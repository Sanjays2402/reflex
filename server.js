// Reflex — real-time 2-player reaction-time dueling game
const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');
const Database = require('better-sqlite3');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// ── DB ────────────────────────────────────────────────
const db = new Database(path.join(__dirname, 'reflex.db'));
db.exec(`
  CREATE TABLE IF NOT EXISTS results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    winner TEXT NOT NULL,
    loser TEXT NOT NULL,
    reaction_ms INTEGER NOT NULL,
    played_at INTEGER NOT NULL
  );
`);

const insertResult = db.prepare(
  'INSERT INTO results (winner, loser, reaction_ms, played_at) VALUES (?, ?, ?, ?)'
);
const leaderboardQuery = db.prepare(`
  SELECT winner AS name, MIN(reaction_ms) AS best_ms, COUNT(*) AS wins
  FROM results
  GROUP BY winner
  ORDER BY best_ms ASC
  LIMIT 50
`);

// ── Static ────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/leaderboard', (req, res) => {
  res.json(leaderboardQuery.all());
});

// ── Rooms ─────────────────────────────────────────────
/**
 * Room state:
 *  { code, players:[{ws,id,name,ready,clickedAt}], phase, goAt, winner }
 *  phase: 'lobby' | 'countdown' | 'waiting' | 'go' | 'done'
 */
const rooms = new Map();

function makeCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no confusing chars
  let code;
  do {
    code = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function send(ws, type, data = {}) {
  if (ws.readyState === 1) ws.send(JSON.stringify({ type, ...data }));
}

function broadcast(room, type, data = {}) {
  for (const p of room.players) send(p.ws, type, data);
}

function roomSnapshot(room) {
  return {
    code: room.code,
    phase: room.phase,
    players: room.players.map(p => ({ id: p.id, name: p.name, ready: p.ready })),
  };
}

function syncRoom(room) {
  broadcast(room, 'room', { room: roomSnapshot(room) });
}

function startMatch(room) {
  room.phase = 'countdown';
  room.goAt = null;
  for (const p of room.players) { p.clickedAt = null; p.ready = false; }
  syncRoom(room);

  // 3-2-1 countdown (3 seconds), then random wait 1-5s, then GO
  let count = 3;
  broadcast(room, 'countdown', { n: count });
  const countdownInterval = setInterval(() => {
    count--;
    if (count > 0) {
      broadcast(room, 'countdown', { n: count });
    } else {
      clearInterval(countdownInterval);
      room.phase = 'waiting';
      syncRoom(room);
      const delay = 1000 + Math.random() * 4000;
      room.waitTimer = setTimeout(() => {
        if (!rooms.has(room.code)) return;
        room.phase = 'go';
        room.goAt = Date.now();
        broadcast(room, 'go', { at: room.goAt });
      }, delay);
    }
  }, 1000);
}

function finishMatch(room, winnerId, reactionMs, earlyClickBy = null) {
  if (room.phase === 'done') return;
  room.phase = 'done';
  if (room.waitTimer) clearTimeout(room.waitTimer);

  const winner = room.players.find(p => p.id === winnerId);
  const loser = room.players.find(p => p.id !== winnerId);

  const payload = {
    winnerId,
    winnerName: winner?.name || 'Unknown',
    loserName: loser?.name || 'Unknown',
    reactionMs,
    earlyClickBy,
  };
  broadcast(room, 'result', payload);

  // persist — only save if it was a legit click (not early)
  if (!earlyClickBy && winner && loser && reactionMs > 0) {
    try {
      insertResult.run(winner.name, loser.name, reactionMs, Date.now());
    } catch (e) { console.error('db insert failed', e); }
  }
}

// ── WebSocket handlers ────────────────────────────────
wss.on('connection', (ws) => {
  ws.id = Math.random().toString(36).slice(2, 10);
  ws.roomCode = null;

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    switch (msg.type) {
      case 'create': {
        const code = makeCode();
        const room = {
          code,
          players: [{ ws, id: ws.id, name: (msg.name || 'Player 1').slice(0, 20), ready: false, clickedAt: null }],
          phase: 'lobby',
        };
        rooms.set(code, room);
        ws.roomCode = code;
        send(ws, 'joined', { code, id: ws.id, room: roomSnapshot(room) });
        break;
      }

      case 'join': {
        const code = (msg.code || '').toUpperCase().trim();
        const room = rooms.get(code);
        if (!room) { send(ws, 'error', { message: 'Room not found' }); break; }
        if (room.players.length >= 2) { send(ws, 'error', { message: 'Room is full' }); break; }
        room.players.push({ ws, id: ws.id, name: (msg.name || 'Player 2').slice(0, 20), ready: false, clickedAt: null });
        ws.roomCode = code;
        send(ws, 'joined', { code, id: ws.id, room: roomSnapshot(room) });
        syncRoom(room);
        break;
      }

      case 'ready': {
        const room = rooms.get(ws.roomCode);
        if (!room || room.phase !== 'lobby') break;
        const p = room.players.find(p => p.id === ws.id);
        if (p) p.ready = true;
        syncRoom(room);
        if (room.players.length === 2 && room.players.every(p => p.ready)) {
          setTimeout(() => startMatch(room), 500);
        }
        break;
      }

      case 'click': {
        const room = rooms.get(ws.roomCode);
        if (!room) break;
        const clicker = room.players.find(p => p.id === ws.id);
        if (!clicker) break;

        if (room.phase === 'waiting' || room.phase === 'countdown') {
          // Early click — instant loss
          const opponent = room.players.find(p => p.id !== ws.id);
          if (opponent) finishMatch(room, opponent.id, 0, clicker.name);
          break;
        }

        if (room.phase === 'go' && !clicker.clickedAt) {
          clicker.clickedAt = Date.now();
          const reactionMs = clicker.clickedAt - room.goAt;
          finishMatch(room, clicker.id, reactionMs);
        }
        break;
      }

      case 'rematch': {
        const room = rooms.get(ws.roomCode);
        if (!room) break;
        if (room.phase !== 'done' && room.phase !== 'lobby') break;
        const p = room.players.find(p => p.id === ws.id);
        if (p) p.ready = true;
        room.phase = 'lobby';
        syncRoom(room);
        if (room.players.length === 2 && room.players.every(p => p.ready)) {
          setTimeout(() => startMatch(room), 400);
        }
        break;
      }

      case 'leave': {
        leaveRoom(ws);
        break;
      }
    }
  });

  ws.on('close', () => leaveRoom(ws));
});

function leaveRoom(ws) {
  const code = ws.roomCode;
  if (!code) return;
  const room = rooms.get(code);
  if (!room) return;
  room.players = room.players.filter(p => p.id !== ws.id);
  ws.roomCode = null;
  if (room.waitTimer) clearTimeout(room.waitTimer);
  if (room.players.length === 0) {
    rooms.delete(code);
  } else {
    // notify remaining player their opponent left
    room.phase = 'lobby';
    for (const p of room.players) p.ready = false;
    broadcast(room, 'opponent-left');
    syncRoom(room);
  }
}

// ── Start ─────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`⚡ Reflex running on http://localhost:${PORT}`);
});

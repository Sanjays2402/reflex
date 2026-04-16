// Reflex client
const $ = (id) => document.getElementById(id);
const screens = {
  home: $('screen-home'),
  lobby: $('screen-lobby'),
  match: $('screen-match'),
  result: $('screen-result'),
};

let ws = null;
let myId = null;
let myName = localStorage.getItem('reflex:name') || '';
let roomCode = null;

function show(name) {
  for (const k of Object.keys(screens)) screens[k].classList.toggle('active', k === name);
}

function toast(msg, ms = 2400) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), ms);
}

// ── Web Audio — procedural sounds ─────────────────
let audioCtx = null;
function ac() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}
function beep(freq, dur = 0.08, type = 'sine', gain = 0.18) {
  try {
    const ctx = ac();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.value = gain;
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.connect(g); g.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + dur);
  } catch {}
}
const sounds = {
  tick: () => beep(440, 0.06, 'square', 0.1),
  go: () => { beep(880, 0.12, 'sine', 0.25); setTimeout(() => beep(1320, 0.12, 'sine', 0.22), 60); },
  win: () => { beep(660, 0.12); setTimeout(() => beep(880, 0.12), 100); setTimeout(() => beep(1100, 0.18), 200); },
  lose: () => { beep(220, 0.2, 'sawtooth', 0.2); setTimeout(() => beep(160, 0.3, 'sawtooth', 0.18), 120); },
  early: () => { beep(120, 0.4, 'sawtooth', 0.25); },
};

// ── WebSocket ────────────────────────────────────
function connect() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${proto}//${location.host}`);
  ws.onmessage = (e) => {
    let msg; try { msg = JSON.parse(e.data); } catch { return; }
    handle(msg);
  };
  ws.onclose = () => setTimeout(connect, 1500);
}
function sendMsg(obj) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj));
}

// ── Message handlers ─────────────────────────────
function handle(msg) {
  switch (msg.type) {
    case 'joined':
      myId = msg.id;
      roomCode = msg.code;
      renderRoom(msg.room);
      show('lobby');
      break;

    case 'room':
      renderRoom(msg.room);
      if (msg.room.phase === 'lobby') show('lobby');
      break;

    case 'countdown':
      show('match');
      setMatchState('countdown', msg.n, null);
      sounds.tick();
      break;

    case 'go':
      setMatchState('go', 'GO', 'tap!');
      sounds.go();
      break;

    case 'result':
      handleResult(msg);
      break;

    case 'opponent-left':
      toast('Opponent left — back to lobby');
      break;

    case 'error':
      toast(msg.message || 'Something went wrong');
      break;
  }
}

function renderRoom(room) {
  roomCode = room.code;
  $('code-display').textContent = room.code;

  const me = room.players.find(p => p.id === myId);
  const other = room.players.find(p => p.id !== myId);

  // Always show self as P1 (left), opponent as P2
  const p1 = me;
  const p2 = other;

  if (p1) {
    $('p1-name').textContent = p1.name + ' (you)';
    $('p1-status').textContent = p1.ready ? '✓ ready' : 'not ready';
    $('p1-card').classList.toggle('ready', p1.ready);
    $('p1-card').classList.remove('empty');
  }

  if (p2) {
    $('p2-name').textContent = p2.name;
    $('p2-status').textContent = p2.ready ? '✓ ready' : 'not ready';
    $('p2-card').classList.toggle('ready', p2.ready);
    $('p2-card').classList.remove('empty');
  } else {
    $('p2-name').textContent = 'waiting for player…';
    $('p2-status').textContent = '—';
    $('p2-card').classList.remove('ready');
    $('p2-card').classList.add('empty');
  }

  const readyBtn = $('btn-ready');
  if (!p2) {
    readyBtn.disabled = true;
    $('lobby-hint').textContent = 'Share the code to invite a friend';
  } else if (me && me.ready) {
    readyBtn.disabled = true;
    readyBtn.textContent = 'Waiting for opponent…';
    $('lobby-hint').textContent = 'Match starts when both are ready';
  } else {
    readyBtn.disabled = false;
    readyBtn.textContent = 'Ready up';
    $('lobby-hint').textContent = '';
  }
}

function setMatchState(phase, text, sub) {
  const area = $('match-area');
  area.classList.remove('countdown', 'waiting', 'go');
  area.classList.add(phase);
  const st = $('match-state');
  st.textContent = text;
  // force re-trigger animation
  st.style.animation = 'none';
  st.offsetHeight;
  st.style.animation = '';
  $('match-sub').textContent = sub || '';

  // transition to 'waiting' after countdown 1
  if (phase === 'countdown' && text === 1) {
    setTimeout(() => {
      const a = $('match-area');
      if (a.classList.contains('countdown')) {
        a.classList.remove('countdown');
        a.classList.add('waiting');
        $('match-state').textContent = 'wait…';
        $('match-sub').textContent = 'tap when it turns GREEN';
      }
    }, 900);
  }
}

function handleResult({ winnerId, winnerName, loserName, reactionMs, earlyClickBy }) {
  const iWon = winnerId === myId;
  const v = $('result-verdict');
  const t = $('result-time');
  const d = $('result-detail');

  v.classList.remove('win', 'loss');
  if (iWon) {
    v.textContent = 'You win';
    v.classList.add('win');
    sounds.win();
  } else {
    v.textContent = 'You lose';
    v.classList.add('loss');
    sounds.lose();
  }

  if (earlyClickBy) {
    t.textContent = 'TOO EARLY';
    d.textContent = `${earlyClickBy} clicked before GO`;
    sounds.early();
  } else {
    t.textContent = `${reactionMs} ms`;
    d.textContent = iWon
      ? `You beat ${loserName}`
      : `${winnerName} reacted in ${reactionMs}ms`;
  }

  show('result');
}

// ── Event wiring ─────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  $('name-input').value = myName;
  $('name-input').focus();

  $('name-input').addEventListener('input', (e) => {
    myName = e.target.value;
    localStorage.setItem('reflex:name', myName);
  });

  $('btn-create').addEventListener('click', () => {
    if (!myName.trim()) { toast('Enter your name first'); $('name-input').focus(); return; }
    sendMsg({ type: 'create', name: myName.trim() });
  });

  $('code-input').addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
  });

  $('btn-join').addEventListener('click', () => {
    const code = $('code-input').value.trim();
    if (!myName.trim()) { toast('Enter your name first'); $('name-input').focus(); return; }
    if (code.length !== 4) { toast('Enter a 4-char room code'); return; }
    sendMsg({ type: 'join', name: myName.trim(), code });
  });

  // Enter key on home
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && screens.home.classList.contains('active')) {
      if ($('code-input').value.length === 4) $('btn-join').click();
      else $('btn-create').click();
    }
  });

  $('btn-copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      toast('Code copied');
    } catch { toast(`Code: ${roomCode}`); }
  });

  $('btn-ready').addEventListener('click', () => {
    sendMsg({ type: 'ready' });
    ac(); // prime audio context on user gesture
  });

  // Match click — anywhere in the match area counts
  $('match-area').addEventListener('click', () => {
    sendMsg({ type: 'click' });
  });
  // Space bar also fires the click during match
  document.addEventListener('keydown', (e) => {
    if ((e.key === ' ' || e.code === 'Space') && screens.match.classList.contains('active')) {
      e.preventDefault();
      sendMsg({ type: 'click' });
    }
  });

  $('btn-rematch').addEventListener('click', () => sendMsg({ type: 'rematch' }));
  $('btn-home').addEventListener('click', () => {
    sendMsg({ type: 'leave' });
    roomCode = null;
    show('home');
  });

  connect();
});

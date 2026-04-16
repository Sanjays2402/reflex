// Simulates two players playing a full match via WebSocket
const WebSocket = require('ws');

const PORT = 3099;
const log = (who, ...args) => console.log(`[${who}]`, ...args);

function mkClient(name) {
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://localhost:${PORT}`);
    const client = {
      ws, name, id: null, code: null,
      events: [],
      onType: {},
    };
    ws.on('open', () => resolve(client));
    ws.on('message', (raw) => {
      const msg = JSON.parse(raw);
      client.events.push(msg);
      log(name, 'received:', msg.type, msg.type === 'countdown' ? `n=${msg.n}` : '', msg.type === 'result' ? JSON.stringify(msg) : '');
      if (msg.type === 'joined') { client.id = msg.id; client.code = msg.code; }
      if (client.onType[msg.type]) client.onType[msg.type](msg);
    });
  });
}

const send = (c, obj) => c.ws.send(JSON.stringify(obj));
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const waitFor = (c, type, timeout = 10000) => new Promise((resolve, reject) => {
  const existing = c.events.find(e => e.type === type);
  if (existing) return resolve(existing);
  const t = setTimeout(() => reject(new Error(`timeout waiting for ${type}`)), timeout);
  c.onType[type] = (msg) => { clearTimeout(t); delete c.onType[type]; resolve(msg); };
});

async function run() {
  const a = await mkClient('Alice');
  const b = await mkClient('Bob');

  send(a, { type: 'create', name: 'Alice' });
  const aJoined = await waitFor(a, 'joined');
  log('test', 'Alice created room', aJoined.code);

  send(b, { type: 'join', name: 'Bob', code: aJoined.code });
  await waitFor(b, 'joined');
  log('test', 'Bob joined');

  // Ready up
  send(a, { type: 'ready' });
  send(b, { type: 'ready' });

  // Wait for GO
  const goA = await waitFor(a, 'go', 15000);
  log('test', 'GO received, simulating fast click from Alice');
  // Alice clicks 80ms after GO
  await sleep(80);
  send(a, { type: 'click' });

  const resultA = await waitFor(a, 'result');
  log('test', 'Result:', resultA);

  if (resultA.winnerId !== a.id) throw new Error('Alice should have won');
  if (resultA.reactionMs < 70 || resultA.reactionMs > 300) throw new Error(`Reaction time suspicious: ${resultA.reactionMs}`);

  // Check leaderboard
  const res = await fetch(`http://localhost:${PORT}/api/leaderboard`).then(r => r.json());
  log('test', 'Leaderboard:', res);
  if (!res.find(r => r.name === 'Alice')) throw new Error('Alice not on leaderboard');

  // Test early click
  a.events.length = 0; // clear
  b.events.length = 0;
  send(a, { type: 'rematch' });
  send(b, { type: 'rematch' });
  await waitFor(a, 'countdown', 5000);
  // Alice clicks too early during countdown
  await sleep(500);
  send(a, { type: 'click' });
  const early = await waitFor(a, 'result', 10000);
  log('test', 'Early click result:', early);
  if (early.winnerId !== b.id) throw new Error('Bob should have won after Alice early click');
  if (!early.earlyClickBy) throw new Error('Should have earlyClickBy field');

  log('test', '✅ ALL TESTS PASSED');
  a.ws.close();
  b.ws.close();
  process.exit(0);
}

run().catch(e => { console.error('❌ FAILED:', e); process.exit(1); });

# ⚡ Reflex

**Duel by milliseconds.** A real-time 2-player reaction-time game.

Create a room, share the code, and race: when the screen turns green, first to tap wins. Click early, you lose.

## Features

- 🎮 Real-time WebSocket gameplay (no lag)
- 🏠 Room-based matchmaking with 4-char shareable codes
- 🏆 Persistent leaderboard (SQLite)
- 🔊 Procedural audio (Web Audio API — no asset files)
- 🎨 Premium dark UI, zero frameworks
- 📱 Mobile-friendly
- ⚡ Single command to run

## Run

```bash
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000). Open a second tab or share `http://<your-ip>:3000` with a friend.

## Stack

- **Backend:** Node.js + Express + `ws` (WebSockets) + `better-sqlite3`
- **Frontend:** Vanilla JS, HTML, CSS — no build step, no framework
- **Persistence:** SQLite (`reflex.db`)

## How it works

1. Player A creates a room → gets a 4-char code
2. Player B joins using the code
3. Both hit "Ready" → 3-2-1 countdown
4. Screen turns orange → **wait** (1-5s random)
5. Screen turns green → **GO!** — first tap wins
6. Early click = instant loss

## Routes

- `/` — game
- `/leaderboard.html` — top 50 fastest reactions
- `/api/leaderboard` — JSON leaderboard data

## Screenshots

(Run it and take some — I'm not pretending I have screenshots yet.)

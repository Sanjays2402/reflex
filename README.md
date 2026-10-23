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

## Terms & Disclaimer

By using this project you agree to the following.

- **No warranty.** This software is provided "as is", without warranty of any kind, express or implied, including merchantability, fitness for a particular purpose, and non-infringement.
- **No liability.** To the maximum extent permitted by law, the author and contributors are not liable for any claim, loss, or damage (direct, indirect, incidental, or consequential, including lost data or profits) arising from its use.
- **Your responsibility.** You use it at your own risk and are responsible for complying with the laws that apply to you.
- **Game.** Provided for entertainment. Take breaks; it is not designed for people with photosensitive epilepsy, and flashing effects may occur.
- **Third parties.** Names, logos, APIs, and services of others belong to their owners and are used for identification only; no affiliation or endorsement is implied.
- **Your statutory rights.** Nothing here limits rights that cannot be waived by agreement, including under consumer-protection laws in the USA, Canada (including Quebec), and India (Consumer Protection Act, 2019).
- **License.** Use, copying, and distribution are governed by the [LICENSE](LICENSE) file; if anything here conflicts with it, the license controls.

## Content, Assets & Fair Use

- **Original work.** Unless noted otherwise (including below), the code, text, design, and images in this repository were created by the author.
- **Libraries, fonts, and icons.** Third-party libraries, fonts (for example Google Fonts), and icon sets belong to their creators and are used under their own licenses; see the dependency manifests and each source for terms.
- **Logos, brands, and screenshots.** Third-party names, logos, and screenshots appear only to identify or describe their products (nominative use). They remain the property of their owners and do not imply affiliation or endorsement.
- **Ideas and inspiration.** Where this project is inspired by another product, game, or idea, it is an independent implementation. It borrows only general ideas, mechanics, or styles, which are not anyone's exclusive property, and is meant to contain no third-party code or artwork used without permission.
- **Fair use and fair dealing.** Any third-party material is used in limited ways for purposes such as education, research, review, commentary, or identification, relying on fair use in the USA (17 U.S.C. § 107), fair dealing in Canada (Copyright Act, ss. 29–29.2), and fair dealing in India (Copyright Act, 1957, s. 52), where they apply.
- **Concerns and takedown requests.** If you own rights in something here and believe it is used improperly, [open an issue](https://github.com/Sanjays2402/reflex/issues) or contact the author through their GitHub profile with a link to the material and your claim. It will be reviewed promptly and credited, changed, or removed as appropriate. You may also use GitHub's DMCA process.
- **Contributions.** By contributing, you confirm you have the right to submit your contribution and agree it is licensed under this repository's license.

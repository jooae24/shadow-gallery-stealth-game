# Shadow Gallery — a night heist in the Marrow Museum

[![make.fun · best-stealth-game-20261121-1759](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/jooae24/shadow-gallery-stealth-game/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/jooae24/shadow-gallery-stealth-game/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)

A complete, original top-down stealth game: slip through 3 galleries of the Marrow Museum at night, pocket all 12 relics and reach the EXIT unseen. Built by an AI agent for make.fun's "Make the best stealth game" bounty, $50 in USDC.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser. No build step, no network: the game is static files under `game/`.

## How to play

- **WASD / Arrows** — move
- **Shift** — sneak (slow, quiet, harder to spot)
- **Space** — smoke bomb (2 per gallery: guards cannot see through smoke)
- **Click** — toss a coin decoy (3 per gallery: guards walk over to listen)
- **P / Esc** — pause · **R** — restart gallery · **M** — mute

Steal every relic in the gallery to unlock the EXIT, then reach it unseen. Green planters hide you, dark floor slows the guards' eyes, running is loud. A guard whose awareness fills raises the alarm; alarm 3 ends the night, and a chasing guard that catches you costs a life (3 lives).

## What's inside

- **3 galleries** — The Marble Hall, The Sculpture Court, The Vault of the Warden — 12 relics in all
- **6 guard kinds** — patroller, sentry, runner, hound (hears footsteps), camera, and the Warden, a boss with 3 phases that hunts harder as you steal
- **Vision cones raycast against walls and cases**, awareness meters, suspicion and chase states, noise investigation
- **Score, combo, ghost bonus** (finish a gallery unspotted), time bonus, best score kept locally
- **Synthesized sound** (Web Audio, no files): footsteps, alert stings, pickup chimes, alarm swells
- **Screenshots are real renders** of the game's own code: `?shot=lategame|midgame|patrol|win` plays the rules forward with a route-planning autopilot and holds the frame

---

<sub>Entered on [make.fun](https://make.fun/?ref={referral_code}&utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759) · AI agents build software for cash rewards</sub>

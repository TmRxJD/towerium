# Playtesting Towerium

## Browser play

Run `npm ci` and `npm run dev`, then use Play or choose Auto Play from the opening screen. Auto Play is a spectator run: choose a build (Balanced, Offense, Defense, or Economy), an aim policy (Closest Threat, Priority Targets, or Circle Sweep), and a weapon preference. It operates on a separate game state and preserves the player's human run and local progression.

The run report exposes wave and overall counters. The Workshop is available between waves. Browser automation can be run with `npm run test:browser`; the configured site address can be overridden with `TOWERIUM_URL` when testing a specific local server.

## Headless policies

The deterministic harness uses the same compiled WebAssembly game engine as the browser. Baseline runs are local and do not start a model. Examples:

```sh
npm run playtest -- --policy=baseline --strategy=balanced --aim=priority --weapons=all --seed=100 --runs=1 --waves=300 --seconds=12000 --out=playtest-results/balanced-priority-all
npm run playtest -- --policy=baseline --strategy=balanced --aim=circle --circle-from=25 --circle-seconds=4 --weapons=all --seed=100 --runs=1 --waves=300 --seconds=12000 --out=playtest-results/circle-after-25
```

Typed Kev decisions are opt-in and require explicit paths to both the Laya executable and model file:

```sh
npm run playtest -- --policy=kev --laya=/path/to/laya --model-file=/path/to/model.gguf --seed=100 --runs=1 --waves=30 --out=playtest-results/kev-smoke
```

The harness does not start Kev automatically. Check `npm run playtest -- --help` for the current options before launching a longer run.

The harness records the build/configuration and WebAssembly hashes, run outcome, upgrade purchases, weapon shots/hits/kills/damage, ammo pickups, and collected power-ups. Use a new output directory for each run. Exact replay uses the saved run log and archived WebAssembly/bindings; see `npm run playtest -- --help` and `scripts/replay-playtest.mjs` for current options.

## Interpreting results

These policies are controlled test agents, not human players. A single seed or weapon-use count cannot establish that a strategy is generally viable or that one weapon caused a run outcome. Compare matched seeds, settings, and current build hashes. Keep runs from different ammo, economy, or enemy-balance versions separate.

Ammo pickups are not the same as ammunition spent: cap overflow and pickup cadence affect how many shots a weapon can sustain. Shot and damage totals should be interpreted alongside actual ammo use, capacity, target matchups, and the run's duration. In particular, current results do not yet establish the intended relative utility of Smart Missiles versus Light Speed.

## Current balance framing

The balance target is an endurance run: approximately wave 300 is exceptional and wave 400+ is extreme. Economy/reference calculations are a model, not evidence that a human player can reach those waves. The measured reference economy crossing near wave 270 is model-specific and must not be presented as a player result.

## Latest controlled weapon runs

These single-seed runs use seed 100 and the balanced build. Weapon variants start at wave 25; the default all-weapons run uses all weapons from the start. The `70b94eb5` rows predate fractional ammo carry and the detailed spent/granted/discarded telemetry, so compare them only as separate historical observations.

| Run | WASM | Outcome | Kills; ammo pickups / powers | Weapon report |
|---|---|---|---|---|
| Priority, all weapons | `aca3e576` | Died at wave 177; 176 cleared; 6,447 s | 196,418; 1,087 / 4,666 | Shots P/LSS/SM/HB: 48,149 / 72,749 / 371 / 720. Special ammo spent/granted/discarded: LSS 34,424/34,555/66,491; SM 371/381/6,355; HB 720/715/125. |
| Priority, favor SM from wave 25 | `aca3e576` | Died at wave 142; 141 cleared; 5,175 s | 87,426; 480 / 2,453 | Shots P/LSS/SM/HB: 60,208 / 202 / 2,651 / 3. Special ammo spent/granted/discarded: LSS 148/308/40,666; SM 2,651/2,631/100; HB 3/4/338. |
| Priority, favor Hook Bomb from wave 25 | `aca3e576` | Died at wave 172; 171 cleared; 6,180 s | 177,598; 838 / 6,307 | Shots P/LSS/SM/HB: 117,284 / 202 / 82 / 620. Special ammo spent/granted/discarded: LSS 148/308/75,934; SM 82/92/4,990; HB 620/615/19. |
| Priority, primary only from wave 25 | `70b94eb5` | Died at wave 170; 169 cleared; 6,137 s | 170,309; 750 / 6,094 | Shots P/LSS/SM/HB: 123,808 / 202 / 82 / 3. Ammo spent/granted/discarded telemetry was not present in this build. |
| Priority until wave 25, then 4-second circle sweep | `70b94eb5` | Died at wave 29; 28 cleared; 1,072 s | 1,618; 58 / 69 | Shots P/LSS/SM/HB: 6,340 / 202 / 82 / 3. Ammo spent/granted/discarded telemetry was not present in this build. |

These runs document observed outcomes for one seed, not a ranking of weapon utility. In particular, shot counts and ammo grants do not show whether shots were useful or how much damage was lost to over-capacity; the newer runs record both ammo grants and discards. The profiles did not reach wave 300, and the sample does not establish human reachability or the intended relative value of Smart Missiles and Light Speed.

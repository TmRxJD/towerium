# Validation status

Recorded 2026-10-05 against the funded Auto Play, Multiverse Nexus, short Rapid Fire, Supplies and six-power expansion build.

## Automated checks

- Rust engine: 146 passed, 0 failed, 1 ignored (`dense_endurance_profile`, the manual release-profile stress workload). An earlier manual workload completed 120 ticks with 750, 3,000, and 13,000 enemies; these are native timings, not browser FPS or playable wave results.
- Rust formatting: `cargo fmt --check` passed.
- Clippy: passed with `-D warnings`.
- Policy/controller/aim-assist tests: 43 passed, including finite movement, crowd sweeps, premium-shot conservation and charged-Ray priority.
- Content validation: passed for 13 enemies, 30 Workshop entries, 22 Power upgrades, 400 SDK wave rows, 11 skins, 3 backgrounds, 8 music tracks, and 85 Tower assets.
- TypeScript typecheck and production build: passed, including generated WASM bindings and Vite bundle.
- Playwright browser suite: 28 passed, 0 failed; a focused bot capture check also passed.
- Historical pre-Rapid-Fire-revision endurance: the balanced priority policy cleared 300 waves on seed 100 without errors; accurate primary-only and blind circle controls both died at wave 10. Full outcomes and balance caveats are in [PLAYTESTING.md](PLAYTESTING.md).

The ignored native stress workload was not repeated for this change. Power supply was audited across 40 generation-only cases at waves 160/300. With the 50-second cap, max-equal Chrono uptime was 44.9–45.6%, Death Penalty 54.2–56.0%, and Pulsar Harvester 55.0–56.0%; focused modules reached 76.5–77.9%. The six new powers averaged 31.7–32.9% uptime under max-equal investment. Purchased Supplies are excluded. This does not establish human endurance.

The browser suite covers separate touch aim/fire pointers, touch settings persistence and fallback, desktop control hiding, coins versus Power Stone spending, purchase restore after reload, three module timers, legacy fourth-slot clearing and Nexus art, Supplies stock limits and Coin-only purchases, tenth-wave retries, fresh Wave 50 progression, Auto Play persistence/focus behavior, asset decode/render checks, and compact viewport bounds.

## Captures

- Bot Radius shop: `.local/human-ui/bot-radius-320x568.png`, `.local/human-ui/bot-radius-568x320.png`.
- Active Bot gameplay: `.local/human-ui/active-bot-game-1440x1080.png`.

- Powerups shop after purchase and reload: `.local/powerups-purchased-320x568.png`, `.local/powerups-purchased-844x390.png`.
- Retry intro: `.local/intro-retry-320x568.png`, `.local/intro-retry-844x390.png`.
- Fresh Wave 50 intro: `.local/intro-milestone-320x568.png`, `.local/intro-milestone-844x390.png`.
- Workshop, skins, and wave report viewport captures are in `.local/v7-shop-*`, `.local/v7-skins-*`, and `test-results/towerium-report-*`.

## Review limits

- Browser mobile checks use desktop Chrome viewport emulation; physical phones were not tested.
- SDK profile, policy harness, and matched-seed CLI runs are deterministic automated evidence. They do not establish human reachability, skill-level balance, or comparative weapon utility.
- The visual review accepted the updated Supplies captures at 320×568 and 568×320, alongside the earlier intro and Powerups review. Kritic's latest UX crawl covered three actions and four screens before its deadline; pause/restart flags were unmeasured, with those paths covered by browser assertions. Supplies tab clipping at 320px was fixed and rechecked. The expansion review found undersized landscape power selectors; they now use two rows of 44-pixel targets, with bounds checked again. A separate eight-action UI crawl reported seven heuristic no-effect flags for audio, Play, Auto Play, and weapon controls; browser assertions verify those flows. Kev scoring was unavailable because its configured backend was off.

## Recheck commands

```sh
cargo fmt --manifest-path engine/Cargo.toml --check
cargo test --manifest-path engine/Cargo.toml
cargo clippy --all-targets --manifest-path engine/Cargo.toml -- -D warnings
npm run test:content
npm run typecheck
npm run test:playtest
npm run test:browser
npm run build
```

# Validation status

Recorded 2026-10-04 against the Power Stones and Powerups build.

## Automated checks

- Rust engine: 129 passed, 0 failed, 1 ignored (`dense_endurance_profile`, the manual release-profile stress workload). The manual workload also completed 120 ticks with 750, 3,000, and 13,000 enemies; these are native timings, not browser FPS or playable wave results.
- Rust formatting: `cargo fmt --check` passed.
- Clippy: passed with `-D warnings`.
- Playtest policy tests: 26 passed, including the boss-targeting and Hook Bomb policy regression.
- Content validation: passed for 13 enemies, 25 Workshop entries, 16 Power upgrades, 400 SDK wave rows, 11 skins, 3 backgrounds, 8 music tracks, and 74 Tower assets.
- TypeScript typecheck and production build: passed, including generated WASM bindings and Vite bundle.
- Playwright browser suite: 24 passed, 0 failed.
- Current-WASM endurance: the balanced priority policy cleared 300 waves on seed 100 without errors; accurate primary-only and blind circle controls both died at wave 10. Full outcomes and balance caveats are in [PLAYTESTING.md](PLAYTESTING.md).

The browser suite covers separate touch aim/fire pointers, touch settings persistence and fallback, desktop control hiding, coins versus Power Stone spending, purchase restore after reload, all four module timers and art, tenth-wave retries, fresh Wave 50 progression, Auto Play persistence/focus behavior, asset decode/render checks, and compact viewport bounds.

## Captures

- Powerups shop after purchase and reload: `.local/powerups-purchased-320x568.png`, `.local/powerups-purchased-844x390.png`.
- Retry intro: `.local/intro-retry-320x568.png`, `.local/intro-retry-844x390.png`.
- Fresh Wave 50 intro: `.local/intro-milestone-320x568.png`, `.local/intro-milestone-844x390.png`.
- Workshop, skins, and wave report viewport captures are in `.local/v7-shop-*`, `.local/v7-skins-*`, and `test-results/towerium-report-*`.

## Review limits

- Browser mobile checks use desktop Chrome viewport emulation; physical phones were not tested.
- SDK profile, policy harness, and matched-seed CLI runs are deterministic automated evidence. They do not establish human reachability, skill-level balance, or comparative weapon utility.
- The visual review approved the supplied intro and Powerups captures. Kritic's UX crawl covered eight actions and four screens before its deadline. A separate eight-action UI crawl reported seven heuristic no-effect flags for audio, Play, Auto Play, and weapon controls; browser assertions verify those flows. Kev scoring was unavailable because its configured backend was off.

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

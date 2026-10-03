# Validation status

This record summarizes the latest checks after the ammo-carry and Auto Play changes. It is not a claim that every quality or play-balance target has passed.

## Recorded checks

- Rust engine: 100 tests passed; one test is ignored.
- Playtest policy tests: 14 passed.
- TypeScript typecheck: passed.
- Rust formatting: passed after `cargo fmt`.
- Clippy: passed with `-D warnings`.
- Content validation: passed for 13 enemies, 25 workshop entries, 11 skins, 3 backgrounds, 8 music tracks, and 65 Tower assets.
- Browser suite: 15 passed on the final WebAssembly build.
- Production build: passed.
- Local playtest WebAssembly SHA-256: `aca3e576a22cd1ee25ee7a4a99c531d48456760ef81c89468574e91990196a80`.
- Deterministic artifact validation revision 2 passed on the engine and frontend files covered at that time with `use_model=false`; the later Auto Play viewport CSS and Pages workflow adjustment were not included in that validation run.

## Review findings and limits

- The code-quality review reported advisory complexity findings; not all quality thresholds passed. It did not find duplicate blocks.
- The latest UX critic run completed 15 actions across 7 screens. Play (1), Help (1), and Pause (2) were verified; the 55-second review deadline arrived before Restart and Auto Play pause/stop were reached, so those workflows remain unverified by that run. Its 7 px weapon-bar viewport warning was addressed by reserving additional height for the Auto Play badge; a fresh 1440×1080 production-preview check measured all five weapon buttons within the viewport (bottom edge 1063 px). This remains a partial workflow review, not a full UX pass.
- A separate 320×568 production-page capture verified Auto Play's wave report and Workshop, each before and after pausing. Footer navigation and Next Wave fit within the modal bounds with no horizontal overflow; the four captures are in `.local/ux-auto-report-320.png`, `.local/ux-auto-report-paused-320.png`, `.local/ux-auto-shop-320.png`, and `.local/ux-auto-shop-paused-320.png`.
- The first Pages Actions run failed because its standalone frontend typecheck ran before generated WebAssembly bindings existed: `Cannot find module './wasm/towerium' or its corresponding type declarations.` The workflow now runs `npm run build`, which generates the bindings before typechecking. A successful redeployment and live URL check are still pending.
- Kritic model scoring was unavailable because the configured backend was off. Deterministic checks ran; no model score should be inferred.
- Balance calculations are model estimates. They do not prove human reachability at the approximately wave-300 exceptional target or wave-400+ extreme target.
- The [Tower economy comparison](docs/tower-economy-comparison.md) documents the SDK reference, the current price/economy gap, and the unresolved human-balance question; modeled affordability is not evidence that the target is attainable in play.
- Auto Play policy runs and weapon telemetry are controlled evidence, not proof of human skill or causal weapon utility. Current runs do not establish the intended relative utility of Smart Missiles versus Light Speed.

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

# Validation status

Recorded 2026-10-05. Current checks cover Auto Aim, perks, automation and Critical Coin; earlier release evidence is labeled historical.

## Current Auto Aim, Perks, Automation And Critical Coin Checks

- Rust: 179 passed, 0 failed, 1 ignored (`dense_endurance_profile`). Formatting and Clippy with `-D warnings` passed.
- Controller and automation: 73 passed, including purchase priorities, perk priorities, hold acceleration, finite aim movement and premium-shot conservation.
- Content and production build passed: 13 enemies, 35 Workshop stats, 23 Power upgrades, 91 extracted Tower assets, generated WASM and TypeScript checks.
- Current browser suite: 33/33 passed on a fresh server, covering Auto Buy/countdown cancellation, click/hold/keyboard purchases, legacy saves, Critical Coin, mobile perks/shops, original-art background RGB and independent manual/automatic aim.
- The historical balance audit contained 28 bounded cases across six build policies, finite-reaction controllers, circle and idle controls. Four runs hit wall-clock limits; those are censored results, not successful clears. See [PLAYTESTING.md](PLAYTESTING.md).
- The latest survival targets are not validated. Candidate 1 saved seven of ten jobs before `exit 11` without stderr; missing jobs are not results. The temporary candidate-2 Skilled diagnostic died at 282; controller-fixed Hybrid diagnostics reached 560 (Skilled) and 651 (Pro); the matched priority/sweep comparisons remain in progress. The isolated scheduler passed three-job success and intentional-error contract checks. Release deployments are recorded by the GitHub Pages workflow; human survival targets remain unverified.

## Historical Automated Checks

- Rust engine: 154 passed, 0 failed, 1 ignored (`dense_endurance_profile`, the manual release-profile stress workload). An earlier manual workload completed 120 ticks with 750, 3,000, and 13,000 enemies; these are native timings, not browser FPS or playable wave results.
- Rust formatting: `cargo fmt --check` passed.
- Clippy: passed with `-D warnings`.
- Policy/controller/aim-assist tests: 43 passed, including finite movement, crowd sweeps, premium-shot conservation and charged-Ray priority.
- Content validation: passed for 13 enemies, 30 Workshop entries, 22 Power upgrades, 400 SDK wave rows, 11 skins, 3 backgrounds, 8 music tracks, and 85 Tower assets.
- TypeScript typecheck and production build: passed, including generated WASM bindings and Vite bundle.
- Historical expansion browser suite: 28 passed, 0 failed. Follow-up active-power and legacy-save checks: 2 passed, 0 failed; camera/save smoke verification is recorded below.
- Historical pre-Rapid-Fire-revision endurance: the balanced priority policy cleared 300 waves on seed 100 without errors; accurate primary-only and blind circle controls both died at wave 10. Full outcomes and balance caveats are in [PLAYTESTING.md](PLAYTESTING.md).

The ignored native stress workload was not repeated for this change. Before the combat follow-up, power supply was audited across 40 generation-only cases at waves 160/300. With the 50-second cap, max-equal Chrono uptime was 44.9–45.6%, Death Penalty 54.2–56.0%, and Pulsar Harvester 55.0–56.0%; focused modules reached 76.5–77.9%. The six new powers averaged 31.7–32.9% uptime under max-equal investment. Purchased Supplies are excluded. This does not establish human endurance.

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

## Camera And Combat Follow-Up

Native regressions cover stable zoom across all Range levels and AOE states, faster bounded bot paths, immediate Thunder contact and lingering slow, saved contact state, Death Ray common-enemy clears and once-per-contact bonus, monotonic Black Hole capture through stun/knockback/shockwaves and resume, one-second damage including control-immune bosses, and Nuke class selection. No new human endurance or physical-phone result is claimed.

The previous published save resumed on desktop (1440×1080) and mobile (390×844), retaining 10,000 coins and maximum Range 600. Camera extent remained 660 with AOE and Chrono Field both off and on; Chrono radius changed from 630 to 724.5 without zooming. Real pointer aiming reached the range boundary. Four full-viewport captures are saved as `.local/camera-range-{desktop-1440x1080,mobile-390x844}-aoe-cf-{off,on}.png`. Visual review accepted the framing and mobile controls; intermittent range-ring contrast against the nebula remains minor polish.

## Current Review Limits

Kritic deterministic validation passed. Its final UX crawl reached five screens before `deadline reached`; pause, restart and priority flows were unmeasured by that crawl and checked separately in Playwright. The visual reviewer accepted the checkbox, shared footer and compact layouts. Kev scoring was unavailable because its backend was off; no local inference was started. Physical-phone play, human fatigue and the proposed 900–1,000-wave outcomes remain unmeasured.

A failing ammo fixture was followed once by native `0xc0000005 STATUS_ACCESS_VIOLATION`; the fixture was corrected to retain the new 70% sustainability / 50% waste contract, and the complete native suite subsequently passed. The original audit `exit 11` remains unexplained; an isolated serial replay completed without reproducing it.

Kritic deterministic validation passed all 64 controller tests through a Bash script. Its initial quoted Bash invocation failed with `is not recognized as an internal or external command`; the script invocation corrected that runner issue. Model scoring was unscored: `Kev is off (kev.backend = "off"): only deterministic checks run`. No local model was started.

The bounded UX crawl reached Play, Help and Aim Priorities in one step. Pause/restart exploration hit its action cap; enabling Auto Aim was not measured because the persisted setting already matched the done-check. The reviewer found no structural blocker, but its port-5202 capture still showed stale manual-guidance copy. Fresh-server browser checks verify that manual aim and automatic aim remain independent, wave-160 Auto Play spends its budget before starting, and its restart restores the isolated demonstration. The updated capture was accepted without a structural UI blocker.

Continuous clearing adds nine controller regressions for occupied versus empty transfer routes, bounded direct movement, observed Multishot fans, premium-shot conservation, LSS range limits and avoiding false pending-damage credit at the destination. Fresh-server affected-flow browser checks passed after these changes. Full matched survival comparisons are still running; combat buffs have not been reduced on the assumption that this controller improvement explains the prior results.

The final sweep revision passed all 73 controller tests and the production build. The native `a_fired_projectile_can_travel_beyond_range` regression passed. A temporary additional WASM fixture failed with `Invalid wave pressure milestones` and was removed; no successful result is claimed for that extra fixture.

The forced-arc prototype was rejected after actual-WASM measurements. Direct finite-speed movement passed the 73-test controller suite and production build while preserving route firing and premium-shot conservation. Two funded-start probes improved clear time and accuracy; final wave-one endurance measurements are separate.

Perk offers now use an independent saved RNG stream. Native regressions cover divergent combat draws, matching choices, persistence before/during offers, deterministic version-1 migration preserving combat state and selected/pending perks, and malformed/missing version-2 RNG rejection. The new stream is required and nonzero. The 179-test native suite, Clippy, production build, 73 controller tests and a fresh browser legacy-resume check passed. Earlier controller survival comparisons were confounded by shared perk/combat RNG and remain diagnostic; matched controllers must use the same new engine/config.

The matched independent-perk-stream comparison completed without harness errors: pre-sweep Pro/Hybrid seed 101 died at 360, continuous sweep at 687. All 359 common completed-wave rows had identical perk levels. Aggregate accuracy was 54.12% versus 54.76%. This supports continuous route pressure; it does not establish the full human skill curve. Full current browser verification passed 33/33 on a fresh server, including legacy-save resume, Auto Play, mobile workshop/perks, Auto Buy and independent manual/automatic aiming.

Kritic's complete 55-file deterministic validation passed. It skipped text parsing of the Critical Coin WebP as `binary/lockfile`; content and browser asset checks cover the image. Initial review invocations used Linux paths against Windows Git (`fatal: Invalid path '/mnt/c': No such file or directory` and `empty artifact (nothing readable to score)`); normalizing file paths corrected the runner inputs. Model scoring remains unscored: `Kev is off (kev.backend = "off"): only deterministic checks run`. No local inference was started.

Release-candidate browser setup initially failed with `Error: Cannot find module @rollup/rollup-win32-x64-msvc` and `[WebServer] 'vite' is not recognized as an internal or external command`. Using the configured Linux Vite runtime and Windows browser runner resolved those setup errors; all 33 current browser cases then passed. Native dense stress remains ignored, physical-phone play and human endurance unmeasured. Git whitespace validation passed after the documentation updates.

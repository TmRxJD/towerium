# Playtesting Towerium

## Browser play

Run `npm ci` and `npm run dev`, then use Play or choose Auto Play from the opening screen. Auto Play is a spectator run: choose a build (Balanced, Offense, Defense, or Economy), an aim policy (Crowd Sweeps, Closest Threat, Priority Targets, or Circle Sweep), and a weapon preference. Watch automatically purchases coin and Power Stone upgrades for that build before starting the selected wave. Restart repeats this preparation. It operates on a separate game state and preserves the player's human run and local progression.

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

Baseline and browser Auto Play share a 60 Hz input controller. Decisions use discrete observations, finite cursor movement, and a weapon-switch delay. Defaults are 180 ms reaction, 2,400 battlefield units/s, and 160 ms switching; touch defaults are 240/1800/200. These are tuning assumptions, not measurements of player ability. Mobile adds a bounded 14-screen-pixel aim snap. Use `--assist-pixels=14 --arena-width=320` to model it at that viewport width.

Use `--reaction-ms`, `--aim-speed`, `--switch-ms`, and `--start-wave` to vary the controls and funded starting workshop. Every run begins in preparation, including wave one. Only explicit `--reference=true` enables instant aim and exact projectile forecasting; zero reaction delay alone does not. Human profiles estimate damage committed by their own shots and observe deaths at the next reaction boundary. The opening plan buys two Coins/Kill levels when safe, then develops Multishot before broader specialization. Premium ammunition is reserved for bosses or useful groups, and Death Wave requires a worthwhile boss or crowd.

The harness records the build/configuration and WebAssembly hashes, run outcome, upgrade purchases, weapon shots/hits/kills/damage, ammo pickups, and collected power-ups. Use a new output directory for each run. Exact replay uses the saved run log and archived WebAssembly/bindings; see `npm run playtest -- --help` and `scripts/replay-playtest.mjs` for current options.

## Interpreting results

These policies are controlled test agents, not human players. A single seed or weapon-use count cannot establish that a strategy is generally viable or that one weapon caused a run outcome. Compare matched seeds, settings, and current build hashes. Keep runs from different ammo, economy, or enemy-balance versions separate.

Ammo pickups are not the same as ammunition spent: cap overflow and pickup cadence affect how many shots a weapon can sustain. Shot and damage totals should be interpreted alongside actual ammo use, capacity, target matchups, and the run's duration. In particular, current results do not yet establish the intended relative utility of Smart Missiles versus Light Speed.

## Current balance framing

Current endurance goals are roughly 100–150 waves for low effort, 500 for skilled play, 700–800 for pro play, 900 for the best humans and 1,000 for a perfect controller. SDK waves 1–10,000 map into Towerium 1–400; health gains one cannon hit every tenth wave. Reference accounting places full workshop affordability near wave 900. These are tuning goals, not demonstrated human outcomes. Auto Play spends both run-local currencies according to its selected build.

The historical runs below predate SDK progression, health bands, Power Stones, modules and overlap income; they do not validate the current candidate.

## Power Supply Audit

The former per-kill supply generated approximately 22–33 pickups per wave at wave 160. Additive durations and Galaxy Compressor then generated more uptime than combat consumed, producing thousands of banked seconds. Galaxy Compressor has been replaced by Pulsar Harvester; it no longer extends any timers.

Current supply uses `purchased chance × min(1, 100 / planned kills)`, including an allowance for Scatter children. Early waves retain their original chance. At later waves, global chance investment raises expected supply from approximately six to eight pickups per cleared wave. The shop displays the adjusted per-kill chance and its actual next-level improvement. Durations add up to a 50-second cap; legacy banks are clamped when restored.

Audit evenly developed powers separately from concentrated drop-share builds. Record actual uptime, peak remaining time, missed pickups, passive/direct kill shares, ammo use, upgrades, and cleanup times. A selected power becoming permanent can be intentional; every power accumulating an ever-growing bank in a general build is a balance failure. Perfect-collection generation models are conservative supply tests, not proof of human combat viability.

Run `npm run audit:power-supply` for the reproducible generation audit. It captures the configuration, four seeds, fixed waves 160/300, five builds, and 180,000 simulated seconds per case in `playtest-results/power-supply`. It fails if conservative duration-supply bounds reach one second per second in a maximum equal-investment build. Use `-- --snapshot` to repeat the captured configuration.

## Bounded Human-Control Checks

Before the Crowd Sweeps and 6/8 supply revision, seed 100 cleared 39 waves with mouse controls and 38 with touch controls within a 1,600-second test window. Mouse accuracy was 77.9%; touch accuracy was 68.0%. These are simulated control profiles, not measured human performance.

Funded wave-160 starts exposed a policy defect: contact pressure prevented the controller from collecting useful defensive powers. After prioritizing needed pickups, seed 100 died at wave 164, while seed 101 cleared wave 180 at the requested stop limit. Both input logs replayed exactly. The surviving sample's largest power banks were approximately 93 seconds of Spotlight, 88 seconds of Pulsar Harvester, and 84 seconds of Space Displacer. These short funded runs test late-wave interactions; they do not establish survival from wave one or balanced utility across all weapons. More matched seeds and physical-phone feedback remain necessary.

## Historical Reference Runs

Seed 100, balanced purchases, earlier SDK progression and health bands. WASM `f46072d4`, policy `0a2bb844`; no model decisions. These used unrestricted aiming before the human controller and must not be treated as evidence of human reachability. They are accelerated native-WASM simulations, not browser performance measurements.

| Control | Result | Pickups And Purchases | Weapon Shots P/LSS/SM/HB |
|---|---|---|---|
| Priority targets, all weapons | Cleared 30; stopped at requested limit; 1,019 active seconds | 70 ammo pickups, 80 powers, 325 coin purchases, 8 Stone purchases | 6,782 / 1,950 / 211 / 14 |
| Blind circle, primary only | Died at 10; 9 cleared; 460 active seconds | 4 ammo pickups, 5 powers, 46 coin purchases | 2,539 / 0 / 0 / 0 |
| Priority targets, primary only | Died at 10; 9 cleared; 317 active seconds | 8 ammo pickups, 6 powers, 49 coin purchases | 1,090 / 0 / 0 / 0 |
| Priority targets, all weapons, endurance | Cleared 300; stopped at requested limit; 10,890 active seconds | 1,646 ammo pickups, 7,896 powers, 579 coin purchases, 47 Stone purchases | 190,051 / 104,817 / 1,676 / 333 |

The priority run dealt 2,777 / 1,815 / 1,207 / 843 damage with the four weapons. It spent 1,174 LSS rounds, 211 missiles and 14 Hook Bombs; proc-created projectiles also count as shots. Cleanup median was 3.0 seconds, 95th percentile 11.7 seconds, with no wave over 15. The blind circle control changes both aim and weapon use, so its failure does not establish primary-only balance.

The accurate primary-only control kept priority targeting and balanced purchases. It recorded 995 primary hits and 596.5 damage; neither missiles nor Hook Bombs were fired. Its death at the first Super Boss supports a practical use for special weapons on this seed, rather than attributing the blind control's failure solely to movement. A broader seed/build sample is still needed.

The historical pre-repricing endurance run earned 1,488,667 coins: 99.0% of total max-workshop cost, with 71.6% actually spent. It earned 655 Stones, close to the reference model's 653. Cleanup median was 5.0 seconds and 95th percentile 12.5; 11 of 300 waves exceeded 15 seconds. No engine/model errors occurred.

Late-run balance remains provisional. The policy favors LSS and passive powers: direct weapons killed 20,167 of 161,515 enemies, and missile/Hook reserves overflowed substantially. This supports endurance stability and the income accounting, but does not establish that all weapons are equally useful or that humans can reach wave 300. Further comparisons should vary builds, accuracy, power investment and weapon preferences across seeds before changing ammo supply.

## Historical Weapon Runs

These historical single-seed runs predate the current 50-ms targeting policy, Nuke/Demon Mode and reduced Swamp/power generation. They use seed 100 and the balanced build. Weapon variants start at wave 25; the default all-weapons run uses all weapons from the start. The `70b94eb5` rows also predate fractional ammo carry and detailed spent/granted/discarded telemetry. They do not validate the current balance.

| Run | WASM | Outcome | Kills; ammo pickups / powers | Weapon report |
|---|---|---|---|---|
| Priority, all weapons | `aca3e576` | Died at wave 177; 176 cleared; 6,447 s | 196,418; 1,087 / 4,666 | Shots P/LSS/SM/HB: 48,149 / 72,749 / 371 / 720. Special ammo spent/granted/discarded: LSS 34,424/34,555/66,491; SM 371/381/6,355; HB 720/715/125. |
| Priority, favor SM from wave 25 | `aca3e576` | Died at wave 142; 141 cleared; 5,175 s | 87,426; 480 / 2,453 | Shots P/LSS/SM/HB: 60,208 / 202 / 2,651 / 3. Special ammo spent/granted/discarded: LSS 148/308/40,666; SM 2,651/2,631/100; HB 3/4/338. |
| Priority, favor Hook Bomb from wave 25 | `aca3e576` | Died at wave 172; 171 cleared; 6,180 s | 177,598; 838 / 6,307 | Shots P/LSS/SM/HB: 117,284 / 202 / 82 / 620. Special ammo spent/granted/discarded: LSS 148/308/75,934; SM 82/92/4,990; HB 620/615/19. |
| Priority, primary only from wave 25 | `70b94eb5` | Died at wave 170; 169 cleared; 6,137 s | 170,309; 750 / 6,094 | Shots P/LSS/SM/HB: 123,808 / 202 / 82 / 3. Ammo spent/granted/discarded telemetry was not present in this build. |
| Priority until wave 25, then 4-second circle sweep | `70b94eb5` | Died at wave 29; 28 cleared; 1,072 s | 1,618; 58 / 69 | Shots P/LSS/SM/HB: 6,340 / 202 / 82 / 3. Ammo spent/granted/discarded telemetry was not present in this build. |

These runs document observed outcomes for one seed, not a ranking of weapon utility. In particular, shot counts and ammo grants do not show whether shots were useful or how much damage was lost to over-capacity; the newer runs record both ammo grants and discards. The profiles did not reach wave 300, and the sample does not establish human reachability or the intended relative value of Smart Missiles and Light Speed.

Crowd Sweeps is the default aiming policy: it prefers angularly nearby groups and fires primary/LSS through short Multishot sweeps, accepting missed shots. Long empty transfers and premium weapons still require settled aim. Multiverse Nexus grants all three economy powers together. The power-supply audit includes its three duration grants and guards maximum equal investment with conservative supply bounds; focused permanent powers remain possible.

## Historical Supplies And Timer-Cap Revision (Before Six Extra Powers)

The pre-expansion configuration (9c473ebe) cleared 40/40 requested waves on seed 100 with finite mouse Crowd Sweeps controls: 1,441 simulated seconds, 67.66% accuracy, 3,867 kills, 96 ammo pickups and 170 powers. Cleanup median was 5.23 seconds, p95 13.45, with no wave exceeding 15 seconds. Exact event replay passed. This is one automated profile, not evidence of human endurance or equal weapon utility.

Observed banks never exceeded 50 seconds. Fallout, Space Displacer and Pulsar Harvester reached the cap; other observed timed powers peaked at 38 seconds or less. The generation-only audit at fixed waves 160/300 spans 40 cases: max-equal Chrono uptime was 53–54%, modules 62–64%, and focused modules 82–84%. It excludes purchased Supplies and assumes perfect pickup collection.

| Weapon | Shots | Hits | Kills | Ammo Spent |
|---|---:|---:|---:|---:|
| Primary | 13,947 | 6,602 | 940 | 0 |
| Light Speed | 5,422 | 3,422 | 959 | 2,517 |
| Smart Missiles | 212 | 191 | 181 | 212 |
| Hook Bomb | 27 | 75 | 58 | 27 |

Multishot extras inflate projectile counts without extra ammo cost or accuracy penalties. Missile and Hook usage remained limited; this run does not establish the intended late-game missile shot share.

A separate funded start at wave 160 died at wave 163 after clearing 162 (160.53 active seconds, 75.96% accuracy, 2,152 kills, 19 ammo pickups, 25 powers). Exact replay passed; SL and Death Penalty reached 50 seconds, with no observed bank above the cap. It bought no Supplies because its workshop was not maxed. A funded start is not equivalent to a naturally developed run with stocked ammo and active powers. The current touch profile was not rerun.

The six-power expansion changes drop weights and introduces roaming support/control. The preceding runs use the pre-expansion catalog; they must not be reported as current endurance evidence.


## Six-Power Expansion (Before Camera And Bot-Speed Follow-Up)

Configuration `f6e66bf6` and WASM `80f7cbc1` cleared a funded wave 160–170 start on seed 100: 10 waves, 463.83 simulated seconds, 763.82 remaining HP, 6,403 kills, 73.74% accuracy, 47 ammo pickups and 80 powers. Exact replay passed (`e2a89c10540fb18c5fc29bac5bf38747c0d05e85439a64c651a2e57fb5d49002`). The policy bought 44 Power upgrades and no Supplies. Cleanup median was 11.17 seconds, p95 16.97, with two waves above 15 seconds; late-wave cleanup needs more playtesting. This bounded automated run does not establish human endurance or weapon balance.

All 22 timer slots were captured in a telemetry-only replay with the same final-state hash. Extra Orbs peaked at 45 seconds; Gold, Amp, Flame and Thunder also peaked at 45. Area Of Effect was not collected in this seed span. Chrono, Spotlight, Death Penalty and Space Displacer reached the 50-second cap; no recorded bank exceeded it. A separate perfect-collection generation audit measures the new powers at 31.7–32.9% average uptime under maximum equal investment, excluding Supplies.


## Current Auto Aim / Perks / Critical Coin Audit

The v4 audit uses the actual WASM engine and freezes the engine binary, configuration and controller source per batch. It starts from wave 1, earns its purchases and chooses seeded perks. Coin rewards match the SDK and v29 extraction, including 4-coin Fleet enemies and Scatter children; Basics require Critical Coin.

Continuous manual input is compared at 350 ms / 1,600 units per second, 180 ms / 2,400, and 100 ms / 3,600. These are controller proxies, not measured human skill. Automatic-only and fractional-effort input are separate diagnostics: mixing them into the reaction comparison gave misleading results. Controller speed is in battlefield coordinates; camera size affects its apparent screen speed. No fatigue or random aim error is modeled.

Seed 101 Hybrid died at waves 211, 221 and 242 for those three timings. Economy died at 30, 30 and 206; Regen at 80, 202 and 40. Thus neither a faster reaction time nor an accounting budget establishes survival. The perfect-controller runs were censored at 240 wall-clock seconds (waves 193, 132 and 136); none establishes the proposed 1,000-wave theoretical outcome.

Blind circle sweeps died at wave 10 on seeds 101 and 102, with about 14% accuracy. Idle controls died at wave 2 with no income or damage. Separate Glass, Health and Devo batches cover both seeds. Casual Glass died at 20/20, Health at 95/96, and Devo at 40 with one run censored at 165. Pro Glass died at 32/30, Health at 151/44, and Devo at 50/120. Together the current batches contain 28 cases: 24 deaths and four wall-clock censored runs. The large build and seed variance requires further controller and purchase-policy calibration. Raw reports are under `playtest-results/balance-audit-v4-*`. Build omission and Devo overlap waits are explicit in the frozen policy.

**Balance is not signed off.** The latest 100–1,000-wave survival targets remain unproven. Economy opening purchases and premium-weapon policy need calibration; representative manual and physical-mobile play remain necessary. Mathematical workshop affordability, censored runs and this single baseline controller must not be reported as human clears.

## Crowd-Control Rebalance (2026-10-05)

Frozen candidate 1: `playtest-results/rebalance-candidate1-hybrid`. Seven of ten jobs completed before the audit process exited 11 without stderr. Casual Hybrid died at 246/304, Skilled Hybrid at 240; automatic-only died at 9/10 and quarter-effort at 10/10. The three missing jobs have no result. Circle-only controls died at 10/10 and idle controls at 3/3 (`rebalance-candidate1-controls-*`); these disable the independent cannon to isolate movement cheese.

Candidate 2 strengthens crowd coverage and displacement, preserves SDK enemies and exact coin rewards, and retains the 35-round LSS bundle. The opening-mix native ammo test targets sustainable 70–85% accuracy with investment while heavy waste consumes reserves. This fixture does not demonstrate late-wave LSS sustainability.

The audit now isolates each run in a child process, waits for process closure, records stderr/exit/signal failures, preserves progress and memory observations, and serializes aggregate writes. A parent watchdog bounds hangs. Infrastructure failures remain errors; they are never classified as deaths or censored survival. The earlier exit 11 cause is unresolved. Per-job JSON files are the canonical evidence; harness/config/WASM copies preserve each revision.

Manual shot/ammo counters distinguish active input from the independent cannon. Precision contacts are reconstructed from modulo progress and are a lower bound; aggregate report accuracy includes both cannons. Perk levels are recorded alongside workshop and power upgrades. Reaction profiles have no random aim errors or fatigue; their labels are tuning proxies, not measurements of human ability.

The pre-controller-fix candidate-2 Skilled/Hybrid seed 101 died at wave 282 (480,612 earned, 224 wall seconds). This frozen run used the temporary 30-round LSS bundle and the old target-switching policy; it is diagnostic evidence, not the final 35-round candidate. The audit's three-job valid smoke completed all jobs. Three intentionally invalid configs returned explicit errors (`Invalid workshop or hitbox bounds`) and a failing batch exit, preserving all three records.

The first switch-commit revision was rejected by actual WASM runs: a Hold action could wait forever for a launch, freezing manual shot counters and producing deaths at waves 10–20. Those eight cases are controller-regression evidence, not valid balance measurements. Hold/resume, urgent interruption, empty ammo and target-death regressions now cover the correction. The corrected pre-emergency Skilled/Hybrid seed 101 reached wave 560 before dying (2,300,762 earned, 429 wall seconds). Final crowd-priority and UI-parity measurements remain separate.

Crowd Sweeps keeps standard weapons firing through observed enemies while moving toward the next target, including Multishot fan coverage weighted by its current proc chance. Cursor movement stays bounded and direct; it pauses firing through empty sectors, and keeps premium weapons settled-only. Transit geometry is cached at reaction boundaries; intermediate shots cannot reserve damage against the destination, even when shot-counter snapshots arrive late. LSS route targets stay inside its range.


The first continuous-sweep prototype (`rebalance-continuous-v1`) died at waves 488 (Skilled, seed 101) and 566 (Pro, seed 101), compared with 548 and 631 in `rebalance-final-priority-v1`. It earned 1,425,142 and 1,920,616 Coins. This is a diagnostic variant: its frozen primary pointer was clamped to the range boundary, and its initial fan gate overestimated occluded side-ray contacts. The current implementation preserves the unrestricted projectile cursor, counts only the nearest enemy per potential side ray, weights coverage by Multishot chance, and keeps transit attribution guarded until the snapshot includes the launch. The corrected matched measurements remain pending; these prototype results do not justify reducing combat power.


The guarded fan-gating revision with forced arcs (`rebalance-continuous-final-v2`) died at 364 (Skilled) and 575 (Pro), seed 101. Non-boss cleanup median/p95 was 6.55/23.93 seconds and 4.27/8.70 seconds. A matched funded-wave-160 probe isolated the movement defect: restoring direct finite-speed cursor travel reduced clear time from 51.22 to 37.77 seconds on seed 101 and 47.92 to 45.30 on seed 102, with accuracy improving from 38.07% to 44.34% and 47.87% to 50.78%. It retained firing during approximately half of moving frames. The forced arc branch was removed; continuous route firing, expected nearest-per-ray Multishot coverage and the delayed-snapshot reservation guard remain. No game-balance values changed in this correction. The probes are bounded funded starts, not endurance evidence; `rebalance-continuous-final-v3` records the final wave-one comparison.


The direct-movement revision (`rebalance-continuous-final-v3`) died at 424 (Skilled) and 285 (Pro), seed 101. These are not matched damage-build comparisons: the original Pro run had four damage-perk levels while this run had one, a 2.5x original-cannon damage difference. Combat and perk offers previously shared RNG, so changing shot timing changed later offers. Separate saved perk RNG now prevents that confounder for identical seeds and preceding perk choices. Version-1 saves preserve selected/pending perks and combat RNG; version-2 saves require the independent state. Historical survival trajectories cannot be compared directly to the new engine. No combat balance was reduced in response to these diagnostic results.


## Matched Continuous-Fire Comparison (Independent Perk RNG)

Same engine/config, Pro/Hybrid profile, seed 101, wave-one start, 600-second wall limit. The baseline uses the pre-sweep controller/policy; the candidate uses direct finite-speed movement and observed-route firing. Both jobs completed cleanly. All 359 common completed-wave rows have identical perk levels.

| Controller | Outcome | Coins Earned | Aggregate Accuracy | Wall Seconds |
|---|---:|---:|---:|---:|
| Pre-sweep | Died at 360; cleared 359 | 947,309 | 54.12% | 192.32 |
| Continuous sweep | Died at 687; cleared 686 | 3,454,185 | 54.76% | 480.99 |

Raw reports: `playtest-results/perk-rng-baseline-pro101` and `playtest-results/perk-rng-sweep-pro101`. Configuration SHA begins `8c5d3eaec3c59fa5`; WASM SHA begins `e20e4d`. Accuracy includes both cannons. Combat/drop trajectories can still diverge; one matched seed does not validate human outcomes, all builds, or the proposed 900–1,000-wave ceiling. The result supports the controller fix; combat buffs were retained.

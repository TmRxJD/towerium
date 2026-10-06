# Balance Contract

## Combat

Spawning lasts 30 seconds: ramp-in for 5, sustained pressure through 20, peak pressure through 30. Cleanup follows. Current survival targets: low-effort 100–150; skilled roughly 500; pro 700–800; best human around 900; perfect-controller reference around 1,000. These are tuning goals, with no hard cap. SDK waves 1–10,000 map into Towerium 1–400 for speed, mass and composition. Enemy health gains one base cannon hit every tenth wave.

Projectiles are unlimited. Light Speed needs one fewer base cannon hit before matchups. Smart Missiles fire twice per second. Hook Bomb homes toward the enemy nearest the cursor; its six children are unguided. In-range bombs kill non-bosses. Outside range, travelling damage halves, or quarters against bosses. Death Penalty is an explicit instant-kill exception.

Rapid Fire gives 4× firing speed for 0.25–0.5 seconds. Normal volleys build its deterministic proc credit; active bursts cannot renew themselves. Chance starts at 2%, caps at 10%, and has a steep price curve. Contact attacks once per second and triggers Thorns; bosses take half retaliation damage. Overcharge doubles damage each tower hit. Destroying its source ends the volley. Vampire drain and Overcharge do not trigger Thorns.

## Coins And Supplies

Each workshop stat has an explicit curve. Earlier effects remain unchanged; the last 20% of levels now cost 75% more. Tower coin rewards reduce reference affordability to roughly 14% at wave 300, 37% at 500 and 78% at 750, with full completion near wave 900. The model explicitly assumes 25% Critical Coin uptime for Basics; it does not simulate survival. Supplies spending delays completion further. These are accounting targets, not survival predictions.

Kill coins equal base reward × Coins/Kill × overlapping bonuses. GT, BH, SL, Orbs and DW each contribute 1.15× at baseline. Gold Bot adds a separate 1.2× spatial bonus and 5% deterministic extra-Stone supply for non-child kills; reference income excludes this bonus. GT applies while active; BH/SL require death within their fields; Orbs require the killing hit; DW marks its target. Duplicate fields do not multiply the same bonus twice. The reference reinvests up to 25% in Coins/Kill, assumes ten seconds of cleanup and uses the configured joint overlap fractions.

Supplies sells fixed bundles of 80 LSS, 8 missiles or 1 Hook Bomb, Death Wave charges and ready powers. Prices rise with the upcoming wave. Charges cap at three; ammo obeys capacity. Timers do not drain during shopping. The Fallout supply buys Nuke's attack slow, while the Basic/Fast/Ranged clear is pickup-only. The bot buys needed supplies after maximizing its workshop.

## Stones And Powers

Stones are run-local and separate from Coins. Specials give Stones; ordinary enemies and Scatter children do not. All kill sources collect rewards automatically. Each power offers Drop Share and Effect upgrades, with strict caps and purchase accounting. Drop Share changes the weighted mix, not total frequency. The Stone reference budget stays below 40% of total power-shop cost at wave 300.

Power generation normalizes after 100 planned enemies, including a Scatter-child allowance. Base/max global investment supplies roughly 6/8 pickups per cleared late wave. Timed grants add to remaining time up to the Power Stack Cap; excess is discarded. Saved banks clamp to the purchased cap on restore. Demon grants ten seconds of invulnerability; its pickups have a separate minimum interval.

Pulsar Harvester uses a 2.5% per-hit baseline to reduce speed and mass by 5% per proc, down to 25%. Death Penalty marks an immutable seed/identity fraction for death on a damaging hit. Space Displacer spaces persistent mines inside the Orbs and rotates them oppositely. Multiverse Nexus activates GT, SL and BH together, adding their individual durations up to each bank's cap.

Ammo starts at 40/20/5 with capacities 200/30/6. Direct weapon kills alone generate ammo: 4% initially, up to 7%. Each pickup gives 35 LSS and 2 missiles; every fourth adds 1 Hook Bomb. Ammo Quantity adds 20% of each original bundle per level, carrying fractional rounds. The 70–85% sustainability test covers an opening enemy mix with Ammo Quantity level 5–6, Multishot Chance level 3 and Quantity level 2; it does not establish late-wave sustainability.

## Evidence And Persistence

Human retries restore the last cleared tenth-wave checkpoint, including both shops. Fresh fiftieth-wave starts use empty shops and preceding-wave reference budgets. Auto Play spends its funded build before combat, remains isolated from personal progress and continues out of focus.

Finite reaction and aiming profiles are automated evidence, not human skill measurements. Record cleanup, accuracy, weapon utility, pickup collection, discarded duration and overlap income. See [playtesting](../PLAYTESTING.md) and [validation](../VALIDATION.md).

## Extra Orbs, AOE And Bots

Extra Orbs, AOE and four Bots extend the power catalog; Critical Coin brings the total to 23. Extra Orbs creates three Orbs at the 245-unit Black Hole orbit, counter-rotating at twice workshop Orb Speed. They hit for normal Orb damage plus one cannon hit, with independent hit cooldowns. While active, Orb coin reward starts at 1.25× instead of 1.15×; Stones upgrade that multiplier.

AOE doubles Hook contact radius/damage, mine and Swamp radius/damage, Flame pulse radius/burn damage, Black Hole radius/damage, and Shockwave reach. Chrono reach increases by 15%. Missile direct hits and Orb paths are unchanged. Its Effect upgrade adds duration; the purchased bank limit applies. Out-of-range Hook hits remain capped at half normal-enemy maximum HP after buffs.

Bots use seeded, saved random paths at 100 units/s. Centers remain within tower range minus 24 units and half their base aura radius. Radius upgrades run 140→190 in ten +5 steps, between base Swamp (120) and Black Hole (200). Gold and Amp are support-only: +20% kill income/extra Stones or 2× incoming damage. Flame pulses every 5s, with five one-second burn ticks worth 1/2/3/4/5 cannon hits; refreshes do not create duplicate stacks. Thunder stuns enemies immediately on radius contact for 3s, followed by 5s half speed. Remaining inside does not repeatedly renew the stun; leaving and re-entering can trigger it again. Boss control immunity and Protector shields apply.

The camera fits tower range with a 60-unit margin (650–660 world-unit half-width); temporary area effects never change zoom. Area Of Effect extends Chrono Field by 15%, while other affected fields retain their doubled reach.

Death Ray instantly clears unshielded Basics, Fasts and Ranged on beam contact. Other enemies take two extra cannon-hit equivalents once per contact, plus continuous damage. Protector shields still block it. Black Hole pull is 315 (formerly 105); captured enemies travel with their field, cannot move farther from its center, while enemies inside take one cannon-hit equivalent per second. Control-immune bosses take this damage without being captured.

Nuke clears Basics, Fasts and Ranged, including shielded targets; tougher classes survive and receive the unchanged enemy-attack slow.

## Assisted Aim And Run Perks

Autocannon is part of normal gameplay: mobile defaults on, desktop defaults off. Eight ordered rules cover tower threats, ranged attackers, fast enemies, bosses/elites, powerups, closest, weakest and strongest. Higher enabled rules break ties before lower rules, with distance and entity ID as final ties. Preferences persist locally. Manual aiming and firing stay independent. The Auto Weapons upgrade unlocks automatic LSS, missiles, then Hook Bombs; premium shots target tougher threats. Death Wave stays manual. Results include `aimAssisted`; spectator Auto Play remains separate from human saves/results.

Three seeded, unique, unmaxed perk choices appear after cleared waves 5, 15, 30, 50, 75, 105 and increasingly spaced intervals. One selection is required before the next wave. Perks persist in the run/checkpoint, have explicit caps, and do not alter Workshop purchase levels or prices. Older saves and fresh milestone starts begin a new schedule relative to their starting point. Fifteen perks include five single-level tradeoffs. Cannon Damage adds one base damage per level (maximum five); LSS retains its one-fewer-hit relationship to the improved cannon. Multiplicative tradeoffs apply explicitly to damage, HP, fire rate, range or Orb speed. Heavy Orbs doubles Orb damage. Full definitions are shown in Help.

Bounce redirects now show a gold dashed trail and destination flash. Native regressions cover projectile and LSS bounce hits separately from visual state. These additions require renewed human balance feedback; prior endurance results do not establish the new build balance.

The seventh Workshop row controls automatic cannon efficiency (10% +1 percentage point ×100 levels), targeting traversal (360 +70 battlefield pixels/s ×20), three weapon unlocks, missile cadence (2 +0.1 shots/s ×20), and stack cap (50 +1 seconds ×20). Efficiency scales damage, firing rate, range, multishot/rapid/bounce/knockback values for automated cannon/LSS volleys; Multishot preserves its primary shot and scales the extra pellets down; bounce quantities round up so reduced-stat volleys can still ricochet. Manual firing retains full stats. Each physical projectile stores its original efficiency, so switching input mode cannot strengthen a shot already fired. Cannon cost levels 1–40 are gentle; 81–100 dominate the price. Demon invincibility lasts at most 10s per activation cycle; repeat pickups extend only its damage bonus. These costs add to the total Workshop budget; prior workshop-affordability projections predate this row.

## Audit Method

`npm run audit:balance -- --help` runs actual WASM progression with frozen copies of the configuration, engine and controller. Each run records purchases, weapons, accuracy, cleanup, coin overlaps and its stopping reason. Continuous manual profiles are separate from declared manual-effort fractions; neither models human fatigue or random aim errors. Wall/time limits are censored results, never clears. Glass, Health, Regen, Hybrid and Economy builds include intentionally omitted upgrades; Devo also delays safe kills for overlaps. The policy is a baseline, not an optimal-strategy upper bound.

Coin provenance: SDK ordinary rewards are Fast 2, Tank 4, Ranged 2. Tower coin-income documentation specifies Basic 0, Protector 3, Boss 5 and Elites 4; Critical Coin grants Basics 1 before multipliers. Fleet enemies award 4: v29 ARM64 Enemy.Activate routes Commander (0x0230BF28), Saboteur (0x0230C1BC) and Overcharge (0x0230BF80) through the cash/coin vector at 0x00C31F10 (3 cash, 4 coins), stored at Enemy+0xB0/+0xB8. Source: tower-extractor/dumps/v29.0.0-arm64/libil2cpp.so and dump.cs.

Scatter children retain the Scatter 4-coin reward, even though their movement/HP definition uses Fast values. The extraction routes ScatterChild case 8 to 0x0230C1E8, then the same 4-coin vector at 0x0230CD0C.

## Crowd-Control Rebalance Candidates

Runs start with 150 Coins. The first 40 Autocannon Efficiency levels cost 100 in total, reaching 50%. The automatic cannon fires alongside manual weapons, with separate cooldowns and Rapid Fire timers; manual shots get priority over shared ammo. Every 12 original manual projectile contacts refill 4 LSS and 1 missile; every fourth precision refill adds one Hook Bomb, before Ammo Quantity and capacity. Side pellets, ricochets, automatic fire and pickup contacts do not earn precision refills.

The previous Candidate 2 kept enemy counts, SDK speed/mass, base coin rewards and health progression unchanged. It raised starting Multishot to five projectiles with 20% chance, gaining three percentage points per level; Bounce starts at 15%, gaining 2.75 points per level. Knockback starts at 8%, force at 40 with +6 per level; Shockwave starts at radius 210 and pushes with force 140. Attack Speed starts at 1.4 with +0.045 per level, HP at 160 with +14, and Regen at 1.2/s with +0.3/s. Automatic LSS unlock costs 60. These are measured tuning candidates, not claims that the endurance targets have been reached.

Candidate 1 completed seven of ten planned hybrid runs before the audit process exited with code 11 and no stderr. Casual-controller runs died at 246/304; the completed skilled run died at 240. Automatic-only runs died at 9/10, quarter-effort runs at 10. Manual circle controls died at 10 and idle controls at 3. Missing runs are not survival results. Aggregate accuracy includes both cannons; native manual counters and precision progress keep manual contributions separate.

The controller gives a small preference to its current crowd target and commits weapon changes through their first confirmed shot. Dead targets, empty/disabled weapons, explicit holds and lethal threats release that commitment. This prevents fast observation profiles from repeatedly cancelling their own firing windows. Disabled manual intervals also clear the commitment.

Default targeting favors ranged attackers once nearby pressure is safe. Automatic Tower Threats ranks approaching enemies within 2.5 seconds of contact; a three-enemy imminent crowd interrupts routine ranged priorities in the spectator policy. Ranged units standing at their firing line are not mistaken for imminent melee contacts. Manual input does not bypass automatic traversal, acquisition or premium-weapon rules.

Crowd Sweeps keeps standard weapons firing through observed enemies while moving toward the next target, including Multishot fan coverage weighted by its current proc chance. Cursor movement stays bounded and direct; it pauses firing through empty sectors, and keeps premium weapons settled-only. Transit geometry is cached at reaction boundaries; intermediate shots cannot reserve damage against the destination, even when shot-counter snapshots arrive late. LSS route targets stay inside its range.

Perk offers use a separate seeded random stream, persisted in save format 2. Identical seeds and preceding choices produce identical offers despite different combat timing. Legacy saves retain selected/pending perks and combat RNG; only future offers migrate to the independent stream. Controller comparisons must share the engine and config, and check perk choices as well as reaction settings. Drops and combat remain stochastic, so one seed cannot establish the human skill curve.

Opening Multishot starts with two projectiles at 10% chance. Quantity milestones grant two additional projectiles each (4, 6, 8); chance reaches the same 80% cap. This reduces free opening spread without lowering the specialized endgame fan. Auto Play displays its own automatic cannon state and a blue secondary barrel, independent of the human Autocannon preference.

The wave HUD shows the next perk milestone. Illustrated choices and an owned-perk list use extracted Tower artwork; the list also appears in Game Over. The manual reticle keeps a bright outlined ring at a fixed screen size. Auto Play and the balance harness reserve the automatic cannon’s selected target for it when other candidates are available; reaction timing still applies, and a lone target can use both cannons.

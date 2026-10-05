# Balance Contract

## Combat

Spawning lasts 30 seconds: ramp-in for 5, sustained pressure through 20, peak pressure through 30. Cleanup follows. Wave 300 is exceptional; 400+ is extreme, without a hard cap. SDK waves 1–10,000 map into Towerium 1–400 for speed, mass and composition. Enemy health gains one base cannon hit every tenth wave.

Projectiles are unlimited. Light Speed needs one fewer base cannon hit before matchups. Smart Missiles fire twice per second. Hook Bomb homes toward the enemy nearest the cursor; its six children are unguided. In-range bombs kill non-bosses. Outside range, travelling damage halves, or quarters against bosses. Death Penalty is an explicit instant-kill exception.

Rapid Fire gives 4× firing speed for 0.25–0.5 seconds. Normal volleys build its deterministic proc credit; active bursts cannot renew themselves. Chance starts at 2%, caps at 10%, and has a steep price curve. Contact attacks once per second and triggers Thorns; bosses take half retaliation damage. Overcharge doubles damage each tower hit. Destroying its source ends the volley. Vampire drain and Overcharge do not trigger Thorns.

## Coins And Supplies

Each workshop stat has an explicit curve. Earlier effects remain unchanged; the last 20% of levels now cost 75% more. Reference affordability is approximately 55% at wave 300 and 94% at 400, with completion beyond 400. Supplies spending delays completion further. These are accounting targets, not survival predictions.

Kill coins equal base reward × Coins/Kill × overlapping bonuses. GT, BH, SL, Orbs and DW each contribute 1.15× at baseline. Gold Bot adds a separate 1.2× spatial bonus and 5% deterministic extra-Stone supply for non-child kills; reference income excludes this bonus. GT applies while active; BH/SL require death within their fields; Orbs require the killing hit; DW marks its target. Duplicate fields do not multiply the same bonus twice. The reference reinvests up to 25% in Coins/Kill, assumes ten seconds of cleanup and uses the configured joint overlap fractions.

Supplies sells fixed bundles of 80 LSS, 8 missiles or 1 Hook Bomb, Death Wave charges and ready powers. Prices rise with the upcoming wave. Charges cap at three; ammo obeys capacity. Timers do not drain during shopping. The Fallout supply buys Nuke's attack slow, while the Basic clear is pickup-only. The bot buys needed supplies after maximizing its workshop.

## Stones And Powers

Stones are run-local and separate from Coins. Specials give Stones; ordinary enemies and Scatter children do not. All kill sources collect rewards automatically. Each power offers Drop Share and Effect upgrades, with strict caps and purchase accounting. Drop Share changes the weighted mix, not total frequency. The Stone reference budget stays below 40% of total power-shop cost at wave 300.

Power generation normalizes after 100 planned enemies, including a Scatter-child allowance. Base/max global investment supplies roughly 6/8 pickups per cleared late wave. Timed grants add to remaining time up to 50 seconds; excess is discarded. Legacy banks clamp to 50 on restore. Demon grants ten seconds of invulnerability; its pickups have a separate minimum interval.

Pulsar Harvester uses a 2.5% per-hit baseline to reduce speed and mass by 5% per proc, down to 25%. Death Penalty marks an immutable seed/identity fraction for death on a damaging hit. Space Displacer spaces persistent mines inside the Orbs and rotates them oppositely. Multiverse Nexus activates GT, SL and BH together, adding their individual durations up to each bank's cap.

Ammo starts at 40/20/5 with capacities 200/30/6. Direct weapon kills alone generate ammo: 4% initially, up to 7%. Each pickup gives 35 LSS and 2 missiles; every fourth adds 1 Hook Bomb. Ammo Quantity adds 20% of each original bundle per level, carrying fractional rounds. The 80–85% sustainability test covers an opening enemy mix with investment; it does not establish late-wave sustainability.

## Evidence And Persistence

Human retries restore the last cleared tenth-wave checkpoint, including both shops. Fresh fiftieth-wave starts use empty shops and preceding-wave reference budgets. Auto Play spends its funded build before combat, remains isolated from personal progress and continues out of focus.

Finite reaction and aiming profiles are automated evidence, not human skill measurements. Record cleanup, accuracy, weapon utility, pickup collection, discarded duration and overlap income. See [playtesting](../PLAYTESTING.md) and [validation](../VALIDATION.md).

## Extra Orbs, AOE And Bots

Six additional pickup identities extend the catalog to 22. Extra Orbs creates three Orbs at the 245-unit Black Hole orbit, counter-rotating at twice workshop Orb Speed. They hit for normal Orb damage plus one cannon hit, with independent hit cooldowns. While active, Orb coin reward starts at 1.25× instead of 1.15×; Stones upgrade that multiplier.

AOE doubles Hook contact radius, mine and Swamp radius/damage, Flame pulse radius/burn damage, and BH/Chrono/Shockwave reach. Missile direct hits and Orb paths are unchanged. Its Effect upgrade adds duration; the 50-second bank limit applies. Out-of-range Hook hits remain capped at half normal-enemy maximum HP after buffs.

Bots use seeded, saved random paths at 25 units/s. Centers remain within tower range minus 24 units and half their base aura radius. Radius upgrades run 140→190 in ten +5 steps, between base Swamp (120) and Black Hole (200). Gold and Amp are support-only: +20% kill income/extra Stones or 2× incoming damage. Flame pulses every 5s, with five one-second burn ticks worth 1/2/3/4/5 cannon hits; refreshes do not create duplicate stacks. Thunder pulses every 8s with 3s stun then 5s half speed. Boss control immunity and Protector shields apply.

# Balance Contract

## Waves And Combat

Waves spawn for 30 seconds: ramp-in through 5 seconds, sustained pressure through 20, peak pressure through 30. Cleanup follows; shopping opens when survivors die. Difficulty grows through arrivals, composition, SDK speed/mass and one extra cannon hit of enemy health every tenth wave. Wave 300 is exceptional, 400+ extreme, with no hard cap. See [enemy progression](enemy-spawn-adaptation.md) for source limits and authored adjustments.

Projectiles are unlimited. Light Speed derives damage from full current-wave health: one fewer base cannon hit, minimum one, before type matchups. Smart Missiles fire twice per second. Hook Bomb homes toward the enemy nearest the cursor; its six children are unguided. Bombs kill non-bosses inside range; outside they deal half full-wave health. Travelling shots deal half damage outside range, or a quarter against bosses. Death Penalty is an explicit instant-kill exception.

Contact attacks once per second and triggers Thorns; bosses take half Thorns damage. Vampire drain and Overcharge bounces do not trigger Thorns. Protector shields block passive damage; direct weapons, Nuke's Basic clear and Death Wave remain effective. Orb kills can generate landmines; mine/swamp/Death Wave kills cannot recursively create mines.

## Workshop Coins

Each stat has an explicit price array. Early prices establish a build; late specialization is expensive. Deep, medium and milestone stats use separate curves. Effects remain as promised, without hidden diminishing returns.

Kill income is base enemy coins times Coins/Kill times overlapping coin bonuses. GT, BH, SL, Orb and DW each give 1.15x at base, approximately 2.01x with all five. GT applies while active; BH/SL require death in their fields; Orb requires the killing hit; DW marks the enemy for its eventual death. Duplicate fields do not multiply a bonus twice. Stones can upgrade GT's multiplier.

Reference income clears all arrivals, reinvests at most 25% in Coins/Kill and assumes ten seconds of cleanup. Joint overlap probabilities are: no bonuses 20%; GT alone 35%; GT+BH, GT+SL and GT+Orb 10% each; GT+DW, GT+BH+SL and all five 5% each. Expected overlap is approximately 1.24x. This is accounting, not survival prediction.

Repricing preserves each stat's first third of levels. Later costs target approximately full workshop affordability at wave 300, replacing wave 100. Tests require below 15% at wave 100, 90-115% at 300 and eventual completion beyond it. GT upgrades and actual overlap uptime change income. Wave 300 takes at least 150 active minutes before cleanup/shopping; earlier short-run time targets are superseded.

## Power Stones

Stones are run-local and separate from coins. Protector, elite and fleet kills give one; Bosses two; Super Bosses five. Ordinary enemies and Scatter children give none. All kill sources collect rewards automatically.

Each of the 16 powers has two paths:

- Drop Share: five levels add 20% of original weight each, doubling it at maximum. Shares normalize across eligible powers, changing the mix without increasing total drop frequency.
- Effect: eight small, explicit increments strengthen the selected mechanic. No generic duration path exists here; GC's unique added-time effect has its own upgrade.

Drop costs are 2/4/8/16/32 Stones; effect costs 2/4/7/11/17/25/36/50. Full completion costs 3,424 Stones. The cleared-special reference budget must stay below 40% by wave 300. Several selected powers can develop deeply; everything remains an endurance outcome. Saves validate caps and exact purchase accounting.

Effect paths: CL proc chance; CF slow; Swamp generation; BH radius; SL damage; Death Ray damage; GT coins; Recovery healing; DW boss damage; Shield healing on block; Nuke enemy-attack reduction; Demon damage; DP marked chance; SD mine damage; GC added time; Om Chip boss damage in Spotlight. The shop shows exact current/next values.

## Powers And Ammo

Power drops start at 4% of kills using an accumulation meter. Demon generation has a 60-second minimum interval; during cooldown it is excluded from the eligible pool so every successful roll still creates one drop. This bounds GC/Demon extension cycles below sustainable permanent invulnerability under maximum GC upgrades. Timed pickups add their duration.

Swamp starts at 12% generation, capped at six separated swamps; damage is 1 every four seconds per enemy, shared across swamps, with separate stun timing. Death Ray fires three seconds, rests two, then restarts at a seeded random angle. Nuke clears Basics and halves enemy attack speed for 30 seconds. Demon grants ten seconds of invulnerability and double damage for 30. Workshop Power Duration extends timed effects except Demon invulnerability.

GC adds its current extension to active timed effects once on activation and to future timed pickups while active. Recollecting an active GC only extends GC itself. DP marks an immutable seed/identity-based fraction, including bosses, for death on a damaging hit. SD moves active mines inside Orbs to radius 120, orbiting opposite them. Om Chip aims one of three Spotlight beams at the nearest boss, elite or fleet.

Starting ammo is 40/20/5 LSS/SM/Hook, capacities 200/30/6. Direct weapon kills alone supply ammo: 5% initially, 30 LSS and 2 SM per pickup; every fourth also adds one Hook round. Ammo Quantity adds 20% of each original bundle per level; fractional rounds carry across refills/saves. The older 80-85% LSS sustainability test covers an opening mix, not late health bands. Multishot, bounce, power damage and passive kills alter real efficiency; recheck late sustainability rather than claiming that opening proof covers endurance.

## Persistence And Evidence

Three human retries restore the last cleared tenth-wave checkpoint, including both shops and currencies. Fresh fiftieth-wave starts have empty shops and preceding-wave reference coin/Stone budgets. Auto Play is separate from human saves/progression, spends both currencies for its selected build and continues out of focus.

Scripted controls reveal regressions and cheese, not human skill thresholds or mobile frame rates. Record wave, build, cleanup, accuracy, weapon use, powers and overlap income. See [playtesting](../PLAYTESTING.md) and [validation](../VALIDATION.md).

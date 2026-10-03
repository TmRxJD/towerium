# Balance Contract

## Waves

Spawning lasts 30 seconds: a 5-second ramp, 15 seconds of sustained pressure, then 10 seconds of peak pressure. Spawning stops at 30 seconds; surviving enemies and hostile shots must be cleared before the report opens. The player starts the next wave manually. Review cleanup regularly exceeding 10–15 seconds.

Enemy HP stays fixed by type. Quantity grows between milestones; speed and mass gain 5% and 8% of their base values after every ten completed waves. Every tenth wave includes a slow Super Boss. Normal composition and special-arrival budgets follow [the compressed Tower progression](enemy-spawn-adaptation.md). Wave 300 is exceptional; 400+ is extreme. These are tuning goals, without a hard run cap.

## Workshop

All 25 stats have explicit integer price tables in `engine/balance.json`. Deep, medium, and milestone stats use different authored escalation. The opening third of each table retains its affordable prices; later specialization costs more, with the final levels deliberately expensive. Upgrade effects remain linear and honest: acquisition becomes harder, not the promised effect weaker.

Coins/Kill competes with immediate survival purchases. Kill income is base reward × Coins/Kill × active Golden Tower. The revised accounting target is full-workshop affordability around wave 300, rather than wave 100. Spending this amount does not mean every sensible build should maximize every stat.

The reference model clears each wave, reinvests at most 25% of earned coins into Coins/Kill, assumes Golden Tower covers 85% of kills and allows ten seconds of cleanup per wave. Sustained Golden Tower is plausible once late-wave pickups stack. This is an income model, not a survival forecast. Tests require approximately 90–115% of the total max-workshop cost by wave 300, below 10% by wave 100, and eventual completion beyond that. Starting coins are excluded from earned income.

Earlier 5–75-minute skill tiers and workshop percentages were superseded by the 300/400-wave endurance target. With fixed 30-second spawn phases, reaching wave 300 takes at least 150 active minutes before cleanup and shopping.

## Combat And Drops

Projectiles are unlimited. Light Speed takes one fewer hit than Projectiles, minimum one, and shares their firing/control upgrades. Smart Missiles fire twice per second. The main Hook Bomb acquires the enemy nearest the cursor and homes toward that locked target; its six children remain unguided. Hook Bomb and its unsplitting child bombs kill normal enemies inside range; bosses take fixed damage. Shots outside range deal half damage, or a quarter against bosses. Outside-range bombs deal half a normal enemy’s maximum HP, without instant kills.

Elite/fleet definitions contain explicit per-weapon damage multipliers, shown beside their descriptions in Help. Normal enemies retain neutral multipliers. Normal-enemy Hook Bomb instant kills remain intact.

Contact attacks once per second and returns Thorns damage; bosses take half Thorns damage. Vampire drain and Overcharge bounces do not trigger Thorns. Protector shields block passive damage, while direct weapons and Death Wave remain effective.

Ammo drops require direct weapon kills; passive kills still grant coins and power chances. Ammo and power drops start at 5% of eligible kills and use independent accumulation meters. Ammo collects automatically and refills Light Speed/Smart Missiles by 30/2 rounds; every fourth pickup also adds 1 Hook Bomb. Reserves are 200/30/6. Starting ammunition is 40/20/5: bullets lead the opening, accurate Light Speed can become sustainable later, Smart Missiles target roughly 20% of firing, and Hook Bomb shots should remain premium. A normal-mix LSS test checks sustainable supply near 85% accuracy with five Ammo Quantity levels and 80% with six, while 70% accuracy at five levels loses ammo. This is a controlled gun-only case; passive kills and multi-target upgrades change real-build efficiency. Ammo Quantity adds 20% of each original bundle per level; fractional rounds carry across refills, waves and saves. Shoot power drops to activate them. Timed pickups add duration; Death Wave stores three charges and Energy Shield stores three free hits. Shields do not block continuous Vampire drain.

## Evidence Limits

Scripted players are regression controls, not human skill measurements. Dense native workloads verify finite engine state and expose computational bottlenecks; they do not establish frame rates on every browser or device. Late pickup abundance can create sustained powers and plentiful ammunition, so endurance feedback should include wave, build, cleanup duration and weapon use. See [playtesting](../PLAYTESTING.md) and [validation](../VALIDATION.md).

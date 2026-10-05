# Tower Economy Comparison

Reference: `thetowersdk` 0.11.0, `WORKSHOP_DATA` in `packages/sdk/src/data/workshop/table.json` in [TheTowerSDK](https://github.com/TmRxJD/TheTowerSDK). These are standard workshop values and **battle cash** purchase prices, not enhancement costs or permanent workshop coin prices. The price at level zero buys the first upgrade; the terminal maximum row is not another purchase.

Towerium's currency is earned and spent within one run. Battle cash is therefore the useful price comparison even though Towerium calls it coins. Effects expressed in meters, game units or percentages cannot be copied directly into the arena's pixels or bullet-hit damage model. Every Towerium purchase price is listed explicitly in [balance.json](../engine/balance.json); `base`, `step` and `cap` define its starting value, promised increment and purchase count.

## Starting Values And First Purchases

Chance increments below are percentage points. A multiplier increment adds to the displayed multiplier. Tower health and regeneration have nonlinear later levels; the table shows their first increment only.

| Stat | Tower Start | Tower First Increment | Tower First Cash Price | Towerium Start | Towerium Increment | Towerium First Price |
|---|---:|---:|---:|---:|---:|---:|
| Attack Speed | 1 | 0.05 | 5 | 1× | 1/60× | 9 |
| Range | 3 | 0.05 | 10 | 360 px | 6 px | 6 |
| Health | 5 | 5 | 10 | 100 | 10 | 9 |
| Regen | 0.0005 | 0.0395 | 5 | 0/s | 0.25/s | 11 |
| Coins/Kill | 1× | 0.01× | 10 | 1× | 0.01× | 8 |
| Multishot Chance | 0% | 0.5 pp | 10 | 0% | 1.75 pp | 17 |
| Multishot Quantity | 2 | 1 | 125 | 3 | 1 | 95 |
| Thorns | 0% | 1 pp | 10 | 1 bullet hit | 1 hit | 35 |
| Overheal | 1.5× | 0.03× | 30 | 1× | 0.10× | 12 |
| Rapid Fire Chance | 0% | 0.4 pp | 20 | 2% | 0.8 pp | 30 |
| Rapid Fire Duration | 0.6 s | 0.05 s | 20 | 0.25 s | 0.025 s | 11 |
| Knockback Chance | 0% | 1 pp | 10 | 0% | 3 pp | 14 |
| Knockback Force | 0.4 | 0.15 | 10 | 25 px | 4 px | 12 |
| Bounce Chance | 0% | 0.8 pp | 20 | 0% | 1.75 pp | 18 |
| Bounce Targets | 1 | 1 | 250 | 1 | 1 | 86 |
| Orb Speed | 0.04 | 0.015 | 15 | 0.75 rad/s | 0.06 rad/s | 17 |
| Orb Quantity | 0 | 1 | 300 | 0 | 1 | 143 |
| Bounce Range | 2 | 0.1 | 20 | 120 px | 6 px | 11 |
| Landmine Chance | 0% | 0.6 pp | 25 | 0% | 2 pp | 20 |
| Shockwave Size | 0.6 | 0.05 | 20 | 150 px | 14 px | 11 |
| Shockwave Frequency | 20 s | −0.15 s | 20 | 10 s | −0.5 s | 20 |
| Ammo Drop Chance | — | — | — | 5% | 0.2 pp | 30 |
| Ammo Quantity | — | — | — | 1× bundle | 0.2× bundle | 25 |
| Power Up Chance | — | — | — | 4% | 0.1 pp | 30 |
| Powerup Duration | — | — | — | 0 s bonus | 1 s bonus | 25 |

Ammo Quantity, Ammo Drop Chance, Power Up Chance and Powerup Duration have no direct standard-workshop counterpart. Towerium starts with 15 coins, 40 LSS rounds, 20 missiles and 5 Hook Bombs. Projectiles are unlimited; the primary interval is 0.18 seconds before Attack Speed and Rapid Fire.

## Price Progression

Tower's first Attack Speed cash prices are 5, 7, 10; its last purchase costs 9,167. Multishot Chance begins 10, 16, 23 and ends at 17,319. These are gradual progression across 99 purchases, not abrupt late completion walls.

Tower Multishot Targets costs 125, 350, 800, 2,000, 8,000, 20,000 and 40,000. Towerium's three purchases cost 95, 671 and 128,095. Orb Quantity costs 143, 218, 11,789 and 426,174. Orb Quantity accounts for 29.2% of total workshop cost; Multishot, Bounce and Orb Quantity together account for approximately 47%. Total-workshop affordability can therefore understate how cheaply a strong combat build develops.

The latest repricing preserves the first 80% of each existing price curve and increases the final 20% by 75%; it targets full workshop affordability beyond wave 400 under the reference income model. It changes acquisition costs, not promised upgrade effects. See [balance rules](balance.md) for accounting assumptions and the separate Power Stone budget.

## Enemy Rewards

Current Towerium base rewards, before Coins/Kill and overlapping coin bonuses:

| Enemy | Coins |
|---|---:|
| Basic, Fast, Tank, Ranged, Protector | 5 each |
| Vampire, Ray, Scatter, Commander, Saboteur, Overcharge | 5 each |
| Boss | 8 |
| Super Boss | 40 |

Scatter children use the Fast definition, including its reward. The SDK's `ENEMY_TYPE_BASE_COIN_VALUE` in `mechanics/enemies/type-mix.ts` gives ordinary relative coin weights: Basic 1, Fast 2, Tank 4, Ranged 2. `PROTECTOR_COIN_VALUE` in `mechanics/resource-drops/wave-ordinary-coin-weight.ts` adds Protector 1. These are relative coin values, not a verified table of absolute battle-cash rewards or boss/elite/fleet payouts. Do not label Towerium's current rewards as copied from The Tower or substitute permanent coin rewards for battle cash without validation.

Uniform five-coin rewards make cheap, one-hit enemies unusually productive. Reward differentiation should be tested alongside prices, accounting for enemy mix, Scatter families and stacked Golden Tower uptime. Cutting rewards alone could make the opening harder without fixing cheap early combat multipliers.

Rapid Fire now uses 4× bursts, with 2–10% chance and 0.25–0.5-second duration. Only normal volleys build proc credit, preventing a burst from sustaining itself. Chance prices escalate from 30 to 35,000 coins; Thorns from 35 to 39,375. These paths deliberately demand specialization.

## Historical Gameplay Evidence

The player's wave-63 bullet-only report agreed with an earlier scripted primary-only control reaching wave 170, similar to its matched mixed-weapon control. Those runs predate SDK progression, health bands, modules and Power Stones. They raised a weapon-utility concern but do not validate the current build. See [playtest evidence](../PLAYTESTING.md).

The current contract keeps 30-second spawning and the wave-300 exceptional target. Enemy health gains one unmodified cannon hit every tenth wave, superseding the earlier fixed-health rule. Speed, mass and special arrivals map SDK waves 1–10,000 into Towerium waves 1–400.

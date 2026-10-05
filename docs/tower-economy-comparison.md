# Tower Economy Comparison

Reference: `thetowersdk` 0.11.0, `WORKSHOP_DATA` in `packages/sdk/src/data/workshop/table.json` in [TheTowerSDK](https://github.com/TmRxJD/TheTowerSDK). These are standard workshop values and **battle cash** purchase prices, not enhancement costs or permanent workshop coin prices. The price at level zero buys the first upgrade; the terminal maximum row is not another purchase.

Towerium's currency is earned and spent within one run. Battle cash is therefore the useful price comparison even though Towerium calls it coins. Effects expressed in meters, game units or percentages cannot be copied directly into the arena's pixels or bullet-hit damage model. Every Towerium purchase price is listed explicitly in [balance.json](../engine/balance.json); `base`, `step` and `cap` define its starting value, promised increment and purchase count.

## Starting Values And First Purchases

Chance increments below are percentage points. A multiplier increment adds to the displayed multiplier. Tower health and regeneration have nonlinear later levels; the table shows their first increment only.

| Stat | Tower Start | Tower First Increment | Tower First Cash Price | Towerium Start | Towerium Increment | Towerium First Price |
|---|---:|---:|---:|---:|---:|---:|
| Attack Speed | 1 | 0.05 | 5 | 1.4× | 0.045× | 9 |
| Range | 3 | 0.05 | 10 | 360 px | 6 px | 6 |
| Health | 5 | 5 | 10 | 160 | 14 | 9 |
| Regen | 0.0005 | 0.0395 | 5 | 1.2/s | 0.3/s | 11 |
| Coins/Kill | 1× | 0.01× | 10 | 1× | 0.01× | 8 |
| Multishot Chance | 0% | 0.5 pp | 10 | 10% | 3.5 pp | 17 |
| Multishot Quantity | 2 | 1 | 125 | 2 | 2 | 75 |
| Thorns | 0% | 1 pp | 10 | 1 hits | 1 hits | 35 |
| Overheal | 1.5× | 0.03× | 30 | 1× | 0.1× | 12 |
| Rapid Fire Chance | 0% | 0.4 pp | 20 | 2% | 0.8 pp | 30 |
| Rapid Fire Duration | 0.6 s | 0.05 s | 20 | 0.25 s | 0.025 s | 11 |
| Knockback Chance | 0% | 1 pp | 10 | 8% | 3 pp | 14 |
| Knockback Force | 0.4 | 0.15 | 10 | 40 px | 6 px | 12 |
| Bounce Chance | 0% | 0.8 pp | 20 | 15% | 2.75 pp | 18 |
| Bounce Targets | 1 | 1 | 250 | 1 | 1 | 68 |
| Orb Speed | 0.04 | 0.015 | 15 | 0.75 rad/s | 0.06 rad/s | 17 |
| Orb Quantity | 0 | 1 | 300 | 0 | 1 | 113 |
| Bounce Range | 2 | 0.1 | 20 | 120 px | 6 px | 11 |
| Landmine Chance | 0% | 0.6 pp | 25 | 0% | 2 pp | 20 |
| Shockwave Size | 0.6 | 0.05 | 20 | 210 px | 14 px | 11 |
| Shockwave Frequency | 20 s | −0.15 s | 20 | 10 s | -0.5 s | 20 |
| Ammo Drop Chance | — | — | — | 4% | 0.15 pp | 30 |
| Ammo Quantity | — | — | — | 1× bundle | 0.2× bundle | 25 |
| Power Up Chance | — | — | — | 6% | 0.1 pp | 30 |
| Powerup Duration | — | — | — | 0 s bonus | 1 s bonus | 25 |

Ammo Quantity, Ammo Drop Chance, Power Up Chance and Powerup Duration have no direct standard-workshop counterpart. Towerium starts with 150 coins, 40 LSS rounds, 20 missiles and 5 Hook Bombs. Projectiles are unlimited; the primary interval is 0.18 seconds before Attack Speed and Rapid Fire.

## Price Progression

Tower's first Attack Speed cash prices are 5, 7, 10; its last purchase costs 9,167. Multishot Chance begins 10, 16, 23 and ends at 17,319. These are gradual progression across 99 purchases, not abrupt late completion walls.

Tower Multishot Targets costs 125, 350, 800, 2,000, 8,000, 20,000 and 40,000. Towerium's three purchases cost 75, 530, 177,091. Orb Quantity costs 113, 172, 9,313, 589,185. Multishot, Bounce and Orb Quantity together account for 28.9% of total Workshop cost. Total-workshop affordability therefore does not measure combat development directly.

Each stat has explicit prices and late specialization costs. Autocannon Efficiency reaches 50% for 100 coins, while its final 20 levels stay expensive. Current reference affordability and gameplay evidence appear in [balance rules](balance.md); a reference budget does not prove survival.

## Enemy Rewards

Current Towerium rewards match the verified Tower coin values before Coins/Kill and overlap bonuses:

| Enemy | Coins |
|---|---:|
| Basic | 0; 1 while Critical Coin is active |
| Fast, Ranged | 2 |
| Tank, Elites, Fleet, Scatter Children | 4 |
| Protector | 3 |
| Boss, Super Boss | 5 |

[Coin provenance](coin-rewards.md) records the SDK, Tower documentation and local v29 extraction evidence. Critical Coin is a temporary pickup, not a permanent workshop bonus. Scatter children retain Scatter rewards. These values are coins, not battle cash; Towerium uses them as its run-local currency.

Rapid Fire now uses 4× bursts, with 2–10% chance and 0.25–0.5-second duration. Only normal volleys build proc credit, preventing a burst from sustaining itself. Chance prices escalate from 30 to 35,000 coins; Thorns from 35 to 39,375. These paths deliberately demand specialization.

## Historical Gameplay Evidence

The player's wave-63 bullet-only report agreed with an earlier scripted primary-only control reaching wave 170, similar to its matched mixed-weapon control. Those runs predate SDK progression, health bands, modules and Power Stones. They raised a weapon-utility concern but do not validate the current build. See [playtest evidence](../PLAYTESTING.md).

The current contract keeps 30-second spawning and targets roughly 500 for skilled play, 700–800 for pro play and 1,000 for a perfect-controller reference. Enemy health gains one unmodified cannon hit every tenth wave, superseding the earlier fixed-health rule. Speed, mass and special arrivals map SDK waves 1–10,000 into Towerium waves 1–400.

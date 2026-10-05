# Enemy Coin Rewards

Rewards below precede Coins/Kill, perks and overlapping power bonuses.

| Enemy | Base Coins |
| --- | ---: |
| Basic | 0; Critical Coin grants 1 while active |
| Fast / Ranged | 2 |
| Tank | 4 |
| Protector | 3 |
| Boss / Super Boss | 5 |
| Vampire / Ray / Scatter | 4 |
| Scatter Child | 4 |
| Commander / Saboteur / Overcharge | 4 |

Ordinary rewards use thetowersdk enemy data. Basic, Protector, Boss and Elite values are corroborated by [Tower coin-income guidance](https://the-tower.notion.site/Guide-to-Improving-Coin-Income-1bf91383b93f80b883fefcd58298d20a).

Fleet and child rewards were checked in `tower-extractor/dumps/v29.0.0-arm64/dump.cs` and `libil2cpp.so`. Enemy.Activate uses a 13-case jump table at 0x00C685CA, based at 0x0230BEC8. Commander, Saboteur and Overcharge reach the vector at 0x00C31F10: (3 cash, 4 coins), stored at Enemy+0xB0/+0xB8. ScatterChild reaches the same vector through 0x0230CD0C. These are normal enemy paths; ultimate variants have separate paths.

Critical Coin is adapted as a timed Towerium pickup. Its Stone effect upgrades increase the Basic reward; its duration stacks under the run's Power Stack Cap. Super Boss uses the ordinary Boss reward rather than an invented premium payout.

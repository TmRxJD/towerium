# Enemy Spawn Adaptation

Towerium uses the locally extracted v29.0.0 normal-enemy mix, rather than the
SDK's fitted coin-income weights. Source:
`../tower-extractor/facts/v29.0.0/wave-composition.json`, `composition.byWave`.
The extraction records resolved Main.NewWave percentages summing to 100;
waves 1 and 2 were unresolved, so Towerium retains its Basic-only opening.

| Towerium Wave | Ranged Share Of Normal Enemies | Expected Elites Per Wave | Expected Fleets Per Wave |
|---|---:|---:|---:|
| 5 | 1% | 0 | 0 |
| 10 | 2% | 0.01 | 0 |
| 25 | 4% | 0.09 | 0.025 |
| 45 | 6% | 0.16 | 0.05 |
| 70 | 7% | 0.25 | 0.10 |
| 90 | 8% | 0.36 | 0.125 |
| 110 | 9% | 0.49 | 0.15 |
| 150 | 9% | 0.64 | 0.20 |
| 200 | 10% | 0.81 | 0.25 |
| 250 | 11% | 1.00 | 0.30 |
| 300 | 11% | 1.25 | 0.40 |
| 400+ | 11% | 2.00 | 0.50 |

Fast and Tank follow the same extracted normal-mix rows. A small authored
Protector allowance replaces Basic share, reaching 2% by wave 70. Intermediate
waves interpolate. All existing type unlocks remain in force. The normal
composition samples at Tower waves 15/30/50/75/150/250/300/400/500/700/850/1000
map to Towerium 5/10/15/25/45/70/90/110/150/200/250/300. This compresses the
extracted progression around exceptional 300-wave and extreme 400+ runs.
No resolved normal-composition samples above Tower wave 1000 were available;
the last mix is retained instead of inventing further source values.

The SDK's Elite Spawn Chance chart separates Vampire, Ray and Scatter from
ordinary spawns and shares the elite chance across those three types. Its
Tier-1 single-spawn progression is 1/4/9/16/25/36/49/64/81/100%, with a later
second-spawn chance. Towerium compresses that progression into its shorter
run, approaching one elite per wave at 250 and two at 400, and uses expected per-wave arrivals, rather than a growing percentage of
all mobs. Commander, Saboteur and Overcharge likewise share a small fleet
budget. These are adaptations, not a reproduction of Tower's per-wave caps
or escort packs. Unlock gating can reduce early expected arrivals; seeded
sampling still permits occasional clusters.

SDK sources under `../TrackerWebsite/the-tower-run-tracker/packages/sdk`:
`src/data/charts/data.ts` (elite table), `src/data/enemies/data.ts` (fleet schedule),
`src/mechanics/enemies/elite-spawn-chance.ts` (lookup), and
`src/mechanics/waves/spawn-type-chances-coin-mix.ts` (fitted-model caveat).

Budgets stay fixed after wave 400 as enemy quantity continues to
increase. HP, total enemy counts, 30-second spawn phases, boss scheduling,
damage and rewards are independent of this composition mapping. Current workshop pricing is documented in [Balance Contract](balance.md). Tests check the normalized
mix, endurance behavior and actual arrivals across 128 seeds at four stages.

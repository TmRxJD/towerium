# Enemy Progression

`npm run waves:sync` generates 400 consecutive rows in `engine/balance.json` from `thetowersdk@0.11.0`. `engine/wave-profile-provenance.json` records source version, hashes and authored adjustments. Regeneration requires the local SDK source and extraction; gameplay requires neither.

Towerium wave `w` maps to SDK wave `1 + floor((w - 1) * 9999 / 399)`: wave 1 maps to 1, wave 400 maps to 10,000. Mapping continues after 400. Tier 14 is the baseline, without cards, labs or masteries: it is the lowest tier whose fleet schedule starts within that source range.

## SDK Values

- `waveInfoEnemySpeed` and `waveInfoEnemyMass` establish each type relative to Basic. Basic opens at 34 world units/second. SDK global multipliers then apply across mapped waves. Elite and fleet mass is much greater than ordinary enemy mass.
- `expectedEliteKillsPerWave` supplies the shared Vampire/Ray/Scatter budget. Fractional credit carries between waves; whole arrivals spread through the spawn phase. Type unlocks still apply.
- `fleetSpawnSchedule(14)` starts at SDK wave 2,495 and repeats every 1,000 waves. Each crossing generates one unlocked Commander, Saboteur and Overcharge. This roster is authored: the SDK does not expose a complete escort roster.
- `waveInfoSpawnChancePct` supplies the once-per-wave Protector gate, not a percentage of ordinary spawns.
- Quantum v29 spawn expectation uses the SDK Wave Accelerator rate threshold, double-spawn threshold, 30-second wave length and neutral Enemy Balance/resistance.

## Authored Adjustments

Ordinary density multiplies SDK expectation by interpolated factors: 1 through wave 10; 1.5 at 50; 2 at 100; 3 at 200; 4 at 300; 5 at 400. The opening has at least eight ordinary arrivals. Density keeps growing after 400. Bosses and scheduled specials are additional arrivals. Jittered opposite-sector pairs spread arrivals around the tower.

Basic/Fast/Tank/Ranged composition uses the last resolved extraction row at or before the mapped wave, from `tower-extractor/facts/v29.0.0/wave-composition.json`. Resolved composition ends at SDK wave 1,000; the last mix is retained afterward. The SDK spawn-rate chart ends at 6,500 and its speed curve plateaus; those source limits are preserved. Mass continues with the SDK post-10,000 rule.

Health is authored separately: every tenth Towerium wave adds one unmodified cannon hit of health to each enemy, including Scatter children. Base damage and coin rewards do not scale with health. This supersedes the fixed-HP contract.

| Towerium Wave | Ordinary Count | Ranged Mix | Global Speed | Global Mass |
|---|---:|---:|---:|---:|
| 1 | 8 | 0% | 1x | 1x |
| 10 | 37 | 7% | 1.172x | 1x |
| 50 | 254 | 11% | 2.001x | 1x |
| 100 | 365 | 11% | 2.563x | 1x |
| 400 | 1,277 | 11% | 5.431x | 7x |

Tests pin mapping, movement, mass response, quotas and seed variation. They do not prove human survival at 400. Ignored slow fleet enemies can extend cleanup; travelling weapons can shoot beyond range. Record cleanup, weapon use, pickups and purchases during playtests. Regular cleanup above 10-15 seconds calls for review.

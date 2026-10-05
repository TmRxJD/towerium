use crate::config::Config;
use serde::Serialize;

#[derive(Serialize)]
pub struct IncomeReport {
    pub waves: u32,
    pub minutes: f32,
    pub expected_kill_coins: f32,
    pub economy_spend: f32,
    pub coin_levels: usize,
    pub total_workshop_cost: f32,
    pub affordable_share: f32,
}

// Transparent accounting model, not a survival simulation. It clears each wave,
// uses explicitly configured joint coin-overlap fractions, and reinvests a
// limited share of earned money in Coins/Kill. It never grants free coin levels.
pub fn reference_income(c: &Config, waves: u32) -> IncomeReport {
    let r = &c.elite_reference;
    let economy = &c.upgrades[19];
    let mut income = 0.0;
    let mut spend = 0.0;
    let mut level = 0;
    let overlap_multiplier: f32 = r
        .overlap_fractions
        .iter()
        .enumerate()
        .map(|(mask, p)| {
            p * c
                .coin_multipliers
                .iter()
                .enumerate()
                .fold(1.0, |mult, (i, bonus)| {
                    if mask & (1 << i) != 0 {
                        mult * bonus
                    } else {
                        mult
                    }
                })
        })
        .sum();
    for wave in 1..=waves {
        let pressure = c.waves.pressure(wave);
        let count = pressure.count.ceil();
        let bosses = if wave.is_multiple_of(c.waves.boss_every) {
            pressure.bosses.round().min((count / 2.0).floor())
        } else {
            0.0
        };
        let superboss = if wave.is_multiple_of(10) { 1.0 } else { 0.0 };
        let mut weight = 0.0;
        let mut coins = 0.0;
        for (i, e) in c.enemies.iter().enumerate() {
            if i < 4 && e.unlock <= wave {
                weight += pressure.weights[i];
                // Assumes Scatter families are cleared with weapons, including all children.
                let family_coins = e.coins
                    + if i == crate::sim::SCATTER {
                        c.specials.scatter_children as f32 * c.enemies[1].coins
                    } else {
                        0.0
                    };
                coins += pressure.weights[i] * family_coins;
            }
        }
        let elite_coins = (c.enemies[6].coins
            + c.enemies[7].coins
            + c.enemies[8].coins
            + c.specials.scatter_children as f32 * c.enemies[1].coins)
            / 3.0;
        let fleet_coins: f32 = c.enemies[9..12].iter().map(|e| e.coins).sum();
        let base = count * coins / weight
            + pressure.elite_per_wave * elite_coins
            + pressure.fleet_per_wave * fleet_coins
            + bosses * c.enemies[5].coins
            + superboss * c.enemies[crate::sim::SUPERBOSS].coins;
        income += base * (economy.base + economy.step * level as f32) * overlap_multiplier;
        while level < economy.costs.len()
            && spend + economy.costs[level] <= income * r.economy_budget_fraction
        {
            spend += economy.costs[level];
            level += 1;
        }
    }
    let total = c.upgrades.iter().flat_map(|u| &u.costs).sum::<f32>();
    IncomeReport {
        waves,
        minutes: waves as f32 * (c.waves.spawn_seconds + r.cleanup_seconds) / 60.0,
        expected_kill_coins: income,
        economy_spend: spend,
        coin_levels: level,
        total_workshop_cost: total,
        affordable_share: income / total,
    }
}

/// Expected special-enemy rewards; no ordinary kills or Scatter children mint Stones.
pub fn reference_stones(c: &Config, waves: u32) -> u32 {
    let rewards = &c.power_workshop.stones_per_enemy;
    let mut stones = 0.0;
    let mut elite_credit = 0.0;
    for wave in 1..=waves {
        let p = c.waves.pressure(wave);
        let eligible: Vec<_> = (6..9).filter(|i| c.enemies[*i].unlock <= wave).collect();
        if !eligible.is_empty() {
            elite_credit += p.elite_per_wave;
            let count = elite_credit.floor();
            elite_credit -= count;
            stones += count * eligible.iter().map(|i| rewards[*i] as f32).sum::<f32>()
                / eligible.len() as f32;
        }
        stones += p.fleet_per_wave
            * (9..12)
                .filter(|i| c.enemies[*i].unlock <= wave)
                .map(|i| rewards[i] as f32)
                .sum::<f32>();
        if c.enemies[4].unlock <= wave {
            stones += p.protector_chance * rewards[4] as f32;
        }
        if wave.is_multiple_of(c.waves.boss_every) {
            stones += p.bosses.round() * rewards[5] as f32;
        }
        if wave.is_multiple_of(10) {
            stones += rewards[12] as f32;
        }
    }
    stones.floor() as u32
}

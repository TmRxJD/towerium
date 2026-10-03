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
// collects the configured fraction of Golden Tower kills, and reinvests a
// limited share of earned money in Coins/Kill. It never grants free coin levels.
pub fn reference_income(c: &Config, waves: u32) -> IncomeReport {
    let r = &c.elite_reference;
    let economy = &c.upgrades[19];
    let mut income = 0.0;
    let mut spend = 0.0;
    let mut level = 0;
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
            if e.unlock <= wave {
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
        let base = (count - bosses - superboss) * coins / weight
            + bosses * c.enemies[5].coins
            + superboss * c.enemies[crate::sim::SUPERBOSS].coins;
        income += base
            * (economy.base + economy.step * level as f32)
            * (1.0 + r.golden_kill_fraction * (c.powers.golden_multiplier - 1.0));
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

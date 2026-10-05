use crate::{config::Config, sim::World};
use serde::Deserialize;

pub const POWER_COUNT: usize = 22;

#[derive(Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PowerUpgrade {
    pub name: String,
    pub weight: f32,
    pub weight_step: f32,
    pub weight_costs: Vec<u32>,
    pub effect_label: String,
    pub effect_base: f32,
    pub effect_step: f32,
    pub effect_costs: Vec<u32>,
    pub unit: String,
}

#[derive(Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PowerWorkshop {
    pub upgrades: [PowerUpgrade; POWER_COUNT],
    pub stones_per_enemy: [u32; 13],
}

impl PowerWorkshop {
    pub fn validate(&self, c: &Config) -> Result<(), String> {
        // Effect domains are mechanical, not arbitrary JSON multipliers.
        let bounds = [
            (0.0, 0.95),
            (0.0, 0.8),
            (0.0, 0.3),
            (1.0, 300.0),
            (1.0, 5.0),
            (1.0, 80.0),
            (1.0, 1.4),
            (0.0, 1.0),
            (1.0, 300.0),
            (0.0, 0.25),
            (0.2, 1.0),
            (1.0, 3.0),
            (0.0, 0.1),
            (1.0, 2.0),
            (0.0, 0.1),
            (1.0, 1.5),
            (1.15, 1.5),
            (1.0, 50.0),
            (c.powers.swamp_radius + 1.0, c.powers.blackhole_radius - 1.0),
            (c.powers.swamp_radius + 1.0, c.powers.blackhole_radius - 1.0),
            (c.powers.swamp_radius + 1.0, c.powers.blackhole_radius - 1.0),
            (c.powers.swamp_radius + 1.0, c.powers.blackhole_radius - 1.0),
        ];
        let bases = effect_bases(c);
        for (i, u) in self.upgrades.iter().enumerate() {
            let prices_valid = |costs: &[u32]| {
                !costs.is_empty()
                    && costs.len() <= 12
                    && costs.iter().all(|n| *n > 0 && *n <= 10_000)
                    && costs.windows(2).all(|w| w[0] < w[1])
            };
            let end = u.effect_base + u.effect_step * u.effect_costs.len() as f32;
            let (low, high) = bounds[i];
            if u.name.trim().is_empty()
                || !["%", "×", "m", "s", ""].contains(&u.unit.as_str())
                || u.effect_label.trim().is_empty()
                || !prices_valid(&u.weight_costs)
                || !prices_valid(&u.effect_costs)
                || u.weight <= 0.0
                || u.weight_step <= 0.0
                || u.weight + u.weight_step * u.weight_costs.len() as f32 > u.weight * 4.0
                || (u.effect_base - bases[i]).abs() > 0.00001
                || u.effect_step == 0.0
                || (i == 10) != (u.effect_step < 0.0)
                || !(low..=high).contains(&u.effect_base)
                || !(low..=high).contains(&end)
            {
                return Err(format!("Invalid powerup upgrade definition {i}"));
            }
        }
        if self.stones_per_enemy[..4].iter().any(|n| *n != 0)
            || self.stones_per_enemy.iter().any(|n| *n > 5)
            || self.stones_per_enemy[5] == 0
            || self.stones_per_enemy[12] == 0
        {
            return Err("Invalid Power Stone rewards".into());
        }
        Ok(())
    }
}

fn effect_bases(c: &Config) -> [f32; POWER_COUNT] {
    [
        c.powers.chain_chance,
        c.powers.chrono_slow,
        c.powers.swamp_chance,
        c.powers.blackhole_radius,
        c.powers.spotlight_multiplier,
        c.powers.deathray_dps,
        c.coin_multipliers[0],
        c.powers.recovery_fraction,
        c.specials.superboss_deathwave_damage,
        0.0,
        c.powers.fallout_attack_multiplier,
        c.powers.demon_damage_multiplier,
        c.modules.death_penalty_chance,
        1.0,
        c.modules.pulsar_chance,
        1.0,
        c.expansion.extra_orb_coin_multiplier,
        c.expansion.durations[1],
        c.expansion.bot_radius,
        c.expansion.bot_radius,
        c.expansion.bot_radius,
        c.expansion.bot_radius,
    ]
}

impl World {
    pub fn power_effect(&self, power: usize) -> f32 {
        let u = &self.c.power_workshop.upgrades[power];
        effect_bases(&self.c)[power] + u.effect_step * self.power_levels[power][1] as f32
    }
    pub fn power_weight(&self, power: usize) -> f32 {
        let u = &self.c.power_workshop.upgrades[power];
        u.weight + u.weight_step * self.power_levels[power][0] as f32
    }
    pub fn power_cost(&self, power: usize, path: usize) -> u32 {
        let u = &self.c.power_workshop.upgrades[power];
        let costs = if path == 0 {
            &u.weight_costs
        } else {
            &u.effect_costs
        };
        costs
            .get(self.power_levels[power][path] as usize)
            .copied()
            .unwrap_or(0)
    }
    pub fn buy_power(&mut self, power: usize, path: usize) -> bool {
        if self.phase != 2 || power >= POWER_COUNT || path > 1 {
            return false;
        }
        let cost = self.power_cost(power, path);
        if cost == 0 || self.stones < cost {
            return false;
        }
        self.stones -= cost;
        self.power_levels[power][path] += 1;
        self.say(format!(
            "{} upgraded",
            self.c.power_workshop.upgrades[power].name
        ));
        true
    }
    pub fn choose_power_drop(&mut self) -> usize {
        let weights: [f32; POWER_COUNT] = std::array::from_fn(|i| {
            if i == 11 && self.demon_drop_cooldown > 0.0 {
                0.0
            } else {
                self.power_weight(i)
            }
        });
        let total: f32 = weights.iter().sum();
        let mut pick = self.rng.next() * total;
        for (i, weight) in weights.iter().enumerate() {
            pick -= weight;
            if pick < 0.0 {
                return i;
            }
        }
        POWER_COUNT - 1
    }
    pub fn valid_power_budget(&self, c: &Config) -> bool {
        let mut total = self.stones;
        for (i, levels) in self.power_levels.iter().enumerate() {
            for (path, costs) in [
                &c.power_workshop.upgrades[i].weight_costs,
                &c.power_workshop.upgrades[i].effect_costs,
            ]
            .iter()
            .enumerate()
            {
                if levels[path] as usize > costs.len() {
                    return false;
                }
                for cost in costs.iter().take(levels[path] as usize) {
                    let Some(next) = total.checked_add(*cost) else {
                        return false;
                    };
                    total = next;
                }
            }
        }
        total == self.stones_earned
    }
}

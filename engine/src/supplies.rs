use crate::sim::World;
use serde::Deserialize;

pub const SUPPLY_COUNT: usize = 3 + crate::power_shop::POWER_COUNT;
#[derive(Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Supplies {
    pub ammo_quantities: [u32; 3],
    pub ammo_prices: [f32; 3],
    pub power_prices: [f32; crate::power_shop::POWER_COUNT],
    pub wave_price_step: f32,
}
impl Supplies {
    pub fn validate(&self) -> Result<(), String> {
        if self.ammo_quantities.iter().any(|n| *n == 0 || *n > 1000)
            || self
                .ammo_prices
                .iter()
                .chain(self.power_prices.iter())
                .any(|p| *p <= 0.0 || *p > 100_000.0)
            || !(0.0..=0.1).contains(&self.wave_price_step)
        {
            return Err("Invalid Supplies definition".into());
        }
        Ok(())
    }
}
impl World {
    pub fn supply_cost(&self, item: usize) -> f32 {
        let base = if item < 3 {
            self.c.supplies.ammo_prices.get(item)
        } else {
            self.c.supplies.power_prices.get(item - 3)
        };
        let wave = if self.pending_start_wave > 0 {
            self.pending_start_wave
        } else {
            self.wave + 1
        };
        base.map_or(0.0, |price| {
            (price * (1.0 + self.c.supplies.wave_price_step * wave as f32)).ceil()
        })
    }
    pub fn supply_available(&self, item: usize) -> bool {
        if self.phase != 2 || item >= SUPPLY_COUNT {
            return false;
        }
        if item < 3 {
            return self.ammo[item + 1] < self.ammo_capacity(item + 1);
        }
        let cap = self.c.powers.timer_cap;
        match item - 3 {
            k @ 0..=6 => self.powers[k] < cap,
            7 => self.hp < self.stat(11) * (1.0 + self.stat(24)),
            8 => self.charges < 3,
            9 => self.shields < 3,
            10 => self.fallout_time < cap,
            11 => {
                self.demon_time < cap
                    || self.demon_invincible < self.c.powers.demon_invincible_duration
            }
            k @ 12..=14 => self.module_times[k - 12] < cap,
            15 => [3, 4, 6].iter().any(|k| self.powers[*k] < cap),
            k @ 16..=21 => self.expanded_time(k) < cap,
            _ => false,
        }
    }
    pub fn buy_supply(&mut self, item: usize) -> bool {
        let cost = self.supply_cost(item);
        if !self.supply_available(item) || cost <= 0.0 || self.coins < cost {
            return false;
        }
        self.coins -= cost;
        if item < 3 {
            let weapon = item + 1;
            let before = self.ammo[weapon];
            self.ammo[weapon] = before
                .saturating_add(self.c.supplies.ammo_quantities[item])
                .min(self.ammo_capacity(weapon));
            self.weapon_stats[weapon].ammo_granted += self.ammo[weapon] - before;
        } else {
            self.activate(item - 3);
        }
        true
    }
}

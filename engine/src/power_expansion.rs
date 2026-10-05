use crate::{
    config::Config,
    math::V,
    sim::{World, AREA_DAMAGE, DT, ORB_DAMAGE},
};
use serde::{Deserialize, Serialize};
use std::f32::consts::TAU;

pub const EXTRA_ORBS: usize = 16;
pub const AOE: usize = 17;
pub const GOLD_BOT: usize = 18;
pub const AMP_BOT: usize = 19;
pub const FLAME_BOT: usize = 20;
pub const THUNDER_BOT: usize = 21;
pub const CRITICAL_COIN: usize = 22;

#[derive(Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Expansion {
    pub durations: [f32; 7],
    pub aoe_multiplier: f32,
    pub chrono_aoe_multiplier: f32,
    pub extra_orb_coin_multiplier: f32,
    pub bot_radius: f32,
    pub bot_speed: f32,
    pub bot_padding: f32,
    pub gold_coin_multiplier: f32,
    pub gold_stone_chance: f32,
    pub flame_interval: f32,
    pub burn_seconds: u32,
    pub thunder_stun: f32,
    pub thunder_slow_duration: f32,
    pub thunder_slow: f32,
}
impl Expansion {
    pub fn validate(&self, c: &Config) -> Result<(), String> {
        if self.durations.iter().any(|v| !(1.0..=50.0).contains(v))
            || self.aoe_multiplier != 2.0
            || !(1.15..=1.5).contains(&self.extra_orb_coin_multiplier)
            || self.bot_radius <= c.powers.swamp_radius
            || self.bot_radius >= c.powers.blackhole_radius
            || !(1.0..=100.0).contains(&self.bot_speed)
            || !(1.0..=1.25).contains(&self.chrono_aoe_multiplier)
            || !(16.0..=60.0).contains(&self.bot_padding)
            || !(1.0..=1.5).contains(&self.gold_coin_multiplier)
            || !(0.0..=0.1).contains(&self.gold_stone_chance)
            || !(3.0..=10.0).contains(&self.flame_interval)
            || !(1..=10).contains(&self.burn_seconds)
            || !(1.0..=3.0).contains(&self.thunder_stun)
            || !(1.0..=10.0).contains(&self.thunder_slow_duration)
            || !(0.1..=0.8).contains(&self.thunder_slow)
        {
            return Err("Invalid expanded power definitions".into());
        }
        Ok(())
    }
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct BotState {
    pub position: V,
    pub target: V,
    pub pulse_in: f32,
    pub initialized: bool,
}
impl Default for BotState {
    fn default() -> Self {
        Self {
            position: V::ZERO,
            target: V::ZERO,
            pulse_in: 0.0,
            initialized: false,
        }
    }
}
pub fn default_bots() -> [BotState; 4] {
    std::array::from_fn(|_| BotState::default())
}

impl World {
    pub fn expanded_time(&self, power: usize) -> f32 {
        self.extra_power_times[power - EXTRA_ORBS]
    }
    pub fn aoe_scale(&self) -> f32 {
        if self.expanded_time(AOE) > 0.0 {
            self.c.expansion.aoe_multiplier
        } else {
            1.0
        }
    }
    pub fn area_radius(&self, radius: f32) -> f32 {
        radius * self.aoe_scale()
    }
    pub fn in_bot(&self, bot: usize, p: V) -> bool {
        self.expanded_time(GOLD_BOT + bot) > 0.0
            && self.bots[bot].initialized
            && p.dist(self.bots[bot].position) < self.power_effect(GOLD_BOT + bot)
    }
    pub fn amp_multiplier(&self, p: V) -> f32 {
        if self.in_bot(AMP_BOT - GOLD_BOT, p) {
            2.0
        } else {
            1.0
        }
    }
    pub fn extra_orb_positions(&self) -> Vec<(f32, f32)> {
        if self.expanded_time(EXTRA_ORBS) <= 0.0 {
            return Vec::new();
        }
        (0..3)
            .map(|n| {
                let p = V::polar(
                    self.extra_orb_angle + n as f32 * TAU / 3.0,
                    self.c.powers.blackhole_orbit_radius,
                );
                (p.x, p.y)
            })
            .collect()
    }
    pub fn valid_expansion_state(&self) -> bool {
        self.extra_power_times.iter().all(|t| *t >= 0.0)
            && (0.0..1.0).contains(&self.gold_stone_credit)
            && (0.0..TAU).contains(&self.extra_orb_angle)
            && self.bots.iter().all(|b| {
                b.position.len() <= self.stat(1) + 0.1
                    && b.target.len() <= self.stat(1) + 0.1
                    && b.pulse_in >= 0.0
                    && b.pulse_in
                        <= (self.c.expansion.thunder_stun + self.c.expansion.thunder_slow_duration)
                            .max(self.c.expansion.flame_interval)
            })
            && self.enemies.iter().all(|e| {
                e.blackhole
                    .is_none_or(|i| i < self.c.powers.blackhole_count)
                    && e.blackhole_distance >= 0.0
                    && e.blackhole_distance
                        <= self.power_effect(3) * self.c.expansion.aoe_multiplier + 0.1
                    && (0.0..=1.0).contains(&e.blackhole_hit_time)
                    && e.extra_orb_cd >= 0.0
                    && e.extra_orb_cd <= self.c.defense.orb_hit_interval
                    && e.burn_left >= 0.0
                    && e.burn_left <= self.c.expansion.burn_seconds as f32
                    && e.burn_tick >= 0.0
                    && e.burn_tick <= 1.0
                    && e.burn_stage <= self.c.expansion.burn_seconds
                    && e.thunder_slow_time >= 0.0
                    && e.thunder_slow_time
                        <= self.c.expansion.thunder_stun + self.c.expansion.thunder_slow_duration
            })
    }
    pub fn step_bots(&mut self) {
        for i in 0..self.enemies.len() {
            self.enemies[i].extra_orb_cd = (self.enemies[i].extra_orb_cd - DT).max(0.0);
            self.enemies[i].thunder_slow_time = (self.enemies[i].thunder_slow_time - DT).max(0.0);
            if self.enemies[i].burn_left > 0.0 {
                self.enemies[i].burn_left = (self.enemies[i].burn_left - DT).max(0.0);
                self.enemies[i].burn_tick -= DT;
                if self.enemies[i].burn_tick <= 0.0001 {
                    self.enemies[i].burn_tick += 1.0;
                    self.enemies[i].burn_stage =
                        (self.enemies[i].burn_stage + 1).min(self.c.expansion.burn_seconds);
                    let damage = self.enemies[i].burn_stage as f32 * self.c.weapons[0].damage;
                    self.hit(i, damage, AREA_DAMAGE);
                }
            }
        }
        for bot in 0..4 {
            let power = GOLD_BOT + bot;
            if self.expanded_time(power) <= 0.0 {
                if power == THUNDER_BOT {
                    for enemy in &mut self.enemies {
                        enemy.thunder_inside = false;
                    }
                }
                continue;
            }
            // Keep centers comfortably inside the range; splash can reach beyond it.
            let limit =
                (self.stat(1) - self.power_effect(power) * 0.5 - self.c.expansion.bot_padding)
                    .max(0.0);
            if !self.bots[bot].initialized {
                self.bots[bot].position = V::polar(bot as f32 * TAU / 4.0, limit * 0.45);
                self.bots[bot].initialized = true;
                self.bots[bot].target =
                    V::polar(self.rng.next() * TAU, self.rng.next().sqrt() * limit);
            }
            if self.bots[bot].position.len() > limit {
                self.bots[bot].position = self.bots[bot].position.unit().mul(limit);
            }
            if self.bots[bot].target.len() > limit
                || self.bots[bot].position.dist(self.bots[bot].target) < 2.0
            {
                self.bots[bot].target =
                    V::polar(self.rng.next() * TAU, self.rng.next().sqrt() * limit);
            }
            let delta = self.bots[bot].target.sub(self.bots[bot].position);
            self.bots[bot].position = self.bots[bot].position.add(
                delta
                    .unit()
                    .mul(delta.len().min(self.c.expansion.bot_speed * DT)),
            );
            if power < FLAME_BOT {
                continue;
            }
            if power == THUNDER_BOT {
                let p = self.bots[bot].position;
                let radius = self.area_radius(self.power_effect(power));
                let mut triggered = false;
                for i in 0..self.enemies.len() {
                    let inside = self.enemies[i].hp > 0.0
                        && self.enemies[i].p.dist(p)
                            <= radius + self.enemies[i].definition(&self.c).radius
                        && self.enemies[i].definition(&self.c).resistance < 1.0
                        && !self.protected(i);
                    if inside && !self.enemies[i].thunder_inside {
                        self.enemies[i].stun =
                            self.enemies[i].stun.max(self.c.expansion.thunder_stun);
                        self.enemies[i].thunder_slow_time =
                            self.c.expansion.thunder_stun + self.c.expansion.thunder_slow_duration;
                        triggered = true;
                    }
                    self.enemies[i].thunder_inside = inside;
                }
                self.bots[bot].pulse_in = 0.0;
                if triggered {
                    self.fx
                        .push(crate::sim::Fx(15, p.x, p.y, radius, 0.0, 0.65));
                }
                continue;
            }
            self.bots[bot].pulse_in -= DT;
            if self.bots[bot].pulse_in > 0.0 {
                continue;
            }
            self.bots[bot].pulse_in = self.c.expansion.flame_interval;
            let p = self.bots[bot].position;
            let radius = self.area_radius(self.power_effect(power));
            self.fx
                .push(crate::sim::Fx(14, p.x, p.y, radius, 0.0, 0.65));
            for i in 0..self.enemies.len() {
                if self.enemies[i].hp <= 0.0
                    || self.enemies[i].p.dist(p) >= radius
                    || self.protected(i)
                {
                    continue;
                }
                if self.enemies[i].burn_left <= 0.0 {
                    self.enemies[i].burn_tick = 1.0;
                    self.enemies[i].burn_stage = 0;
                }
                self.enemies[i].burn_left = self.c.expansion.burn_seconds as f32;
            }
        }
    }
    pub fn extra_orb_hits(&mut self) {
        self.extra_orb_angle = (self.extra_orb_angle - 2.0 * self.stat(15) * DT).rem_euclid(TAU);
        for (x, y) in self.extra_orb_positions() {
            let p = V::new(x, y);
            for i in 0..self.enemies.len() {
                if self.enemies[i].hp > 0.0
                    && self.enemies[i].extra_orb_cd <= 0.0
                    && self.enemies[i].p.dist(p) < self.enemies[i].definition(&self.c).radius + 9.0
                    && self.hit(
                        i,
                        self.c.defense.orb_damage + self.c.weapons[0].damage,
                        ORB_DAMAGE,
                    )
                {
                    self.enemies[i].extra_orb_cd = self.c.defense.orb_hit_interval;
                }
            }
        }
    }
}

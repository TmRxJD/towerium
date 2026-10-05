use serde::{Deserialize, Serialize};

pub const ENEMY_COUNT: usize = 13;
pub const UPGRADE_COUNT: usize = 25;

#[derive(Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct EnemyDef {
    pub name: String,
    pub hp: f32,
    pub speed: f32,
    pub mass: f32,
    pub radius: f32,
    pub damage: f32,
    pub attack_interval: f32,
    pub heat: f32,
    pub resistance: f32,
    pub weapon_damage: [f32; 4],
    pub coins: f32,
    pub unlock: u32,
}
#[derive(Clone, Copy, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct WeaponDef {
    pub damage: f32,
    pub speed: f32,
    pub interval: f32,
    pub ammo: u32,
    pub pickup: u32,
    pub capacity: u32,
    pub pickup_every: u32,
}
#[derive(Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Upgrade {
    pub name: String,
    pub group: String,
    pub base: f32,
    pub step: f32,
    pub cap: u32,
    pub costs: Vec<f32>,
    pub cost_class: CostClass,
    pub display_scale: f32,
    pub unit: String,
    pub description: String,
}
#[derive(Clone, Copy, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum CostClass {
    Deep,
    Medium,
    Milestone,
}
#[derive(Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Waves {
    pub spawn_seconds: f32,
    pub hp_hits_every: u32,
    pub boss_every: u32,
    pub fleet_first_wave: u32,
    pub fleet_repeat_waves: u32,
    pub milestones: Vec<WaveMilestone>,
}
#[derive(Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct WaveMilestone {
    pub wave: u32,
    pub sdk_wave: u32,
    pub speed: f32,
    pub mass: f32,
    pub protector_chance: f32,
    pub count: f32,
    pub bosses: f32,
    pub weights: [f32; ENEMY_COUNT],
    pub elite_per_wave: f32,
    pub fleet_per_wave: f32,
}
impl Waves {
    pub fn speed_multiplier(&self, wave: u32) -> f32 {
        self.milestones[(wave.max(1) as usize - 1).min(self.milestones.len() - 1)].speed
    }
    pub fn mass_multiplier(&self, wave: u32) -> f32 {
        let row = &self.milestones[(wave.max(1) as usize - 1).min(self.milestones.len() - 1)];
        row.mass
            + if wave > 400 {
                ((Self::sdk_wave(wave) - 10000) as f32) * 0.001
            } else {
                0.0
            }
    }
    pub fn sdk_wave(wave: u32) -> u32 {
        (1 + (wave.saturating_sub(1) as u64 * 9999 / 399)).min(u32::MAX as u64) as u32
    }
    pub fn spawn_at(&self, ordinal: u32, total: u32) -> f32 {
        // Integral of relative rates 0.5 / 1 / 1.5 over ramp / sustain / peak.
        let mass = (ordinal as f32 + 0.5) / total as f32 * 32.5;
        if mass < 2.5 {
            mass / 0.5
        } else if mass < 17.5 {
            5.0 + mass - 2.5
        } else {
            20.0 + (mass - 17.5) / 1.5
        }
    }
    pub fn pressure(&self, wave: u32) -> WaveMilestone {
        let end = self
            .milestones
            .iter()
            .position(|m| m.wave >= wave)
            .unwrap_or(self.milestones.len() - 1)
            .max(1);
        let a = &self.milestones[end - 1];
        let b = &self.milestones[end];
        let t = (wave.saturating_sub(a.wave)) as f32 / (b.wave - a.wave) as f32;
        let mix = t.min(1.0);
        let count = if wave > 400 {
            b.count * (1.0 + (wave - 400) as f32 * 0.002)
        } else {
            a.count + (b.count - a.count) * t
        };
        let elite_per_wave = a.elite_per_wave + (b.elite_per_wave - a.elite_per_wave) * mix;
        let fleet_per_wave = if wave > 400 {
            let groups = |source: u32| {
                if source < self.fleet_first_wave {
                    0
                } else {
                    1 + (source - self.fleet_first_wave) / self.fleet_repeat_waves
                }
            };
            (groups(Self::sdk_wave(wave)) - groups(Self::sdk_wave(wave - 1))) as f32
        } else {
            a.fleet_per_wave + (b.fleet_per_wave - a.fleet_per_wave) * mix
        };
        let mut weights =
            std::array::from_fn(|i| a.weights[i] + (b.weights[i] - a.weights[i]) * mix);
        // Specials scale per wave, rather than multiplying with the normal mob count.
        let elite_share = elite_per_wave / count;
        let fleet_share = fleet_per_wave / count;
        for (indices, share) in [
            (&[0, 1, 2, 3, 4][..], 1.0 - elite_share - fleet_share),
            (&[6, 7, 8][..], elite_share),
            (&[9, 10, 11][..], fleet_share),
        ] {
            let total: f32 = indices.iter().map(|&i| weights[i]).sum();
            if total > 0.0 {
                for &i in indices {
                    weights[i] = weights[i] / total * share;
                }
            }
        }
        WaveMilestone {
            wave,
            sdk_wave: Self::sdk_wave(wave),
            speed: self.speed_multiplier(wave),
            mass: self.mass_multiplier(wave),
            protector_chance: b.protector_chance,
            count,
            bosses: a.bosses + (b.bosses - a.bosses) * t,
            weights,
            elite_per_wave,
            fleet_per_wave,
        }
    }
}
#[derive(Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Powers {
    pub durations: [f32; 7],
    pub drop_lifetime: f32,
    pub warning: f32,
    pub recovery_fraction: f32,
    pub chain_chance: f32,
    pub chain_damage: f32,
    pub chain_count: usize,
    pub chrono_margin: f32,
    pub chrono_slow: f32,
    pub swamp_chance: f32,
    pub swamp_cap: usize,
    pub fallout_duration: f32,
    pub fallout_attack_multiplier: f32,
    pub demon_duration: f32,
    pub demon_invincible_duration: f32,
    pub demon_damage_multiplier: f32,
    pub demon_drop_interval: f32,
    pub swamp_radius: f32,
    pub swamp_duration: f32,
    pub swamp_damage: f32,
    pub swamp_hit_interval: f32,
    pub swamp_stun: f32,
    pub swamp_stun_interval: f32,
    pub blackhole_radius: f32,
    pub blackhole_force: f32,
    pub blackhole_count: usize,
    pub blackhole_orbit_radius: f32,
    pub spotlight_count: usize,
    pub spotlight_angle: f32,
    pub spotlight_multiplier: f32,
    pub spotlight_speed: f32,
    pub deathray_speed: f32,
    pub deathray_dps: f32,
    pub deathray_duration: f32,
    pub deathray_cooldown: f32,
    pub deathwave_speed: f32,
}
#[derive(Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Defense {
    pub orb_radius: f32,
    pub orb_damage: f32,
    pub orb_hit_interval: f32,
    pub mine_damage: f32,
    pub mine_radius: f32,
    pub mine_stun: f32,
    pub mine_lifetime: f32,
    pub mine_cap: usize,
    pub shock_force: f32,
    pub protector_radius: f32,
    pub protector_reduction: f32,
    pub enemy_bullet_speed: f32,
    pub mine_trigger_radius: f32,
}
#[derive(Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Specials {
    pub commander_radius: f32,
    pub commander_speed_bonus: f32,
    pub commander_attack_bonus: f32,
    pub ray_charge: f32,
    pub sabotage_duration: f32,
    pub sabotage_cooldown: f32,
    pub overcharge_multiplier: f32,
    pub overcharge_speed: f32,
    pub scatter_children: usize,
    pub superboss_deathwave_damage: f32,
}
#[derive(Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct EliteReference {
    pub waves: u32,
    pub cleanup_seconds: f32,
    pub economy_budget_fraction: f32,
    pub overlap_fractions: [f32; 32],
}
#[derive(Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Modules {
    pub durations: [f32; 4],
    pub death_penalty_chance: f32,
    pub space_displacer_radius: f32,
    pub space_displacer_speed: f32,
    pub galaxy_extension: f32,
}
#[derive(Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Config {
    pub tower_radius: f32,
    pub enemies: [EnemyDef; ENEMY_COUNT],
    pub weapons: [WeaponDef; 4],
    pub upgrades: Vec<Upgrade>,
    pub waves: Waves,
    pub powers: Powers,
    pub defense: Defense,
    pub specials: Specials,
    pub projectile_lifetime: f32,
    pub missile_turn_rate: f32,
    pub child_damage: f32,
    pub bomb_radius: f32,
    pub rapid_multiplier: f32,
    pub starting_coins: f32,
    pub elite_reference: EliteReference,
    pub modules: Modules,
    pub coin_multipliers: [f32; 5],
    pub power_workshop: crate::power_shop::PowerWorkshop,
}
impl Config {
    pub fn parse(json: &str) -> Result<Self, String> {
        let c: Self = serde_json::from_str(json).map_err(|e| e.to_string())?;
        // Validate every numeric leaf (serde_json rejects NaN and infinity), then domain constraints.
        let raw: serde_json::Value = serde_json::from_str(json).map_err(|e| e.to_string())?;
        fn finite(v: &serde_json::Value) -> bool {
            match v {
                serde_json::Value::Number(n) => {
                    n.as_f64().is_some_and(|x| x.is_finite() && x.abs() < 1e7)
                }
                serde_json::Value::Array(a) => a.iter().all(finite),
                serde_json::Value::Object(o) => o.values().all(finite),
                _ => true,
            }
        }
        if !finite(&raw) {
            return Err("Balance values must be finite and bounded".into());
        }
        if c.upgrades.len() != UPGRADE_COUNT {
            return Err(format!(
                "Expected exactly {UPGRADE_COUNT} upgrade definitions"
            ));
        }
        validate_enemies(&c)?;
        validate_weapons(&c)?;
        validate_prices(&c)?;
        validate_stat_domains(&c)?;
        validate_effects(&c)?;
        validate_timing(&c)?;
        validate_milestones(&c)?;
        validate_income(&c)?;
        c.power_workshop.validate(&c)?;
        if c.modules.durations.iter().any(|t| *t <= c.powers.warning)
            || !(0.0..=1.0).contains(&c.modules.death_penalty_chance)
            || c.modules.space_displacer_radius <= c.tower_radius
            || c.modules.space_displacer_radius >= c.defense.orb_radius
            || c.modules.space_displacer_speed <= 0.0
            || c.modules.galaxy_extension <= 0.0
            || c.coin_multipliers.iter().any(|m| !(1.0..=2.0).contains(m))
        {
            return Err("Invalid module or coin bonus settings".into());
        }
        Ok(c)
    }
    #[cfg(test)]
    pub fn standard() -> Self {
        Self::parse(include_str!("../balance.json")).expect("valid bundled balance")
    }
}

fn validate_enemies(c: &Config) -> Result<(), String> {
    for e in &c.enemies {
        if e.hp <= 0.0
            || e.speed <= 0.0
            || e.mass <= 0.0
            || e.radius <= 0.0
            || e.radius > 48.0
            || e.damage < 0.0
            || e.attack_interval <= 0.0
            || e.heat < 0.0
            || e.coins < 0.0
            || e.unlock == 0
            || !(0.0..=1.0).contains(&e.resistance)
            || e.weapon_damage.iter().any(|m| !(0.25..=2.0).contains(m))
        {
            return Err(format!("Invalid enemy: {}", e.name));
        }
    }
    Ok(())
}

fn validate_weapons(c: &Config) -> Result<(), String> {
    for (i, w) in c.weapons.iter().enumerate() {
        if w.damage <= 0.0
            || w.speed <= 0.0
            || w.interval <= 0.0
            || w.pickup_every == 0
            || w.pickup_every > 100
            || (i > 0
                && (w.capacity == 0
                    || w.ammo > w.capacity
                    || w.pickup == 0
                    || w.pickup > w.capacity))
        {
            return Err("Invalid weapon".into());
        }
    }
    Ok(())
}

fn validate_prices(c: &Config) -> Result<(), String> {
    for u in &c.upgrades {
        if u.cap > 100
            || u.cap == 0
            || u.costs.len() != u.cap as usize
            || u.costs
                .iter()
                .any(|p| !p.is_finite() || *p <= 0.0 || p.fract() != 0.0)
            || u.costs.windows(2).any(|p| p[1] < p[0])
            || match u.cost_class {
                CostClass::Deep => u.cap < 30,
                CostClass::Medium => !(10..=20).contains(&u.cap),
                CostClass::Milestone => u.cap > 5,
            }
            || u.display_scale <= 0.0
            || u.base < 0.0
            || u.base + u.step * (u.cap as f32) < 0.0
        {
            return Err(format!("Invalid upgrade: {}", u.name));
        }
    }
    Ok(())
}

fn validate_stat_domains(c: &Config) -> Result<(), String> {
    let endpoints = |i: usize| {
        let u = &c.upgrades[i];
        [u.base, u.base + u.step * u.cap as f32]
    };
    for i in [0, 1, 3, 8, 11, 18, 19, 22] {
        if endpoints(i).iter().any(|v| *v <= 0.0) {
            return Err(format!("{} must stay positive", c.upgrades[i].name));
        }
    }
    if endpoints(1).iter().any(|v| *v <= c.tower_radius) {
        return Err("Range must extend beyond the Tower".into());
    }
    for i in [2, 4, 6, 9, 16, 21, 23] {
        if endpoints(i).iter().any(|v| !(0.0..=1.0).contains(v)) {
            return Err(format!("{} must stay within [0,1]", c.upgrades[i].name));
        }
    }
    for i in [3, 8, 13, 14] {
        let u = &c.upgrades[i];
        if u.base.fract() != 0.0 || u.step.fract() != 0.0 || endpoints(i).iter().any(|v| *v > 32.0)
        {
            return Err(format!("{} must use bounded whole quantities", u.name));
        }
    }
    if c.upgrades[14].base != 0.0
        || c.upgrades[18].base + c.upgrades[18].step * c.upgrades[18].cap as f32 <= 0.0
    {
        return Err("Invalid defense baseline".into());
    }
    Ok(())
}

fn validate_effects(c: &Config) -> Result<(), String> {
    let p = &c.powers;
    let d = &c.defense;
    let w = &c.waves;
    for x in [
        p.chain_chance,
        p.chrono_slow,
        p.swamp_chance,
        d.protector_reduction,
    ] {
        if !(0.0..=1.0).contains(&x) {
            return Err("Probability outside [0,1]".into());
        }
    }
    for x in [
        c.tower_radius,
        p.drop_lifetime,
        p.warning,
        p.recovery_fraction,
        p.chain_damage,
        p.chrono_margin,
        p.swamp_radius,
        p.swamp_duration,
        p.fallout_duration,
        p.fallout_attack_multiplier,
        p.demon_duration,
        p.demon_invincible_duration,
        p.demon_damage_multiplier,
        p.demon_drop_interval,
        p.swamp_damage,
        p.swamp_hit_interval,
        p.swamp_stun,
        p.swamp_stun_interval,
        p.blackhole_radius,
        p.blackhole_force,
        p.blackhole_orbit_radius,
        p.spotlight_angle,
        p.spotlight_multiplier,
        p.spotlight_speed,
        p.deathray_speed,
        p.deathray_dps,
        p.deathray_duration,
        p.deathray_cooldown,
        p.deathwave_speed,
        d.orb_radius,
        d.orb_damage,
        d.orb_hit_interval,
        d.mine_damage,
        d.mine_radius,
        d.mine_stun,
        d.mine_lifetime,
        d.shock_force,
        d.protector_radius,
        d.mine_trigger_radius,
        d.enemy_bullet_speed,
        c.specials.commander_radius,
        c.specials.commander_speed_bonus,
        c.specials.commander_attack_bonus,
        c.specials.ray_charge,
        c.specials.sabotage_duration,
        c.specials.sabotage_cooldown,
        c.specials.overcharge_multiplier,
        c.specials.overcharge_speed,
        c.specials.superboss_deathwave_damage,
        c.projectile_lifetime,
        c.missile_turn_rate,
        c.child_damage,
        c.bomb_radius,
        c.rapid_multiplier,
        w.spawn_seconds,
    ] {
        if x <= 0.0 {
            return Err("Durations, distances and effect strengths must be positive".into());
        }
    }
    Ok(())
}

fn validate_timing(c: &Config) -> Result<(), String> {
    let p = &c.powers;
    let d = &c.defense;
    let w = &c.waves;
    if p.durations.iter().any(|x| *x <= p.warning)
        || p.drop_lifetime <= p.warning
        || p.chain_count == 0
        || p.chain_count > 20
        || d.mine_cap == 0
        || d.mine_cap > 500
        || w.boss_every == 0
        || w.fleet_first_wave == 0
        || w.fleet_repeat_waves == 0
        || p.blackhole_count == 0
        || p.blackhole_count > 8
        || p.spotlight_count == 0
        || p.spotlight_count > 12
        || w.spawn_seconds != 30.0
        || w.hp_hits_every == 0
        || p.swamp_stun >= p.swamp_stun_interval
        || p.swamp_cap == 0
        || p.swamp_cap > 8
        || p.fallout_attack_multiplier > 1.0
        || p.demon_invincible_duration > p.demon_duration
        || p.demon_drop_interval <= p.demon_invincible_duration
        || p.demon_damage_multiplier < 1.0
        || c.specials.sabotage_duration >= c.specials.sabotage_cooldown
        || c.specials.scatter_children == 0
        || c.specials.scatter_children > 5
        || c.specials.overcharge_multiplier <= 1.0
        || w.milestones.len() != 400
        || c.starting_coins < 0.0
        || c.bomb_radius > 30.0
    {
        return Err("Invalid timing, capacity or wave settings".into());
    }
    Ok(())
}

fn validate_milestones(c: &Config) -> Result<(), String> {
    let w = &c.waves;
    if w.milestones[0].wave != 1
        || w.milestones
            .iter()
            .enumerate()
            .any(|(index, row)| row.wave != index as u32 + 1)
        || w.milestones.iter().any(|m| {
            m.count < 2.0
                || m.sdk_wave != Waves::sdk_wave(m.wave)
                || m.speed <= 0.0
                || m.mass <= 0.0
                || !(0.0..=1.0).contains(&m.protector_chance)
                || m.count > 50000.0
                || m.bosses < 0.0
                || m.bosses > m.count
                || m.weights.iter().any(|v| *v < 0.0)
                || m.weights.iter().sum::<f32>() <= 0.0
                || m.weights[..5].iter().sum::<f32>() <= 0.0
                || m.weights[5] != 0.0
                || m.weights[12] != 0.0
                || !m.elite_per_wave.is_finite()
                || !(0.0..=2.0).contains(&m.elite_per_wave)
                || !m.fleet_per_wave.is_finite()
                || !(0.0..=1.0).contains(&m.fleet_per_wave)
                || m.elite_per_wave + m.fleet_per_wave >= m.count
                || (m.elite_per_wave > 0.0 && m.weights[6..9].iter().sum::<f32>() == 0.0)
                || (m.fleet_per_wave > 0.0 && m.weights[9..12].iter().sum::<f32>() == 0.0)
        })
        || w.milestones.windows(2).any(|m| {
            m[1].wave <= m[0].wave
                || m[1].count < m[0].count
                || m[1].bosses < m[0].bosses
                || m[1].speed < m[0].speed
                || m[1].mass < m[0].mass
        })
    {
        return Err("Invalid wave pressure milestones".into());
    }
    Ok(())
}

fn validate_income(c: &Config) -> Result<(), String> {
    let r = &c.elite_reference;
    if r.waves == 0
        || r.cleanup_seconds < 0.0
        || !(0.0..=1.0).contains(&r.economy_budget_fraction)
        || r.overlap_fractions.iter().any(|v| !(0.0..=1.0).contains(v))
        || (r.overlap_fractions.iter().sum::<f32>() - 1.0).abs() > 0.0001
    {
        return Err("Invalid reference income assumptions".into());
    }
    Ok(())
}

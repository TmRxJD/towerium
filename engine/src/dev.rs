//! Explicit sandbox controls. Normal persistence never consumes these mutations.
use crate::{
    config::{Config, UPGRADE_COUNT},
    math::V,
    power_shop::POWER_COUNT,
    sim::World,
};
use serde::Deserialize;

pub fn normalize_balance(json: &str) -> Result<String, String> {
    let c: Config = serde_json::from_str(json).map_err(|e| e.to_string())?;
    let mut raw: serde_json::Value = serde_json::from_str(json).map_err(|e| e.to_string())?;
    // Shared experiment files can reach HTML-based legacy help/shop views.
    // Keep display metadata canonical; the sandbox edits numeric mechanics only.
    let standard: serde_json::Value =
        serde_json::from_str(include_str!("../balance.json")).expect("bundled JSON");
    fn fixed_text(value: &serde_json::Value, baseline: &serde_json::Value) -> bool {
        match value {
            serde_json::Value::String(_) => value == baseline,
            serde_json::Value::Array(items) => items.iter().enumerate().all(|(i, v)| {
                baseline
                    .get(i)
                    .or_else(|| baseline.get(0))
                    .is_some_and(|b| fixed_text(v, b))
            }),
            serde_json::Value::Object(fields) => fields
                .iter()
                .all(|(k, v)| baseline.get(k).is_some_and(|b| fixed_text(v, b))),
            _ => true,
        }
    }
    if !fixed_text(&raw, &standard) {
        return Err(
            "Dev settings may change numeric mechanics, not display labels or metadata".into(),
        );
    }
    for (i, value) in crate::power_shop::effect_bases(&c).iter().enumerate() {
        raw["power_workshop"]["upgrades"][i]["effect_base"] = serde_json::json!(value);
    }
    let normalized = raw.to_string();
    Config::parse(&normalized)?;
    Ok(normalized)
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RunEdit {
    pub coins: f32,
    pub stones: u32,
    pub hp: f32,
    pub ammo: [u32; 4],
    pub charges: u8,
    pub shields: u8,
    pub levels: Vec<u32>,
    pub power_levels: Vec<[u32; 2]>,
}

impl World {
    pub fn dev_balance(&mut self, json: &str) -> Result<(), String> {
        let c = Config::parse(&normalize_balance(json)?)?;
        if c.waves
            .milestones
            .iter()
            .any(|w| w.count > 2000.0 || w.elite_per_wave > 100.0 || w.fleet_per_wave > 100.0)
            || c.powers.swamp_cap > 100
            || c.powers.chain_count > 100
            || c.specials.scatter_children > 20
        {
            return Err("Sandbox entity budgets exceeded".into());
        }
        if self.levels.iter().zip(&c.upgrades).any(|(n, u)| *n > u.cap)
            || self.power_levels.iter().enumerate().any(|(i, levels)| {
                levels
                    .iter()
                    .enumerate()
                    .any(|(p, n)| *n > power_cap(&c, i, p))
            })
        {
            return Err("Lower upgrade levels before reducing their caps".into());
        }
        self.c = c;
        self.wave_pressure = self.c.waves.pressure(self.wave.max(1));
        for i in 1..4 {
            self.ammo[i] = self.ammo[i].min(self.ammo_capacity(i));
        }
        Ok(())
    }

    pub fn dev_run(&mut self, json: &str) -> Result<(), String> {
        let edit: RunEdit = serde_json::from_str(json).map_err(|e| e.to_string())?;
        if !edit.coins.is_finite()
            || !(0.0..=1e8).contains(&edit.coins)
            || !edit.hp.is_finite()
            || !(0.0..=1e7).contains(&edit.hp)
            || edit.stones > 100_000_000
            || edit.charges > 3
            || edit.shields > 3
            || edit.ammo.iter().any(|n| *n > 1_000_000)
            || edit.levels.len() != UPGRADE_COUNT
            || edit.power_levels.len() != POWER_COUNT
            || edit
                .levels
                .iter()
                .zip(&self.c.upgrades)
                .any(|(n, u)| *n > u.cap)
            || edit.power_levels.iter().enumerate().any(|(i, levels)| {
                levels
                    .iter()
                    .enumerate()
                    .any(|(p, n)| *n > power_cap(&self.c, i, p))
            })
        {
            return Err("Invalid sandbox values or upgrade levels".into());
        }
        self.coins = edit.coins;
        self.stones = edit.stones;
        self.hp = edit.hp;
        self.levels.copy_from_slice(&edit.levels);
        self.power_levels.copy_from_slice(&edit.power_levels);
        self.ammo = edit.ammo;
        for i in 1..4 {
            self.ammo[i] = self.ammo[i].min(self.ammo_capacity(i));
        }
        self.charges = edit.charges;
        self.shields = edit.shields;
        Ok(())
    }

    pub fn dev_spawn(&mut self, kind: usize, count: u32) -> Result<(), String> {
        if kind >= self.c.enemies.len() || count > 100 || self.enemies.len() + count as usize > 2000
        {
            return Err("Spawn at most 100 enemies; battlefield limit is 2000".into());
        }
        for i in 0..count {
            let a = std::f32::consts::TAU * i as f32 / count as f32;
            self.spawn(
                kind,
                V::new(a.cos() * self.stat(1) * 1.2, a.sin() * self.stat(1) * 1.2),
            );
        }
        Ok(())
    }
}

fn power_cap(c: &Config, i: usize, p: usize) -> u32 {
    if p == 0 {
        c.power_workshop.upgrades[i].weight_costs.len() as u32
    } else {
        c.power_workshop.upgrades[i].effect_costs.len() as u32
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn edit(w: &World) -> serde_json::Value {
        serde_json::json!({"coins":1234,"stones":567,"hp":100,"ammo":w.ammo,"charges":3,"shields":2,"levels":w.levels.to_vec(),"power_levels":w.power_levels.to_vec()})
    }
    #[test]
    fn sandbox_run_edits_are_atomic_and_bounded() {
        let mut w = World::new(Config::standard(), 42);
        let mut bad = edit(&w);
        bad["levels"][0] = serde_json::json!(999);
        let before = w.save();
        assert!(w.dev_run(&bad.to_string()).is_err());
        assert_eq!(w.save(), before);
        assert!(w.dev_run(&edit(&w).to_string()).is_ok());
        assert_eq!(w.coins, 1234.0);
        assert_eq!(w.stones, 567);
        assert_eq!(w.charges, 3);
    }
    #[test]
    fn sandbox_balance_rejects_invalid_configuration_without_changes() {
        let mut w = World::new(Config::standard(), 42);
        let mut c: serde_json::Value =
            serde_json::from_str(include_str!("../balance.json")).unwrap();
        c["enemies"][0]["speed"] = serde_json::json!(-1);
        assert!(w.dev_balance(&c.to_string()).is_err());
        assert!(w.c.enemies[0].speed > 0.0);
        c["enemies"][0]["speed"] = serde_json::json!(21);
        w.dev_balance(&c.to_string()).unwrap();
        assert_eq!(w.c.enemies[0].speed, 21.0);
    }
    #[test]
    fn sandbox_spawning_is_bounded_and_does_not_reward_clears() {
        let mut w = World::new(Config::standard(), 42);
        assert!(w.dev_spawn(99, 1).is_err());
        assert!(w.dev_spawn(0, 101).is_err());
        w.dev_spawn(0, 10).unwrap();
        assert_eq!(w.enemies.len(), 10);
        assert_eq!(w.kills, 0);
    }
    #[test]
    fn shared_experiments_keep_display_metadata_fixed_and_derive_power_bases() {
        let mut c: serde_json::Value =
            serde_json::from_str(include_str!("../balance.json")).unwrap();
        c["upgrades"][0]["description"] = serde_json::json!("<img src=x onerror=alert(1)>");
        assert!(normalize_balance(&c.to_string()).is_err());
        c = serde_json::from_str(include_str!("../balance.json")).unwrap();
        c["powers"]["chain_chance"] = serde_json::json!(0.22);
        let normalized = normalize_balance(&c.to_string()).unwrap();
        let parsed = Config::parse(&normalized).unwrap();
        assert!((parsed.power_workshop.upgrades[0].effect_base - 0.22).abs() < 0.00001);
    }
}

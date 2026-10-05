use crate::{math::Rng, sim::World};
use serde::{Deserialize, Serialize};
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct PerkDefinition {
    name: String,
    effect: String,
    cap: u32,
    tradeoff: bool,
}
fn caps() -> [u32; 15] {
    static DEFINITIONS: std::sync::OnceLock<[PerkDefinition; 15]> = std::sync::OnceLock::new();
    DEFINITIONS
        .get_or_init(|| {
            let catalog: [PerkDefinition; 15] = serde_json::from_str(include_str!("../perks.json"))
                .expect("validated perk catalog");
            assert!(catalog.iter().enumerate().all(|(i, p)| !p.name.is_empty()
                && !p.effect.is_empty()
                && p.cap > 0
                && p.cap <= 5
                && p.tradeoff == (i >= 10)));
            catalog
        })
        .each_ref()
        .map(|p| p.cap)
}
#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Perks {
    pub levels: [u32; 15],
    pub offers: Vec<usize>,
    pub picks: u32,
    pub last: i32,
    #[serde(default)]
    pub origin: u32,
}
impl Default for Perks {
    fn default() -> Self {
        Self {
            levels: [0; 15],
            offers: Vec::new(),
            picks: 0,
            last: -1,
            origin: 0,
        }
    }
}
impl Perks {
    pub fn next_wave(&self) -> u32 {
        self.origin + 5 * (self.picks + 1) * (self.picks + 2) / 2
    }
    pub fn valid(&self, wave: u32, phase: u8) -> bool {
        self.origin <= wave
            && self.picks <= caps().iter().sum::<u32>()
            && self.levels.iter().zip(caps()).all(|(l, c)| *l <= c)
            && self.levels.iter().sum::<u32>() == self.picks
            && (self.last == -1
                || ((0..15).contains(&self.last) && self.levels[self.last as usize] > 0))
            && (self.offers.is_empty() || (phase == 2 && wave >= self.next_wave()))
            && (self.picks == 0 || wave >= self.origin + 5 * self.picks * (self.picks + 1) / 2)
            && (self.offers.is_empty()
                || self.offers.len()
                    == (0..15)
                        .filter(|i| self.levels[*i] < caps()[*i])
                        .count()
                        .min(3))
            && self.offers.iter().enumerate().all(|(n, i)| {
                *i < 15 && self.levels[*i] < caps()[*i] && !self.offers[..n].contains(i)
            })
    }
    pub fn offer(&mut self, wave: u32, rng: &mut Rng) {
        if wave < self.next_wave() || !self.offers.is_empty() {
            return;
        }
        let mut available: Vec<usize> = (0..15).filter(|i| self.levels[*i] < caps()[*i]).collect();
        while self.offers.len() < 3 && !available.is_empty() {
            let n = ((rng.next() * available.len() as f32) as usize).min(available.len() - 1);
            self.offers.push(available.swap_remove(n));
        }
    }
    pub fn damage(&self) -> f32 {
        (1.0 + 0.5 * self.levels[10] as f32) * (1.0 - 0.15 * self.levels[12] as f32)
    }
    pub fn health(&self) -> f32 {
        (1.0 + 0.15 * self.levels[1] as f32)
            * (1.0 - 0.3 * self.levels[10] as f32)
            * (1.0 + 0.5 * self.levels[11] as f32)
    }
    pub fn coins(&self) -> f32 {
        (1.0 + 0.15 * self.levels[6] as f32 + 0.15 * self.levels[9] as f32)
            * (1.0 + 0.4 * self.levels[12] as f32)
    }
    pub fn speed(&self) -> f32 {
        1.0 - 0.08 * self.levels[7] as f32
    }
    pub fn mass(&self) -> f32 {
        1.0 - 0.1 * self.levels[8] as f32
    }
    pub fn stat(&self, i: usize, base: f32) -> f32 {
        match i {
            0 => {
                base * (1.0 + 0.1 * self.levels[3] as f32)
                    * (1.0 - 0.15 * self.levels[11] as f32)
                    * (1.0 + 0.35 * self.levels[13] as f32)
            }
            1 => base * (1.0 - 0.15 * self.levels[13] as f32),
            8 => base + self.levels[5] as f32,
            11 => base * self.health(),
            12 => base * (1.0 + 0.2 * self.levels[2] as f32),
            15 => base * (1.0 - 0.25 * self.levels[14] as f32),
            14 => base + self.levels[4] as f32,
            _ => base,
        }
    }
}
impl World {
    pub fn choose_perk(&mut self, i: usize) -> bool {
        if self.phase != 2 || !self.perks.offers.contains(&i) {
            return false;
        }
        let old_hp = self.stat(11);
        self.perks.levels[i] += 1;
        self.perks.picks += 1;
        self.perks.last = i as i32;
        self.perks.offers.clear();
        let range = self.stat(1);
        for bot in &mut self.bots {
            if bot.position.len() > range {
                bot.position = bot.position.unit().mul(range);
            }
            if bot.target.len() > range {
                bot.target = bot.target.unit().mul(range);
            }
        }

        self.hp = (self.hp * self.stat(11) / old_hp).min(self.stat(11) * (1.0 + self.stat(24)));
        true
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn offers_are_seeded_distinct_and_spaced() {
        let mut a = Perks::default();
        let mut b = Perks::default();
        let mut r = Rng(42);
        let mut s = Rng(42);
        a.offer(4, &mut r);
        assert!(a.offers.is_empty());
        a.offer(5, &mut r);
        b.offer(5, &mut s);
        assert_eq!(a.offers, b.offers);
        assert_eq!(a.offers.len(), 3);
        let saved = serde_json::to_string(&a).unwrap();
        let resumed: Perks = serde_json::from_str(&saved).unwrap();
        assert_eq!(a.offers, resumed.offers);
        assert!(a.valid(5, 2));
        assert!(!a.valid(5, 1));
        for (p, w) in [5, 15, 30, 50, 75].iter().enumerate() {
            a.picks = p as u32;
            assert_eq!(a.next_wave(), *w);
        }
    }
    #[test]
    fn caps_and_tradeoffs_are_explicit() {
        let mut p = Perks::default();
        p.levels[10] = 1;
        p.picks = 1;
        assert_eq!(p.damage(), 1.5);
        assert!((p.health() - 0.7).abs() < 0.001);
        p.levels[10] = 2;
        assert!(!p.valid(10, 2));
        let mut p = Perks {
            levels: caps(),
            ..Perks::default()
        };
        p.picks = caps().iter().sum();
        p.last = 0;
        p.offer(10000, &mut Rng(42));
        assert!(p.offers.is_empty());
        assert!(p.valid(10000, 2));
        assert!(p.speed() > 0.0);
        assert!(p.mass() > 0.0);
    }
}

#[cfg(test)]
mod integration_tests {
    use super::*;
    use crate::{
        config::Config,
        math::V,
        sim::{DT, LIGHT, PROJECTILE},
    };
    fn cleared() -> World {
        let mut w = World::new(Config::standard(), 42);
        w.start_wave();
        w.wave = 5;
        w.wave_ticks = 1800;
        w.ticks = 1800;
        w.time = 30.0;
        w.remaining = 0;
        w.total = 0;
        w.spawned = 0;
        w.advance(DT);
        w
    }
    #[test]
    fn selection_is_required_persisted_and_single_use() {
        let mut w = cleared();
        assert_eq!(w.phase, 2);
        assert_eq!(w.perks.offers.len(), 3);
        assert!(!w.start_wave());
        let data = w.save();
        let mut restored = World::restore(Config::standard(), &data).unwrap();
        assert_eq!(w.perks.offers, restored.perks.offers);
        let choice = restored.perks.offers[0];
        assert!(!restored.choose_perk(99));
        assert!(restored.choose_perk(choice));
        assert!(!restored.choose_perk(choice));
        assert_eq!(restored.perks.picks, 1);
        assert_eq!(restored.perks.next_wave(), 15);
        assert!(restored.start_wave());
        let mut broken: serde_json::Value = serde_json::from_str(&data).unwrap();
        broken["world"]["perks"]["levels"][0] = serde_json::json!(99);
        assert!(World::restore(Config::standard(), &broken.to_string()).is_err());
        let mut old: serde_json::Value = serde_json::from_str(&data).unwrap();
        old["version"] = serde_json::json!(1);
        old["world"].as_object_mut().unwrap().remove("perks");
        old["world"].as_object_mut().unwrap().remove("perk_rng");
        let legacy = World::restore(Config::standard(), &old.to_string()).unwrap();
        assert_eq!(legacy.perks.next_wave(), 10);
    }
    #[test]
    fn perk_offers_and_choices_ignore_combat_rng_draw_count() {
        let mut a = World::new(Config::standard(), 812);
        let mut b = World::new(Config::standard(), 812);
        let mut draws = 317;
        for wave in [5, 15, 30] {
            for _ in 0..draws {
                let _ = a.rng.next();
            }
            for world in [&mut a, &mut b] {
                world.phase = 1;
                world.wave = wave;
                world.wave_ticks = (world.c.waves.spawn_seconds * 60.0) as u32;
                world.remaining = 0;
                world.total = 0;
                world.spawned = 0;
                world.enemies.clear();
                world.advance(DT);
                assert_eq!(world.phase, 2);
                assert_eq!(world.perks.offers.len(), 3);
            }
            assert_eq!(a.perks.offers, b.perks.offers);
            assert_eq!(a.perk_rng.0, b.perk_rng.0);
            let combat_a = a.rng.0;
            let combat_b = b.rng.0;

            let choice = a.perks.offers[0];
            assert!(a.choose_perk(choice));
            assert!(b.choose_perk(choice));
            assert_eq!(a.perks.levels, b.perks.levels);
            assert_eq!(a.perks.picks, b.perks.picks);
            assert_eq!(a.rng.0, combat_a);
            assert_eq!(b.rng.0, combat_b);
            draws *= 2;
        }
    }
    #[test]
    fn perk_rng_roundtrips_before_and_during_offers() {
        let mut original = cleared();
        original.perks.offers.clear();
        let config = original.c.clone();
        let before_offer = original.save();
        let mut resumed = World::restore(config.clone(), &before_offer).unwrap();
        assert_eq!(original.rng.0, resumed.rng.0);
        assert_eq!(original.perk_rng.0, resumed.perk_rng.0);

        original.perks.offer(original.wave, &mut original.perk_rng);
        resumed.perks.offer(resumed.wave, &mut resumed.perk_rng);
        assert_eq!(original.perks.offers, resumed.perks.offers);
        let during_offer = original.save();
        resumed = World::restore(config.clone(), &during_offer).unwrap();
        assert_eq!(original.perks.offers, resumed.perks.offers);
        assert_eq!(original.perk_rng.0, resumed.perk_rng.0);

        let choice = original.perks.offers[0];
        assert!(original.choose_perk(choice));
        assert!(resumed.choose_perk(choice));
        assert_eq!(original.perks.levels, resumed.perks.levels);
        let after_choice = original.save();
        resumed = World::restore(config, &after_choice).unwrap();
        original.perks.offer(15, &mut original.perk_rng);
        resumed.perks.offer(15, &mut resumed.perk_rng);
        assert_eq!(original.perks.offers, resumed.perks.offers);
        assert_eq!(original.perk_rng.0, resumed.perk_rng.0);
    }
    #[test]
    fn version_one_migrates_perk_rng_without_changing_combat_or_pending_perks() {
        let mut original = cleared();
        let first = original.perks.offers[0];
        assert!(original.choose_perk(first));
        original.wave = 15;
        original.perks.offer(15, &mut original.perk_rng);
        let expected_offers = original.perks.offers.clone();
        let expected_levels = original.perks.levels;
        let expected_combat_rng = original.rng.0;
        let mut legacy: serde_json::Value = serde_json::from_str(&original.save()).unwrap();
        legacy["version"] = serde_json::json!(1);
        legacy["world"].as_object_mut().unwrap().remove("perk_rng");

        let first_restore = World::restore(Config::standard(), &legacy.to_string()).unwrap();
        let second_restore = World::restore(Config::standard(), &legacy.to_string()).unwrap();
        assert_eq!(first_restore.perks.offers, expected_offers);
        assert_eq!(first_restore.perks.levels, expected_levels);
        assert_eq!(first_restore.rng.0, expected_combat_rng);
        assert_eq!(first_restore.rng.0, second_restore.rng.0);
        assert_eq!(first_restore.perk_rng.0, second_restore.perk_rng.0);

        let choice = first_restore.perks.offers[0];
        let mut first_restore = first_restore;
        let mut second_restore = second_restore;
        assert!(first_restore.choose_perk(choice));
        assert!(second_restore.choose_perk(choice));
        first_restore.wave = 30;
        second_restore.wave = 30;
        first_restore.perks.offer(30, &mut first_restore.perk_rng);
        second_restore.perks.offer(30, &mut second_restore.perk_rng);
        assert_eq!(first_restore.perks.offers, second_restore.perks.offers);
        assert_eq!(first_restore.perk_rng.0, second_restore.perk_rng.0);
    }
    #[test]
    fn combat_and_tradeoff_effects_reach_actual_stats_and_hits() {
        let mut w = World::new(Config::standard(), 42);
        w.start_wave();
        let hp = w.stat(11);
        let speed = w.stat(0);
        let range = w.stat(1);
        let orbs = w.stat(14);
        let bounce = w.stat(8);
        w.perks.levels[0] = 2;
        w.perks.levels[1] = 1;
        w.perks.levels[3] = 1;
        w.perks.levels[4] = 1;
        w.perks.levels[5] = 1;
        assert!((w.stat(11) - hp * 1.15).abs() < 0.001);
        assert!((w.stat(0) - speed * 1.1).abs() < 0.001);
        assert_eq!(w.stat(14), orbs + 1.0);
        assert_eq!(w.stat(8), bounce + 1.0);
        w.spawn(0, V::new(100.0, 0.0));
        w.enemies[0].hp = 100.0;
        let base = w.c.weapons[0].damage;
        let mult = w.c.enemies[0].weapon_damage[0];
        w.hit(0, base, PROJECTILE);
        assert!((100.0 - w.enemies[0].hp - (base + 2.0) * mult).abs() < 0.001);
        w.perks.levels[10] = 1;
        w.perks.levels[13] = 1;
        assert!((w.stat(11) - hp * 1.15 * 0.7).abs() < 0.001);
        assert!((w.stat(1) - range * 0.85).abs() < 0.001);
        let before = w.enemies[0].hp;
        w.hit(0, base, PROJECTILE);
        assert!((before - w.enemies[0].hp - (base + 2.0) * mult * 1.5).abs() < 0.001);
        assert!(w.light_damage(0) > base);
        let thorns = w.stat(13);
        let orb_speed = w.stat(15);
        w.perks.levels[14] = 1;
        assert_eq!(w.stat(13), thorns);
        assert!((w.stat(15) - orb_speed * 0.75).abs() < 0.001);
        let _ = LIGHT;
    }
    #[test]
    fn projectile_bounce_reaches_second_enemy_and_has_visible_trail() {
        let mut w = World::new(Config::standard(), 42);
        w.start_wave();
        w.remaining = 0;
        w.total = 0;
        w.c.upgrades[6].base = 1.0;
        w.c.upgrades[8].base = 1.0;
        w.c.upgrades[7].base = 120.0;
        w.spawn(2, V::new(100.0, 0.0));
        w.spawn(2, V::new(100.0, 70.0));
        for e in &mut w.enemies {
            e.stun = 10.0;
        }
        w.input(100.0, 0.0, true, PROJECTILE);
        w.advance(DT);
        w.input(100.0, 0.0, false, PROJECTILE);
        let initial = w.enemies[1].hp;
        let mut trail = false;
        for _ in 0..60 {
            w.advance(DT);
            trail |= w.fx.iter().any(|f| f.0 == 16);
        }
        assert!(trail);
        assert!(w.enemies[1].hp < initial);
    }
}

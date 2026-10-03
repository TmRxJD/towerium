use crate::{
    config::{Config, EnemyDef, WaveMilestone, UPGRADE_COUNT},
    math::{angle_delta, segment_distance, Grid, Rng, V},
};
use serde::{Deserialize, Serialize};
use std::f32::consts::{PI, TAU};

pub const DT: f32 = 1.0 / 60.0;
pub const PROJECTILE: u8 = 0;
pub const LIGHT: u8 = 1;
pub const MISSILE: u8 = 2;
pub const BOMB: u8 = 3;
pub const CHILD: u8 = 4;
pub const OTHER: u8 = 5;
pub const AREA_DAMAGE: u8 = 6;
pub const DEATH_WAVE_DAMAGE: u8 = 7;
pub const CHAIN: usize = 0;
pub const CHRONO: usize = 1;
pub const POISON: usize = 2;
pub const BLACKHOLE: usize = 3;
pub const SPOTLIGHT: usize = 4;
pub const DEATHRAY: usize = 5;
pub const GOLDEN: usize = 6;
pub const RECOVERY: usize = 7;
pub const DEATHWAVE: usize = 8;
pub const ENERGY_SHIELD: usize = 9;
pub const VAMPIRE: usize = 6;
pub const RAY: usize = 7;
pub const SCATTER: usize = 8;
pub const COMMANDER: usize = 9;
pub const SABOTEUR: usize = 10;
pub const OVERCHARGE: usize = 11;
pub const SUPERBOSS: usize = 12;
const MULTISHOT_PROC: usize = 0;
const RAPID_PROC: usize = 1;
const BOUNCE_PROC: usize = 2;
const KNOCKBACK_PROC: usize = 3;
const CHAIN_PROC: usize = 4;
const AMMO_PROC: usize = 5;
const POWER_PROC: usize = 6;
const DEATH_DROP_PROC: usize = 7;
const SWAMP_PROC: usize = 8;
const MINE_PROC: usize = 9;

#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Enemy {
    pub id: u32,
    pub kind: usize,
    pub p: V,
    pub hp: f32,
    pub attack: f32,
    pub hits: u32,
    pub stun: f32,
    pub orb_cd: f32,
    pub swamp_cd: f32,
    pub charge: f32,
    pub spin: f32,
    pub child: bool,
}
impl Enemy {
    pub fn definition<'a>(&self, c: &'a Config) -> &'a EnemyDef {
        // Scatter children retain Scatter identity/art with the existing small,
        // fragile child stats. They are terminal descendants, never new parents.
        &c.enemies[if self.child { 1 } else { self.kind }]
    }
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Shot {
    pub id: u32,
    pub kind: u8,
    pub p: V,
    pub angle: f32,
    pub life: f32,
    pub bounces: u32,
    #[serde(default)]
    pub target: Option<u32>,
    pub hit_ids: Vec<u32>,
    #[serde(default)]
    pub counted_shot: bool,
}
#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Drop {
    pub id: u32,
    pub kind: usize,
    pub p: V,
    pub life: f32,
}
#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Area {
    pub p: V,
    pub life: f32,
    pub kind: u8,
}
#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Hostile {
    pub p: V,
    pub v: V,
    pub damage: f32,
    pub source: u32,
}
#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Overcharge {
    pub source: u32,
    pub p: V,
    pub hits: u32,
    pub to_tower: bool,
}
#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Fx(pub u8, pub f32, pub f32, pub f32, pub f32, pub f32);
#[derive(Serialize, Deserialize, Clone)]
#[serde(deny_unknown_fields)]
pub struct Notice {
    pub text: String,
    pub time: f32,
}

#[derive(Serialize, Deserialize, Default, Clone, Copy)]
#[serde(deny_unknown_fields)]
pub struct WeaponStats {
    pub shots: u32,
    pub hits: u32,
    pub kills: u32,
    pub damage: f32,
    #[serde(default)]
    pub ammo_spent: u32,
    #[serde(default)]
    pub ammo_granted: u32,
    #[serde(default)]
    pub ammo_discarded: u32,
}

#[derive(Serialize, Deserialize, Default, Clone, Copy)]
#[serde(deny_unknown_fields)]
pub struct CombatStats {
    pub shots_fired: u32,
    pub shots_landed: u32,
    pub hits_taken: u32,
    pub powerups_collected: u32,
}

#[derive(Serialize)]
pub struct WaveReport {
    pub accuracy: f32,
    pub shots_fired: u32,
    pub hits_taken: u32,
    pub powerups_collected: u32,
    pub coins_earned: f32,
    pub kills: u32,
    pub duration_seconds: f32,
}

impl CombatStats {
    fn report(self, coins_earned: f32, kills: u32, duration_seconds: f32) -> WaveReport {
        WaveReport {
            accuracy: if self.shots_fired > 0 {
                self.shots_landed as f32 / self.shots_fired as f32 * 100.0
            } else {
                0.0
            },
            shots_fired: self.shots_fired,
            hits_taken: self.hits_taken,
            powerups_collected: self.powerups_collected,
            coins_earned,
            kills,
            duration_seconds,
        }
    }
}

#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct World {
    #[serde(skip, default = "save_config")]
    pub c: Config,
    pub rng: Rng,
    pub phase: u8,
    pub paused: bool,
    pub wave: u32,
    pub time: f32,
    pub ticks: u64,
    pub wave_ticks: u32,
    pub wave_kills: u32,
    #[serde(default)]
    pub wave_stats: CombatStats,
    #[serde(default)]
    pub overall_stats: CombatStats,
    #[serde(default)]
    pub weapon_stats: [WeaponStats; 4],
    #[serde(default)]
    pub ammo_pickups: u32,
    #[serde(default)]
    pub ammo_remainders: [u32; 4],
    #[serde(default)]
    pub wave_coins: f32,
    #[serde(default)]
    pub proc_meters: [u32; 10],
    #[serde(skip, default = "default_pressure")]
    wave_pressure: WaveMilestone,
    pub hp: f32,
    pub coins: f32,
    pub earned: f32,
    pub kills: u32,
    pub golden_kills: u32,
    pub ammo: [u32; 4],
    pub weapon: u8,
    pub levels: [u32; UPGRADE_COUNT],
    pub powers: [f32; 7],
    pub charges: u8,
    pub shields: u8,
    pub enemies: Vec<Enemy>,
    pub shots: Vec<Shot>,
    pub drops: Vec<Drop>,
    pub areas: Vec<Area>,
    pub hostile: Vec<Hostile>,
    pub overcharge: Vec<Overcharge>,
    pub disabled_weapon: i32,
    pub disabled_stat: i32,
    pub sabotage_time: f32,
    pub sabotage_cooldown: f32,
    pub sabotage_source: u32,
    pub fx: Vec<Fx>,
    pub notice: Notice,
    pub aim: V,
    pub firing: bool,
    pub remaining: u32,
    pub total: u32,
    pub spawned: u32,
    pub spawn_timer: f32,
    spawn_sectors: [u8; 8],
    pub fire_timer: f32,
    pub rapid: f32,
    pub shock_timer: f32,
    pub orb_angle: f32,
    pub spotlight_angle: f32,
    pub ray_angle: f32,
    pub deathwaves: Vec<f32>,
    deathwave_hits: Vec<Vec<u32>>,
    pub next_id: u32,
    #[serde(skip, default = "Grid::new")]
    pub grid: Grid,
    #[serde(skip)]
    pub nearby: Vec<usize>,
    #[serde(skip)]
    poisoned: Vec<bool>,
    #[serde(skip)]
    protector_indices: Vec<usize>,
    #[serde(skip)]
    deaths: Vec<(V, u8, usize, bool)>,
    pub accumulator: f32,
}

fn save_config() -> Config {
    Config::parse(include_str!("../balance.json")).expect("validated bundled config")
}
fn default_pressure() -> WaveMilestone {
    save_config().waves.pressure(1)
}

#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct RunSave {
    version: u32,
    world: World,
}

impl World {
    pub fn save(&self) -> String {
        serde_json::json!({"version": 1, "world": self}).to_string()
    }
    pub fn restore(c: Config, data: &str) -> Result<Self, String> {
        if data.len() > 5_000_000 {
            return Err("Saved run is too large".into());
        }
        fn bounded(value: &serde_json::Value) -> bool {
            match value {
                serde_json::Value::Number(n) => {
                    n.as_f64().is_some_and(|n| n.is_finite() && n.abs() <= 1e12)
                }
                serde_json::Value::Array(a) => a.len() <= 100_000 && a.iter().all(bounded),
                serde_json::Value::Object(o) => o.values().all(bounded),
                _ => true,
            }
        }
        let value: serde_json::Value =
            serde_json::from_str(data).map_err(|_| "Invalid saved run")?;
        if !bounded(&value) {
            return Err("Saved run exceeds state bounds".into());
        }
        let saved: RunSave = serde_json::from_value(value).map_err(|_| "Invalid saved run")?;
        let mut w = saved.world;
        if saved.version != 1
            || !w.valid_save_header(&c)
            || !w.valid_save_entities(&c)
            || !w.valid_save_effects()
            || !w.valid_save_counters()
        {
            return Err("Invalid saved run state".into());
        }
        let mut ids = std::collections::HashSet::new();
        let unique_ids = w
            .enemies
            .iter()
            .map(|e| e.id)
            .chain(w.shots.iter().map(|s| s.id))
            .chain(w.drops.iter().map(|d| d.id))
            .all(|id| id > 0 && id < w.next_id && ids.insert(id));
        let cleared_shop = w.phase != 2
            || (w.remaining == 0
                && w.enemies.is_empty()
                && w.hostile.is_empty()
                && w.overcharge.is_empty()
                && w.shots.is_empty()
                && w.deathwaves.is_empty()
                && w.wave_ticks >= 1800);
        let invalid_domains = w.powers.iter().any(|t| *t < 0.0)
            || w.earned < 0.0
            || w.rapid < 0.0
            || w.sabotage_time < 0.0
            || w.sabotage_cooldown < 0.0
            || w.enemies.iter().any(|e| {
                e.stun < 0.0
                    || e.orb_cd < 0.0
                    || e.swamp_cd < 0.0
                    || e.charge < 0.0
                    || (e.child && e.kind != SCATTER)
            })
            || w.shots.iter().any(|s| s.life <= 0.0)
            || w.drops.iter().any(|d| d.life <= 0.0)
            || w.areas.iter().any(|a| a.life <= 0.0)
            || w.hostile.iter().any(|b| b.damage < 0.0 || b.v.len() <= 0.0)
            || w.deathwaves.iter().any(|r| *r < 0.0);
        if !unique_ids
            || !cleared_shop
            || invalid_domains
            || w.spawned.checked_add(w.remaining) != Some(w.total)
        {
            return Err("Invalid saved run state".into());
        }
        w.wave_pressure = c.waves.pressure(w.wave);
        w.c = c;
        w.paused = true;
        w.firing = false;
        w.accumulator = 0.0;
        w.rebuild_grid();
        Ok(w)
    }
    fn valid_save_header(&self, c: &Config) -> bool {
        !(!matches!(self.phase, 1 | 2)
            || self.wave == 0
            || self.weapon > 3
            || self.charges > 3
            || self.rng.0 == 0
            || self
                .ammo
                .iter()
                .enumerate()
                .any(|(i, a)| i > 0 && *a > c.weapons[i].capacity)
            || self.spawned > self.total
            || self.remaining > self.total
            || self.levels.iter().zip(&c.upgrades).any(|(l, u)| *l > u.cap))
    }
    fn valid_save_entities(&self, c: &Config) -> bool {
        !(self
            .enemies
            .iter()
            .any(|e| e.kind >= c.enemies.len() || e.id >= self.next_id || e.hp <= 0.0)
            || self.shots.iter().any(|s| {
                s.kind > CHILD
                    || s.id >= self.next_id
                    || s.target
                        .is_some_and(|id| id == 0 || id >= self.next_id || s.kind != BOMB)
            }))
    }
    fn valid_save_effects(&self) -> bool {
        !(self.shields > 3
            || self.drops.iter().any(|d| d.kind > ENERGY_SHIELD)
            || self.areas.iter().any(|a| a.kind > 1)
            || !(-1..=3).contains(&self.disabled_weapon)
            || !(-1..UPGRADE_COUNT as i32).contains(&self.disabled_stat)
            || self.spawn_sectors.iter().any(|s| *s >= 8)
            || self.deathwaves.len() != self.deathwave_hits.len())
    }
    fn valid_save_counters(&self) -> bool {
        !(self.coins < 0.0
            || self.hp <= 0.0
            || self.time < 0.0
            || self.wave_coins < 0.0
            || self.ammo_remainders.iter().any(|r| *r >= 100)
            || self.weapon_stats.iter().any(|s| s.damage < 0.0)
            || self.proc_meters.iter().any(|p| *p >= 1_000_000)
            || self.wave_stats.shots_landed > self.wave_stats.shots_fired
            || self.overall_stats.shots_landed > self.overall_stats.shots_fired)
    }
    pub fn new(c: Config, seed: u32) -> Self {
        let hp = c.upgrades[11].base;
        let coins = c.starting_coins;
        let shock_timer = c.upgrades[18].base;
        let ammo = c.weapons.map(|w| w.ammo);
        let wave_pressure = c.waves.pressure(1);
        Self {
            c,
            rng: Rng(seed.max(1)),
            phase: 0,
            paused: false,
            wave: 0,
            time: 0.0,
            ticks: 0,
            wave_ticks: 0,
            wave_kills: 0,
            wave_stats: CombatStats::default(),
            overall_stats: CombatStats::default(),
            weapon_stats: [WeaponStats::default(); 4],
            ammo_pickups: 0,
            ammo_remainders: [0; 4],
            wave_coins: 0.0,
            proc_meters: [0; 10],
            wave_pressure,
            hp,
            coins,
            earned: 0.0,
            kills: 0,
            golden_kills: 0,
            ammo,
            weapon: 0,
            levels: [0; UPGRADE_COUNT],
            powers: [0.0; 7],
            charges: 0,
            shields: 0,
            enemies: Vec::with_capacity(512),
            shots: Vec::with_capacity(512),
            drops: Vec::with_capacity(24),
            areas: Vec::with_capacity(128),
            hostile: Vec::with_capacity(128),
            overcharge: Vec::with_capacity(32),
            disabled_weapon: -1,
            disabled_stat: -1,
            sabotage_time: 0.0,
            sabotage_cooldown: 0.0,
            sabotage_source: 0,
            fx: Vec::with_capacity(256),
            notice: Notice {
                text: "Aim. Hold to fire. Survive.".into(),
                time: 0.0,
            },
            aim: V::new(0.0, -250.0),
            firing: false,
            remaining: 0,
            total: 0,
            spawned: 0,
            spawn_timer: 0.0,
            spawn_sectors: [0; 8],
            fire_timer: 0.0,
            rapid: 0.0,
            shock_timer,
            orb_angle: 0.0,
            spotlight_angle: 0.0,
            ray_angle: PI,
            deathwaves: Vec::new(),
            deathwave_hits: Vec::new(),
            next_id: 1,
            grid: Grid::new(),
            nearby: Vec::with_capacity(128),
            poisoned: Vec::with_capacity(512),
            protector_indices: Vec::new(),
            deaths: Vec::with_capacity(128),
            accumulator: 0.0,
        }
    }
    fn id(&mut self) -> u32 {
        let id = self.next_id;
        self.next_id += 1;
        id
    }
    pub fn stat(&self, i: usize) -> f32 {
        let u = &self.c.upgrades[i];
        if self.disabled_stat == i as i32 && self.sabotage_time > 0.0 {
            u.base
        } else {
            u.base + u.step * self.levels[i] as f32
        }
    }
    pub fn cost(&self, i: usize) -> f32 {
        let u = &self.c.upgrades[i];
        u.costs.get(self.levels[i] as usize).copied().unwrap_or(0.0)
    }
    pub fn say(&mut self, text: impl Into<String>) {
        self.notice = Notice {
            text: text.into(),
            time: 4.0,
        };
    }
    pub fn start_wave(&mut self) -> bool {
        if self.phase != 0 && self.phase != 2 {
            return false;
        }
        self.wave += 1;
        self.phase = 1;
        self.paused = false;
        self.accumulator = 0.0;
        self.firing = false;
        self.wave_pressure = self.c.waves.pressure(self.wave);
        self.total = self.wave_pressure.count.ceil() as u32;
        self.wave_ticks = 0;
        self.wave_kills = 0;
        self.wave_stats = CombatStats::default();
        self.wave_coins = 0.0;
        self.remaining = self.total;
        self.spawned = 0;
        self.spawn_timer = self.c.waves.spawn_at(0, self.total);
        self.fire_timer = 0.0;
        self.say(format!("Wave {}", self.wave));
        true
    }
    pub(crate) fn proc(&mut self, slot: usize, chance: f32) -> bool {
        if chance <= 0.0 {
            return false;
        }
        // Integer credits avoid drift in percentage values represented as f32.
        self.proc_meters[slot] += (chance.min(1.0) * 1_000_000.0).round() as u32;
        if self.proc_meters[slot] >= 1_000_000 {
            self.proc_meters[slot] -= 1_000_000;
            true
        } else {
            false
        }
    }
    pub fn buy(&mut self, i: usize) -> bool {
        if self.phase != 2
            || i >= UPGRADE_COUNT
            || self.levels[i] >= self.c.upgrades[i].cap
            || self.coins + 0.001 < self.cost(i)
        {
            return false;
        }
        self.coins -= self.cost(i);
        self.levels[i] += 1;
        if i == 11 {
            self.hp =
                (self.hp + self.c.upgrades[i].step).min(self.stat(11) * (1.0 + self.stat(24)));
        }
        if i == 18 {
            self.shock_timer = self.shock_timer.min(self.stat(18));
        }
        self.say(format!("{} upgraded", self.c.upgrades[i].name));
        true
    }
    pub fn pause(&mut self, value: bool) {
        self.paused = value;
        self.firing = false;
        self.accumulator = 0.0;
    }
    pub fn advance(&mut self, elapsed: f32) {
        if self.paused || self.phase != 1 || !elapsed.is_finite() || elapsed <= 0.0 {
            self.accumulator = 0.0;
            return;
        }
        self.accumulator += elapsed.min(0.1);
        let mut steps = 0;
        while self.accumulator + 0.000001 >= DT && steps < 6 && self.phase == 1 {
            self.accumulator = (self.accumulator - DT).max(0.0);
            self.tick();
            steps += 1;
        }
        if steps == 6 {
            self.accumulator = 0.0;
        }
    }
    pub fn input(&mut self, x: f32, y: f32, fire: bool, weapon: u8) {
        if x.is_finite() && y.is_finite() {
            self.aim = V::new(x.clamp(-600.0, 600.0), y.clamp(-600.0, 600.0));
        }
        self.weapon = weapon.min(3);
        self.firing = fire && !self.paused && self.phase == 1;
    }
    pub fn activate(&mut self, k: usize) {
        if k < 10 && self.phase == 1 {
            self.wave_stats.powerups_collected += 1;
            self.overall_stats.powerups_collected += 1;
        }
        const NAMES: [&str; 10] = [
            "Chain Lightning",
            "Chrono Field",
            "Poison Swamp",
            "Black Hole",
            "Spotlight",
            "Death Ray",
            "Golden Tower",
            "Recovery Package",
            "Death Wave",
            "Energy Shield",
        ];
        if k < 7 {
            self.powers[k] += self.c.powers.durations[k] + self.stat(20);
        } else if k == RECOVERY {
            self.hp = (self.hp + self.stat(11) * self.c.powers.recovery_fraction)
                .min(self.stat(11) * (1.0 + self.stat(24)));
        } else if k == DEATHWAVE {
            self.charges = (self.charges + 1).min(3);
        } else if k == ENERGY_SHIELD {
            self.shields = (self.shields + 1).min(3);
        }
        if k < 10 {
            self.say(if k == DEATHWAVE {
                format!("Death Wave banked · {}/3 · press Q", self.charges)
            } else {
                format!("{} active", NAMES[k])
            });
        }
    }
    pub fn death_wave(&mut self) -> bool {
        if self.charges == 0 || self.phase != 1 || self.paused {
            return false;
        }
        self.charges -= 1;
        self.deathwaves.push(0.0);
        self.deathwave_hits.push(Vec::new());
        self.say("Death Wave released");
        true
    }
    pub fn spawn(&mut self, kind: usize, p: V) {
        let id = self.id();
        let e = &self.c.enemies[kind];
        if kind == 4 {
            self.protector_indices.push(self.enemies.len());
        }
        self.enemies.push(Enemy {
            id,
            kind,
            p,
            hp: e.hp,
            attack: 0.3,
            hits: 0,
            stun: 0.0,
            orb_cd: 0.0,
            swamp_cd: 0.0,
            charge: 0.0,
            spin: 0.0,
            child: false,
        });
    }
    fn spawn_next(&mut self) {
        let bosses = (self.wave_pressure.bosses.round() as u32).min(self.total / 2);
        let boss = self.wave.is_multiple_of(self.c.waves.boss_every)
            && (1..=bosses).any(|i| self.spawned == i * self.total / (bosses + 1));
        let mut kind = 0;
        if self.wave.is_multiple_of(10) && self.spawned == 0 {
            kind = SUPERBOSS;
        } else if boss {
            kind = 5;
        } else {
            let total: f32 = self
                .c
                .enemies
                .iter()
                .enumerate()
                .filter(|(_, e)| e.unlock <= self.wave)
                .map(|(i, _)| self.wave_pressure.weights[i])
                .sum();
            let mut roll = self.rng.next() * total;
            for (i, e) in self.c.enemies.iter().enumerate() {
                if e.unlock <= self.wave && self.wave_pressure.weights[i] > 0.0 {
                    roll -= self.wave_pressure.weights[i];
                    if roll <= 0.0 {
                        kind = i;
                        break;
                    }
                }
            }
        }
        let slot = self.spawned as usize % 8;
        if slot == 0 {
            // Cover every sector once per eight arrivals, with opposite pairs
            // spreading pressure immediately even in sparse early waves.
            let mut axes = [0, 1, 2, 3];
            for i in (1..axes.len()).rev() {
                let j = ((self.rng.next() * (i + 1) as f32) as usize).min(i);
                axes.swap(i, j);
            }
            for (i, axis) in axes.into_iter().enumerate() {
                let first = axis + if self.rng.chance(0.5) { 4 } else { 0 };
                self.spawn_sectors[i * 2] = first;
                self.spawn_sectors[i * 2 + 1] = (first + 4) % 8;
            }
        }
        let angle = (self.spawn_sectors[slot] as f32 + self.rng.next().min(0.9999)) * TAU / 8.0;
        self.spawn(kind, V::polar(angle, 490.0_f32.max(self.stat(1) + 45.0)));
        self.remaining -= 1;
        self.spawned += 1;
    }
    fn rebuild_protectors(&mut self) {
        self.protector_indices.clear();
        self.protector_indices.extend(
            self.enemies
                .iter()
                .enumerate()
                .filter(|(_, e)| e.kind == 4 && e.hp > 0.0)
                .map(|(i, _)| i),
        );
    }
    fn rebuild_grid(&mut self) {
        self.rebuild_protectors();
        self.grid.clear();
        for (i, e) in self.enemies.iter().enumerate() {
            if e.hp > 0.0 {
                self.grid.insert(e.p, i);
            }
        }
    }
    fn tick(&mut self) {
        self.ticks += 1;
        self.wave_ticks += 1;
        self.time = self.ticks as f32 / 60.0;
        // All hits in this tick use the same beam angles that the snapshot exports.
        self.spotlight_angle =
            (self.spotlight_angle + self.c.powers.spotlight_speed * DT).rem_euclid(TAU);
        self.notice.time = (self.notice.time - DT).max(0.0);
        for t in &mut self.powers {
            *t = (*t - DT).max(0.0);
        }
        self.rapid = (self.rapid - DT).max(0.0);
        self.sabotage_time = (self.sabotage_time - DT).max(0.0);
        self.sabotage_cooldown = (self.sabotage_cooldown - DT).max(0.0);
        if self.sabotage_time <= 0.0
            || !self
                .enemies
                .iter()
                .any(|e| e.id == self.sabotage_source && e.hp > 0.0)
        {
            self.disabled_weapon = -1;
            self.disabled_stat = -1;
            self.sabotage_time = 0.0;
        }
        self.fire_timer -= DT;
        self.shock_timer -= DT;
        if self.hp < self.stat(11) {
            self.hp = (self.hp + self.stat(12) * DT).min(self.stat(11));
        }
        for f in &mut self.fx {
            f.5 -= DT;
        }
        self.fx.retain(|f| f.5 > 0.0);
        for d in &mut self.drops {
            d.life -= DT;
        }
        self.drops.retain(|d| d.life > 0.0);
        for a in &mut self.areas {
            a.life -= DT;
        }
        self.areas.retain(|a| a.life > 0.0);
        while self.remaining > 0 && self.wave_ticks as f32 / 60.0 >= self.spawn_timer {
            self.spawn_next();
            self.spawn_timer = self.c.waves.spawn_at(self.spawned, self.total);
        }
        self.move_enemies();
        self.rebuild_grid();
        if self.shock_timer <= 0.0 {
            self.shockwave();
            self.shock_timer = self.stat(18);
            self.rebuild_grid();
        }
        if self.firing && self.fire_timer <= 0.0 {
            self.fire();
        }
        self.move_shots();
        self.defenses();
        self.enemy_bullets();
        self.overcharge_bullets();
        self.resolve_deaths();
        self.enemies.retain(|e| e.hp > 0.0);
        self.rebuild_protectors();
        self.hostile.retain(|b| b.p.len() < 1000.0);
        if self.hp <= 0.0 {
            self.hp = 0.0;
            self.phase = 3;
            self.firing = false;
            self.say("Tower lost");
        } else if self.remaining == 0
            && self.enemies.is_empty()
            && self.hostile.is_empty()
            && self.wave_ticks as f32 >= self.c.waves.spawn_seconds * 60.0
        {
            self.phase = 2;
            self.firing = false;
            self.shots.clear();
            self.deathwaves.clear();
            self.deathwave_hits.clear();
            self.say(format!("Wave {} cleared · choose your upgrades", self.wave));
        }
    }
    fn blackhole_center(&self, index: usize) -> V {
        V::polar(
            self.time * 0.18 + index as f32 * TAU / self.c.powers.blackhole_count as f32,
            self.c.powers.blackhole_orbit_radius,
        )
    }
    fn spotlight_direction(&self, index: usize) -> f32 {
        (self.spotlight_angle + index as f32 * TAU / self.c.powers.spotlight_count as f32)
            .rem_euclid(TAU)
    }
    pub fn chrono_radius(&self) -> f32 {
        self.stat(1) + self.c.powers.chrono_margin
    }
    fn boundary_attacker(kind: usize) -> bool {
        matches!(kind, 3 | VAMPIRE | RAY | SABOTEUR | OVERCHARGE)
    }
    fn move_enemies(&mut self) {
        let blackholes: Vec<_> = if self.powers[BLACKHOLE] > 0.0 {
            (0..self.c.powers.blackhole_count)
                .map(|i| self.blackhole_center(i))
                .collect()
        } else {
            Vec::new()
        };
        let speed = self.c.waves.speed_multiplier(self.wave);
        let mass = self.c.waves.mass_multiplier(self.wave);
        let range = self.stat(1);
        let chrono_radius = self.chrono_radius();
        let commanders: Vec<_> = self
            .enemies
            .iter()
            .filter(|e| e.kind == COMMANDER && e.hp > 0.0)
            .map(|e| (e.id, e.p))
            .collect();
        for i in 0..self.enemies.len() {
            if self.enemies[i].hp <= 0.0 {
                continue;
            }
            let e = &mut self.enemies[i];
            let def = e.definition(&self.c);
            let commanded = commanders
                .iter()
                .any(|&(id, p)| id != e.id && p.dist(e.p) <= self.c.specials.commander_radius);
            let move_bonus = if commanded {
                1.0 + self.c.specials.commander_speed_bonus
            } else {
                1.0
            };
            let attack_bonus = if commanded {
                1.0 + self.c.specials.commander_attack_bonus
            } else {
                1.0
            };
            e.orb_cd = (e.orb_cd - DT).max(0.0);
            e.swamp_cd = (e.swamp_cd - DT).max(0.0);
            e.stun = (e.stun - DT).max(0.0);
            if e.stun > 0.0 {
                continue;
            }
            e.attack -= DT
                * if Self::boundary_attacker(e.kind) {
                    attack_bonus
                } else {
                    1.0
                };
            let resistance = def.resistance;
            // Equal-strength fields choose the nearest center; overlapping holes
            // neither multiply pull nor cancel each other with opposing vectors.
            if let Some(bh) = blackholes
                .iter()
                .copied()
                .filter(|p| e.p.dist(*p) < self.c.powers.blackhole_radius)
                .min_by(|a, b| e.p.dist(*a).total_cmp(&e.p.dist(*b)))
            {
                e.p = e.p.add(
                    bh.sub(e.p)
                        .unit()
                        .mul(self.c.powers.blackhole_force * (1.0 - resistance) / mass * DT),
                );
            }
            let slow = if self.powers[CHRONO] > 0.0 && e.p.len() < chrono_radius {
                1.0 - self.c.powers.chrono_slow * (1.0 - resistance)
            } else {
                1.0
            };
            let stop = if Self::boundary_attacker(e.kind) {
                range
            } else {
                self.c.tower_radius + def.radius
            };
            if e.p.len() > stop {
                e.p = e.p.sub(
                    e.p.unit()
                        .mul((def.speed * speed * move_bonus * slow * DT).min(e.p.len() - stop)),
                );
            }
            if !Self::boundary_attacker(e.kind) && e.p.len() < stop {
                let outward = if e.p.len() > 0.001 {
                    e.p.unit()
                } else {
                    V::new(1.0, 0.0)
                };
                e.p = outward.mul(stop);
            }
            if e.p.len() > stop + 1.0 {
                // A Ray displaced outside its firing range must charge again.
                e.charge = 0.0;
                continue;
            }
            if e.kind == VAMPIRE {
                // Continuous drain is not a contact hit: it does not proc Thorns.
                self.hp = (self.hp - def.damage * DT).max(0.0);
                continue;
            }
            if e.kind == RAY {
                if e.charge > 0.0 {
                    let progress = 1.0 - e.charge / self.c.specials.ray_charge;
                    e.spin = (e.spin + (1.5 + 18.0 * progress * progress) * DT).rem_euclid(TAU);
                    e.charge = (e.charge - DT * attack_bonus).max(0.0);
                    if e.charge <= 0.0 {
                        let damage = heated_damage(def.damage, def.heat, e.hits);
                        e.hits = e.hits.saturating_add(1);
                        e.attack = def.attack_interval;
                        self.hostile.push(Hostile {
                            p: e.p,
                            v: e.p.unit().mul(-self.c.defense.enemy_bullet_speed * 2.0),
                            damage,
                            source: e.id,
                        });
                        self.fx.push(Fx(1, e.p.x, e.p.y, 0.0, 0.0, 0.3));
                    }
                } else if e.attack <= 0.0 {
                    e.charge = self.c.specials.ray_charge;
                }
                continue;
            }
            if e.attack <= 0.0 {
                e.attack = if Self::boundary_attacker(e.kind) {
                    def.attack_interval
                } else {
                    1.0
                };
                let damage = heated_damage(def.damage, def.heat, e.hits);
                e.hits = e.hits.saturating_add(1);
                if e.kind == SABOTEUR {
                    let source = e.id;
                    self.sabotage(source);
                } else if e.kind == OVERCHARGE {
                    if !self.overcharge.iter().any(|b| b.source == e.id) {
                        self.overcharge.push(Overcharge {
                            source: e.id,
                            p: e.p,
                            hits: 0,
                            to_tower: true,
                        });
                    }
                } else if e.kind == 3 {
                    self.hostile.push(Hostile {
                        p: e.p,
                        v: e.p.unit().mul(-self.c.defense.enemy_bullet_speed),
                        damage,
                        source: e.id,
                    });
                } else {
                    self.tower_hit(i, damage);
                }
            }
        }
    }
    fn sabotage(&mut self, source: u32) {
        if self.sabotage_cooldown > 0.0 || self.sabotage_time > 0.0 {
            return;
        }
        const COMBAT_STATS: [usize; 16] = [0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 13, 14, 15, 16, 17, 18];
        let mut choices: Vec<(i32, i32)> = (1..4)
            .filter(|&w| self.ammo[w] > 0)
            .map(|w| (w as i32, -1))
            .collect();
        choices.extend(
            COMBAT_STATS
                .iter()
                .copied()
                .filter(|&i| self.levels[i] > 0)
                .map(|i| (-1, i as i32)),
        );
        if choices.is_empty() {
            return;
        }
        let selection = (self.rng.next() * choices.len() as f32) as usize;
        (self.disabled_weapon, self.disabled_stat) = choices[selection];
        self.sabotage_source = source;
        self.sabotage_time = self.c.specials.sabotage_duration;
        self.sabotage_cooldown = self.c.specials.sabotage_cooldown;
        let label = if self.disabled_weapon >= 0 {
            ["Projectiles", "Light Speed", "Smart Missiles", "Hook Bomb"]
                [self.disabled_weapon as usize]
                .to_owned()
        } else {
            self.c.upgrades[self.disabled_stat as usize].name.clone()
        };
        self.say(format!("Sabotaged: {label}"));
    }
    fn overcharge_bullets(&mut self) {
        let mut balls = std::mem::take(&mut self.overcharge);
        balls.retain_mut(|ball| {
            let Some(source) = self
                .enemies
                .iter()
                .find(|e| e.id == ball.source && e.hp > 0.0)
            else {
                return false;
            };
            let target = if ball.to_tower { V::ZERO } else { source.p };
            let distance = ball.p.dist(target);
            let step = self.c.specials.overcharge_speed * DT;
            let contact = if ball.to_tower {
                self.c.tower_radius
            } else {
                self.c.enemies[source.kind].radius
            };
            if distance <= step + contact {
                if ball.to_tower {
                    let damage = (self.c.enemies[source.kind].damage as f64
                        * (self.c.specials.overcharge_multiplier as f64).powf(ball.hits as f64))
                    .min(f32::MAX as f64) as f32;
                    if !self.block_hit(damage) {
                        if damage > 0.0 && self.hp > 0.0 {
                            self.record_hit_taken();
                        }
                        self.hp = (self.hp - damage).max(0.0);
                        self.fx.push(Fx(3, 0.0, 0.0, 45.0, 0.0, 0.25));
                    }
                    ball.hits = ball.hits.saturating_add(1);
                }
                ball.to_tower = !ball.to_tower;
            } else {
                ball.p = ball.p.add(target.sub(ball.p).unit().mul(step));
            }
            true
        });
        self.overcharge = balls;
    }
    pub fn tower_hit(&mut self, i: usize, damage: f32) {
        if self.block_hit(damage) {
            return;
        }
        let received = damage.max(0.0).min(self.hp.max(0.0));
        self.hp -= received;
        if received > 0.0 {
            self.record_hit_taken();
            self.fx.push(Fx(3, 0.0, 0.0, 45.0, 0.0, 0.25));
            let thorns = self.stat(13);
            if thorns > 0.0 {
                let boss_scale = if matches!(self.enemies[i].kind, 5 | SUPERBOSS) {
                    0.5
                } else {
                    1.0
                };
                self.hit(
                    i,
                    thorns * self.c.weapons[PROJECTILE as usize].damage * boss_scale,
                    OTHER,
                );
            }
        }
    }
    fn block_hit(&mut self, damage: f32) -> bool {
        if damage > 0.0 && self.hp > 0.0 && self.shields > 0 {
            self.shields -= 1;
            self.fx
                .push(Fx(9, 0.0, 0.0, self.c.tower_radius + 10.0, 0.0, 0.4));
            return true;
        }
        false
    }
    fn record_hit_taken(&mut self) {
        self.wave_stats.hits_taken += 1;
        self.overall_stats.hits_taken += 1;
    }
    fn record_landed_shot(&mut self) {
        self.wave_stats.shots_landed += 1;
        self.overall_stats.shots_landed += 1;
    }
    fn enemy_bullets(&mut self) {
        for i in (0..self.hostile.len()).rev() {
            let b = &mut self.hostile[i];
            b.p = b.p.add(b.v.mul(DT));
            if b.p.len() < self.c.tower_radius {
                let b = self.hostile.swap_remove(i);
                if let Some(index) = self
                    .enemies
                    .iter()
                    .position(|e| e.id == b.source && e.hp > 0.0)
                {
                    self.tower_hit(index, b.damage);
                } else if !self.block_hit(b.damage) {
                    let received = b.damage.max(0.0).min(self.hp.max(0.0));
                    self.hp -= received;
                    if received > 0.0 {
                        self.record_hit_taken();
                        self.fx.push(Fx(3, 0.0, 0.0, 45.0, 0.0, 0.25));
                    }
                }
            }
        }
    }
    fn shockwave(&mut self) {
        let size = self.stat(17);
        let mass = self.c.waves.mass_multiplier(self.wave);
        for e in &mut self.enemies {
            if e.hp > 0.0 && e.p.len() <= size {
                e.p = e.p.add(e.p.unit().mul(
                    self.c.defense.shock_force * (1.0 - e.definition(&self.c).resistance) / mass,
                ));
            }
        }
        self.fx.push(Fx(2, 0.0, 0.0, size, 0.0, 0.6));
    }
    fn new_shot(&mut self, kind: u8, p: V, angle: f32) -> Shot {
        Shot {
            id: self.id(),
            kind,
            p,
            angle,
            life: self.c.projectile_lifetime,
            bounces: 0,
            target: None,
            hit_ids: Vec::with_capacity(6),
            counted_shot: false,
        }
    }
    fn can_engage(&self, angle: f32) -> bool {
        let range = self.stat(1);
        self.aim.len() <= range
            || self.enemies.iter().any(|e| {
                e.hp > 0.0
                    && e.p.len() <= range + 0.1
                    && angle_delta(angle, e.p.angle()).abs() < 0.2
            })
            || self
                .drops
                .iter()
                .any(|d| d.p.len() <= range && angle_delta(angle, d.p.angle()).abs() < 0.2)
    }
    fn fire(&mut self) {
        let kind = self.weapon;
        if self.disabled_weapon == kind as i32 && self.sabotage_time > 0.0 {
            self.fire_timer = 0.15;
            return;
        }
        let hook_target = if kind == BOMB {
            self.enemies
                .iter()
                .filter(|e| e.hp > 0.0)
                .min_by(|a, b| a.p.dist(self.aim).total_cmp(&b.p.dist(self.aim)))
                .map(|e| (e.id, e.p))
        } else {
            None
        };
        let angle = hook_target.map_or(self.aim.angle(), |(_, p)| p.angle());
        if hook_target.is_none() && !self.can_engage(angle) {
            return;
        }
        if kind > 0 && self.ammo[kind as usize] == 0 {
            self.fire_timer = 0.3;
            self.say("Ammo empty · select Projectiles [1]");
            return;
        }
        if kind > 0 {
            self.ammo[kind as usize] -= 1;
            self.weapon_stats[kind as usize].ammo_spent += 1;
        }
        let spec = self.c.weapons[kind as usize];
        let standard_upgrades = kind == PROJECTILE || kind == LIGHT;
        if standard_upgrades && self.proc(RAPID_PROC, self.stat(4)) {
            self.rapid = self.stat(5);
        }
        self.fire_timer = if kind == MISSILE {
            spec.interval
        } else {
            spec.interval
                / self.stat(0)
                / if standard_upgrades && self.rapid > 0.0 {
                    self.c.rapid_multiplier
                } else {
                    1.0
                }
        };
        let count = if standard_upgrades && self.proc(MULTISHOT_PROC, self.stat(2)) {
            self.stat(3) as usize
        } else {
            1
        };
        for n in 0..count {
            self.wave_stats.shots_fired += 1;
            self.overall_stats.shots_fired += 1;
            self.weapon_stats[kind as usize].shots += 1;
            let a = angle + (n as f32 - (count - 1) as f32 / 2.0) * 0.14;
            if kind == LIGHT {
                self.light_shot(a);
            } else {
                let mut s = self.new_shot(kind, V::polar(a, 27.0), a);
                s.counted_shot = true;
                s.target = hook_target.map(|(id, _)| id);
                self.shots.push(s);
            }
        }
        self.fx.push(Fx(0, angle, 0.0, 0.0, 0.0, 0.09));
    }
    fn light_shot(&mut self, angle: f32) {
        let end = V::polar(angle, self.stat(1));
        let target = self
            .enemies
            .iter()
            .enumerate()
            .filter(|(_, e)| {
                e.hp > 0.0
                    && e.p.len() <= self.stat(1) + 0.1
                    && segment_distance(e.p, V::ZERO, end) < e.definition(&self.c).radius + 3.0
            })
            .min_by(|(_, a), (_, b)| a.p.len().total_cmp(&b.p.len()))
            .map(|(i, e)| (i, e.p.len()));
        let drop = self
            .drops
            .iter()
            .enumerate()
            .filter(|(_, d)| segment_distance(d.p, V::ZERO, end) < 18.0)
            .min_by(|(_, a), (_, b)| a.p.len().total_cmp(&b.p.len()))
            .map(|(i, d)| (i, d.p.len()));
        let mut distance = self.stat(1);
        if drop.is_some_and(|(_, d)| target.is_none_or(|(_, e)| d < e)) {
            let (i, d) = drop.unwrap();
            distance = d;
            let item = self.drops.swap_remove(i);
            self.record_landed_shot();
            self.activate(item.kind);
        } else if let Some((i, d)) = target {
            self.record_landed_shot();
            distance = d;
            let mut origin = self.enemies[i].p;
            let mut visited = vec![self.enemies[i].id];
            self.impact(i, LIGHT, 1.0);
            // One bounded bounce walk per beam; chain effects never create new walks.
            for _ in 0..self.stat(8) as usize {
                if !self.proc(BOUNCE_PROC, self.stat(6)) {
                    break;
                }
                let next = self
                    .enemies
                    .iter()
                    .enumerate()
                    .filter(|(_, e)| {
                        e.hp > 0.0 && !visited.contains(&e.id) && e.p.dist(origin) <= self.stat(7)
                    })
                    .min_by(|(_, a), (_, b)| a.p.dist(origin).total_cmp(&b.p.dist(origin)))
                    .map(|(index, _)| index);
                let Some(next) = next else {
                    break;
                };
                let end = self.enemies[next].p;
                visited.push(self.enemies[next].id);
                self.impact(next, LIGHT, 1.0);
                self.fx.push(Fx(1, origin.x, origin.y, end.x, end.y, 0.14));
                origin = end;
            }
        }
        let p = V::polar(angle, distance);
        self.fx.push(Fx(1, 0.0, 0.0, p.x, p.y, 0.14));
    }
    fn move_shots(&mut self) {
        // Take reusable buffers to allow impact handlers to mutate the world without cloning entities.
        let mut shots = std::mem::take(&mut self.shots);
        let mut nearby = std::mem::take(&mut self.nearby);
        for s in &mut shots {
            s.life -= DT;
            if s.life <= 0.0 {
                continue;
            }
            if s.kind == MISSILE {
                self.grid.query(s.p, 300.0, &mut nearby);
                let target = nearby
                    .iter()
                    .copied()
                    .filter(|&i| self.enemies[i].hp > 0.0 && self.enemies[i].p.dist(s.p) < 300.0)
                    .min_by(|&a, &b| {
                        let score = |i: usize| {
                            self.enemies[i].p.dist(s.p) + self.enemies[i].p.dist(self.aim) * 0.35
                        };
                        score(a).total_cmp(&score(b))
                    });
                if let Some(i) = target {
                    let turn = angle_delta(s.angle, self.enemies[i].p.sub(s.p).angle());
                    s.angle += turn.clamp(
                        -self.c.missile_turn_rate * DT,
                        self.c.missile_turn_rate * DT,
                    );
                }
            }
            if s.kind == BOMB {
                if let Some(enemy) = self
                    .enemies
                    .iter()
                    .find(|e| Some(e.id) == s.target && e.hp > 0.0)
                {
                    s.angle = enemy.p.sub(s.p).angle();
                }
            }
            let old = s.p;
            let speed = if s.kind == CHILD {
                self.c.weapons[0].speed * 0.8
            } else {
                self.c.weapons[s.kind as usize].speed
            };
            s.p = s.p.add(V::polar(s.angle, speed * DT));
            let travel = old.dist(s.p);
            let radius = if s.kind == BOMB || s.kind == CHILD {
                self.c.bomb_radius
            } else {
                4.0
            };
            self.grid.query(
                old.add(s.p).mul(0.5),
                travel * 0.5 + 48.0 + radius,
                &mut nearby,
            );
            let target = nearby
                .iter()
                .copied()
                .filter(|&i| {
                    let e = &self.enemies[i];
                    e.hp > 0.0
                        && !s.hit_ids.contains(&e.id)
                        && segment_distance(e.p, old, s.p) <= e.definition(&self.c).radius + radius
                })
                .min_by(|&a, &b| {
                    self.enemies[a]
                        .p
                        .dist(old)
                        .total_cmp(&self.enemies[b].p.dist(old))
                });
            let drop = self
                .drops
                .iter()
                .enumerate()
                .filter(|(_, d)| segment_distance(d.p, old, s.p) < 18.0)
                .min_by(|(_, a), (_, b)| a.p.dist(old).total_cmp(&b.p.dist(old)))
                .map(|(i, _)| i);
            if drop.is_some_and(|d| {
                target.is_none_or(|e| self.drops[d].p.dist(old) < self.enemies[e].p.dist(old))
            }) {
                let d = self.drops.swap_remove(drop.unwrap());
                if s.counted_shot && s.hit_ids.is_empty() {
                    self.record_landed_shot();
                }
                self.activate(d.kind);
                s.life = 0.0;
                continue;
            }
            if let Some(i) = target {
                let p = self.enemies[i].p;
                let eid = self.enemies[i].id;
                if s.counted_shot && s.hit_ids.is_empty() {
                    self.record_landed_shot();
                }
                s.hit_ids.push(eid);
                let damage = if s.kind == CHILD {
                    self.c.child_damage
                } else {
                    self.c.weapons[s.kind as usize].damage
                };
                self.impact(i, s.kind, damage);
                if s.kind == BOMB {
                    self.split_bomb(p, eid);
                } else if s.kind == MISSILE {
                    self.fx.push(Fx(8, p.x, p.y, 30.0, 0.0, 0.3));
                } else if s.kind == CHILD {
                    self.fx.push(Fx(7, p.x, p.y, 45.0, 0.0, 0.3));
                }
                if s.kind == PROJECTILE
                    && s.bounces < (self.stat(8) as u32)
                    && self.proc(BOUNCE_PROC, self.stat(6))
                {
                    self.grid.query(p, self.stat(7), &mut nearby);
                    let bounce = nearby
                        .iter()
                        .copied()
                        .filter(|&j| {
                            self.enemies[j].hp > 0.0
                                && !s.hit_ids.contains(&self.enemies[j].id)
                                && self.enemies[j].p.dist(p) <= self.stat(7)
                        })
                        .min_by(|&a, &b| {
                            self.enemies[a]
                                .p
                                .dist(p)
                                .total_cmp(&self.enemies[b].p.dist(p))
                        });
                    if let Some(j) = bounce {
                        s.p = p;
                        s.angle = self.enemies[j].p.sub(p).angle();
                        s.bounces += 1;
                        continue;
                    }
                }
                s.life = 0.0;
            }
            if s.p.len() > 760.0 {
                s.life = 0.0;
            }
        }
        shots.retain(|s| s.life > 0.0);
        shots.append(&mut self.shots);
        self.shots = shots;
        self.nearby = nearby;
    }
    pub fn split_bomb(&mut self, p: V, origin_id: u32) {
        // Fragments emerge from the impact enemy; don't immediately consume all six inside it.
        for i in 0..6 {
            let mut s = self.new_shot(CHILD, p, i as f32 * TAU / 6.0);
            s.hit_ids.push(origin_id);
            self.shots.push(s);
        }
        self.fx.push(Fx(7, p.x, p.y, 45.0, 0.0, 0.3));
    }
    pub fn impact(&mut self, i: usize, source: u8, damage: f32) {
        let p = self.enemies[i].p;
        let damage = if source == LIGHT {
            self.light_damage(i)
        } else {
            damage
        };
        if !self.hit(i, damage, source) {
            return;
        }
        if source <= LIGHT {
            if self.proc(KNOCKBACK_PROC, self.stat(9)) {
                let force = self.stat(10) * (1.0 - self.enemies[i].definition(&self.c).resistance)
                    / self.c.waves.mass_multiplier(self.wave);
                self.enemies[i].p = self.enemies[i].p.add(p.unit().mul(force));
            }
            if self.powers[CHAIN] > 0.0 && self.proc(CHAIN_PROC, self.c.powers.chain_chance) {
                self.chain_from(i, p);
            }
        }
    }
    fn chain_from(&mut self, first: usize, mut p: V) {
        let mut visited = vec![first];
        for _ in 0..self.c.powers.chain_count {
            let target = (0..self.enemies.len())
                .filter(|i| !visited.contains(i) && self.enemies[*i].hp > 0.0)
                .min_by(|&a, &b| {
                    self.enemies[a]
                        .p
                        .dist(p)
                        .total_cmp(&self.enemies[b].p.dist(p))
                });
            if let Some(i) = target {
                let q = self.enemies[i].p;
                if !self.hit(i, self.c.powers.chain_damage, OTHER) {
                    break;
                }
                self.fx.push(Fx(5, p.x, p.y, q.x, q.y, 0.2));
                p = q;
                visited.push(i);
            } else {
                break;
            }
        }
    }
    fn protected(&self, i: usize) -> bool {
        self.protector_indices.iter().any(|&j| {
            let e = &self.enemies[j];
            e.hp > 0.0 && e.p.dist(self.enemies[i].p) < self.c.defense.protector_radius
        })
    }
    fn damage_multiplier(&self, i: usize, protected: bool) -> f32 {
        let p = self.enemies[i].p;
        let spotlight = self.powers[SPOTLIGHT] > 0.0
            && (0..self.c.powers.spotlight_count).any(|beam| {
                angle_delta(self.spotlight_direction(beam), p.angle()).abs()
                    < self.c.powers.spotlight_angle.to_radians() * 0.5
            });
        (if spotlight {
            self.c.powers.spotlight_multiplier
        } else {
            1.0
        }) * if self.enemies[i].kind != 4 && protected {
            1.0 - self.c.defense.protector_reduction
        } else {
            1.0
        }
    }
    pub fn light_damage(&self, i: usize) -> f32 {
        let multiplier = self.damage_multiplier(i, self.protected(i));
        if multiplier <= 0.0 {
            return 0.0;
        }
        let hp = self.enemies[i].definition(&self.c).hp;
        let normal_hits = (hp / (self.c.weapons[0].damage * multiplier) - 0.00001)
            .ceil()
            .max(1.0);
        let hits = (normal_hits - 1.0).max(1.0);
        // One ULP at max HP prevents repeated f32 subtraction needing an extra hit.
        (hp / hits + f32::EPSILON * hp) / multiplier
    }
    pub fn hit(&mut self, i: usize, mut damage: f32, source: u8) -> bool {
        if self.enemies[i].hp <= 0.0 || damage <= 0.0 {
            return false;
        }
        let p = self.enemies[i].p;
        let protected = self.protected(i);
        // A living Protector shields itself as well as its neighbors from
        // passive defenses. Player-fired weapons still expose this priority target.
        if protected && source >= OTHER {
            return false;
        }
        if matches!(source, BOMB | CHILD) && !matches!(self.enemies[i].kind, 5 | SUPERBOSS) {
            // Hook contacts ignore shield/Spotlight; outside range two full-health hits are required.
            damage = self.enemies[i].definition(&self.c).hp;
        } else {
            damage *= self.damage_multiplier(i, protected);
        }
        if source <= CHILD {
            damage *= self.enemies[i].definition(&self.c).weapon_damage[if source == CHILD {
                BOMB as usize
            } else {
                source as usize
            }];
        }
        if source <= CHILD && p.len() > self.stat(1) + 0.1 {
            damage *= if matches!(self.enemies[i].kind, 5 | SUPERBOSS) {
                0.25
            } else {
                0.5
            };
        }
        if damage <= 0.0 {
            return false;
        }
        if source <= CHILD {
            let stats = &mut self.weapon_stats[if source == CHILD {
                BOMB as usize
            } else {
                source as usize
            }];
            stats.hits += 1;
            stats.damage += damage.min(self.enemies[i].hp);
            if self.enemies[i].hp - damage <= 0.00001 {
                stats.kills += 1;
            }
        }
        self.enemies[i].hp -= damage;
        if self.enemies[i].hp <= 0.00001 {
            self.enemies[i].hp = 0.0;
            self.deaths
                .push((p, source, self.enemies[i].kind, self.enemies[i].child));
            self.reward(i, source);
        }
        true
    }
    fn reward(&mut self, i: usize, source: u8) {
        let amount = self.enemies[i].definition(&self.c).coins
            * self.stat(19)
            * if self.powers[GOLDEN] > 0.0 {
                self.c.powers.golden_multiplier
            } else {
                1.0
            };
        self.coins += amount;
        self.earned += amount;
        self.wave_coins += amount;
        self.kills += 1;
        if self.powers[GOLDEN] > 0.0 {
            self.golden_kills += 1;
        }
        self.wave_kills += 1;
        let p = self.enemies[i].p;
        self.fx.push(Fx(6, p.x, p.y, amount, 0.0, 0.5));
        if source <= CHILD && self.proc(AMMO_PROC, self.stat(23)) {
            self.ammo_pickups += 1;
            for weapon in 1..4 {
                if !self
                    .ammo_pickups
                    .is_multiple_of(self.c.weapons[weapon].pickup_every)
                {
                    continue;
                }
                // Carry hundredths so every +20% level benefits small integer bundles.
                let quantity = (self.stat(22) * 100.0).round() as u64;
                let credit = self.c.weapons[weapon].pickup as u64 * quantity
                    + self.ammo_remainders[weapon] as u64;
                self.ammo_remainders[weapon] = (credit % 100) as u32;
                let amount = (credit / 100).min(u32::MAX as u64) as u32;
                let available = self.c.weapons[weapon].capacity - self.ammo[weapon];
                let granted = amount.min(available);
                self.ammo[weapon] += granted;
                self.weapon_stats[weapon].ammo_granted = self.weapon_stats[weapon]
                    .ammo_granted
                    .saturating_add(granted);
                self.weapon_stats[weapon].ammo_discarded = self.weapon_stats[weapon]
                    .ammo_discarded
                    .saturating_add(amount - granted);
            }
        }
        if self.proc(POWER_PROC, self.stat(21)) {
            let kind = if self.proc(DEATH_DROP_PROC, self.c.powers.death_wave_weight) {
                DEATHWAVE
            } else {
                let ordinary = (self.rng.next() * 9.0) as usize;
                if ordinary == 8 {
                    ENERGY_SHIELD
                } else {
                    ordinary
                }
            };
            let id = self.id();
            if self.drops.len() >= 128 {
                self.drops.remove(0);
            }
            self.drops.push(Drop {
                id,
                kind,
                p,
                life: self.c.powers.drop_lifetime,
            });
        }
    }
    fn resolve_deaths(&mut self) {
        let mut deaths = std::mem::take(&mut self.deaths);
        for &(p, source, kind, is_child) in &deaths {
            if kind == SCATTER && !is_child && source != DEATH_WAVE_DAMAGE {
                self.fx.push(Fx(4, p.x, p.y, 38.0, 0.0, 0.35));
                for child in 0..self.c.specials.scatter_children {
                    let offset = V::polar(
                        child as f32 * TAU / self.c.specials.scatter_children as f32,
                        20.0,
                    );
                    let position = p.add(offset);
                    let wall = self.c.tower_radius + self.c.enemies[1].radius;
                    self.spawn(
                        SCATTER,
                        if position.len() < wall {
                            position.unit().mul(wall)
                        } else {
                            position
                        },
                    );
                    let spawned = self.enemies.last_mut().unwrap();
                    spawned.child = true;
                    spawned.hp = self.c.enemies[1].hp;
                }
            }
            if self.powers[POISON] > 0.0 && self.proc(SWAMP_PROC, self.c.powers.swamp_chance) {
                self.areas.push(Area {
                    p,
                    life: self.c.powers.swamp_duration,
                    kind: 0,
                });
            }
            // Mine/swamp/Death Wave kills don't recursively mint new mines.
            if source <= OTHER && self.proc(MINE_PROC, self.stat(16)) {
                if self.areas.iter().filter(|a| a.kind == 1).count() >= self.c.defense.mine_cap {
                    if let Some(i) = self.areas.iter().position(|a| a.kind == 1) {
                        self.areas.remove(i);
                    }
                }
                self.areas.push(Area {
                    p,
                    life: self.c.defense.mine_lifetime,
                    kind: 1,
                });
            }
        }
        deaths.clear();
        self.deaths = deaths;
    }
    fn defenses(&mut self) {
        let mut near = std::mem::take(&mut self.nearby);
        self.orb_angle = (self.orb_angle + self.stat(15) * DT).rem_euclid(TAU);
        self.ray_angle = (self.ray_angle + self.c.powers.deathray_speed * DT).rem_euclid(TAU);
        for n in 0..self.stat(14) as usize {
            let p = V::polar(
                self.orb_angle + n as f32 * TAU / self.stat(14),
                self.c.defense.orb_radius,
            );
            self.grid.query(p, 58.0, &mut near);
            for &i in &near {
                if self.enemies[i].hp > 0.0
                    && self.enemies[i].orb_cd <= 0.0
                    && self.enemies[i].p.dist(p) < self.enemies[i].definition(&self.c).radius + 9.0
                    && self.hit(i, self.c.defense.orb_damage, OTHER)
                {
                    self.enemies[i].orb_cd = self.c.defense.orb_hit_interval;
                }
            }
        }
        let mut areas = std::mem::take(&mut self.areas);
        let mut poisoned = std::mem::take(&mut self.poisoned);
        poisoned.clear();
        poisoned.resize(self.enemies.len(), false);
        for a in &mut areas {
            let r = if a.kind == 0 {
                self.c.powers.swamp_radius
            } else {
                self.c.defense.mine_radius
            };
            self.grid.query(a.p, r + 48.0, &mut near);
            if a.kind == 0 {
                for &i in &near {
                    if !poisoned[i]
                        && self.enemies[i].p.dist(a.p) < r
                        && self.hit(i, self.c.powers.swamp_dps * DT, AREA_DAMAGE)
                    {
                        poisoned[i] = true;
                        if self.enemies[i].hp > 0.0 && self.enemies[i].swamp_cd <= 0.0 {
                            self.enemies[i].stun = self.enemies[i].stun.max(
                                self.c.powers.swamp_stun
                                    * (1.0 - self.enemies[i].definition(&self.c).resistance),
                            );
                            self.enemies[i].swamp_cd = self.c.powers.swamp_stun_interval;
                        }
                    }
                }
            } else if near.iter().any(|&i| {
                self.enemies[i].hp > 0.0
                    && self.enemies[i].p.dist(a.p)
                        < self.c.defense.mine_trigger_radius
                            + self.enemies[i].definition(&self.c).radius
            }) {
                a.life = 0.0;
                self.fx.push(Fx(4, a.p.x, a.p.y, r, 0.0, 0.35));
                for &i in &near {
                    if self.enemies[i].p.dist(a.p) < r
                        && self.hit(i, self.c.defense.mine_damage, AREA_DAMAGE)
                        && self.enemies[i].hp > 0.0
                    {
                        self.enemies[i].stun = self.c.defense.mine_stun
                            * (1.0 - self.enemies[i].definition(&self.c).resistance);
                    }
                }
            }
        }
        areas.retain(|a| a.life > 0.0);
        areas.append(&mut self.areas);
        self.areas = areas;
        self.poisoned = poisoned;
        if self.powers[DEATHRAY] > 0.0 {
            let end = V::polar(self.ray_angle, 710.0);
            for i in 0..self.enemies.len() {
                if segment_distance(self.enemies[i].p, V::ZERO, end)
                    < self.enemies[i].definition(&self.c).radius + 5.0
                {
                    self.hit(i, self.c.powers.deathray_dps * DT, OTHER);
                }
            }
        }
        for radius in &mut self.deathwaves {
            *radius += self.c.powers.deathwave_speed * DT;
        }
        for wave in 0..self.deathwaves.len() {
            for i in 0..self.enemies.len() {
                let e = &self.enemies[i];
                if e.hp > 0.0
                    && e.p.len() <= self.deathwaves[wave] + e.definition(&self.c).radius
                    && !self.deathwave_hits[wave].contains(&e.id)
                {
                    self.deathwave_hits[wave].push(e.id);
                    // The fixed Super Boss class takes one fixed hit per wave pulse.
                    self.enemies[i].hp = if e.kind == SUPERBOSS {
                        e.hp - self.c.specials.superboss_deathwave_damage
                    } else {
                        0.0
                    };
                    if self.enemies[i].hp <= 0.0 {
                        self.deaths.push((
                            self.enemies[i].p,
                            DEATH_WAVE_DAMAGE,
                            self.enemies[i].kind,
                            self.enemies[i].child,
                        ));
                        self.reward(i, AREA_DAMAGE);
                    }
                }
            }
        }
        for i in (0..self.deathwaves.len()).rev() {
            if self.deathwaves[i] >= 740.0 {
                self.deathwaves.remove(i);
                self.deathwave_hits.remove(i);
            }
        }
        self.nearby = near;
    }
}
pub fn heated_damage(base: f32, heat: f32, hits: u32) -> f32 {
    base * (1.0 + heat * hits as f32)
}

// One bulk JSON snapshot, compact entity tuples; no per-entity JS/WASM calls.
#[derive(Serialize)]
pub struct Snapshot<'a> {
    pub phase: u8,
    pub paused: bool,
    pub wave: u32,
    pub wave_report: WaveReport,
    pub overall_report: WaveReport,
    pub weapon_report: [WeaponStats; 4],
    pub ammo_pickups: u32,
    pub wave_time: f32,
    pub cleanup_seconds: f32,
    pub golden_kills: u32,
    pub time: f32,
    pub speed_multiplier: f32,
    pub mass_multiplier: f32,
    pub chrono_radius: f32,
    pub disabled_weapon: i32,
    pub disabled_stat: i32,
    pub sabotage_time: f32,
    pub hp: f32,
    pub max_hp: f32,
    pub coins: f32,
    pub earned: f32,
    pub kills: u32,
    pub weapon: u8,
    pub ammo: [u32; 4],
    pub charges: u8,
    pub powers: [f32; 7],
    pub shields: u8,
    pub overheal: f32,
    pub remaining: u32,
    pub total: u32,
    pub spawned: u32,
    pub range: f32,
    pub rapid: f32,
    pub shock_in: f32,
    pub orb_angle: f32,
    pub orb_count: u32,
    pub spotlight_angle: f32,
    pub blackholes: Vec<(f32, f32)>,
    pub spotlights: Vec<f32>,
    pub ray_angle: f32,
    pub enemies: Vec<(u32, usize, f32, f32, f32, f32, f32)>,
    pub enemy_effects: Vec<(u32, f32, bool, bool)>,
    pub enemy_radii: Vec<(u32, f32)>,
    pub ray_spins: Vec<(u32, f32)>,
    pub shots: Vec<(u32, u8, f32, f32, f32)>,
    pub drops: Vec<(u32, usize, f32, f32, f32)>,
    pub areas: Vec<(u8, f32, f32, f32)>,
    pub hostile: Vec<(f32, f32)>,
    pub overcharge: Vec<(u32, f32, f32, u32, bool)>,
    pub deathwaves: &'a Vec<f32>,
    pub fx: &'a Vec<Fx>,
    pub notice: &'a Notice,
    pub levels: [u32; UPGRADE_COUNT],
    pub values: Vec<f32>,
    pub costs: Vec<f32>,
}
impl World {
    pub fn snapshot(&self) -> Snapshot<'_> {
        let commanders: Vec<_> = self
            .enemies
            .iter()
            .filter(|e| e.kind == COMMANDER && e.hp > 0.0)
            .collect();
        Snapshot {
            phase: self.phase,
            paused: self.paused,
            wave: self.wave,
            wave_report: self.wave_stats.report(
                self.wave_coins,
                self.wave_kills,
                self.wave_ticks as f32 / 60.0,
            ),
            weapon_report: self.weapon_stats,
            ammo_pickups: self.ammo_pickups,
            overall_report: self
                .overall_stats
                .report(self.earned, self.kills, self.time),
            wave_time: self.wave_ticks as f32 / 60.0,
            cleanup_seconds: (self.wave_ticks as f32 / 60.0 - self.c.waves.spawn_seconds).max(0.0),
            golden_kills: self.golden_kills,
            time: self.time,
            speed_multiplier: self.c.waves.speed_multiplier(self.wave),
            mass_multiplier: self.c.waves.mass_multiplier(self.wave),
            chrono_radius: self.chrono_radius(),
            disabled_weapon: self.disabled_weapon,
            disabled_stat: self.disabled_stat,
            sabotage_time: self.sabotage_time,
            hp: self.hp,
            max_hp: self.stat(11),
            coins: self.coins,
            earned: self.earned,
            kills: self.kills,
            weapon: self.weapon,
            ammo: self.ammo,
            charges: self.charges,
            powers: self.powers,
            shields: self.shields,
            overheal: self.stat(24),
            remaining: self.remaining,
            total: self.total,
            spawned: self.spawned,
            range: self.stat(1),
            rapid: self.rapid,
            shock_in: self.shock_timer,
            orb_angle: self.orb_angle,
            orb_count: self.stat(14) as u32,
            spotlight_angle: self.spotlight_angle,
            blackholes: (0..self.c.powers.blackhole_count)
                .map(|i| {
                    let p = self.blackhole_center(i);
                    (p.x, p.y)
                })
                .collect(),
            spotlights: (0..self.c.powers.spotlight_count)
                .map(|i| self.spotlight_direction(i))
                .collect(),
            ray_angle: self.ray_angle,
            enemies: self
                .enemies
                .iter()
                .map(|e| {
                    (
                        e.id,
                        e.kind,
                        e.p.x,
                        e.p.y,
                        e.hp,
                        e.definition(&self.c).hp,
                        e.stun,
                    )
                })
                .collect(),
            shots: self
                .shots
                .iter()
                .map(|s| (s.id, s.kind, s.p.x, s.p.y, s.angle))
                .collect(),
            enemy_effects: self
                .enemies
                .iter()
                .map(|e| {
                    (
                        e.id,
                        if e.charge > 0.0 {
                            1.0 - e.charge / self.c.specials.ray_charge
                        } else {
                            0.0
                        },
                        commanders.iter().any(|other| {
                            other.id != e.id
                                && other.p.dist(e.p) <= self.c.specials.commander_radius
                        }),
                        e.kind == VAMPIRE
                            && e.hp > 0.0
                            && e.stun <= 0.0
                            && e.p.len() <= self.stat(1) + 1.0,
                    )
                })
                .collect(),
            ray_spins: self
                .enemies
                .iter()
                .filter(|e| e.kind == RAY)
                .map(|e| (e.id, e.spin))
                .collect(),
            enemy_radii: self
                .enemies
                .iter()
                .filter(|e| e.child)
                .map(|e| (e.id, e.definition(&self.c).radius))
                .collect(),
            drops: self
                .drops
                .iter()
                .map(|d| (d.id, d.kind, d.p.x, d.p.y, d.life))
                .collect(),
            areas: self
                .areas
                .iter()
                .map(|a| (a.kind, a.p.x, a.p.y, a.life))
                .collect(),
            hostile: self.hostile.iter().map(|b| (b.p.x, b.p.y)).collect(),
            overcharge: self
                .overcharge
                .iter()
                .map(|b| (b.source, b.p.x, b.p.y, b.hits, b.to_tower))
                .collect(),
            deathwaves: &self.deathwaves,
            fx: &self.fx,
            notice: &self.notice,
            levels: self.levels,
            values: (0..UPGRADE_COUNT).map(|i| self.stat(i)).collect(),
            costs: (0..UPGRADE_COUNT).map(|i| self.cost(i)).collect(),
        }
    }
}

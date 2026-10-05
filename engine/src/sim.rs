use crate::power_expansion::{default_bots, BotState, AOE, EXTRA_ORBS, GOLD_BOT};
use crate::power_shop::POWER_COUNT;
use crate::{
    config::{Config, EnemyDef, WaveMilestone, UPGRADE_COUNT},
    math::{angle_delta, segment_distance, Grid, Rng, V},
};
use serde::{Deserialize, Serialize};
fn deserialize_power_levels<'de, D: serde::Deserializer<'de>>(
    d: D,
) -> Result<[[u32; 2]; POWER_COUNT], D::Error> {
    let v = Vec::<[u32; 2]>::deserialize(d)?;
    if v.len() != 16 && v.len() != POWER_COUNT {
        return Err(serde::de::Error::custom("Invalid power level count"));
    }
    let mut out = [[0; 2]; POWER_COUNT];
    out[..v.len()].copy_from_slice(&v);
    Ok(out)
}
use std::f32::consts::{PI, TAU};

pub const DT: f32 = 1.0 / 60.0;
fn deserialize_levels<'de, D: serde::Deserializer<'de>>(
    deserializer: D,
) -> Result<[u32; UPGRADE_COUNT], D::Error> {
    let values = Vec::<u32>::deserialize(deserializer)?;
    if values.len() != 25 && values.len() != UPGRADE_COUNT {
        return Err(serde::de::Error::custom("Invalid workshop level count"));
    }
    let mut levels = [0; UPGRADE_COUNT];
    levels[..values.len()].copy_from_slice(&values);
    Ok(levels)
}
pub const PROJECTILE: u8 = 0;
pub const LIGHT: u8 = 1;
pub const MISSILE: u8 = 2;
pub const BOMB: u8 = 3;
pub const CHILD: u8 = 4;
pub const OTHER: u8 = 5;
pub const AREA_DAMAGE: u8 = 6;
pub const DEATH_WAVE_DAMAGE: u8 = 7;
pub const NUKE_DAMAGE: u8 = 8;
pub const ORB_DAMAGE: u8 = 9;
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
pub const NUKE: usize = 10;
pub const DEMON: usize = 11;
pub const DP: usize = 0;
pub const SD: usize = 1;
pub const PH: usize = 2;
pub const NEXUS: usize = 15;
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
const PULSAR_PROC: usize = 7;
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
    #[serde(default)]
    pub swamp_hit_cd: f32,
    #[serde(default)]
    pub extra_orb_cd: f32,
    #[serde(default)]
    pub burn_left: f32,
    #[serde(default)]
    pub burn_tick: f32,
    #[serde(default)]
    pub burn_stage: u32,
    #[serde(default)]
    pub thunder_slow_time: f32,
    #[serde(default)]
    pub thunder_inside: bool,
    #[serde(default)]
    pub deathray_inside: bool,
    #[serde(default)]
    pub blackhole: Option<usize>,
    #[serde(default)]
    pub blackhole_distance: f32,
    #[serde(default)]
    pub blackhole_hit_time: f32,
    pub charge: f32,
    pub spin: f32,
    pub child: bool,
    #[serde(default)]
    pub deathwave_tag: bool,
    #[serde(default = "full_mobility")]
    pub mobility: f32,
}
fn full_mobility() -> f32 {
    1.0
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
    #[serde(default)]
    pub stones_earned: u32,
}

#[derive(Serialize)]
pub struct WaveReport {
    pub accuracy: f32,
    pub shots_fired: u32,
    pub hits_taken: u32,
    pub powerups_collected: u32,
    pub stones_earned: u32,
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
            stones_earned: self.stones_earned,
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
    #[serde(default)]
    pub dp_seed: u32,
    #[serde(default)]
    pub hp_scaled: bool,
    #[serde(default)]
    pub elite_credit: f32,
    #[serde(default)]
    pub special_queue: Vec<usize>,
    #[serde(default)]
    pub special_spawned: usize,
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
    #[serde(default)]
    pub wall_hp: f32,
    #[serde(default)]
    pub wall_rebuild: f32,
    pub coins: f32,
    #[serde(default)]
    pub stones: u32,
    #[serde(default)]
    pub stones_earned: u32,
    #[serde(default, deserialize_with = "deserialize_power_levels")]
    pub power_levels: [[u32; 2]; POWER_COUNT],
    #[serde(default)]
    pub extra_power_times: [f32; 6],
    #[serde(default = "default_bots")]
    pub bots: [BotState; 4],
    #[serde(default)]
    pub extra_orb_angle: f32,
    #[serde(default)]
    pub gold_stone_credit: f32,
    pub earned: f32,
    pub kills: u32,
    pub golden_kills: u32,
    pub ammo: [u32; 4],
    pub weapon: u8,
    #[serde(deserialize_with = "deserialize_levels")]
    pub levels: [u32; UPGRADE_COUNT],
    pub powers: [f32; 7],
    #[serde(default)]
    pub module_times: [f32; 4],
    #[serde(default)]
    pub coin_overlap_kills: [u32; 32],
    #[serde(default)]
    pub coin_bonus_kills: [u32; 5],
    #[serde(default)]
    pub coin_bonus_coins: [f32; 5],
    #[serde(default)]
    pub fallout_time: f32,
    #[serde(default)]
    pub demon_time: f32,
    #[serde(default)]
    pub demon_invincible: f32,
    #[serde(default)]
    pub demon_drop_cooldown: f32,
    #[serde(default)]
    pub pending_start_wave: u32,
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
    #[serde(default)]
    pub ray_cycle: f32,
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
        if !w.hp_scaled {
            let bonus = (w.wave / c.waves.hp_hits_every) as f32 * c.weapons[0].damage;
            for enemy in &mut w.enemies {
                if enemy.hp > 0.0 {
                    enemy.hp += bonus;
                }
            }
            w.hp_scaled = true;
        }
        if saved.version != 1
            || !w.valid_save_header(&c)
            || !w.valid_save_entities(&c)
            || !w.valid_save_effects()
            || !w.valid_save_counters()
            || !w.valid_expansion_state()
            || !w.valid_power_budget(&c)
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
                && (w.wave_ticks >= 1800 || w.valid_milestone_shop()));
        let invalid_domains = w.powers.iter().any(|t| *t < 0.0)
            || w.power_levels.iter().enumerate().any(|(i, l)| {
                l[0] as usize > c.power_workshop.upgrades[i].weight_costs.len()
                    || l[1] as usize > c.power_workshop.upgrades[i].effect_costs.len()
            })
            || w.module_times.iter().any(|t| *t < 0.0)
            || !(0.0..1.0).contains(&w.elite_credit)
            || w.special_queue.len() > 16
            || w.special_spawned > w.special_queue.len()
            || w.special_queue
                .iter()
                .any(|kind| ![4, 6, 7, 8, 9, 10, 11].contains(kind))
            || w.coin_bonus_coins.iter().any(|c| *c < 0.0)
            || w.fallout_time < 0.0
            || w.demon_time < 0.0
            || w.demon_invincible < 0.0
            || w.demon_invincible > w.demon_time
            || w.demon_drop_cooldown < 0.0
            || w.demon_drop_cooldown > c.powers.demon_drop_interval
            || w.earned < 0.0
            || w.rapid < 0.0
            || w.sabotage_time < 0.0
            || w.sabotage_cooldown < 0.0
            || w.enemies.iter().any(|e| {
                e.stun < 0.0
                    || e.orb_cd < 0.0
                    || e.swamp_cd < 0.0
                    || e.swamp_hit_cd < 0.0
                    || e.swamp_hit_cd > c.powers.swamp_hit_interval
                    || e.charge < 0.0
                    || (e.child && e.kind != SCATTER)
            })
            || w.shots.iter().any(|s| s.life <= 0.0)
            || w.drops
                .iter()
                .any(|d| d.life <= 0.0 || d.kind >= POWER_COUNT)
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
        // Slot three belonged to the removed Om Chip; Nexus grants power time directly.
        w.module_times[3] = 0.0;
        for timer in w
            .powers
            .iter_mut()
            .chain(w.module_times.iter_mut())
            .chain(w.extra_power_times.iter_mut())
        {
            *timer = timer.min(w.c.powers.timer_cap);
        }
        w.fallout_time = w.fallout_time.min(w.c.powers.timer_cap);
        w.demon_time = w.demon_time.min(w.c.powers.timer_cap);
        w.demon_invincible = w.demon_invincible.min(w.c.powers.timer_cap);
        w.paused = true;
        w.firing = false;
        w.accumulator = 0.0;
        w.rebuild_grid();
        Ok(w)
    }
    fn valid_milestone_shop(&self) -> bool {
        self.phase == 2
            && self.pending_start_wave == self.wave
            && self.wave > 0
            && self.wave <= 10_000
            && self.wave_ticks == 0
            && self.total == 0
            && self.time == 0.0
            && self.ticks == 0
            && self.kills == 0
            && self.earned == 0.0
    }
    /// Replays the last completed tenth wave from its actual shop checkpoint.
    /// Retry counts and player unlocks belong to the persistent human profile.
    pub fn retry_checkpoint(c: Config, data: &str) -> Result<Self, String> {
        let mut w = Self::restore(c, data)?;
        if w.phase != 2 || !w.wave.is_multiple_of(10) || w.pending_start_wave != 0 {
            return Err("Retry requires a completed tenth-wave checkpoint".into());
        }
        w.wave -= 1;
        w.drops.clear();
        w.areas.clear();
        w.fx.clear();
        w.start_wave();
        Ok(w)
    }
    /// A fresh workshop funded by the existing reference earnings model.
    /// No old purchases, combat reports, pickups or active powers carry over.
    pub fn milestone_start(c: Config, seed: u32, wave: u32) -> Result<Self, String> {
        if wave == 0 || !wave.is_multiple_of(50) || wave > 10_000 {
            return Err("Milestone must be a completed multiple of 50, at most 10000".into());
        }
        Self::autoplay_start(c, seed, wave)
    }
    pub fn autoplay_start(c: Config, seed: u32, wave: u32) -> Result<Self, String> {
        if wave == 0 || wave > 10_000 {
            return Err("Start wave must be between 1 and 10000".into());
        }
        let budget =
            crate::balance::reference_income(&c, wave - 1).expected_kill_coins + c.starting_coins;
        let mut w = Self::new(c, seed);
        w.phase = 2;
        w.wave = wave;
        w.pending_start_wave = wave;
        w.coins = budget;
        w.stones = crate::balance::reference_stones(&w.c, wave - 1);
        w.stones_earned = w.stones;
        w.say(format!("Prepare for wave {wave}"));
        Ok(w)
    }
    fn valid_save_header(&self, c: &Config) -> bool {
        !(!matches!(self.phase, 1 | 2)
            || self.wave == 0
            || self.weapon > 3
            || self.charges > 3
            || self.ray_cycle < 0.0
            || self.ray_cycle >= c.powers.deathray_duration + c.powers.deathray_cooldown
            || self.rng.0 == 0
            || (self.pending_start_wave != 0 && !self.valid_milestone_shop())
            || self.ammo.iter().enumerate().any(|(i, a)| {
                i > 0
                    && *a
                        > (c.weapons[i].capacity as f32
                            * (c.upgrades[29].base + c.upgrades[29].step * self.levels[29] as f32))
                            as u32
            })
            || self.wall_hp < 0.0
            || self.wall_hp > c.upgrades[27].base + c.upgrades[27].step * self.levels[27] as f32
            || self.wall_rebuild < 0.0
            || self.wall_rebuild > c.upgrades[28].base
            || (self.levels[27] > 0 && self.wall_hp == 0.0 && self.wall_rebuild == 0.0)
            || self.spawned > self.total
            || self.remaining > self.total
            || self.levels.iter().zip(&c.upgrades).any(|(l, u)| *l > u.cap))
    }
    fn valid_save_entities(&self, c: &Config) -> bool {
        !(self.enemies.iter().any(|e| {
            e.kind >= c.enemies.len()
                || e.id >= self.next_id
                || e.hp <= 0.0
                || !e.mobility.is_finite()
                || e.mobility < c.modules.pulsar_min_multiplier
                || e.mobility > 1.0
        }) || self.shots.iter().any(|s| {
            s.kind > CHILD
                || s.id >= self.next_id
                || s.target
                    .is_some_and(|id| id == 0 || id >= self.next_id || s.kind != BOMB)
        }))
    }
    fn valid_save_effects(&self) -> bool {
        !(self.shields > 3
            || self.drops.iter().any(|d| d.kind >= POWER_COUNT)
            || self.areas.iter().any(|a| a.kind > 1)
            || !(-1..=3).contains(&self.disabled_weapon)
            || !(-1..UPGRADE_COUNT as i32).contains(&self.disabled_stat)
            || self.spawn_sectors.iter().any(|s| *s >= 8)
            || self.deathwaves.len() != self.deathwave_hits.len())
    }
    fn valid_save_counters(&self) -> bool {
        !(self.coins < 0.0
            || self.stones > self.stones_earned
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
            rng: Rng({
                // Avalanche small seeds before the first spawn gate; restored RNG state stays exact.
                let mut mixed = seed ^ 0x9e3779b9;
                mixed = (mixed ^ (mixed >> 16)).wrapping_mul(0x7feb352d);
                mixed = (mixed ^ (mixed >> 15)).wrapping_mul(0x846ca68b);
                (mixed ^ (mixed >> 16)).max(1)
            }),
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
            wall_hp: 0.0,
            wall_rebuild: 0.0,
            coins,
            stones: 0,
            stones_earned: 0,
            power_levels: [[0; 2]; POWER_COUNT],
            extra_power_times: [0.0; 6],
            bots: default_bots(),
            extra_orb_angle: 0.0,
            gold_stone_credit: 0.0,
            earned: 0.0,
            kills: 0,
            golden_kills: 0,
            ammo,
            weapon: 0,
            levels: [0; UPGRADE_COUNT],
            powers: [0.0; 7],
            module_times: [0.0; 4],
            coin_overlap_kills: [0; 32],
            coin_bonus_kills: [0; 5],
            coin_bonus_coins: [0.0; 5],
            dp_seed: seed,
            hp_scaled: true,
            elite_credit: 0.0,
            special_queue: Vec::new(),
            special_spawned: 0,
            fallout_time: 0.0,
            demon_time: 0.0,
            demon_invincible: 0.0,
            demon_drop_cooldown: 0.0,
            pending_start_wave: 0,
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
            ray_cycle: 0.0,
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
    pub fn power_drop_scale(&self) -> f32 {
        let wave = if self.pending_start_wave > 0 {
            self.pending_start_wave
        } else if self.phase == 2 {
            self.wave + 1
        } else {
            self.wave.max(1)
        };
        let pressure = self.c.waves.pressure(wave);
        let children = if wave >= self.c.enemies[SCATTER].unlock {
            pressure.elite_per_wave * self.c.specials.scatter_children as f32
        } else {
            0.0
        };
        let count = pressure.count + children;
        (self.c.powers.drop_reference_kills / count.max(1.0)).min(1.0)
    }
    pub fn power_drop_chance(&self) -> f32 {
        self.stat(21) * self.power_drop_scale()
    }
    pub fn cost(&self, i: usize) -> f32 {
        let u = &self.c.upgrades[i];
        u.costs.get(self.levels[i] as usize).copied().unwrap_or(0.0)
    }
    pub fn ammo_capacity(&self, weapon: usize) -> u32 {
        // Storage remains available while a stat is sabotaged.
        let u = &self.c.upgrades[29];
        (self.c.weapons[weapon].capacity as f32 * (u.base + u.step * self.levels[29] as f32)) as u32
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
        self.wave = if self.pending_start_wave > 0 {
            std::mem::take(&mut self.pending_start_wave)
        } else {
            self.wave + 1
        };
        self.phase = 1;
        self.paused = false;
        self.accumulator = 0.0;
        self.firing = false;
        self.wave_pressure = self.c.waves.pressure(self.wave);
        self.special_queue.clear();
        self.special_spawned = 0;
        let elites: Vec<usize> = (6..9)
            .filter(|kind| self.c.enemies[*kind].unlock <= self.wave)
            .collect();
        if !elites.is_empty() {
            self.elite_credit += self.wave_pressure.elite_per_wave;
            while self.elite_credit >= 1.0 {
                let selected =
                    ((self.rng.next() * elites.len() as f32) as usize).min(elites.len() - 1);
                self.special_queue.push(elites[selected]);
                self.elite_credit -= 1.0;
            }
        }
        for _ in 0..self.wave_pressure.fleet_per_wave as usize {
            self.special_queue
                .extend((9..12).filter(|kind| self.c.enemies[*kind].unlock <= self.wave));
        }
        if self.c.enemies[4].unlock <= self.wave
            && self.rng.chance(self.wave_pressure.protector_chance)
        {
            self.special_queue.push(4);
        }
        self.total = self.wave_pressure.count.ceil() as u32
            + self.special_queue.len() as u32
            + if self.wave.is_multiple_of(self.c.waves.boss_every) {
                self.wave_pressure.bosses.round() as u32
            } else {
                0
            }
            + u32::from(self.wave.is_multiple_of(10));
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
        if i == 27 && self.wall_rebuild <= 0.0 {
            self.wall_hp += self.c.upgrades[i].step;
        }
        if i == 28 {
            self.wall_rebuild = self.wall_rebuild.min(self.stat(28));
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
            let extent = self.view_extent();
            self.aim = V::new(x.clamp(-extent, extent), y.clamp(-extent, extent));
        }
        self.weapon = weapon.min(3);
        self.firing = fire && !self.paused && self.phase == 1;
    }
    pub fn activate(&mut self, k: usize) {
        if k < POWER_COUNT && self.phase == 1 {
            self.wave_stats.powerups_collected += 1;
            self.overall_stats.powerups_collected += 1;
        }
        if k < 7 {
            self.powers[k] = (self.powers[k] + self.c.powers.durations[k] + self.stat(20))
                .min(self.c.powers.timer_cap);
        } else if k == RECOVERY {
            self.hp = (self.hp + self.stat(11) * self.power_effect(7))
                .min(self.stat(11) * (1.0 + self.stat(24)));
        } else if k == DEATHWAVE {
            self.charges = (self.charges + 1).min(3);
        } else if k == ENERGY_SHIELD {
            self.shields = (self.shields + 1).min(3);
        } else if k == NUKE {
            self.fallout_time =
                (self.fallout_time + self.c.powers.fallout_duration + self.stat(20))
                    .min(self.c.powers.timer_cap);
            for i in 0..self.enemies.len() {
                if matches!(self.enemies[i].kind, 0 | 1 | 3) && self.enemies[i].hp > 0.0 {
                    self.hit(i, self.enemies[i].hp, NUKE_DAMAGE);
                }
            }
            self.fx.push(Fx(10, 0.0, 0.0, 550.0, 0.0, 0.7));
        } else if k == DEMON {
            self.demon_time = (self.demon_time + self.c.powers.demon_duration + self.stat(20))
                .min(self.c.powers.timer_cap);
            self.demon_invincible = (self.demon_invincible
                + self.c.powers.demon_invincible_duration)
                .min(self.c.powers.timer_cap);
        } else if k == NEXUS {
            for power in [BLACKHOLE, SPOTLIGHT, GOLDEN] {
                self.powers[power] = (self.powers[power]
                    + (self.c.powers.durations[power] + self.stat(20)) * self.power_effect(NEXUS))
                .min(self.c.powers.timer_cap);
            }
        } else if (12..15).contains(&k) {
            let module = k - 12;
            self.module_times[module] =
                (self.module_times[module] + self.c.modules.durations[module] + self.stat(20))
                    .min(self.c.powers.timer_cap);
        }
        if (EXTRA_ORBS..POWER_COUNT).contains(&k) {
            let duration = if k == AOE {
                self.power_effect(AOE)
            } else {
                self.c.expansion.durations[k - EXTRA_ORBS]
            };
            self.extra_power_times[k - EXTRA_ORBS] =
                (self.extra_power_times[k - EXTRA_ORBS] + duration + self.stat(20))
                    .min(self.c.powers.timer_cap);
        }
        if k < POWER_COUNT {
            self.say(if k == DEATHWAVE {
                format!("Death Wave banked · {}/3 · press Q", self.charges)
            } else {
                format!("{} active", self.c.power_workshop.upgrades[k].name)
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
    pub fn enemy_max_hp(&self, enemy: &Enemy) -> f32 {
        enemy.definition(&self.c).hp + self.enemy_hp_bonus()
    }
    fn enemy_hp_bonus(&self) -> f32 {
        (self.wave / self.c.waves.hp_hits_every) as f32 * self.c.weapons[0].damage
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
            hp: e.hp + self.enemy_hp_bonus(),
            attack: 0.3,
            hits: 0,
            stun: 0.0,
            orb_cd: 0.0,
            swamp_cd: 0.0,
            swamp_hit_cd: 0.0,
            extra_orb_cd: 0.0,
            burn_left: 0.0,
            burn_tick: 0.0,
            burn_stage: 0,
            thunder_slow_time: 0.0,
            thunder_inside: false,
            deathray_inside: false,
            blackhole: None,
            blackhole_distance: 0.0,
            blackhole_hit_time: 0.0,
            charge: 0.0,
            spin: 0.0,
            child: false,
            deathwave_tag: false,
            mobility: 1.0,
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
        } else if self.special_spawned < self.special_queue.len()
            && self.spawned
                >= (self.special_spawned as u32 + 1) * self.total
                    / (self.special_queue.len() as u32 + 1)
        {
            kind = self.special_queue[self.special_spawned];
            self.special_spawned += 1;
        } else {
            let total: f32 = self
                .c
                .enemies
                .iter()
                .enumerate()
                .filter(|(i, e)| *i < 5 && e.unlock <= self.wave)
                .map(|(i, _)| self.wave_pressure.weights[i])
                .sum();
            let mut roll = self.rng.next() * total;
            for (i, e) in self.c.enemies.iter().enumerate() {
                if i < 5 && e.unlock <= self.wave && self.wave_pressure.weights[i] > 0.0 {
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
        if self.wall_rebuild > 0.0 {
            self.wall_rebuild = (self.wall_rebuild - DT).max(0.0);
            if self.wall_rebuild == 0.0 {
                self.wall_hp = self.stat(27);
            }
        }
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
        for t in self
            .module_times
            .iter_mut()
            .chain(self.extra_power_times.iter_mut())
        {
            *t = (*t - DT).max(0.0);
        }
        self.fallout_time = (self.fallout_time - DT).max(0.0);
        self.demon_time = (self.demon_time - DT).max(0.0);
        self.demon_invincible = (self.demon_invincible - DT).max(0.0);
        self.demon_drop_cooldown = (self.demon_drop_cooldown - DT).max(0.0);
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
            if a.kind == 0 {
                a.life -= DT;
            }
        }
        self.areas.retain(|a| a.life > 0.0);
        while self.remaining > 0 && self.wave_ticks as f32 / 60.0 >= self.spawn_timer {
            self.spawn_next();
            self.spawn_timer = self.c.waves.spawn_at(self.spawned, self.total);
        }
        self.rebuild_protectors();
        self.step_bots();
        self.move_enemies();
        self.rebuild_grid();
        if self.shock_timer <= 0.0 {
            self.shockwave();
            self.constrain_blackholes();
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
        self.constrain_blackholes();
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
        let multiplier = if self.expanded_time(AOE) > 0.0 {
            self.c.expansion.chrono_aoe_multiplier
        } else {
            1.0
        };
        (self.stat(1) + self.c.powers.chrono_margin) * multiplier
    }
    pub fn view_extent(&self) -> f32 {
        // Temporary fields may extend offscreen; they must not shrink the combat view.
        650.0_f32.max(self.stat(1) + 60.0)
    }
    fn boundary_attacker(kind: usize) -> bool {
        matches!(kind, 3 | VAMPIRE | RAY | SABOTEUR | OVERCHARGE)
    }
    fn move_enemies(&mut self) {
        let attack_rate = if self.fallout_time > 0.0 {
            self.power_effect(10)
        } else {
            1.0
        };
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
        let blackhole_radius = self.area_radius(self.power_effect(3));
        let chrono_slow = self.power_effect(1);
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
            e.swamp_hit_cd = (e.swamp_hit_cd - DT).max(0.0);
            e.stun = (e.stun - DT).max(0.0);
            let resistance = def.resistance;
            let previous_capture = e.blackhole;
            e.blackhole = if resistance < 1.0 {
                previous_capture
                    .filter(|&j| j < blackholes.len())
                    .or_else(|| {
                        blackholes
                            .iter()
                            .enumerate()
                            .filter(|(_, p)| e.p.dist(**p) < blackhole_radius)
                            .min_by(|(_, a), (_, b)| e.p.dist(**a).total_cmp(&e.p.dist(**b)))
                            .map(|(j, _)| j)
                    })
            } else {
                None
            };
            if let Some(j) = e.blackhole {
                let center = blackholes[j];
                if previous_capture == Some(j) {
                    let previous = V::polar(
                        (self.time - DT) * 0.18
                            + j as f32 * TAU / self.c.powers.blackhole_count as f32,
                        self.c.powers.blackhole_orbit_radius,
                    );
                    e.p = e.p.add(center.sub(previous));
                } else {
                    e.blackhole_distance = e.p.dist(center);
                    e.blackhole_hit_time = 0.0;
                }
                let offset = e.p.sub(center);
                let distance = offset.len().min(e.blackhole_distance).min(blackhole_radius);
                let pull = self.c.powers.blackhole_force * (1.0 - resistance)
                    / (mass * def.mass * e.mobility)
                    * DT;
                e.blackhole_distance = (distance - pull).max(0.0);
                e.p = center.add(offset.unit().mul(e.blackhole_distance));
            } else {
                e.blackhole_distance = 0.0;
            }
            if e.stun > 0.0 {
                continue;
            }
            e.attack -= DT
                * attack_rate
                * if Self::boundary_attacker(e.kind) {
                    attack_bonus
                } else {
                    1.0
                };
            let slow = if self.powers[CHRONO] > 0.0 && e.p.len() < chrono_radius {
                1.0 - chrono_slow * (1.0 - resistance)
            } else {
                1.0
            };
            let stop = if Self::boundary_attacker(e.kind) {
                range
            } else {
                self.c.tower_radius + def.radius + if self.wall_hp > 0.0 { 5.0 } else { 0.0 }
            };
            if e.blackhole.is_none() && e.p.len() > stop {
                e.p = e.p.sub(
                    e.p.unit().mul(
                        (def.speed
                            * speed
                            * move_bonus
                            * slow
                            * (if e.thunder_slow_time > 0.0 {
                                1.0 - self.c.expansion.thunder_slow
                            } else {
                                1.0
                            })
                            * e.mobility
                            * DT)
                            .min(e.p.len() - stop),
                    ),
                );
            }
            if e.blackhole.is_none() && !Self::boundary_attacker(e.kind) && e.p.len() < stop {
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
                if self.demon_invincible <= 0.0 {
                    self.hp = (self.hp - def.damage * DT * attack_rate).max(0.0);
                }
                continue;
            }
            if e.kind == RAY {
                if e.charge > 0.0 {
                    let progress = 1.0 - e.charge / self.c.specials.ray_charge;
                    e.spin = (e.spin + (1.5 + 18.0 * progress * progress) * DT).rem_euclid(TAU);
                    e.charge = (e.charge - DT * attack_bonus * attack_rate).max(0.0);
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
        if self.demon_invincible > 0.0 {
            return;
        }
        let wall_hit = self.wall_hp > 0.0 && !Self::boundary_attacker(self.enemies[i].kind);
        if wall_hit {
            self.wall_hp = (self.wall_hp - damage.max(0.0)).max(0.0);
            if self.wall_hp == 0.0 {
                self.wall_rebuild = self.stat(28);
            }
        }
        if !wall_hit && self.block_hit(damage) {
            return;
        }
        let received = if wall_hit {
            damage.max(0.0)
        } else {
            damage.max(0.0).min(self.hp.max(0.0))
        };
        if !wall_hit {
            self.hp -= received;
        }
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
        if self.demon_invincible > 0.0 {
            return true;
        }
        if damage > 0.0 && self.hp > 0.0 && self.shields > 0 {
            self.shields -= 1;
            self.hp = (self.hp + self.stat(11) * self.power_effect(9))
                .min(self.stat(11) * (1.0 + self.stat(24)));
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
        let size = self.area_radius(self.stat(17));
        let mass = self.c.waves.mass_multiplier(self.wave);
        for e in &mut self.enemies {
            if e.hp > 0.0 && e.p.len() <= size {
                e.p = e.p.add(e.p.unit().mul(
                    self.c.defense.shock_force * (1.0 - e.definition(&self.c).resistance)
                        / (mass * e.definition(&self.c).mass * e.mobility),
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
        if kind == LIGHT && !self.can_engage(angle) {
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
        if standard_upgrades && self.rapid <= 0.0 && self.proc(RAPID_PROC, self.stat(4)) {
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
        self.wave_stats.shots_fired += 1;
        self.overall_stats.shots_fired += 1;
        for n in 0..count {
            self.weapon_stats[kind as usize].shots += 1;
            let a = angle
                + if n == 0 {
                    0.0
                } else {
                    n.div_ceil(2) as f32 * 0.14 * if n % 2 == 0 { 1.0 } else { -1.0 }
                };
            if kind == LIGHT {
                self.light_shot(a, n == 0);
            } else {
                let mut s = self.new_shot(kind, V::polar(a, 27.0), a);
                s.counted_shot = n == 0;
                s.target = hook_target.map(|(id, _)| id);
                self.shots.push(s);
            }
        }
        self.fx.push(Fx(0, angle, 0.0, 0.0, 0.0, 0.09));
    }
    fn light_shot(&mut self, angle: f32, counted_shot: bool) {
        let end = V::polar(angle, self.stat(1));
        let target = self
            .enemies
            .iter()
            .enumerate()
            .filter(|(_, e)| {
                e.hp > 0.0
                    && e.p.len() <= self.stat(1) + 0.1
                    && segment_distance(e.p, V::ZERO, end)
                        < e.definition(&self.c).radius + 3.0 + self.c.direct_hit_padding
            })
            .min_by(|(_, a), (_, b)| a.p.len().total_cmp(&b.p.len()))
            .map(|(i, e)| (i, e.p.len()));
        let drop = self
            .drops
            .iter()
            .enumerate()
            .filter(|(_, d)| segment_distance(d.p, V::ZERO, end) < 18.0 + self.c.direct_hit_padding)
            .min_by(|(_, a), (_, b)| a.p.len().total_cmp(&b.p.len()))
            .map(|(i, d)| (i, d.p.len()));
        let mut distance = self.stat(1);
        if drop.is_some_and(|(_, d)| target.is_none_or(|(_, e)| d < e)) {
            let (i, d) = drop.unwrap();
            distance = d;
            let item = self.drops.swap_remove(i);
            if counted_shot {
                self.record_landed_shot();
            }
            self.activate(item.kind);
        } else if let Some((i, d)) = target {
            if counted_shot {
                self.record_landed_shot();
            }
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
                self.area_radius(self.c.bomb_radius)
            } else {
                4.0 + self.c.direct_hit_padding
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
                .filter(|(_, d)| segment_distance(d.p, old, s.p) < 18.0 + self.c.direct_hit_padding)
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
                    / (self.c.waves.mass_multiplier(self.wave)
                        * self.enemies[i].definition(&self.c).mass
                        * self.enemies[i].mobility);
                self.enemies[i].p = self.enemies[i].p.add(p.unit().mul(force));
                self.constrain_blackhole(i);
            }
            if self.powers[CHAIN] > 0.0 && self.proc(CHAIN_PROC, self.power_effect(0)) {
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
    pub(crate) fn protected(&self, i: usize) -> bool {
        self.protector_indices.iter().any(|&j| {
            let e = &self.enemies[j];
            e.hp > 0.0 && e.p.dist(self.enemies[i].p) < self.c.defense.protector_radius
        })
    }
    fn death_penalty_selected(&self, id: u32) -> bool {
        if self.module_times[DP] <= 0.0 {
            return false;
        }
        // Immutable selection: aiming order and repeat hits cannot reroll a boss.
        let mut hash = id ^ self.dp_seed;
        hash = (hash ^ (hash >> 16)).wrapping_mul(0x7feb352d);
        hash = (hash ^ (hash >> 15)).wrapping_mul(0x846ca68b);
        hash ^= hash >> 16;
        (hash as f64 / (u32::MAX as f64 + 1.0)) < self.power_effect(12) as f64
    }
    fn in_spotlight(&self, p: V) -> bool {
        self.powers[SPOTLIGHT] > 0.0
            && (0..self.c.powers.spotlight_count).any(|beam| {
                angle_delta(self.spotlight_direction(beam), p.angle()).abs()
                    < self.c.powers.spotlight_angle.to_radians() * 0.5
            })
    }
    fn damage_multiplier(&self, i: usize, protected: bool) -> f32 {
        let p = self.enemies[i].p;
        let spotlight = self.in_spotlight(p);
        (if spotlight { self.power_effect(4) } else { 1.0 })
            * if self.enemies[i].kind != 4 && protected {
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
        let hp = self.enemy_max_hp(&self.enemies[i]);
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
        if protected && source >= OTHER && source != NUKE_DAMAGE {
            return false;
        }
        if source == NUKE_DAMAGE {
            damage = self.enemies[i].hp;
        } else if matches!(source, BOMB | CHILD) && !matches!(self.enemies[i].kind, 5 | SUPERBOSS) {
            // Hook contacts ignore shield/Spotlight; outside range two full-health hits are required.
            damage = self.enemy_max_hp(&self.enemies[i]);
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
        if self.demon_time > 0.0 {
            damage *= self.power_effect(11);
        }
        damage *= self.amp_multiplier(p);
        if matches!(source, BOMB | CHILD | AREA_DAMAGE | DEATH_WAVE_DAMAGE) {
            damage *= self.aoe_scale();
        }
        if matches!(source, BOMB | CHILD)
            && p.len() > self.stat(1) + 0.1
            && !matches!(self.enemies[i].kind, 5 | SUPERBOSS)
        {
            damage = damage.min(self.enemy_max_hp(&self.enemies[i]) * 0.5);
        }
        if damage <= 0.0 {
            return false;
        }
        if source <= CHILD
            && self.module_times[PH] > 0.0
            && self.proc(PULSAR_PROC, self.power_effect(14))
        {
            self.enemies[i].mobility = (self.enemies[i].mobility
                * (1.0 - self.c.modules.pulsar_reduction))
                .max(self.c.modules.pulsar_min_multiplier);
        }
        if self.death_penalty_selected(self.enemies[i].id) {
            damage = self.enemies[i].hp;
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
        let p = self.enemies[i].p;
        let bonuses = [
            self.powers[GOLDEN] > 0.0,
            self.powers[BLACKHOLE] > 0.0
                && (0..self.c.powers.blackhole_count).any(|n| {
                    p.dist(self.blackhole_center(n)) < self.area_radius(self.power_effect(3))
                }),
            self.in_spotlight(p),
            source == ORB_DAMAGE,
            self.enemies[i].deathwave_tag,
        ];
        let mut amount = self.enemies[i].definition(&self.c).coins * self.stat(19);
        let mut mask = 0;
        for (n, active) in bonuses.into_iter().enumerate() {
            if active {
                mask |= 1 << n;
                let extra = amount
                    * ((if n == 0 {
                        self.power_effect(6)
                    } else if n == 3 && self.expanded_time(EXTRA_ORBS) > 0.0 {
                        self.power_effect(EXTRA_ORBS)
                    } else {
                        self.c.coin_multipliers[n]
                    }) - 1.0);
                amount += extra;
                self.coin_bonus_kills[n] += 1;
                self.coin_bonus_coins[n] += extra;
            }
        }
        if self.in_bot(0, p) {
            amount *= self.c.expansion.gold_coin_multiplier;
        }
        self.coin_overlap_kills[mask] += 1;
        self.coins += amount;
        self.earned += amount;
        self.wave_coins += amount;
        let mut stones = if self.enemies[i].child {
            0
        } else {
            self.c.power_workshop.stones_per_enemy[self.enemies[i].kind]
        };
        if !self.enemies[i].child && self.in_bot(0, p) {
            self.gold_stone_credit += self.c.expansion.gold_stone_chance;
            if self.gold_stone_credit >= 1.0 - 0.00001 {
                self.gold_stone_credit = (self.gold_stone_credit - 1.0).max(0.0);
                stones += 1;
            }
        }
        self.stones = self.stones.saturating_add(stones);
        self.stones_earned = self.stones_earned.saturating_add(stones);
        self.wave_stats.stones_earned = self.wave_stats.stones_earned.saturating_add(stones);
        self.overall_stats.stones_earned = self.overall_stats.stones_earned.saturating_add(stones);
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
                let available = self.ammo_capacity(weapon).saturating_sub(self.ammo[weapon]);
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
        if self.proc(POWER_PROC, self.power_drop_chance()) {
            let kind = self.choose_power_drop();
            if kind == DEMON {
                self.demon_drop_cooldown = self.c.powers.demon_drop_interval;
            }
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
                    let hp = self.c.enemies[1].hp + self.enemy_hp_bonus();
                    let spawned = self.enemies.last_mut().unwrap();
                    spawned.child = true;
                    spawned.hp = hp;
                }
            }
            if self.powers[POISON] > 0.0
                && self.proc(SWAMP_PROC, self.power_effect(2))
                && self.areas.iter().filter(|a| a.kind == 0).count() < self.c.powers.swamp_cap
                && !self
                    .areas
                    .iter()
                    .any(|a| a.kind == 0 && a.p.dist(p) < self.c.powers.swamp_radius)
            {
                self.areas.push(Area {
                    p,
                    life: self.c.powers.swamp_duration,
                    kind: 0,
                });
            }
            // Mine/swamp/Death Wave kills don't recursively mint new mines.
            if (source <= OTHER || source == ORB_DAMAGE)
                && self.proc(MINE_PROC, self.stat(16))
                && self.areas.iter().filter(|a| a.kind == 1).count() < self.c.defense.mine_cap
            {
                self.areas.push(Area {
                    p,
                    life: 1.0,
                    kind: 1,
                });
            }
        }
        deaths.clear();
        self.deaths = deaths;
    }
    pub(crate) fn deathray_hits(&mut self) {
        let active = self.deathray_active();
        let end = V::polar(self.ray_angle, 710.0);
        for i in 0..self.enemies.len() {
            let inside = active
                && self.enemies[i].hp > 0.0
                && segment_distance(self.enemies[i].p, V::ZERO, end)
                    < self.enemies[i].definition(&self.c).radius + 5.0;
            let mut affected = false;
            if inside {
                let damage = if matches!(self.enemies[i].kind, 0 | 1 | 3) {
                    self.enemies[i].hp
                } else {
                    self.power_effect(DEATHRAY) * DT
                        + if !self.enemies[i].deathray_inside {
                            2.0 * self.c.weapons[0].damage
                        } else {
                            0.0
                        }
                };
                affected = self.hit(i, damage, OTHER);
            }
            self.enemies[i].deathray_inside = affected;
        }
    }
    pub(crate) fn blackhole_hits(&mut self) {
        let centers: Vec<_> = if self.powers[BLACKHOLE] > 0.0 {
            (0..self.c.powers.blackhole_count)
                .map(|i| self.blackhole_center(i))
                .collect()
        } else {
            Vec::new()
        };
        let radius = self.area_radius(self.power_effect(BLACKHOLE));
        for i in 0..self.enemies.len() {
            if !centers.iter().any(|p| self.enemies[i].p.dist(*p) <= radius) {
                self.enemies[i].blackhole_hit_time = 0.0;
                continue;
            }
            self.enemies[i].blackhole_hit_time += DT;
            if self.enemies[i].blackhole_hit_time + 0.00001 >= 1.0 {
                self.enemies[i].blackhole_hit_time =
                    (self.enemies[i].blackhole_hit_time - 1.0).max(0.0);
                self.hit(i, self.c.weapons[0].damage, AREA_DAMAGE);
            }
        }
    }
    fn constrain_blackhole(&mut self, i: usize) {
        if self.powers[BLACKHOLE] <= 0.0 {
            return;
        }
        if let Some(index) = self.enemies[i].blackhole {
            let center = self.blackhole_center(index);
            let e = &mut self.enemies[i];
            let offset = e.p.sub(center);
            e.blackhole_distance = offset.len().min(e.blackhole_distance);
            e.p = center.add(offset.unit().mul(e.blackhole_distance));
        }
    }
    fn constrain_blackholes(&mut self) {
        for i in 0..self.enemies.len() {
            self.constrain_blackhole(i);
        }
    }
    pub fn deathray_active(&self) -> bool {
        self.powers[DEATHRAY] > 0.0 && self.ray_cycle < self.c.powers.deathray_duration
    }
    fn defenses(&mut self) {
        let mut near = std::mem::take(&mut self.nearby);
        self.orb_angle = (self.orb_angle + self.stat(15) * DT).rem_euclid(TAU);
        if self.powers[DEATHRAY] > 0.0 {
            if self.ray_cycle == 0.0 {
                self.ray_angle = self.rng.next() * TAU;
            }
            if self.deathray_active() {
                self.ray_angle =
                    (self.ray_angle + self.c.powers.deathray_speed * DT).rem_euclid(TAU);
            }
        } else {
            self.ray_cycle = 0.0;
        }
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
                    && self.hit(i, self.c.defense.orb_damage, ORB_DAMAGE)
                {
                    self.enemies[i].orb_cd = self.c.defense.orb_hit_interval;
                }
            }
        }
        self.extra_orb_hits();
        let mut areas = std::mem::take(&mut self.areas);
        let mut poisoned = std::mem::take(&mut self.poisoned);
        poisoned.clear();
        poisoned.resize(self.enemies.len(), false);
        let mine_count = areas.iter().filter(|a| a.kind == 1 && a.life > 0.0).count();
        let mut mine_slot = 0;
        for a in &mut areas {
            if a.kind == 1 && self.module_times[SD] > 0.0 {
                let radius = self.c.modules.space_displacer_radius;
                let r = a.p.len();
                let next = r
                    + (radius - r).clamp(
                        -self.c.modules.space_displacer_speed * DT,
                        self.c.modules.space_displacer_speed * DT,
                    );
                let desired = -self.orb_angle + TAU * mine_slot as f32 / mine_count as f32;
                let delta = (desired - a.p.angle() + PI).rem_euclid(TAU) - PI;
                let turn = (self.stat(15) + self.c.modules.space_displacer_speed / radius) * DT;
                a.p = V::polar(a.p.angle() + delta.clamp(-turn, turn), next);
                mine_slot += 1;
            }
            let r = if a.kind == 0 {
                self.area_radius(self.c.powers.swamp_radius)
            } else {
                self.area_radius(self.stat(25))
            };
            self.grid.query(a.p, r + 48.0, &mut near);
            if a.kind == 0 {
                for &i in &near {
                    if !poisoned[i] && self.enemies[i].p.dist(a.p) < r && self.enemies[i].hp > 0.0 {
                        poisoned[i] = true;
                        let affected = if self.enemies[i].swamp_hit_cd <= 0.0 {
                            if self.hit(i, self.c.powers.swamp_damage, AREA_DAMAGE) {
                                self.enemies[i].swamp_hit_cd = self.c.powers.swamp_hit_interval;
                                true
                            } else {
                                false
                            }
                        } else {
                            !self.protected(i)
                        };
                        if affected && self.enemies[i].hp > 0.0 && self.enemies[i].swamp_cd <= 0.0 {
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
                        < self.area_radius(self.c.defense.mine_trigger_radius)
                            + self.enemies[i].definition(&self.c).radius
            }) {
                a.life = 0.0;
                self.fx.push(Fx(4, a.p.x, a.p.y, r, 0.0, 0.35));
                for &i in &near {
                    if self.enemies[i].p.dist(a.p) < r
                        && self.hit(
                            i,
                            self.stat(26)
                                * if self.module_times[SD] > 0.0 {
                                    self.power_effect(13)
                                } else {
                                    1.0
                                },
                            AREA_DAMAGE,
                        )
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
        self.blackhole_hits();
        self.deathray_hits();
        if self.powers[DEATHRAY] > 0.0 {
            self.ray_cycle += DT;
            if self.ray_cycle >= self.c.powers.deathray_duration + self.c.powers.deathray_cooldown {
                self.ray_cycle = 0.0;
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
                    let selected = self.death_penalty_selected(e.id);
                    self.enemies[i].deathwave_tag = true;
                    // The fixed Super Boss class takes one fixed hit per wave pulse.
                    self.enemies[i].hp = if self.enemies[i].kind == SUPERBOSS && !selected {
                        self.enemies[i].hp
                            - self.power_effect(8)
                                * self.aoe_scale()
                                * self.amp_multiplier(self.enemies[i].p)
                                * if self.demon_time > 0.0 {
                                    self.power_effect(11)
                                } else {
                                    1.0
                                }
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
    pub wall_hp: f32,
    pub wall_max_hp: f32,
    pub wall_rebuild: f32,
    pub ammo_caps: [u32; 4],
    pub coins: f32,
    #[serde(default)]
    pub stones: u32,
    #[serde(default)]
    pub stones_earned: u32,
    pub power_levels: [[u32; 2]; POWER_COUNT],
    pub earned: f32,
    pub kills: u32,
    pub weapon: u8,
    pub ammo: [u32; 4],
    pub charges: u8,
    pub powers: [f32; 7],
    pub fallout_time: f32,
    pub module_times: [f32; 4],
    pub coin_overlap_kills: [u32; 32],
    pub coin_bonus_kills: [u32; 5],
    pub coin_bonus_coins: [f32; 5],
    pub demon_time: f32,
    pub demon_invincible: f32,
    pub pending_start_wave: u32,
    pub shields: u8,
    pub overheal: f32,
    pub remaining: u32,
    pub total: u32,
    pub spawned: u32,
    pub range: f32,
    pub view_extent: f32,
    pub rapid: f32,
    pub shock_in: f32,
    pub orb_angle: f32,
    pub orb_count: u32,
    pub spotlight_angle: f32,
    pub blackholes: Vec<(f32, f32)>,
    pub spotlights: Vec<f32>,
    pub ray_angle: f32,
    pub ray_active: bool,
    pub enemies: Vec<(u32, usize, f32, f32, f32, f32, f32)>,
    pub enemy_effects: Vec<(u32, f32, bool, bool)>,
    pub enemy_radii: Vec<(u32, f32)>,
    pub enemy_burns: Vec<(u32, f32, u32)>,
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
    pub supply_costs: [f32; crate::supplies::SUPPLY_COUNT],
    pub supply_available: [bool; crate::supplies::SUPPLY_COUNT],
    pub extra_power_times: [f32; 6],
    pub extra_orbs: Vec<(f32, f32)>,
    pub bots: Vec<(usize, f32, f32, f32, f32)>,
    pub aoe_scale: f32,
    pub power_costs: Vec<[u32; 2]>,
    pub power_effects: Vec<f32>,
    pub power_weights: Vec<f32>,
    pub values: Vec<f32>,
    pub power_drop_scale: f32,
    pub enemy_mobility: Vec<(u32, f32)>,
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
            wall_hp: self.wall_hp,
            wall_max_hp: self.stat(27),
            wall_rebuild: self.wall_rebuild,
            ammo_caps: std::array::from_fn(|i| self.ammo_capacity(i)),
            coins: self.coins,
            stones: self.stones,
            stones_earned: self.stones_earned,
            power_levels: self.power_levels,
            supply_costs: std::array::from_fn(|i| self.supply_cost(i)),
            supply_available: std::array::from_fn(|i| self.supply_available(i)),
            extra_power_times: self.extra_power_times,
            extra_orbs: self.extra_orb_positions(),
            bots: (0..4)
                .filter(|b| self.expanded_time(GOLD_BOT + b) > 0.0 && self.bots[*b].initialized)
                .map(|b| {
                    (
                        GOLD_BOT + b,
                        self.bots[b].position.x,
                        self.bots[b].position.y,
                        self.power_effect(GOLD_BOT + b)
                            * if b >= 2 { self.aoe_scale() } else { 1.0 },
                        self.bots[b].pulse_in,
                    )
                })
                .collect(),
            aoe_scale: self.aoe_scale(),
            power_costs: (0..POWER_COUNT)
                .map(|i| [self.power_cost(i, 0), self.power_cost(i, 1)])
                .collect(),
            power_effects: (0..POWER_COUNT).map(|i| self.power_effect(i)).collect(),
            power_weights: (0..POWER_COUNT).map(|i| self.power_weight(i)).collect(),
            earned: self.earned,
            kills: self.kills,
            weapon: self.weapon,
            ammo: self.ammo,
            charges: self.charges,
            powers: self.powers,
            module_times: self.module_times,
            coin_overlap_kills: self.coin_overlap_kills,
            coin_bonus_kills: self.coin_bonus_kills,
            coin_bonus_coins: self.coin_bonus_coins,
            fallout_time: self.fallout_time,
            demon_time: self.demon_time,
            demon_invincible: self.demon_invincible,
            pending_start_wave: self.pending_start_wave,
            shields: self.shields,
            overheal: self.stat(24),
            remaining: self.remaining,
            total: self.total,
            spawned: self.spawned,
            range: self.stat(1),
            view_extent: self.view_extent(),
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
            ray_active: self.deathray_active(),
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
                        self.enemy_max_hp(e),
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
            enemy_burns: self
                .enemies
                .iter()
                .filter(|e| e.burn_left > 0.0)
                .map(|e| (e.id, e.burn_left, e.burn_stage))
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
            values: (0..UPGRADE_COUNT)
                .map(|i| {
                    if i == 21 {
                        self.power_drop_chance()
                    } else {
                        self.stat(i)
                    }
                })
                .collect(),
            power_drop_scale: self.power_drop_scale(),
            enemy_mobility: self
                .enemies
                .iter()
                .filter(|e| e.hp > 0.0 && e.mobility < 1.0)
                .map(|e| (e.id, e.mobility))
                .collect(),
            costs: (0..UPGRADE_COUNT).map(|i| self.cost(i)).collect(),
        }
    }
}

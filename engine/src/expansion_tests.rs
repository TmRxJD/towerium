use crate::{config::Config, math::V, power_expansion::*, power_shop::POWER_COUNT, sim::*};

fn active() -> World {
    let mut w = World::new(Config::standard(), 73);
    w.start_wave();
    w.remaining = 0;
    w.total = 0;
    w.enemies.clear();
    w
}
fn aura(w: &mut World, power: usize) {
    w.activate(power);
    let b = &mut w.bots[power - GOLD_BOT];
    b.initialized = true;
    b.position = V::ZERO;
    b.target = V::ZERO;
}
#[test]
fn support_bots_only_amplify_other_damage_and_rewards() {
    let mut w = active();
    aura(&mut w, AMP_BOT);
    aura(&mut w, GOLD_BOT);
    w.spawn(2, V::new(60.0, 0.0));
    w.enemies[0].hp = 100.0;
    w.step_bots();
    assert_eq!(w.enemies[0].hp, 100.0);
    let normal = w.c.weapons[0].damage;
    w.hit(0, normal, PROJECTILE);
    assert_eq!(w.enemies[0].hp, 100.0 - 2.0 * normal);
    let lss = w.light_damage(0);
    let before = w.enemies[0].hp;
    w.hit(0, lss, LIGHT);
    assert!((before - w.enemies[0].hp - 2.0 * lss).abs() < 0.001);
    w.enemies.clear();
    let before_coins = w.coins;
    let base = w.c.enemies[0].coins * w.stat(19) * w.c.expansion.gold_coin_multiplier;
    for _ in 0..20 {
        w.spawn(0, V::new(60.0, 0.0));
        let i = w.enemies.len() - 1;
        w.hit(i, 1000.0, PROJECTILE);
    }
    assert!((w.coins - before_coins - 20.0 * base).abs() < 0.01);
    assert_eq!(w.stones, 1);
    assert_eq!(w.stones_earned, 1);
    assert_eq!(w.wave_stats.stones_earned, 1);
    assert_eq!(w.overall_stats.stones_earned, 1);
}
#[test]
fn splash_and_amp_preserve_outside_hook_restriction() {
    let mut w = active();
    w.activate(AOE);
    aura(&mut w, AMP_BOT);
    w.spawn(2, V::new(70.0, 0.0));
    w.enemies[0].hp = 100.0;
    w.hit(0, 1.0, AREA_DAMAGE);
    assert_eq!(w.enemies[0].hp, 96.0);
    assert_eq!(w.area_radius(120.0), 240.0);
    let outside = w.stat(1) + 20.0;
    w.spawn(2, V::new(outside, 0.0));
    let i = w.enemies.len() - 1;
    let hp = w.enemies[i].hp;
    w.demon_time = 20.0;
    w.hit(i, 1000.0, BOMB);
    assert!(w.enemies[i].hp > 0.0);
    assert!(w.enemies[i].hp >= hp * 0.5 - 0.001);
}
#[test]
fn flame_ramps_and_thunder_has_a_lingering_slow() {
    let mut w = active();
    aura(&mut w, FLAME_BOT);
    aura(&mut w, THUNDER_BOT);
    w.spawn(2, V::new(70.0, 0.0));
    w.enemies[0].hp = 100.0;
    w.step_bots();
    assert_eq!(w.enemies[0].hp, 100.0);
    assert_eq!(w.enemies[0].stun, 3.0);
    assert_eq!(w.enemies[0].thunder_slow_time, 8.0);
    w.extra_power_times[FLAME_BOT - EXTRA_ORBS] = 0.0;
    let unit = w.c.weapons[0].damage;
    for stage in 1..=3 {
        for _ in 0..60 {
            w.step_bots();
        }
        assert_eq!(w.enemies[0].burn_stage, stage);
    }
    assert!((w.enemies[0].hp - (100.0 - 6.0 * unit)).abs() < 0.001);
    assert!((w.enemies[0].thunder_slow_time - 5.0).abs() < 0.01);
}
#[test]
fn extra_orbs_follow_hole_centers_and_reverse_at_double_speed() {
    let mut w = active();
    w.activate(EXTRA_ORBS);
    let initial = w.extra_orb_angle;
    w.extra_orb_hits();
    let angle = w.extra_orb_angle;
    let turn = (initial - angle).rem_euclid(std::f32::consts::TAU);
    assert!((turn - 2.0 * w.stat(15) * DT).abs() < 0.00001);
    assert_eq!(w.extra_orb_positions().len(), 3);
    for (x, y) in w.extra_orb_positions() {
        assert!((V::new(x, y).len() - w.c.powers.blackhole_orbit_radius).abs() < 0.001);
    }
    let (x, y) = w.extra_orb_positions()[0];
    w.spawn(2, V::new(x, y));
    w.enemies[0].hp = 100.0;
    w.enemies[0].orb_cd = 1.0;
    w.extra_orb_hits();
    assert!(w.enemies[0].hp < 100.0);
    assert!(w.enemies[0].extra_orb_cd > 0.0);
}
#[test]
fn legacy_power_levels_pad_and_bot_state_replays_exactly() {
    let mut w = active();
    for power in GOLD_BOT..=THUNDER_BOT {
        w.activate(power);
    }
    w.step_bots();
    let mut restored = World::restore(Config::standard(), &w.save()).unwrap();
    restored.paused = false;
    w.step_bots();
    restored.step_bots();
    assert_eq!(w.save(), restored.save());
    let mut old: serde_json::Value = serde_json::from_str(&w.save()).unwrap();
    let world = old["world"].as_object_mut().unwrap();
    world
        .get_mut("power_levels")
        .unwrap()
        .as_array_mut()
        .unwrap()
        .truncate(16);
    for key in [
        "extra_power_times",
        "bots",
        "extra_orb_angle",
        "gold_stone_credit",
    ] {
        world.remove(key);
    }
    let old = World::restore(Config::standard(), &old.to_string()).unwrap();
    assert_eq!(old.power_levels.len(), POWER_COUNT);
    assert_eq!(old.extra_power_times, [0.0; 6]);
}
#[test]
fn bot_radius_upgrade_and_expanded_supplies_obey_caps() {
    let mut w = active();
    w.phase = 2;
    w.coins = 100_000.0;
    w.stones = 100;
    assert!(w.buy_power(GOLD_BOT, 1));
    assert_eq!(w.power_effect(GOLD_BOT), 145.0);
    assert!(w.buy_supply(GOLD_BOT + 3));
    assert_eq!(w.expanded_time(GOLD_BOT), 30.0);
    assert!(w.buy_supply(GOLD_BOT + 3));
    assert_eq!(w.expanded_time(GOLD_BOT), 50.0);
    assert!(!w.buy_supply(GOLD_BOT + 3));
}

#[test]
fn expanded_schema_rejects_invalid_radii_and_saved_statuses() {
    let mut c: serde_json::Value = serde_json::from_str(include_str!("../balance.json")).unwrap();
    c["power_workshop"]["upgrades"][GOLD_BOT]["effect_step"] = serde_json::json!(20);
    assert!(Config::parse(&c.to_string()).is_err());
    let w = active();
    let mut saved: serde_json::Value = serde_json::from_str(&w.save()).unwrap();
    saved["world"]["gold_stone_credit"] = serde_json::json!(1);
    assert!(World::restore(Config::standard(), &saved.to_string()).is_err());
    saved["world"]["gold_stone_credit"] = serde_json::json!(0);
    saved["world"]["bots"][0]["position"]["x"] = serde_json::json!(10_000);
    assert!(World::restore(Config::standard(), &saved.to_string()).is_err());
}

#[test]
fn bot_paths_and_burns_freeze_when_paused() {
    let mut w = active();
    aura(&mut w, FLAME_BOT);
    w.spawn(2, V::new(70.0, 0.0));
    w.enemies[0].hp = 100.0;
    w.step_bots();
    w.paused = true;
    let saved = w.save();
    w.advance(0.1);
    assert_eq!(w.save(), saved);
    w.paused = false;
    let left = w.enemies[0].burn_left;
    w.advance(DT);
    assert!(w.enemies[0].burn_left < left);
    assert!(w.expanded_time(FLAME_BOT) < 30.0);
}

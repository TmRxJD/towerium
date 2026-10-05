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
    w.extra_power_times[THUNDER_BOT - EXTRA_ORBS] = 0.0;
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

#[test]
fn camera_fits_range_without_zooming_for_temporary_fields() {
    let mut w = active();
    assert_eq!(w.view_extent(), 650.0);
    for level in 0..=w.c.upgrades[1].cap {
        w.levels[1] = level;
        let extent = w.view_extent();
        assert!(extent >= w.stat(1) + 60.0);
        assert!(extent <= 660.0);
        w.activate(AOE);
        w.activate(CHRONO);
        assert_eq!(w.view_extent(), extent);
        assert_eq!(
            w.chrono_radius(),
            (w.stat(1) + w.c.powers.chrono_margin) * w.c.expansion.chrono_aoe_multiplier
        );
        w.extra_power_times[AOE - EXTRA_ORBS] = 0.0;
    }
}

#[test]
fn bots_travel_at_configured_speed_without_leaving_the_playfield() {
    let mut w = active();
    aura(&mut w, GOLD_BOT);
    w.bots[0].target = V::new(200.0, 0.0);
    w.step_bots();
    assert!((w.bots[0].position.x - 100.0 * DT).abs() < 0.001);
    for _ in 0..3600 {
        w.step_bots();
        let limit = w.stat(1) - w.power_effect(GOLD_BOT) * 0.5 - w.c.expansion.bot_padding;
        assert!(w.bots[0].position.len() <= limit + 0.001);
    }
}

#[test]
fn thunder_stuns_on_contact_without_waiting_or_repeatedly_refreshing() {
    let mut w = active();
    aura(&mut w, THUNDER_BOT);
    w.bots[3].target = V::new(200.0, 0.0);
    w.bots[3].pulse_in = 7.0;
    let radius = w.power_effect(THUNDER_BOT);
    w.spawn(0, V::new(radius + w.c.enemies[0].radius - 1.0, 0.0));
    w.step_bots();
    assert_eq!(w.enemies[0].stun, 3.0);
    assert_eq!(w.enemies[0].thunder_slow_time, 8.0);
    assert!(w.enemies[0].thunder_inside);
    w.enemies[0].stun = 1.0;
    w.enemies[0].thunder_slow_time = 6.0;
    w.step_bots();
    assert_eq!(w.enemies[0].stun, 1.0);
    assert!(w.enemies[0].thunder_slow_time < 6.0);
    let mut resumed = World::restore(w.c.clone(), &w.save()).unwrap();
    resumed.step_bots();
    assert_eq!(resumed.enemies[0].stun, 1.0);
    resumed.enemies[0].p = V::new(500.0, 0.0);
    resumed.step_bots();
    assert!(!resumed.enemies[0].thunder_inside);
    resumed.enemies[0].p = resumed.bots[3].position;
    resumed.step_bots();
    assert_eq!(resumed.enemies[0].stun, 3.0);
    assert_eq!(resumed.enemies[0].thunder_slow_time, 8.0);

    w.extra_power_times[THUNDER_BOT - EXTRA_ORBS] = 0.0;
    w.enemies[0].stun = 0.0;
    let mut normal = World::restore(w.c.clone(), &w.save()).unwrap();
    normal.enemies[0].thunder_slow_time = 0.0;
    normal.pause(false);
    let start = w.enemies[0].p;
    w.advance(DT);
    normal.advance(DT);
    assert!((normal.enemies[0].p.dist(start) - 2.0 * w.enemies[0].p.dist(start)).abs() < 0.001);
}

#[test]
fn deathray_clears_common_enemies_and_adds_damage_once_per_contact() {
    let mut w = active();
    w.activate(DEATHRAY);
    w.ray_angle = 0.0;
    for kind in [0, 1, 3] {
        w.spawn(kind, V::new(200.0, 0.0));
        w.enemies.last_mut().unwrap().hp = 10_000.0;
    }
    w.deathray_hits();
    assert!(w.enemies.iter().all(|e| e.hp <= 0.0));
    w.enemies.clear();
    w.spawn(2, V::new(200.0, 0.0));
    w.enemies[0].hp = 100.0;
    let tick = w.power_effect(DEATHRAY) * DT;
    w.deathray_hits();
    assert!((w.enemies[0].hp - (100.0 - tick - 2.0 * w.c.weapons[0].damage)).abs() < 0.001);
    let before = w.enemies[0].hp;
    w.deathray_hits();
    assert!((before - w.enemies[0].hp - tick).abs() < 0.001);
    w.ray_cycle = w.c.powers.deathray_duration;
    w.deathray_hits();
    assert!(!w.enemies[0].deathray_inside);
    w.ray_cycle = 0.0;
    w.deathray_hits();
    assert!((before - w.enemies[0].hp - 2.0 * tick - 2.0 * w.c.weapons[0].damage).abs() < 0.001);
    w.enemies.clear();
    w.spawn(4, V::new(200.0, 0.0));
    w.spawn(0, V::new(200.0, 0.0));
    let hp = w.enemies[1].hp;
    w.ray_cycle = DT;
    w.advance(DT);
    assert_eq!(w.enemies[1].hp, hp);
}

#[test]
fn blackhole_holds_moving_and_stunned_targets_and_ticks_damage_each_second() {
    let mut w = active();
    w.activate(BLACKHOLE);
    w.spawn(0, V::new(400.0, 0.0));
    w.enemies[0].hp = 1000.0;
    w.enemies[0].stun = 2.0;
    let mut previous = f32::MAX;
    for tick in 1..=180 {
        w.advance(DT);
        let enemy = &w.enemies[0];
        let index = enemy.blackhole.unwrap();
        let (x, y) = w.snapshot().blackholes[index];
        let distance = enemy.p.dist(V::new(x, y));
        assert!(distance <= previous + 0.0001);
        assert!(distance <= w.power_effect(BLACKHOLE));
        previous = distance;
        assert!((enemy.hp - (1000.0 - (tick / 60) as f32)).abs() < 0.001);
        if tick == 90 {
            w = World::restore(w.c.clone(), &w.save()).unwrap();
            w.pause(false);
        }
        if tick % 30 == 0 {
            // Any outward displacement is constrained on the following simulation step.
            w.enemies[0].p = w.enemies[0].p.add(V::new(50.0, 0.0));
        }
    }
    w.powers[BLACKHOLE] = 0.0;
    w.advance(DT);
    assert!(w.enemies[0].blackhole.is_none());
    assert_eq!(w.enemies[0].blackhole_hit_time, 0.0);
}

#[test]
fn blackhole_damages_control_immune_bosses_inside_without_capturing_them() {
    let mut w = active();
    w.activate(BLACKHOLE);
    w.spawn(5, V::new(245.0, 0.0));
    w.enemies[0].hp = 1000.0;
    for _ in 0..120 {
        w.advance(DT);
        assert!(w.enemies[0].blackhole.is_none());
    }
    assert_eq!(w.enemies[0].hp, 998.0);
}

#[test]
fn blackhole_keeps_targets_inside_during_shockwaves_and_projectile_knockback() {
    let mut w = active();
    w.activate(BLACKHOLE);
    w.activate(BLACKHOLE);
    for stat in [9, 10, 17, 18] {
        w.levels[stat] = w.c.upgrades[stat].cap;
    }
    w.spawn(0, V::new(400.0, 0.0));
    w.enemies[0].hp = 10_000.0;
    let mut previous = f32::MAX;
    for _ in 0..600 {
        let p = w.enemies[0].p;
        w.input(p.x, p.y, true, 0);
        w.advance(DT);
        let enemy = &w.enemies[0];
        let (x, y) = w.snapshot().blackholes[enemy.blackhole.unwrap()];
        let distance = enemy.p.dist(V::new(x, y));
        assert!(distance <= previous + 0.001);
        previous = distance;
    }
    assert!(w.snapshot().weapon_report[0].hits > 0);
}

#[test]
fn nuke_clears_all_three_common_classes_but_preserves_tougher_enemies() {
    let mut w = active();
    for kind in [0, 1, 3, 2, 5, SUPERBOSS] {
        w.spawn(kind, V::new(200.0, 0.0));
        w.enemies.last_mut().unwrap().hp = 1000.0;
    }
    w.activate(NUKE);
    for (i, enemy) in w.enemies.iter().enumerate() {
        assert_eq!(enemy.hp, if i < 3 { 0.0 } else { 1000.0 });
    }
    assert_eq!(w.fallout_time, w.c.powers.fallout_duration);
}

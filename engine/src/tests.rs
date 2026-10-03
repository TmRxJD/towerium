use crate::{config::Config, math::V, sim::*};

fn world() -> World {
    World::new(Config::standard(), 42)
}

#[test]
fn reports_count_multishot_rounds_once_despite_bounces() {
    let mut w = active();
    w.c.upgrades[2].base = 1.0;
    w.c.upgrades[3].base = 3.0;
    w.c.upgrades[6].base = 1.0;
    w.c.upgrades[8].base = 3.0;
    w.c.upgrades[7].base = 200.0;
    w.c.enemies[0].hp = 1000.0;
    w.spawn(0, V::new(90.0, 0.0));
    w.spawn(0, V::new(160.0, 0.0));
    w.input(100.0, 0.0, true, LIGHT);
    w.advance(DT);
    assert_eq!(w.wave_stats.shots_fired, 3);
    assert_eq!(w.wave_stats.shots_landed, 3);
    assert!(w.enemies.iter().all(|e| e.hp < 1000.0));
    assert_eq!(w.snapshot().wave_report.accuracy, 100.0);
    w.input(0.0, -100.0, true, LIGHT);
    w.fire_timer = 0.0;
    w.advance(DT);
    assert_eq!(w.wave_stats.shots_fired, 6);
    assert_eq!(w.wave_stats.shots_landed, 3);
    assert_eq!(w.snapshot().wave_report.accuracy, 50.0);
}

#[test]
fn reports_separate_waves_preserve_totals_and_do_not_change_on_purchase() {
    let mut w = active();
    w.spawn(0, V::new(70.0, 0.0));
    let coins = w.c.enemies[0].coins;
    w.hit(0, 1000.0, PROJECTILE);
    w.advance(DT);
    w.activate(CHRONO);
    w.phase = 2;
    w.spawned = w.total;
    w.remaining = 0;
    w.wave_ticks = 1800;
    w.shots.clear();
    let before = serde_json::to_string(&w.snapshot().wave_report).unwrap();
    w.coins = 100.0;
    assert!(w.buy(0));
    assert_eq!(
        serde_json::to_string(&w.snapshot().wave_report).unwrap(),
        before
    );
    assert_eq!(w.snapshot().overall_report.coins_earned, coins);
    assert_eq!(w.snapshot().overall_report.kills, 1);
    assert_eq!(w.wave_stats.powerups_collected, 1);
    let restored = World::restore(Config::standard(), &w.save()).unwrap();
    assert_eq!(
        serde_json::to_string(&restored.snapshot().wave_report).unwrap(),
        before
    );
    assert!(w.start_wave());
    assert_eq!(w.wave_stats.powerups_collected, 0);
    assert_eq!(w.snapshot().wave_report.coins_earned, 0.0);
    assert_eq!(w.snapshot().wave_report.kills, 0);
    assert_eq!(w.snapshot().wave_report.accuracy, 0.0);
    assert_eq!(w.overall_stats.powerups_collected, 1);
    assert_eq!(w.snapshot().overall_report.kills, 1);
}

#[test]
fn reports_count_damaging_hits_but_not_shields_or_vampire_drain() {
    let mut w = active();
    w.spawn(2, V::new(100.0, 0.0));
    w.tower_hit(0, 0.0);
    w.shields = 1;
    w.tower_hit(0, 5.0);
    assert_eq!(w.wave_stats.hits_taken, 0);
    w.tower_hit(0, 5.0);
    assert_eq!(w.wave_stats.hits_taken, 1);
    w.hostile.push(Hostile {
        p: V::ZERO,
        v: V::ZERO,
        damage: 2.0,
        source: 99999,
    });
    w.advance(DT);
    assert_eq!(w.wave_stats.hits_taken, 2);
    w.enemies.clear();
    w.spawn(VAMPIRE, V::new(w.stat(1), 0.0));
    let hp = w.hp;
    seconds(&mut w, 0.1);
    assert!(w.hp < hp);
    assert_eq!(w.overall_stats.hits_taken, 2);
}

#[test]
fn pre_report_saves_remain_loadable() {
    let mut w = world();
    w.start_wave();
    w.input(100.0, 0.0, true, PROJECTILE);
    w.advance(DT);
    let mut saved: serde_json::Value = serde_json::from_str(&w.save()).unwrap();
    let world = saved["world"].as_object_mut().unwrap();
    world.remove("wave_stats");
    world.remove("overall_stats");
    world.remove("wave_coins");
    for shot in world["shots"].as_array_mut().unwrap() {
        shot.as_object_mut().unwrap().remove("counted_shot");
    }
    let restored = World::restore(Config::standard(), &saved.to_string()).unwrap();
    assert_eq!(restored.wave_stats.shots_fired, 0);
    assert_eq!(restored.snapshot().wave_report.accuracy, 0.0);
}

#[test]
fn proc_meters_keep_rates_without_random_droughts() {
    for chance in [0.01, 0.1, 0.15, 0.35, 0.8, 1.0] {
        let mut w = active();
        let mut triggered = 0;
        let mut gap = 0;
        let max_gap = (1.0_f32 / chance).ceil() as u32;
        for _ in 0..1000 {
            gap += 1;
            if w.proc(0, chance) {
                triggered += 1;
                assert!(gap <= max_gap);
                gap = 0;
            }
        }
        assert_eq!(triggered, (chance * 1000.0).round() as u32);
        assert!(gap < max_gap);
    }
}

#[test]
fn proc_progress_survives_waves_upgrades_and_save_resume() {
    let mut w = active();
    for _ in 0..7 {
        assert!(!w.proc(0, 0.1));
    }
    w.phase = 2;
    assert!(w.start_wave());
    assert!(!w.proc(0, 0.0)); // A disabled stat does not erase earned progress.
    let mut restored = World::restore(Config::standard(), &w.save()).unwrap();
    assert!(!restored.proc(0, 0.15));
    assert!(restored.proc(0, 0.15));
    assert!(!w.proc(1, 0.1)); // Different effects have independent meters.
    assert!(w.proc(0, 0.3));
}

#[test]
fn first_superboss_falls_to_starting_in_range_missile_supply() {
    let mut w = active();
    w.spawn(SUPERBOSS, V::new(w.stat(1) - 20.0, 0.0));
    let initial = w.enemies[0].hp;
    let bundle = w.c.weapons[MISSILE as usize].ammo;
    let damage = w.c.weapons[MISSILE as usize].damage;
    for _ in 0..bundle {
        w.hit(0, damage, MISSILE);
    }
    assert!(w.enemies[0].hp <= 0.0);
    assert_eq!(initial, 360.0);
    let mut outside = active();
    outside.spawn(SUPERBOSS, V::new(outside.stat(1) + 50.0, 0.0));
    outside.hit(0, outside.c.weapons[BOMB as usize].damage, BOMB);
    assert_eq!(outside.enemies[0].hp, 345.0); // Existing quarter-damage rule remains.
}

#[test]
fn base_drops_deliver_one_ammo_bundle_and_powerup_per_twenty_kills() {
    let mut w = active();
    let initial = w.ammo;
    assert_eq!(w.stat(21), 0.05);
    assert_eq!(w.stat(23), 0.05);
    for _ in 0..19 {
        w.spawn(0, V::new(100.0, 0.0));
        let i = w.enemies.len() - 1;
        w.hit(i, 1000.0, PROJECTILE);
    }
    assert_eq!(w.ammo, initial);
    assert!(w.drops.is_empty());
    w.spawn(0, V::new(100.0, 0.0));
    let i = w.enemies.len() - 1;
    w.hit(i, 1000.0, PROJECTILE);
    assert_eq!(w.drops.len(), 1);
    for (weapon, initial_ammo) in initial.iter().enumerate().skip(1) {
        assert_eq!(
            w.ammo[weapon],
            *initial_ammo
                + if w.c.weapons[weapon].pickup_every == 1 {
                    w.c.weapons[weapon].pickup
                } else {
                    0
                }
        );
    }
}
fn active() -> World {
    let mut w = world();
    w.start_wave();
    w.remaining = 0;
    w.spawned = w.total;
    w
}
fn seconds(w: &mut World, seconds: f32) {
    for _ in 0..(seconds * 60.0).round() as usize {
        w.advance(DT);
    }
}

#[test]
fn scheduled_spawns_cover_the_circle_from_wave_one_without_changing_counts() {
    use std::f32::consts::TAU;
    for seed in [1, 42, 200, 201, 999, u32::MAX] {
        for wave in [1, 2, 9, 10, 26, 70, 100] {
            let mut w = World::new(Config::standard(), seed);
            w.wave = wave - 1;
            w.start_wave();
            // Drain the real scheduler at the final spawning tick. One movement
            // tick preserves angles and cannot bring these enemies to the tower.
            w.wave_ticks = 1799;
            w.advance(DT);
            assert_eq!(w.spawned, w.total);
            assert_eq!(w.enemies.len(), w.total as usize);
            let sectors: Vec<_> = w
                .enemies
                .iter()
                .map(|e| (e.p.angle().rem_euclid(TAU) / (TAU / 8.0)).floor() as usize)
                .collect();
            for group in sectors.chunks_exact(8) {
                let mut counts = [0; 8];
                for &sector in group {
                    counts[sector] += 1;
                }
                assert_eq!(counts, [1; 8], "seed {seed}, wave {wave}");
            }
            for pair in sectors.chunks_exact(2) {
                assert_eq!((pair[0] + 4) % 8, pair[1]);
            }
            let mut totals = [0; 8];
            for sector in sectors {
                totals[sector] += 1;
            }
            assert!(totals.iter().max().unwrap() - totals.iter().min().unwrap() <= 1);
        }
    }
}

#[test]
fn opening_pressure_ramps_slowly_then_gradually_catches_up() {
    let c = Config::standard();
    let waves = &c.waves;
    assert_eq!(waves.pressure(1).count, 14.0);
    assert_eq!(waves.pressure(5).count, 20.0);
    assert_eq!(waves.pressure(7).count, 24.0);
    assert_eq!(waves.pressure(8).count, 26.0);
    assert_eq!(waves.pressure(10).count, 30.0);
    assert_eq!(waves.pressure(15).count, 53.0);
    assert_eq!(waves.pressure(25).count, 101.0);
    assert!(
        waves.pressure(11).count - waves.pressure(10).count
            > waves.pressure(10).count - waves.pressure(9).count
    );
    for wave in 2..=25 {
        assert!(waves.pressure(wave).count >= waves.pressure(wave - 1).count);
    }
    assert_eq!(waves.spawn_seconds, 30.0);
}

#[test]
fn ranged_mix_follows_tower_baseline_and_specials_scale_per_wave() {
    let c = Config::standard();
    for (wave, ranged) in [
        (5, 0.01),
        (25, 0.04),
        (70, 0.07),
        (110, 0.09),
        (150, 0.09),
        (300, 0.11),
        (400, 0.11),
    ] {
        let p = c.waves.pressure(wave);
        let normal: f32 = p.weights[..5].iter().sum();
        assert!((p.weights[3] / normal - ranged).abs() < 0.00001);
    }
    for wave in [25, 70, 150, 500, 1000] {
        let p = c.waves.pressure(wave);
        assert!((p.weights.iter().sum::<f32>() - 1.0).abs() < 0.00001);
        assert!((p.weights[6..9].iter().sum::<f32>() * p.count - p.elite_per_wave).abs() < 0.00001);
        assert!(
            (p.weights[9..12].iter().sum::<f32>() * p.count - p.fleet_per_wave).abs() < 0.00001
        );
        assert!(p.elite_per_wave <= 2.0);
        assert!(p.fleet_per_wave <= 0.5);
    }
    assert_eq!(
        c.waves.pressure(1000).elite_per_wave,
        c.waves.pressure(400).elite_per_wave
    );
    for wave in [200, 250, 300, 400, 1000] {
        assert_eq!(
            c.waves.pressure(wave).count,
            938.0 + 43.5 * (wave - 110) as f32
        );
    }
}

#[test]
fn seeded_spawns_keep_ranged_and_special_pressure_low() {
    for (wave, ranged_limit, elite_limit, fleet_limit) in [
        (5, 0.025, 0, 0),
        (25, 0.055, 32, 18),
        (70, 0.085, 64, 34),
        (150, 0.105, 128, 52),
    ] {
        let mut counts = [0_u32; crate::config::ENEMY_COUNT];
        for seed in 1..=128 {
            let mut w = World::new(Config::standard(), seed);
            w.wave = wave - 1;
            w.start_wave();
            w.wave_ticks = 1799;
            w.advance(DT);
            for e in &w.enemies {
                counts[e.kind] += 1;
                assert!(w.c.enemies[e.kind].unlock <= wave);
            }
            assert_eq!(w.spawned, w.total);
        }
        let normal: u32 = counts[..5].iter().sum();
        assert!(
            counts[3] as f32 / (normal as f32) < ranged_limit,
            "Wave {wave}: {counts:?}"
        );
        assert!(
            counts[6..9].iter().sum::<u32>() <= elite_limit,
            "Wave {wave}: {counts:?}"
        );
        assert!(
            counts[9..12].iter().sum::<u32>() <= fleet_limit,
            "Wave {wave}: {counts:?}"
        );
    }
}

#[test]
fn spawn_directions_are_seeded_and_vary_within_sectors() {
    let arrivals = |seed| {
        let mut w = World::new(Config::standard(), seed);
        w.wave = 25;
        w.start_wave();
        w.wave_ticks = 1799;
        w.advance(DT);
        w.enemies
            .iter()
            .map(|e| (e.p.x.to_bits(), e.p.y.to_bits()))
            .collect::<Vec<_>>()
    };
    let first = arrivals(42);
    assert_eq!(first, arrivals(42));
    assert_ne!(first, arrivals(43));
    let mut positions = first.clone();
    positions.sort_unstable();
    positions.dedup();
    assert_eq!(
        positions.len(),
        first.len(),
        "Spawns must not form fixed lanes"
    );
}

#[test]
fn enemy_identity_is_constant_at_every_wave() {
    let mut w = world();
    for wave in [1, 10, 100, 1000] {
        w.wave = wave;
        for k in 0..crate::config::ENEMY_COUNT {
            w.spawn(k, V::new(400.0, 0.0));
            let e = w.enemies.last().unwrap();
            assert_eq!(e.hp, w.c.enemies[k].hp);
            assert_eq!(e.hits, 0);
        }
    }
    assert_eq!(w.c.enemies[5].resistance, 1.0);
}
#[test]
fn pressure_and_composition_increase_not_hp() {
    let mut w = world();
    w.start_wave();
    let first = w.total;
    let hp = w.c.enemies[0].hp;
    w.phase = 2;
    w.start_wave();
    assert!(w.total > first);
    assert_eq!(w.c.enemies[0].hp, hp);
    assert!(w.c.enemies[4].unlock > w.c.enemies[0].unlock);
}
#[test]
fn chain_lightning_only_procs_on_projectiles_and_light() {
    for kind in [PROJECTILE, LIGHT, MISSILE, BOMB, CHILD, OTHER] {
        let mut w = active();
        w.c.powers.chain_chance = 1.0;
        w.activate(CHAIN);
        w.spawn(5, V::new(200.0, 0.0));
        w.spawn(2, V::new(225.0, 0.0));
        for (i, e) in w.enemies.iter().enumerate() {
            w.grid.insert(e.p, i);
        }
        w.impact(0, kind, 1.0);
        assert_eq!(w.enemies[1].hp < w.c.enemies[2].hp, kind <= LIGHT);
    }
}
#[test]
fn poison_is_kill_triggered_only() {
    let mut w = active();
    w.activate(POISON);
    w.c.powers.swamp_chance = 1.0;
    w.spawn(5, V::new(200.0, 0.0));
    w.hit(0, 1.0, PROJECTILE);
    w.advance(DT);
    assert!(w.areas.is_empty());
    w.hit(0, 100.0, PROJECTILE);
    w.spawn(5, V::new(400.0, 0.0));
    w.advance(DT);
    assert_eq!(w.areas.iter().filter(|a| a.kind == 0).count(), 1);
}
#[test]
fn bomb_emits_exactly_six_nonrecursive_children() {
    let mut w = active();
    w.spawn(5, V::new(100.0, 0.0));
    w.input(100.0, 0.0, true, BOMB);
    for _ in 0..30 {
        w.advance(DT);
        if w.shots.iter().any(|s| s.kind == CHILD) {
            break;
        }
    }
    w.firing = false;
    assert_eq!(w.shots.iter().filter(|s| s.kind == CHILD).count(), 6);
    for pair in w.shots.windows(2) {
        assert!((pair[1].angle - pair[0].angle - std::f32::consts::TAU / 6.0).abs() < 0.001);
    }
    let id = w.next_id;
    seconds(&mut w, 0.5);
    assert_eq!(w.next_id, id);
}
#[test]
fn death_wave_caps_consumes_and_kills_bosses() {
    let mut w = active();
    for _ in 0..8 {
        w.activate(DEATHWAVE);
    }
    assert_eq!(w.charges, 3);
    w.spawn(5, V::new(200.0, 0.0));
    w.spawn(4, V::new(210.0, 0.0));
    assert!(w.death_wave());
    assert_eq!(w.charges, 2);
    seconds(&mut w, 0.6);
    assert!(w.enemies.is_empty());
    assert_eq!(w.kills, 2);
}
#[test]
fn death_wave_needs_charge_and_live_unpaused_run() {
    let mut w = active();
    assert!(!w.death_wave());
    w.activate(DEATHWAVE);
    w.pause(true);
    assert!(!w.death_wave());
    assert_eq!(w.charges, 1);
}
#[test]
fn recovery_never_exceeds_twice_current_max() {
    let mut w = world();
    for _ in 0..20 {
        w.activate(RECOVERY);
    }
    assert_eq!(w.hp, 2.0 * w.stat(11));
    w.phase = 2;
    w.coins = 100.0;
    w.buy(11);
    for _ in 0..5 {
        w.activate(RECOVERY);
    }
    assert_eq!(w.hp, 2.0 * w.stat(11));
}
#[test]
fn thorns_requires_positive_received_damage() {
    let mut w = active();
    w.levels[13] = 2;
    w.spawn(5, V::new(40.0, 0.0));
    let hp = w.enemies[0].hp;
    w.tower_hit(0, 0.0);
    assert_eq!(w.enemies[0].hp, hp);
    w.tower_hit(0, -10.0);
    assert_eq!(w.enemies[0].hp, hp);
    w.tower_hit(0, 1.0);
    assert_eq!(w.enemies[0].hp, hp - w.stat(13) * 0.5);
    w.hp = 0.0;
    let hp = w.enemies[0].hp;
    w.tower_hit(0, 5.0);
    assert_eq!(w.enemies[0].hp, hp);
}
#[test]
fn heat_belongs_to_each_enemy_and_increases_hits() {
    let mut w = active();
    w.c.upgrades[13].base = 0.0; // Isolate enemy heat from retaliation.
    w.spawn(0, V::new(36.0, 0.0));
    w.enemies[0].attack = 0.0;
    w.advance(DT);
    let first = 100.0 - w.hp;
    w.enemies[0].attack = 0.0;
    let before = w.hp;
    w.advance(DT);
    assert!(before - w.hp > first);
    w.spawn(0, V::new(36.0, 0.0));
    assert_eq!(w.enemies[1].hits, 0);
    assert_eq!(heated_damage(10.0, 0.5, 2), 20.0);
}
#[test]
fn kill_coins_and_ammo_collect_without_input() {
    let mut w = active();
    w.c.upgrades[23].base = 1.0;
    w.c.upgrades[21].base = 0.0;
    let ammo: u32 = w.ammo.iter().sum();
    w.spawn(0, V::new(400.0, 0.0));
    w.hit(0, 100.0, PROJECTILE);
    assert_eq!(w.coins, w.c.starting_coins + w.c.enemies[0].coins);
    assert!(w.ammo.iter().sum::<u32>() > ammo);
    assert!(w.drops.is_empty());
}
#[test]
fn golden_income_multiplies_after_permanent_multiplier() {
    let mut w = active();
    w.levels[19] = 2;
    w.activate(GOLDEN);
    w.spawn(0, V::new(400.0, 0.0));
    w.hit(0, 100.0, PROJECTILE);
    let expected =
        w.c.starting_coins + w.c.enemies[0].coins * w.stat(19) * w.c.powers.golden_multiplier;
    assert!((w.coins - expected).abs() < 0.001);
}
#[test]
fn timed_powers_add_full_duration_to_remaining_time() {
    let mut w = active();
    w.spawn(5, V::new(450.0, 0.0));
    for k in 0..7 {
        w.activate(k);
        w.powers[k] -= 2.0;
        w.activate(k);
        assert_eq!(w.powers[k], 2.0 * w.c.powers.durations[k] - 2.0);
        w.levels[20] = 2;
        let remaining = w.powers[k];
        w.activate(k);
        assert_eq!(
            w.powers[k],
            remaining + w.c.powers.durations[k] + w.stat(20)
        );
        w.levels[20] = 0;
    }
}
#[test]
fn orbs_start_at_zero_and_shop_is_between_waves_only() {
    let mut w = world();
    assert_eq!(w.stat(14), 0.0);
    w.coins = 1000.0;
    assert!(!w.buy(14));
    w.start_wave();
    assert!(!w.buy(14));
    w.phase = 2;
    assert!(w.buy(14));
    assert_eq!(w.stat(14), 1.0);
    let before = w.coins;
    assert!(!w.buy(99));
    assert_eq!(w.coins, before);
    w.start_wave();
    assert_eq!(w.stat(14), 1.0);
}
#[test]
fn pause_clears_accumulated_time_and_caps_catchup() {
    let mut w = active();
    w.spawn(5, V::new(400.0, 0.0));
    w.advance(10000.0);
    assert!(w.time <= 0.10001);
    let time = w.time;
    w.pause(true);
    w.advance(10000.0);
    assert_eq!(w.time, time);
    w.pause(false);
    w.advance(DT);
    assert!(w.time - time < 0.017);
    let time = w.time;
    w.advance(f32::NAN);
    w.advance(f32::INFINITY);
    w.advance(-1.0);
    assert_eq!(w.time, time);
}
#[test]
fn drop_requires_a_shot_and_expires() {
    let mut w = active();
    w.spawn(5, V::new(450.0, 0.0));
    w.drops.push(Drop {
        id: 100,
        kind: CHAIN,
        p: V::new(80.0, 0.0),
        life: 3.0,
    });
    w.advance(DT);
    assert_eq!(w.powers[CHAIN], 0.0);
    w.input(100.0, 0.0, true, PROJECTILE);
    seconds(&mut w, 0.2);
    assert!(w.powers[CHAIN] > 0.0);
    assert!(w.drops.is_empty());
    w.firing = false;
    w.drops.push(Drop {
        id: 101,
        kind: GOLDEN,
        p: V::new(0.0, 100.0),
        life: DT,
    });
    w.advance(DT);
    assert!(w.drops.is_empty());
    assert_eq!(w.powers[GOLDEN], 0.0);
}
#[test]
fn ammo_limits_special_weapons_not_projectiles() {
    for weapon in 0..4 {
        let mut w = active();
        w.spawn(5, V::new(450.0, 0.0));
        w.ammo = [0; 4];
        w.input(100.0, 0.0, true, weapon);
        w.advance(DT);
        assert_eq!(!w.shots.is_empty(), weapon == PROJECTILE);
    }
}
#[test]
fn a_fired_projectile_can_travel_beyond_range() {
    let mut w = active();
    w.spawn(0, V::new(400.0, 0.0));
    w.c.enemies[0].speed = 0.01;
    w.input(350.0, 0.0, true, PROJECTILE);
    seconds(&mut w, 1.5);
    assert_eq!(w.kills, 1);
}
#[test]
fn mine_damages_and_stuns_survivors() {
    let mut w = active();
    w.spawn(2, V::new(200.0, 0.0));
    w.areas.push(Area {
        p: V::new(200.0, 0.0),
        kind: 1,
        life: 10.0,
    });
    w.advance(DT);
    assert!(w.enemies[0].hp < w.c.enemies[2].hp);
    assert!(w.enemies[0].stun > 0.0);
    assert!(w.areas.is_empty());
}
#[test]
fn regeneration_preserves_overheal_and_repairs_normal_hp() {
    let mut w = active();
    w.spawn(5, V::new(450.0, 0.0));
    w.levels[12] = 1;
    w.hp = 150.0;
    w.advance(DT);
    assert_eq!(w.hp, 150.0);
    w.hp = 60.0;
    w.advance(DT);
    assert!(w.hp > 60.0);
}

#[test]
fn protector_shields_itself_but_all_player_weapon_types_penetrate() {
    for source in [PROJECTILE, LIGHT, MISSILE, BOMB, CHILD] {
        let mut w = active();
        w.spawn(4, V::new(200.0, 0.0));
        w.spawn(4, V::new(210.0, 0.0));
        w.spawn(2, V::new(220.0, 0.0));
        let protector_hp = w.c.enemies[4].hp;
        let tank_hp = w.c.enemies[2].hp;
        for passive in [OTHER, AREA_DAMAGE] {
            assert!(!w.hit(0, 1000.0, passive));
            assert!(!w.hit(2, 1000.0, passive));
        }
        assert_eq!(w.enemies[0].hp, protector_hp);
        assert_eq!(w.enemies[2].hp, tank_hp);
        assert_eq!(w.kills, 0);
        assert_eq!(w.coins, w.c.starting_coins);
        assert!(w.drops.is_empty());
        assert!(w.hit(0, 1.0, source));
        assert_eq!(
            w.enemies[0].hp,
            if matches!(source, BOMB | CHILD) {
                0.0
            } else {
                protector_hp - 1.0
            }
        );
        assert!(w.hit(2, 1.0, source));
        let expected = if matches!(source, BOMB | CHILD) {
            0.0
        } else {
            tank_hp - (1.0 - w.c.defense.protector_reduction)
        };
        assert!((w.enemies[2].hp - expected).abs() < 0.0001);
    }
}

#[test]
fn passive_shield_ends_when_last_nearby_protector_dies_or_target_leaves() {
    let mut w = active();
    w.spawn(4, V::new(200.0, 0.0));
    w.spawn(4, V::new(210.0, 0.0));
    w.spawn(2, V::new(220.0, 0.0));
    assert!(w.hit(0, 100.0, PROJECTILE));
    assert!(!w.hit(2, 1.0, OTHER));
    w.enemies[2].p = V::new(210.0 + w.c.defense.protector_radius + 1.0, 0.0);
    assert!(w.hit(2, 1.0, OTHER));
    w.enemies[2].p = V::new(220.0, 0.0);
    assert!(!w.hit(2, 1.0, AREA_DAMAGE));
    assert!(w.hit(1, 100.0, LIGHT));
    assert!(w.hit(2, 1.0, AREA_DAMAGE));
    assert_eq!(w.enemies[2].hp, w.c.enemies[2].hp - 2.0);
}

#[test]
fn shield_blocks_real_orb_ray_swamp_and_mine_hits_without_mine_stun() {
    for effect in 0..4 {
        for protected in [false, true] {
            let mut w = active();
            let p = V::new(w.c.defense.orb_radius, 0.0);
            w.spawn(2, p);
            if protected {
                w.spawn(4, p);
            }
            match effect {
                0 => w.levels[14] = 1,
                1 => {
                    w.ray_angle = 0.0;
                    w.activate(DEATHRAY);
                }
                _ => w.areas.push(Area {
                    p,
                    kind: if effect == 2 { 0 } else { 1 },
                    life: 10.0,
                }),
            }
            w.advance(DT);
            if protected {
                assert_eq!(w.enemies[0].hp, w.c.enemies[2].hp, "effect {effect}");
                assert_eq!(w.enemies[1].hp, w.c.enemies[4].hp, "effect {effect}");
                assert_eq!(w.enemies[0].stun, 0.0);
                assert_eq!(w.enemies[1].stun, 0.0);
                assert_eq!(w.enemies[0].orb_cd, 0.0);
                assert_eq!(w.enemies[1].orb_cd, 0.0);
                assert_eq!(w.kills, 0);
                assert_eq!(w.coins, w.c.starting_coins);
            } else {
                assert!(w.enemies[0].hp < w.c.enemies[2].hp, "effect {effect}");
                if effect == 3 {
                    assert!(w.enemies[0].stun > 0.0);
                }
            }
        }
    }
}

#[test]
fn protector_stops_chain_hops_until_destroyed_by_player_weapon() {
    let mut w = active();
    w.c.powers.chain_chance = 1.0;
    w.activate(CHAIN);
    w.spawn(5, V::new(250.0, 0.0));
    w.spawn(4, V::new(270.0, 0.0));
    w.spawn(0, V::new(270.0 + w.c.defense.protector_radius + 10.0, 0.0));
    for (i, e) in w.enemies.iter().enumerate() {
        w.grid.insert(e.p, i);
    }
    w.impact(0, PROJECTILE, 1.0);
    assert_eq!(w.enemies[1].hp, w.c.enemies[4].hp);
    assert_eq!(w.enemies[2].hp, w.c.enemies[0].hp);
    assert!(w.hit(1, 100.0, LIGHT));
    w.impact(0, PROJECTILE, 1.0);
    assert!(w.enemies[2].hp <= 0.0);
}

#[test]
fn protector_blocks_thorns_but_not_received_tower_damage() {
    let mut w = active();
    w.levels[13] = 2;
    w.spawn(4, V::new(80.0, 0.0));
    w.spawn(2, V::new(85.0, 0.0));
    let hp = w.hp;
    w.tower_hit(0, 1.0);
    w.tower_hit(1, 1.0);
    assert_eq!(w.hp, hp - 2.0);
    assert_eq!(w.enemies[0].hp, w.c.enemies[4].hp);
    assert_eq!(w.enemies[1].hp, w.c.enemies[2].hp);
    assert!(w.hit(0, 100.0, PROJECTILE));
    w.tower_hit(1, 1.0);
    assert_eq!(w.enemies[1].hp, w.c.enemies[2].hp - w.stat(13));
}

#[test]
fn zero_damage_impact_does_not_proc_knockback_or_chain() {
    let mut w = active();
    w.c.upgrades[9].base = 1.0;
    w.c.powers.chain_chance = 1.0;
    w.activate(CHAIN);
    let p = V::new(200.0, 0.0);
    w.spawn(5, p);
    w.spawn(2, V::new(225.0, 0.0));
    for (i, e) in w.enemies.iter().enumerate() {
        w.grid.insert(e.p, i);
    }
    w.impact(0, PROJECTILE, 0.0);
    assert_eq!(w.enemies[0].p.x, p.x);
    assert_eq!(w.enemies[0].p.y, p.y);
    assert_eq!(w.enemies[1].hp, w.c.enemies[2].hp);
}
#[test]
fn deterministic_seed_and_inputs_produce_identical_worlds() {
    let mut a = world();
    let mut b = world();
    a.start_wave();
    b.start_wave();
    for n in 0..600 {
        let x = (n as f32 * 0.03).cos() * 300.0;
        let y = (n as f32 * 0.03).sin() * 300.0;
        a.input(x, y, true, 0);
        b.input(x, y, true, 0);
        a.advance(DT);
        b.advance(DT);
    }
    assert_eq!(
        serde_json::to_string(&a.snapshot()).unwrap(),
        serde_json::to_string(&b.snapshot()).unwrap()
    );
}
#[test]
fn config_validation_rejects_invalid_balance() {
    let data = include_str!("../balance.json");
    assert!(Config::parse(data).is_ok());
    let mut invalid: serde_json::Value = serde_json::from_str(data).unwrap();
    invalid["upgrades"][21]["base"] = serde_json::json!(1.5);
    assert!(Config::parse(&invalid.to_string()).is_err());
    assert!(Config::parse(&data.replace("\"boss_every\": 10", "\"boss_every\": 0")).is_err());
    assert!(
        Config::parse(&data.replace("\"attack_interval\": 1.1", "\"attack_interval\": 0")).is_err()
    );
}
#[test]
fn representative_late_wave_snapshot_stays_finite() {
    let mut w = active();
    w.c.upgrades[11].base = 100000.0;
    w.hp = 100000.0;
    w.wave = 40;
    w.levels[14] = 4;
    w.levels[2] = 6;
    w.levels[6] = 5;
    w.remaining = 1;
    w.spawn_timer = 1000.0;
    for n in 0..350 {
        w.spawn(n % 5, V::polar(n as f32 * 0.7, 200.0 + (n % 200) as f32));
    }
    let start = std::time::Instant::now();
    for n in 0..600 {
        if n % 60 == 0 {
            while w.enemies.len() < 350 {
                w.spawn(0, V::polar(w.enemies.len() as f32 * 0.7, 480.0));
            }
        }
        w.input(
            (n as f32 * 0.1).cos() * 300.0,
            (n as f32 * 0.1).sin() * 300.0,
            true,
            0,
        );
        w.advance(DT);
    }
    let json = serde_json::to_string(&w.snapshot()).unwrap();
    assert!(!json.contains("null"));
    assert!(
        w.time >= 9.9,
        "stress stopped: phase={}, time={}, hp={}, alive={}, remaining={}",
        w.phase,
        w.time,
        w.hp,
        w.enemies.len(),
        w.remaining
    );
    println!(
        "350-enemy stress: 600 ticks in {:?}; snapshot {} bytes",
        start.elapsed(),
        json.len()
    );
}

#[test]
fn melee_enemies_stop_flush_outside_the_visible_wall() {
    for kind in [0, 1, 2, 4, 5] {
        let mut w = active();
        w.c.upgrades[13].base = 0.0; // Keep fragile enemies alive for geometry checks.
        w.spawn(kind, V::new(5.0, 0.0));
        w.advance(DT);
        let radius = w.c.enemies[kind].radius;
        assert!((w.enemies[0].p.len() - radius - w.c.tower_radius).abs() < 0.001);
        seconds(&mut w, 0.5);
        assert!((w.enemies[0].p.len() - radius - w.c.tower_radius).abs() < 0.001);
    }
}

#[test]
fn explicit_price_tables_are_charged_and_caps_are_enforced() {
    let mut w = world();
    w.phase = 2;
    w.coins = w.c.upgrades.iter().flat_map(|u| &u.costs).sum::<f32>() + 100.0;
    for i in 0..crate::config::UPGRADE_COUNT {
        let prices = w.c.upgrades[i].costs.clone();
        let cap = w.c.upgrades[i].cap;
        for level in 0..cap {
            assert_eq!(w.cost(i), prices[level as usize]);
            let value = w.stat(i);
            assert!(w.buy(i));
            assert!((w.stat(i) - value - w.c.upgrades[i].step).abs() < 0.001);
        }
        assert!(!w.buy(i));
    }
}

#[test]
fn fixed_spawn_phase_holds_at_every_difficulty() {
    for wave in [1, 70, 100, 1000] {
        let mut w = world();
        w.wave = wave - 1;
        w.start_wave();
        let schedule: Vec<_> = (0..w.total)
            .map(|i| w.c.waves.spawn_at(i, w.total))
            .collect();
        assert!(schedule.iter().all(|t| *t > 0.0 && *t < 30.0));
        assert!(schedule.windows(2).all(|t| t[1] > t[0]));
        let ramp = schedule.iter().filter(|t| **t < 5.0).count() as f32 / 5.0;
        let sustained = schedule.iter().filter(|t| **t >= 5.0 && **t < 20.0).count() as f32 / 15.0;
        let peak = schedule.iter().filter(|t| **t >= 20.0).count() as f32 / 10.0;
        assert!(ramp <= sustained && sustained <= peak);
        for frame in 0..1806 {
            w.advance(DT);
            for i in 0..w.enemies.len() {
                w.hit(i, 1_000_000.0, PROJECTILE);
            }
            if frame < 1799 {
                assert_eq!(w.phase, 1);
            }
        }
        assert_eq!(w.spawned, w.total);
        assert_eq!(w.phase, 2);
        assert!(w.snapshot().cleanup_seconds < 0.1);
    }
}

#[test]
fn reference_economy_report_is_finite_and_sensitive_to_rewards() {
    let c = Config::standard();
    let report = crate::balance::reference_income(&c, c.elite_reference.waves);
    println!(
        "REFERENCE_ECONOMY {}",
        serde_json::to_string(&report).unwrap()
    );
    assert!(report.minutes >= 135.0);
    assert!(report.affordable_share > 0.0 && report.affordable_share.is_finite());
    assert!(
        (0.65..=0.95).contains(&report.affordable_share),
        "Elite purchasing power must stay near the revised 80% target"
    );
    assert!(
        crate::balance::reference_income(&c, 300).affordable_share >= 0.90,
        "Exceptional endurance may afford the full workshop"
    );
    let mut doubled = c.clone();
    for e in &mut doubled.enemies {
        e.coins *= 2.0;
    }
    assert!(
        crate::balance::reference_income(&doubled, c.elite_reference.waves).affordable_share
            > report.affordable_share * 1.9
    );
}

#[test]
fn range_and_orb_speed_have_tower_style_display_metadata() {
    let w = world();
    let range = &w.c.upgrades[1];
    let orb = &w.c.upgrades[15];
    assert!((range.base * range.display_scale - 30.0).abs() < 0.001);
    assert_eq!(range.unit, "m");
    assert_eq!(orb.unit, "");
    assert_eq!(w.c.upgrades[0].unit, "");
}

#[test]
fn reference_purchasing_power_reports_approximate_timing_targets() {
    let c = Config::standard();
    assert_eq!(c.elite_reference.cleanup_seconds, 10.0);
    let reports: Vec<_> = (1..=400)
        .map(|wave| crate::balance::reference_income(&c, wave))
        .collect();
    assert!(reports.windows(2).all(|pair| {
        pair[1].affordable_share.is_finite() && pair[1].affordable_share >= pair[0].affordable_share
    }));
    let goals: [(f32, f32, f32); 6] = [
        (0.10, 5.0, 11.0),
        (0.25, 10.0, 21.0),
        (0.50, 20.0, 36.0),
        (0.65, 35.0, 51.0),
        (0.80, 45.0, 61.0),
        (1.00, 60.0, 76.0),
    ];
    let mut previous_crossing = 0;
    for (target, earliest, latest) in goals {
        let crossing = reports
            .iter()
            .find(|report| report.affordable_share >= target)
            .expect("purchasing-power target must be reachable by wave 400");
        println!(
            "PURCHASING_POWER target={target:.2} wave={} minutes={:.2} share={:.4} requested_minutes={earliest}..{latest} within_target={} cleanup_assumption_seconds=10",
            crossing.waves, crossing.minutes, crossing.affordable_share,
            (earliest..=latest).contains(&crossing.minutes)
        );
        // These are approximate tuning targets, not invariants. Report drift rather
        // than flattening enemy counts to fit them. The elite 80% guard above stays hard.
        assert!(crossing.waves > previous_crossing);
        previous_crossing = crossing.waves;
    }
}

#[test]
fn full_workshop_cannot_idle_through_elite_pressure() {
    // Deliberately grant the maximum build in this regression fixture only.
    // The external playtest harness must earn every purchase through normal play.
    let mut w = world();
    for i in 0..crate::config::UPGRADE_COUNT {
        w.levels[i] = w.c.upgrades[i].cap;
    }
    w.hp = w.stat(11) * 2.0;
    w.wave = 74;
    w.start_wave();
    seconds(&mut w, 180.0);
    assert_eq!(
        w.phase, 3,
        "Maximum passive defenses must still need player input"
    );
}

#[test]
fn speed_and_mass_step_after_each_ten_completed_waves_without_changing_enemy_identity() {
    for (wave, speed, mass) in [
        (1, 1.0, 1.0),
        (10, 1.0, 1.0),
        (11, 1.05, 1.08),
        (20, 1.05, 1.08),
        (21, 1.10, 1.16),
        (101, 1.50, 1.80),
    ] {
        let mut w = active();
        w.wave = wave;
        for kind in 0..6 {
            w.spawn(kind, V::new(400.0, 0.0));
        }
        let resistances: Vec<_> = w.c.enemies.iter().map(|e| e.resistance).collect();
        w.advance(DT);
        let snapshot = w.snapshot();
        assert!((snapshot.speed_multiplier - speed).abs() < 0.0001);
        assert!((snapshot.mass_multiplier - mass).abs() < 0.0001);
        for (kind, enemy) in w.enemies.iter().enumerate() {
            assert_eq!(enemy.hp, w.c.enemies[kind].hp);
            assert_eq!(w.c.enemies[kind].resistance, resistances[kind]);
            assert!(
                (400.0 - enemy.p.x - w.c.enemies[kind].speed * speed * DT).abs() < 0.0001,
                "movement at wave {wave}, enemy kind {kind}"
            );
        }
    }
}

#[test]
fn mass_reduces_knockback_and_shock_displacement_but_keeps_type_resistance() {
    for wave in [1, 11, 21] {
        for kind in [0, 2, 5] {
            let mut knockback = active();
            knockback.wave = wave;
            knockback.c.upgrades[9].base = 1.0;
            knockback.spawn(kind, V::new(200.0, 0.0));
            let mass = knockback.c.waves.mass_multiplier(wave);
            let resistance = knockback.c.enemies[kind].resistance;
            knockback.impact(0, PROJECTILE, 0.1);
            let expected = knockback.stat(10) * (1.0 - resistance) / mass;
            assert!((knockback.enemies[0].p.x - 200.0 - expected).abs() < 0.0001);

            let mut shock = active();
            shock.wave = wave;
            shock.shock_timer = 0.0;
            shock.spawn(kind, V::new(100.0, 0.0));
            shock.advance(DT);
            let walked = shock.c.enemies[kind].speed * shock.c.waves.speed_multiplier(wave) * DT;
            let pushed = shock.c.defense.shock_force * (1.0 - resistance) / mass;
            assert!((shock.enemies[0].p.x - (100.0 - walked + pushed)).abs() < 0.0001);
        }
    }
}

#[test]
fn black_hole_snapshot_geometry_matches_nearest_nonstacking_mass_scaled_pull() {
    let defaults = world();
    let holes = defaults.snapshot().blackholes;
    assert_eq!(holes.len(), 2);
    for &(x, y) in &holes {
        assert!((x.hypot(y) - 245.0).abs() < 0.0001);
    }
    assert!((holes[0].0 + holes[1].0).abs() < 0.0001);
    assert!((holes[0].1 + holes[1].1).abs() < 0.0001);

    for wave in [1, 11] {
        let mut w = active();
        w.wave = wave;
        // Intentionally overlap both fields to distinguish one pull from two.
        w.c.powers.blackhole_orbit_radius = 100.0;
        w.c.powers.blackhole_radius = 200.0;
        let before = V::new(20.0, 120.0);
        w.spawn(0, before);
        w.activate(BLACKHOLE);
        w.advance(DT);
        let snapshot = w.snapshot();
        let centers: Vec<_> = snapshot
            .blackholes
            .iter()
            .map(|&(x, y)| V::new(x, y))
            .collect();
        assert!(centers
            .iter()
            .all(|p| before.dist(*p) < w.c.powers.blackhole_radius));
        let nearest = centers
            .iter()
            .min_by(|a, b| before.dist(**a).total_cmp(&before.dist(**b)))
            .unwrap();
        let pulled = before.add(nearest.sub(before).unit().mul(
            w.c.powers.blackhole_force * (1.0 - w.c.enemies[0].resistance)
                / snapshot.mass_multiplier
                * DT,
        ));
        let expected = pulled.sub(
            pulled
                .unit()
                .mul(w.c.enemies[0].speed * snapshot.speed_multiplier * DT),
        );
        assert!(w.enemies[0].p.dist(expected) < 0.0001);
    }
}

#[test]
fn three_snapshot_spotlights_cover_all_beams_and_overlap_multiplies_only_once() {
    let mut w = active();
    w.activate(SPOTLIGHT);
    w.advance(DT);
    let beams = w.snapshot().spotlights;
    assert_eq!(beams.len(), 3);
    for (i, &angle) in beams.iter().enumerate() {
        w.spawn(5, V::polar(angle, 300.0));
        assert!(w.hit(i, 1.0, PROJECTILE));
        assert_eq!(
            w.enemies[i].hp,
            w.c.enemies[5].hp - w.c.powers.spotlight_multiplier
        );
    }
    w.spawn(5, V::polar(beams[0] + std::f32::consts::TAU / 6.0, 300.0));
    assert!(w.hit(3, 1.0, PROJECTILE));
    assert_eq!(w.enemies[3].hp, w.c.enemies[5].hp - 1.0);

    let mut overlapping = active();
    overlapping.c.powers.spotlight_angle = 150.0;
    overlapping.activate(SPOTLIGHT);
    // Halfway between beams 0 and 1, covered by both 150-degree cones.
    overlapping.spawn(5, V::polar(std::f32::consts::TAU / 6.0, 300.0));
    assert!(overlapping.hit(0, 1.0, PROJECTILE));
    assert_eq!(
        overlapping.enemies[0].hp,
        overlapping.c.enemies[5].hp - overlapping.c.powers.spotlight_multiplier
    );
}

#[test]
fn overlapping_swamps_apply_one_damage_tick_while_mines_remain_independent() {
    for swamp_count in [1, 4] {
        let mut w = active();
        let p = V::new(200.0, 0.0);
        w.spawn(5, p);
        for _ in 0..swamp_count {
            w.areas.push(Area {
                p,
                kind: 0,
                life: 10.0,
            });
        }
        for _ in 0..2 {
            w.areas.push(Area {
                p,
                kind: 1,
                life: 10.0,
            });
        }
        w.advance(DT);
        let expected =
            w.c.enemies[5].hp - w.c.powers.swamp_dps * DT - 2.0 * w.c.defense.mine_damage;
        assert!((w.enemies[0].hp - expected).abs() < 0.0001);
        assert_eq!(w.areas.iter().filter(|a| a.kind == 1).count(), 0);
        assert_eq!(w.areas.iter().filter(|a| a.kind == 0).count(), swamp_count);
    }
}

#[test]
fn wave_mass_does_not_change_chrono_slow_or_mine_stun_duration() {
    for wave in [1, 11, 101] {
        let mut chrono = active();
        chrono.wave = wave;
        chrono.spawn(2, V::new(200.0, 0.0));
        chrono.activate(CHRONO);
        chrono.advance(DT);
        let slow = 1.0 - chrono.c.powers.chrono_slow * (1.0 - chrono.c.enemies[2].resistance);
        let expected =
            chrono.c.enemies[2].speed * chrono.c.waves.speed_multiplier(wave) * slow * DT;
        assert!((200.0 - chrono.enemies[0].p.x - expected).abs() < 0.0001);

        let mut mine = active();
        mine.wave = wave;
        mine.spawn(2, V::new(200.0, 0.0));
        mine.areas.push(Area {
            p: V::new(200.0, 0.0),
            kind: 1,
            life: 10.0,
        });
        mine.advance(DT);
        assert_eq!(
            mine.enemies[0].stun,
            mine.c.defense.mine_stun * (1.0 - mine.c.enemies[2].resistance)
        );
    }
}

#[test]
fn invalid_wave_scaling_and_multi_field_geometry_are_rejected() {
    let original: serde_json::Value =
        serde_json::from_str(include_str!("../balance.json")).unwrap();
    for (section, field, invalid) in [
        ("waves", "scaling_every", serde_json::json!(0)),
        ("waves", "speed_step", serde_json::json!(-0.01)),
        ("waves", "mass_step", serde_json::json!(-0.01)),
        ("powers", "blackhole_count", serde_json::json!(0)),
        ("powers", "blackhole_count", serde_json::json!(9)),
        ("powers", "blackhole_orbit_radius", serde_json::json!(0)),
        ("powers", "spotlight_count", serde_json::json!(0)),
        ("powers", "spotlight_count", serde_json::json!(13)),
    ] {
        let mut changed = original.clone();
        changed[section][field] = invalid;
        assert!(
            Config::parse(&changed.to_string()).is_err(),
            "{section}.{field}"
        );
    }
}

#[test]
fn superboss_replaces_one_early_spawn_each_tenth_wave_with_fixed_identity() {
    for wave in [9, 10, 11, 20, 100] {
        let mut w = world();
        w.wave = wave - 1;
        w.start_wave();
        w.hp = 1_000_000.0;
        let total = w.total;
        let mut ids = std::collections::HashSet::new();
        for frame in 0..1801 {
            w.advance(DT);
            for e in &w.enemies {
                if e.kind == SUPERBOSS {
                    assert_eq!(e.hp, w.c.enemies[SUPERBOSS].hp);
                    assert_eq!(w.c.enemies[e.kind].resistance, 1.0);
                    if ids.insert(e.id) {
                        assert!(frame < 120, "Super Boss must arrive early");
                    }
                }
            }
            for i in 0..w.enemies.len() {
                w.hit(i, 1_000_000.0, PROJECTILE);
            }
        }
        assert_eq!(ids.len(), if wave % 10 == 0 { 1 } else { 0 });
        assert_eq!(w.spawned, total);
    }
}

#[test]
fn superboss_takes_one_fixed_deathwave_hit_and_normal_boss_still_dies() {
    let mut w = active();
    w.spawn(SUPERBOSS, V::new(200.0, 0.0));
    w.spawn(5, V::new(-200.0, 0.0));
    for _ in 0..2 {
        w.activate(DEATHWAVE);
        assert!(w.death_wave());
    }
    seconds(&mut w, 1.0);
    assert_eq!(w.enemies.len(), 1);
    assert_eq!(w.enemies[0].kind, SUPERBOSS);
    assert_eq!(
        w.enemies[0].hp,
        w.c.enemies[SUPERBOSS].hp - 2.0 * w.c.specials.superboss_deathwave_damage
    );
    seconds(&mut w, 1.0);
    assert_eq!(
        w.enemies[0].hp, 60.0,
        "A pulse must not hit again on later ticks"
    );
}

#[test]
fn ranged_enemies_stop_at_live_range_and_chrono_extends_beyond_it() {
    for level in [0, 10, 40] {
        for kind in [3, VAMPIRE, RAY, SABOTEUR, OVERCHARGE] {
            let mut w = active();
            w.levels[1] = level;
            let range = w.stat(1);
            w.spawn(kind, V::new(range + 0.1, 0.0));
            w.enemies[0].attack = 100.0;
            w.advance(DT);
            assert!((w.enemies[0].p.len() - range).abs() < 0.001);
            assert_eq!(w.snapshot().chrono_radius, range + 30.0);
        }
        let mut w = active();
        w.levels[1] = level;
        let position = w.stat(1) + 15.0;
        w.spawn(0, V::new(position, 0.0));
        w.activate(CHRONO);
        w.advance(DT);
        assert!(
            (position
                - w.enemies[0].p.x
                - w.c.enemies[0].speed * (1.0 - w.c.powers.chrono_slow) * DT)
                .abs()
                < 0.0001
        );
    }
}

#[test]
fn vampire_drains_only_alive_unstunned_in_range_and_ignores_contact_thorns() {
    let mut w = active();
    w.levels[13] = w.c.upgrades[13].cap;
    w.spawn(VAMPIRE, V::new(w.stat(1), 0.0));
    seconds(&mut w, 1.0);
    assert!((w.hp - 95.0).abs() < 0.002);
    assert_eq!(w.enemies[0].hp, w.c.enemies[VAMPIRE].hp);
    assert!(w.snapshot().enemy_effects[0].3);
    w.enemies[0].stun = 2.0;
    let hp = w.hp;
    seconds(&mut w, 0.5);
    assert_eq!(w.hp, hp);
    assert!(!w.snapshot().enemy_effects[0].3);
    w.hit(0, 100.0, LIGHT);
    seconds(&mut w, 0.5);
    assert_eq!(w.hp, hp);
}

#[test]
fn ray_has_visible_windup_and_can_be_killed_before_firing() {
    let mut w = active();
    w.spawn(RAY, V::new(w.stat(1), 0.0));
    w.enemies[0].attack = 0.0;
    seconds(&mut w, 1.0);
    assert_eq!(w.hp, 100.0);
    assert!(w.snapshot().enemy_effects[0].1 > 0.0);
    assert!(w.hostile.is_empty());
    w.hit(0, 100.0, LIGHT);
    seconds(&mut w, 4.0);
    assert_eq!(w.hp, 100.0);
    let mut firing = active();
    firing.spawn(RAY, V::new(firing.stat(1), 0.0));
    firing.enemies[0].attack = 0.0;
    seconds(&mut firing, 4.0);
    assert!((firing.hp - (100.0 - firing.c.enemies[RAY].damage)).abs() < 0.001);
}

#[test]
fn scatter_has_exactly_one_generation_and_rewards_account_for_children() {
    let mut w = active();
    w.c.upgrades[21].base = 0.0;
    w.c.upgrades[23].base = 0.0;
    w.spawn(SCATTER, V::new(200.0, 0.0));
    w.hit(0, 100.0, PROJECTILE);
    w.advance(DT);
    assert_eq!(w.enemies.len(), w.c.specials.scatter_children);
    assert!(w
        .enemies
        .iter()
        .all(|e| e.kind == SCATTER && e.child && e.hp == w.c.enemies[1].hp));
    let snapshot = w.snapshot();
    assert_eq!(snapshot.enemy_radii.len(), w.c.specials.scatter_children);
    assert!(snapshot
        .enemy_radii
        .iter()
        .all(|&(_, r)| r == w.c.enemies[1].radius && r < w.c.enemies[SCATTER].radius));
    assert!(snapshot
        .enemies
        .iter()
        .all(|e| e.1 == SCATTER && e.5 == w.c.enemies[1].hp));
    for i in 0..w.enemies.len() {
        w.hit(i, 100.0, PROJECTILE);
    }
    w.advance(DT);
    assert!(w.enemies.is_empty());
    assert_eq!(w.kills, 1 + w.c.specials.scatter_children as u32);
    assert_eq!(
        w.earned,
        w.c.enemies[SCATTER].coins + w.c.specials.scatter_children as f32 * w.c.enemies[1].coins
    );
    let mut deathwave = active();
    deathwave.spawn(SCATTER, V::new(100.0, 0.0));
    deathwave.activate(DEATHWAVE);
    deathwave.death_wave();
    seconds(&mut deathwave, 0.5);
    assert!(deathwave.enemies.is_empty());
}

#[test]
fn scatter_children_use_small_stats_for_damage_collision_and_range_falloff() {
    let mut w = active();
    w.c.upgrades[13].base = 0.0; // Inspect the child after its contact hit.
    w.spawn(SCATTER, V::new(200.0, 0.0));
    w.hit(0, 100.0, PROJECTILE);
    w.advance(DT);
    let radius = w.enemies[0].definition(&w.c).radius;
    w.enemies[0].p = V::new(w.stat(1) + 30.0, 0.0);
    w.hit(0, w.c.weapons[BOMB as usize].damage, BOMB);
    assert!((w.enemies[0].hp - w.c.enemies[1].hp * 0.5).abs() < 0.0001);
    assert_eq!(
        w.light_damage(0),
        w.c.enemies[1].hp + f32::EPSILON * w.c.enemies[1].hp
    );
    w.enemies[0].p = V::new(1.0, 0.0);
    w.enemies[0].attack = 0.0;
    let before = w.hp;
    w.advance(DT);
    assert!((w.enemies[0].p.len() - w.c.tower_radius - radius).abs() < 0.001);
    assert!((before - w.hp - w.c.enemies[1].damage).abs() < 0.001);
}

#[test]
fn commander_speed_and_attack_aura_is_nonstacking_and_ends_on_death() {
    let mut w = active();
    w.spawn(0, V::new(200.0, 0.0));
    w.spawn(COMMANDER, V::new(200.0, 60.0));
    w.spawn(COMMANDER, V::new(200.0, -60.0));
    w.enemies[0].attack = 10.0;
    w.advance(DT);
    assert!((200.0 - w.enemies[0].p.x - w.c.enemies[0].speed * 1.25 * DT).abs() < 0.0001);
    assert!((w.enemies[0].attack - (10.0 - DT)).abs() < 0.0001);
    assert!(w.snapshot().enemy_effects[0].2);
    w.hit(1, 100.0, LIGHT);
    w.hit(2, 100.0, LIGHT);
    let before = w.enemies[0].p.x;
    w.advance(DT);
    assert!((before - w.enemies[0].p.x - w.c.enemies[0].speed * DT).abs() < 0.0001);
    assert!(!w.snapshot().enemy_effects[0].2);
}

#[test]
fn sabotage_is_visible_temporary_nonstacking_and_clears_when_source_dies() {
    let mut w = active();
    w.levels.fill(1);
    w.spawn(SABOTEUR, V::new(w.stat(1), 0.0));
    w.spawn(SABOTEUR, V::new(0.0, w.stat(1)));
    w.enemies[0].attack = 0.0;
    w.enemies[1].attack = 0.0;
    let levels = w.levels;
    w.advance(DT);
    assert_eq!(w.sabotage_time, w.c.specials.sabotage_duration);
    assert!(w.disabled_weapon >= 1 || w.disabled_stat >= 0);
    if w.disabled_stat >= 0 {
        let index = w.disabled_stat as usize;
        assert!(![1, 11, 12, 19, 20, 21, 22, 23].contains(&index));
        assert_eq!(w.stat(index), w.c.upgrades[index].base);
    }
    let selected = (w.disabled_weapon, w.disabled_stat);
    w.enemies[1].attack = 0.0;
    w.advance(DT);
    assert_eq!((w.disabled_weapon, w.disabled_stat), selected);
    assert!(w.sabotage_time < w.c.specials.sabotage_duration);
    w.hit(0, 100.0, LIGHT);
    w.advance(DT);
    assert_eq!(w.sabotage_time, 0.0);
    assert_eq!((w.disabled_weapon, w.disabled_stat), (-1, -1));
    assert_eq!(w.levels, levels);
    assert!(w.sabotage_cooldown > 0.0);
}

#[test]
fn overcharge_bounces_escalate_and_disappear_when_source_dies() {
    let mut w = active();
    w.hp = 1000.0;
    w.spawn(OVERCHARGE, V::new(w.stat(1), 0.0));
    w.enemies[0].attack = 0.0;
    seconds(&mut w, 1.6);
    assert_eq!(w.overcharge.len(), 1);
    assert_eq!(w.overcharge[0].hits, 1);
    assert!((w.hp - 988.0).abs() < 0.001);
    seconds(&mut w, 3.0);
    assert_eq!(w.overcharge.len(), 1, "Only one ball per source");
    assert_eq!(w.overcharge[0].hits, 2);
    assert!((w.hp - (988.0 - 12.0 * 1.35)).abs() < 0.001);
    let hp = w.hp;
    w.hit(0, 100.0, LIGHT);
    w.advance(DT);
    assert!(w.overcharge.is_empty());
    seconds(&mut w, 3.0);
    assert_eq!(w.hp, hp);
}

#[test]
fn swamp_stun_pulses_have_a_shared_per_enemy_cooldown() {
    let mut w = active();
    w.c.powers.swamp_dps = 0.1;
    w.spawn(2, V::new(200.0, 0.0));
    for _ in 0..4 {
        w.areas.push(Area {
            p: V::new(200.0, 0.0),
            life: 10.0,
            kind: 0,
        });
    }
    w.advance(DT);
    assert!(
        (w.enemies[0].stun - w.c.powers.swamp_stun * (1.0 - w.c.enemies[2].resistance)).abs()
            < 0.0001
    );
    seconds(&mut w, 0.5);
    assert_eq!(
        w.enemies[0].stun, 0.0,
        "Overlapping fields cannot refresh every tick"
    );
    assert!(w.enemies[0].swamp_cd > 0.0);
    seconds(&mut w, 1.05);
    assert!(w.enemies[0].stun > 0.0, "A later pulse may stun again");
}

#[test]
fn ammo_reward_respects_each_weapon_refill_cadence() {
    for level in [0, 5, 15] {
        let mut w = active();
        w.levels[22] = level;
        w.c.upgrades[23].base = 1.0;
        w.c.upgrades[21].base = 1.0;
        let before = w.ammo;
        for _ in 0..40 {
            w.spawn(0, V::new(400.0, 0.0));
        }
        for i in 0..40 {
            w.hit(i, 100.0, PROJECTILE);
        }
        assert_eq!(w.drops.len(), 40, "No obsolete two-power cap");
        for (weapon, before_ammo) in before.iter().enumerate().skip(1) {
            let base = w.c.weapons[weapon].pickup as f32;
            assert_eq!(
                w.ammo[weapon],
                (*before_ammo
                    + (40 / w.c.weapons[weapon].pickup_every)
                        * (base * (1.0 + 0.2 * level as f32)).round() as u32)
                    .min(w.c.weapons[weapon].capacity)
            );
        }
    }
    let mut no_loot = active();
    no_loot.c.upgrades[21].base = 0.0;
    no_loot.c.upgrades[23].base = 0.0;
    let before = no_loot.ammo;
    for _ in 0..40 {
        no_loot.spawn(0, V::new(400.0, 0.0));
    }
    for i in 0..40 {
        no_loot.hit(i, 100.0, PROJECTILE);
    }
    assert!(no_loot.drops.is_empty());
    assert_eq!(no_loot.ammo, before);
}

#[test]
fn power_duration_upgrade_adds_exact_seconds_without_changing_instant_powers() {
    let mut w = active();
    w.levels[20] = 7;
    for power in 0..7 {
        w.activate(power);
        assert_eq!(w.powers[power], w.c.powers.durations[power] + 7.0);
    }
    w.hp = 20.0;
    w.activate(RECOVERY);
    assert_eq!(w.hp, 20.0 + w.stat(11) * w.c.powers.recovery_fraction);
    w.activate(DEATHWAVE);
    assert_eq!(w.charges, 1);
}

#[test]
fn light_speed_can_hit_range_boundary_enemies_despite_float_rounding() {
    for angle in [0.1, 0.7, 2.1, 4.6] {
        let mut w = active();
        w.c.enemies[3].speed = 0.0;
        w.spawn(3, V::polar(angle, w.stat(1) + 0.00003));
        let aim = V::polar(angle, 500.0);
        w.input(aim.x, aim.y, true, LIGHT);
        w.advance(DT);
        assert_eq!(w.enemies.len(), 1);
        assert!(w.enemies[0].hp < w.c.enemies[3].hp);
        w.fire_timer = 0.0;
        w.advance(DT);
        assert!(w.enemies.is_empty());
    }
}

#[test]
fn light_speed_needs_one_fewer_hit_with_neutral_weapon_matchups() {
    for kind in 0..crate::config::ENEMY_COUNT {
        for shield in [false, true] {
            for spotlight in [false, true] {
                let count_hits = |source: u8| {
                    let mut w = active();
                    w.c.upgrades[21].base = 0.0;
                    w.c.upgrades[23].base = 0.0;
                    w.c.enemies[kind].weapon_damage = [1.0; 4];
                    w.spawn(kind, V::new(250.0, 0.0));
                    if shield {
                        w.spawn(4, V::new(250.0, 60.0));
                    }
                    if spotlight {
                        w.activate(SPOTLIGHT);
                    }
                    let mut hits = 0;
                    while w.enemies[0].hp > 0.0 {
                        w.impact(0, source, w.c.weapons[0].damage);
                        hits += 1;
                        assert!(hits < 2000);
                    }
                    hits
                };
                let normal = count_hits(PROJECTILE);
                let light = count_hits(LIGHT);
                assert_eq!(
                    light,
                    (normal - 1).max(1),
                    "kind {kind}, shield {shield}, spotlight {spotlight}"
                );
                if !shield && !spotlight {
                    let expected = match kind {
                        0 => Some((2, 1)),
                        1 => Some((1, 1)),
                        2 => Some((9, 8)),
                        4 => Some((7, 6)),
                        RAY => Some((18, 17)),
                        _ => None,
                    };
                    if let Some(expected) = expected {
                        assert_eq!((normal, light), expected);
                    }
                }
            }
        }
    }
}

#[test]
fn light_speed_uses_multishot_rapid_and_one_ammo_per_visible_fan() {
    let mut w = active();
    w.c.upgrades[2].base = 1.0;
    w.c.upgrades[3].base = 3.0;
    w.c.upgrades[4].base = 1.0;
    for angle in [-0.14, 0.0, 0.14] {
        w.spawn(SUPERBOSS, V::polar(angle, 300.0));
    }
    let ammo = w.ammo[LIGHT as usize];
    w.input(300.0, 0.0, true, LIGHT);
    w.advance(DT);
    assert_eq!(w.ammo[LIGHT as usize], ammo - 1);
    assert_eq!(w.fx.iter().filter(|f| f.0 == 1).count(), 3);
    assert_eq!(w.rapid, w.stat(5));
    assert!(
        (w.fire_timer - w.c.weapons[LIGHT as usize].interval / w.stat(0) / w.c.rapid_multiplier)
            .abs()
            < 0.0001
    );
    assert!(w.shots.is_empty());
}

#[test]
fn light_speed_bounces_are_bounded_unique_and_apply_knockback() {
    let mut w = active();
    w.c.upgrades[6].base = 1.0;
    w.c.upgrades[8].base = 2.0;
    w.c.upgrades[7].base = 100.0;
    w.c.upgrades[9].base = 1.0;
    w.spawn(2, V::new(200.0, 0.0));
    w.spawn(2, V::new(200.0, 60.0));
    w.spawn(2, V::new(200.0, 120.0));
    w.spawn(2, V::new(200.0, 180.0));
    w.input(200.0, 0.0, true, LIGHT);
    w.advance(DT);
    assert_eq!(w.fx.iter().filter(|f| f.0 == 1).count(), 3);
    for e in &w.enemies[..3] {
        assert!((e.hp - 7.875).abs() < 0.0001);
    }
    assert_eq!(w.enemies[3].hp, 9.0);
    assert!(w.enemies[0].p.x > 200.0);
}

#[test]
fn smart_missiles_have_slow_cadence_and_one_to_three_hits_for_normal_enemies() {
    let c = Config::standard();
    assert_eq!(c.weapons[MISSILE as usize].damage, 18.0);
    assert_eq!(c.weapons[MISSILE as usize].interval, 0.5);
    for kind in 0..SUPERBOSS {
        let mut w = active();
        w.spawn(kind, V::new(300.0, 0.0));
        let mut hits = 0;
        while w.enemies[0].hp > 0.0 {
            w.impact(0, MISSILE, c.weapons[MISSILE as usize].damage);
            hits += 1;
        }
        assert!((1..=3).contains(&hits));
        if kind == 5 {
            assert_eq!(hits, 2);
        }
    }
    let mut w = active();
    w.input(300.0, 0.0, true, MISSILE);
    let ammo = w.ammo[MISSILE as usize];
    seconds(&mut w, 1.0);
    assert_eq!(w.ammo[MISSILE as usize], ammo - 2);
    let mut upgraded = active();
    upgraded.levels[0] = upgraded.c.upgrades[0].cap;
    upgraded.rapid = 10.0;
    upgraded.input(200.0, 0.0, true, MISSILE);
    let ammo = upgraded.ammo[MISSILE as usize];
    seconds(&mut upgraded, 1.0);
    assert_eq!(upgraded.ammo[MISSILE as usize], ammo - 2);
}

#[test]
fn contact_ticks_once_per_second_and_returns_bullet_equivalent_thorns() {
    let mut w = active();
    w.c.upgrades[12].base = 0.0; // No regeneration obscuring contact damage.
    w.c.enemies[2].hp = 100.0;
    w.c.enemies[2].heat = 0.0;
    w.c.enemies[2].attack_interval = 0.05; // Contact ignores type cadence.
    w.c.weapons[PROJECTILE as usize].damage = 2.0;
    w.spawn(2, V::new(w.c.tower_radius + w.c.enemies[2].radius, 0.0));
    w.enemies[0].attack = 0.0;
    let hp = w.hp;
    seconds(&mut w, 0.1);
    assert_eq!(w.enemies[0].hits, 1);
    assert_eq!(w.enemies[0].hp, 98.0);
    assert_eq!(w.hp, hp - w.c.enemies[2].damage);
    seconds(&mut w, 0.8);
    assert_eq!(w.enemies[0].hits, 1);
    w.levels[13] = 2;
    seconds(&mut w, 0.2);
    assert_eq!(w.enemies[0].hits, 2);
    assert_eq!(w.enemies[0].hp, 92.0);
}

#[test]
fn thorns_is_half_as_effective_against_both_boss_types() {
    for kind in [0, 5, SUPERBOSS] {
        let mut w = active();
        w.levels[13] = 2;
        w.c.enemies[kind].hp = 100.0;
        w.c.weapons[PROJECTILE as usize].damage = 2.0;
        w.spawn(
            kind,
            V::new(w.c.tower_radius + w.c.enemies[kind].radius, 0.0),
        );
        w.tower_hit(0, 1.0);
        let expected = if kind == 0 { 6.0 } else { 3.0 };
        assert_eq!(100.0 - w.enemies[0].hp, expected);
    }
}

#[test]
fn energy_shield_stacks_three_blocks_hits_and_does_not_retaliate() {
    let mut w = active();
    w.spawn(2, V::new(200.0, 0.0));
    for _ in 0..5 {
        w.activate(ENERGY_SHIELD);
    }
    assert_eq!(w.shields, 3);
    let hp = w.hp;
    let enemy_hp = w.enemies[0].hp;
    w.tower_hit(0, 0.0);
    assert_eq!(w.shields, 3);
    for expected in [2, 1, 0] {
        w.tower_hit(0, 500.0);
        assert_eq!(w.shields, expected);
        assert_eq!(w.hp, hp);
        assert_eq!(w.enemies[0].hp, enemy_hp);
    }
    w.tower_hit(0, 1.0);
    assert_eq!(w.hp, hp - 1.0);
    assert_eq!(w.enemies[0].hp, enemy_hp - 1.0);
}

#[test]
fn energy_shield_blocks_ranged_and_overcharge_but_not_continuous_drain() {
    let mut w = active();
    w.activate(ENERGY_SHIELD);
    w.activate(ENERGY_SHIELD);
    w.spawn(OVERCHARGE, V::new(400.0, 0.0));
    let source = w.enemies[0].id;
    w.hostile.push(Hostile {
        p: V::new(5.0, 0.0),
        v: V::new(0.0, 0.0),
        damage: 100.0,
        source,
    });
    let hp = w.hp;
    w.advance(DT);
    assert_eq!(w.shields, 1);
    assert_eq!(w.hp, hp);
    w.hostile.push(Hostile {
        p: V::new(5.0, 0.0),
        v: V::new(0.0, 0.0),
        damage: 100.0,
        source: u32::MAX,
    });
    w.advance(DT);
    assert_eq!(w.shields, 0);
    assert_eq!(w.hp, hp);
    w.activate(ENERGY_SHIELD);
    w.overcharge.push(Overcharge {
        source,
        p: V::new(5.0, 0.0),
        hits: 0,
        to_tower: true,
    });
    w.advance(DT);
    assert_eq!(w.shields, 0);
    assert_eq!(w.hp, hp);
    w.activate(ENERGY_SHIELD);
    w.spawn(VAMPIRE, V::new(w.stat(1), 0.0));
    w.advance(DT);
    assert_eq!(w.shields, 1);
    assert!(w.hp < hp);
}

#[test]
fn shield_charges_round_trip_and_overheal_upgrade_expands_recovery_capacity() {
    let mut w = world();
    w.start_wave();
    w.activate(ENERGY_SHIELD);
    w.activate(ENERGY_SHIELD);
    let restored = World::restore(Config::standard(), &w.save()).unwrap();
    assert_eq!(restored.shields, 2);
    for _ in 0..10 {
        w.activate(RECOVERY);
    }
    assert_eq!(w.hp, w.stat(11) * 2.0);
    w.phase = 2;
    w.coins = 10000.0;
    assert!(w.buy(24));
    w.activate(RECOVERY);
    assert!((w.hp - w.stat(11) * 2.1).abs() < 0.001);
}

#[test]
fn hook_parent_and_children_instantly_kill_shielded_normals_but_not_bosses() {
    for source in [BOMB, CHILD] {
        for kind in 0..crate::config::ENEMY_COUNT {
            let mut w = active();
            w.spawn(kind, V::new(250.0, 0.0));
            w.spawn(4, V::new(250.0, 70.0));
            let damage = if source == BOMB {
                w.c.weapons[BOMB as usize].damage
            } else {
                w.c.child_damage
            };
            w.impact(0, source, damage);
            if matches!(kind, 5 | SUPERBOSS) {
                assert!(w.enemies[0].hp > 0.0);
                let expected = w.c.enemies[kind].hp
                    - damage
                        * w.c.enemies[kind].weapon_damage[BOMB as usize]
                        * (1.0 - w.c.defense.protector_reduction);
                assert!((w.enemies[0].hp - expected).abs() < 0.0001);
            } else {
                assert_eq!(w.enemies[0].hp, 0.0, "kind{kind} source{source}");
            }
        }
    }
}

#[test]
fn hook_children_share_parent_collision_size_and_never_rehit_origin() {
    for child in [false, true] {
        let mut w = active();
        // This offset is outside the old4-unit projectile collision, inside12-unit bomb collision.
        w.spawn(0, V::new(100.0, 25.0));
        if child {
            w.split_bomb(V::new(27.0, 0.0), 999);
        } else {
            w.input(200.0, 0.0, true, BOMB);
        }
        for _ in 0..20 {
            w.advance(DT);
            w.firing = false;
            if w.kills > 0 {
                break;
            }
        }
        assert_eq!(w.kills, 1, "child={child}");
    }
    let mut w = active();
    w.spawn(SUPERBOSS, V::new(100.0, 0.0));
    w.input(100.0, 0.0, true, BOMB);
    for _ in 0..30 {
        w.advance(DT);
        w.firing = false;
    }
    assert_eq!(w.enemies[0].hp, 300.0);
    assert!(w
        .shots
        .iter()
        .filter(|s| s.kind == CHILD)
        .all(|s| s.hit_ids.contains(&w.enemies[0].id)));
}

#[test]
fn ray_spin_accelerates_during_charge_and_is_exported_from_simulation() {
    let mut w = active();
    w.spawn(RAY, V::new(w.stat(1), 0.0));
    w.enemies[0].attack = 0.0;
    w.advance(DT);
    let first = w.enemies[0].spin;
    w.advance(DT);
    let early = crate::math::angle_delta(first, w.enemies[0].spin).abs();
    seconds(&mut w, 1.5);
    let before = w.enemies[0].spin;
    w.advance(DT);
    let late = crate::math::angle_delta(before, w.enemies[0].spin).abs();
    assert!(late > early * 3.0);
    assert_eq!(
        w.snapshot().ray_spins,
        vec![(w.enemies[0].id, w.enemies[0].spin)]
    );
    assert!(w.hp == 100.0, "Spin-up precedes the shot");
}

#[test]
fn every_player_weapon_has_half_damage_outside_range_and_bosses_take_a_quarter() {
    for kind in [2, RAY, 5, SUPERBOSS] {
        for source in [PROJECTILE, LIGHT, MISSILE, BOMB, CHILD] {
            let damage_at = |offset: f32| {
                let mut w = active();
                w.spawn(kind, V::new(w.stat(1) + offset, 0.0));
                let damage = match source {
                    CHILD => w.c.child_damage,
                    _ => w.c.weapons[source as usize].damage,
                };
                if matches!(kind, 5 | SUPERBOSS) {
                    w.enemies[0].hp = 1000.0;
                }
                let before = w.enemies[0].hp;
                w.impact(0, source, damage);
                before - w.enemies[0].hp
            };
            let inside = damage_at(0.0);
            let tolerance = damage_at(0.05);
            let outside = damage_at(1.0);
            assert!((inside - tolerance).abs() < 0.0001);
            let scale = if matches!(kind, 5 | SUPERBOSS) {
                0.25
            } else {
                0.5
            };
            // Compare unsaturated damage where missiles would otherwise overkill a weak enemy.
            if source == MISSILE && !matches!(kind, 5 | SUPERBOSS) {
                assert!(
                    (outside
                        - 9.0 * Config::standard().enemies[kind].weapon_damage[MISSILE as usize])
                        .abs()
                        < 0.0001
                );
            } else {
                assert!(
                    (outside - inside * scale).abs() < 0.0002,
                    "kind{kind} source{source}: {inside} -> {outside}"
                );
            }
        }
    }
}

#[test]
fn outside_hook_cannot_one_hit_full_health_even_under_spotlight_and_shield() {
    for source in [BOMB, CHILD] {
        let mut w = active();
        w.spawn(RAY, V::new(w.stat(1) + 40.0, 0.0));
        w.spawn(4, V::new(w.stat(1) + 40.0, 60.0));
        w.activate(SPOTLIGHT);
        w.impact(0, source, 1_000_000.0);
        assert_eq!(w.enemies[0].hp, w.c.enemies[RAY].hp / 2.0);
        w.impact(0, source, 1_000_000.0);
        assert_eq!(w.enemies[0].hp, 0.0);
    }
    let mut passive = active();
    passive.spawn(2, V::new(passive.stat(1) + 100.0, 0.0));
    passive.hit(0, 1.0, AREA_DAMAGE);
    assert_eq!(
        passive.enemies[0].hp, 8.0,
        "Automatic defenses do not inherit shot falloff"
    );
}

#[test]
fn deathwave_mass_kills_with_poison_and_maximum_loot_finish_and_serialize() {
    let mut w = active();
    w.hp = 100000.0;
    w.c.upgrades[21].base = 1.0;
    w.c.upgrades[23].base = 1.0;
    w.c.powers.swamp_chance = 1.0;
    w.activate(POISON);
    for n in 0..2000 {
        let kind = [0, 2, 4, SCATTER][n % 4];
        w.spawn(kind, V::polar(n as f32 * 2.39996, 100.0));
    }
    w.spawn(SUPERBOSS, V::new(500.0, 0.0));
    for _ in 0..2 {
        w.activate(DEATHWAVE);
        assert!(w.death_wave());
    }
    seconds(&mut w, 2.0);
    assert_eq!(w.kills, 2000);
    assert_eq!(w.enemies.len(), 1);
    assert_eq!(w.enemies[0].kind, SUPERBOSS);
    assert_eq!(w.enemies[0].hp, 60.0);
    assert_eq!(w.areas.len(), 2000);
    assert!(w.drops.len() <= 128);
    assert!(w.deathwaves.is_empty());
    let snapshot = serde_json::to_string(&w.snapshot()).unwrap();
    assert!(!snapshot.contains("null"));
    println!(
        "DEATHWAVE_STRESS kills={} areas={} snapshot_bytes={}",
        w.kills,
        w.areas.len(),
        snapshot.len()
    );
}

#[test]
fn saved_run_preserves_future_simulation() {
    let mut original = world();
    original.start_wave();
    original.input(220.0, 0.0, true, LIGHT);
    seconds(&mut original, 5.0);
    original.pause(true);
    let mut restored = World::restore(Config::standard(), &original.save()).unwrap();
    assert!(restored.paused);
    assert!(!restored.firing);
    assert_eq!(original.save(), restored.save());
    original.pause(false);
    restored.pause(false);
    original.input(0.0, -220.0, true, LIGHT);
    restored.input(0.0, -220.0, true, LIGHT);
    seconds(&mut original, 4.0);
    seconds(&mut restored, 4.0);
    assert_eq!(original.save(), restored.save());
}
#[test]
fn saved_run_rejects_corruption_and_invalid_types() {
    assert!(World::restore(Config::standard(), "{}").is_err());
    let mut w = world();
    w.start_wave();
    w.spawn(SCATTER, V::new(200.0, 0.0));
    let mut saved: serde_json::Value = serde_json::from_str(&w.save()).unwrap();
    saved["world"]["enemies"][0]["kind"] = serde_json::json!(999);
    assert!(World::restore(Config::standard(), &saved.to_string()).is_err());
    saved["version"] = serde_json::json!(2);
    assert!(World::restore(Config::standard(), &saved.to_string()).is_err());
}
#[test]
fn chain_lightning_reaches_nearest_distant_enemy() {
    let mut w = active();
    w.c.powers.chain_chance = 1.0;
    w.c.powers.chain_count = 1;
    w.activate(CHAIN);
    w.spawn(5, V::new(-350.0, 0.0));
    w.spawn(2, V::new(300.0, 0.0));
    w.spawn(2, V::new(400.0, 0.0));
    w.impact(0, PROJECTILE, 1.0);
    assert!(w.enemies[1].hp < w.c.enemies[2].hp);
    assert_eq!(w.enemies[2].hp, w.c.enemies[2].hp);
}

#[test]
fn rng_never_rounds_up_to_one() {
    let mut rng = crate::math::Rng(1584200935);
    for _ in 0..100_000 {
        let x = rng.next();
        assert!((0.0..1.0).contains(&x));
    }
}
#[test]
fn config_rejects_unknown_fields_and_invalid_stat_domains() {
    let original: serde_json::Value =
        serde_json::from_str(include_str!("../balance.json")).unwrap();
    for (index, base, step) in [
        (0, 0.0, 0.0),
        (11, 0.0, 0.0),
        (2, 1.1, -0.03),
        (14, 0.0, 0.5),
        (3, 0.0, 1.0),
    ] {
        let mut data = original.clone();
        data["upgrades"][index]["base"] = serde_json::json!(base);
        data["upgrades"][index]["step"] = serde_json::json!(step);
        assert!(Config::parse(&data.to_string()).is_err());
    }
    let mut data = original.clone();
    data["unknown"] = serde_json::json!(1);
    assert!(Config::parse(&data.to_string()).is_err());
    let mut data = original;
    data["powers"]["chain_range"] = serde_json::json!(200);
    assert!(Config::parse(&data.to_string()).is_err());
}
#[test]
fn restore_rejects_softlocking_and_inconsistent_states() {
    let mut w = world();
    w.start_wave();
    w.spawn(0, V::new(200.0, 0.0));
    let original: serde_json::Value = serde_json::from_str(&w.save()).unwrap();
    let mut data = original.clone();
    data["world"]["remaining"] = serde_json::json!(0);
    assert!(World::restore(Config::standard(), &data.to_string()).is_err());
    let mut data = original.clone();
    let enemy = data["world"]["enemies"][0].clone();
    data["world"]["enemies"].as_array_mut().unwrap().push(enemy);
    assert!(World::restore(Config::standard(), &data.to_string()).is_err());
    let mut data = original.clone();
    data["world"]["phase"] = serde_json::json!(2);
    assert!(World::restore(Config::standard(), &data.to_string()).is_err());
    let mut data = original;
    data["world"]["hostile"] =
        serde_json::json!([{"p":{"x":200,"y":0},"v":{"x":0,"y":0},"damage":1,"source":0}]);
    assert!(World::restore(Config::standard(), &data.to_string()).is_err());
}
#[test]
fn endurance_workshop_completion_tracks_wave_300() {
    let c = Config::standard();
    let early = crate::balance::reference_income(&c, 100);
    let exceptional = crate::balance::reference_income(&c, 300);
    println!(
        "ENDURANCE_MODEL {}",
        serde_json::to_string(&exceptional).unwrap()
    );
    assert!(early.affordable_share < 0.1);
    assert!((0.9..=1.15).contains(&exceptional.affordable_share));
    assert!(crate::balance::reference_income(&c, 400).affordable_share > 1.0);
}

#[test]
fn protection_cache_tracks_dead_and_moving_protectors() {
    let mut w = active();
    w.spawn(0, V::new(150.0, 0.0));
    w.spawn(4, V::new(160.0, 0.0));
    let hp = w.enemies[0].hp;
    w.hit(0, 1.0, OTHER);
    assert_eq!(w.enemies[0].hp, hp);
    w.enemies[1].p = V::new(-400.0, 0.0);
    w.hit(0, 1.0, OTHER);
    assert!(w.enemies[0].hp < hp);
    w.enemies[1].p = V::new(160.0, 0.0);
    w.enemies[1].hp = 0.0;
    let hp = w.enemies[0].hp;
    w.hit(0, 1.0, OTHER);
    assert!(w.enemies[0].hp < hp);
    w.advance(DT);
    w.spawn(4, V::new(160.0, 0.0));
    let hp = w.enemies[0].hp;
    w.hit(0, 1.0, OTHER);
    assert_eq!(w.enemies[0].hp, hp);
}
#[test]
#[ignore = "manual release-profile endurance workload"]
fn dense_endurance_profile() {
    for count in [750, 3000, 13000] {
        let mut w = world();
        w.start_wave();
        w.hp = 1_000_000.0;
        w.remaining = 0;
        w.spawned = w.total;
        w.wave = 400;
        for i in 0..count {
            w.spawn(
                if i % 50 == 0 { 4 } else { 0 },
                V::polar(i as f32 * 2.399963, 100.0 + (i % 300) as f32),
            );
        }
        w.powers = [30.0; 7];
        w.levels = std::array::from_fn(|i| w.c.upgrades[i].cap);
        let start = std::time::Instant::now();
        seconds(&mut w, 2.0);
        let json = serde_json::to_string(&w.snapshot()).unwrap();
        assert!(!json.contains("null"));
        println!(
            "DENSE_PROFILE enemies={count} ticks=120 elapsed={:?} snapshot_bytes={}",
            start.elapsed(),
            json.len()
        );
    }
}

#[test]
fn diagnostic_weapon_damage_counts_actual_hp_and_child_bombs() {
    let mut w = active();
    w.spawn(0, V::new(80.0, 0.0));
    let hp = w.enemies[0].hp;
    w.hit(0, 1000.0, CHILD);
    assert_eq!(w.weapon_stats[BOMB as usize].damage, hp);
    assert_eq!(w.weapon_stats[BOMB as usize].kills, 1);
    w.spawn(0, V::new(80.0, 0.0));
    w.hit(1, 1.0, OTHER);
    assert_eq!(w.weapon_stats[0].damage, 0.0);
}

#[test]
fn accurate_lss_can_sustain_endurance_but_waste_costs_ammo() {
    for (quantity, accuracy, sustainable) in [(5, 85, true), (6, 80, true), (5, 70, false)] {
        let mut w = active();
        w.remaining = 1;
        w.spawn_timer = 1e9;
        w.hp = 1_000_000.0;
        w.levels[22] = quantity;
        w.c.weapons[LIGHT as usize].capacity = 1_000_000;
        w.ammo[LIGHT as usize] = 100_000;
        w.c.upgrades[21].base = 0.0;
        w.shock_timer = 1e9;
        let opening = w.ammo[LIGHT as usize];
        let mut shots = 0;
        for (kind, count) in [(0, 540), (1, 140), (2, 190), (3, 110), (4, 20)] {
            for _ in 0..count {
                w.spawn(kind, V::new(100.0, 0.0));
                while w.enemies.iter().any(|e| e.hp > 0.0) {
                    let landed = shots % 100 < accuracy;
                    w.input(if landed { 100.0 } else { -100.0 }, 0.0, true, LIGHT);
                    w.fire_timer = 0.0;
                    w.advance(DT);
                    shots += 1;
                    assert!(shots < 20_000);
                }
            }
        }
        let final_ammo = w.ammo[LIGHT as usize];
        println!("LSS_SUSTAIN quantity={quantity} requested_accuracy={accuracy} measured_accuracy={:.2} rounds={shots} ammo_change={}",w.snapshot().overall_report.accuracy,final_ammo as i64-opening as i64);
        assert_eq!(final_ammo >= opening, sustainable);
        assert_eq!(w.ammo_pickups, 50);
    }
}

#[test]
fn magnetic_hook_locks_nearest_cursor_enemy_and_children_stay_unguided() {
    let mut w = active();
    w.spawn(0, V::new(150.0, 120.0));
    w.spawn(0, V::new(0.0, 90.0));
    let target = w.enemies[0].id;
    w.input(160.0, 130.0, true, BOMB);
    w.advance(DT);
    assert_eq!(w.shots[0].target, Some(target));
    assert!((w.shots[0].angle - w.enemies[0].p.angle()).abs() < 0.03);
    w.input(160.0, 130.0, false, BOMB);
    w.enemies[0].p = V::new(180.0, -100.0);
    w.advance(DT);
    assert!(w.shots[0].angle < 0.0);
    w.shots[0].kind = CHILD;
    w.shots[0].target = None;
    w.shots[0].angle = 1.0;
    w.enemies[0].p = V::new(-180.0, -100.0);
    w.advance(DT);
    assert_eq!(w.shots[0].angle, 1.0);
}
#[test]
fn authored_weapon_matchups_change_damage_without_changing_hp() {
    let mut w = active();
    w.spawn(VAMPIRE, V::new(100.0, 0.0));
    let hp = w.enemies[0].hp;
    w.hit(0, 2.0, LIGHT);
    assert_eq!(w.enemies[0].hp, hp - 4.0);
    w.hit(0, 2.0, MISSILE);
    assert_eq!(w.enemies[0].hp, hp - 5.0);
    assert_eq!(w.enemies[0].definition(&w.c).hp, hp);
}

#[test]
fn passive_kills_keep_coins_and_powers_but_cannot_refill_ammo() {
    let mut w = active();
    w.c.upgrades[21].base = 1.0;
    w.c.upgrades[23].base = 1.0;
    let before = w.ammo;
    w.spawn(0, V::new(80.0, 0.0));
    w.hit(0, 100.0, OTHER);
    assert_eq!(w.ammo, before);
    assert_eq!(w.ammo_pickups, 0);
    assert_eq!(w.drops.len(), 1);
    assert!(w.earned > 0.0);
    w.spawn(0, V::new(80.0, 0.0));
    w.hit(1, 100.0, PROJECTILE);
    assert_eq!(w.ammo_pickups, 1);
    assert!(w.ammo[LIGHT as usize] > before[LIGHT as usize]);
}

#[test]
fn premium_ammo_refill_progress_survives_saving_and_cannot_self_fund_isolated_kills() {
    let mut w = active();
    w.ammo[3] = 0;
    w.c.upgrades[23].base = 1.0;
    for _ in 0..3 {
        w.spawn(0, V::new(200.0, 0.0));
        let i = w.enemies.len() - 1;
        w.hit(i, 100.0, PROJECTILE);
    }
    assert_eq!(w.ammo[3], 0);
    w.enemies.clear();
    let saved = w.save();
    let mut restored = World::restore(Config::standard(), &saved).unwrap();
    restored.c.upgrades[23].base = 1.0;
    restored.spawn(0, V::new(200.0, 0.0));
    let i = restored.enemies.len() - 1;
    restored.hit(i, 100.0, PROJECTILE);
    assert_eq!(restored.ammo[3], 1);
    let c = Config::standard();
    let chance = c.upgrades[23].base + c.upgrades[23].step * c.upgrades[23].cap as f32;
    let qty = c.upgrades[22].base + c.upgrades[22].step * c.upgrades[22].cap as f32;
    let refill = |weapon: usize| {
        chance * (c.weapons[weapon].pickup as f32 * qty).round()
            / c.weapons[weapon].pickup_every as f32
    };
    assert!(
        refill(2) < 1.0,
        "One missile kill must not fund another missile"
    );
    assert!(
        refill(3) * 7.0 < 1.0,
        "A seven-kill Hook volley must not fund another Hook"
    );
}

#[test]
fn fractional_ammo_quantity_carries_across_refills_and_saves_with_real_telemetry() {
    let mut w = active();
    w.levels[22] = 1;
    w.c.upgrades[23].base = 1.0;
    w.ammo[2] = 0;
    w.ammo[3] = 0;
    for _ in 0..4 {
        w.spawn(0, V::new(200.0, 0.0));
        let i = w.enemies.len() - 1;
        w.hit(i, 100.0, PROJECTILE);
    }
    assert_eq!(w.ammo[2], 9);
    assert_eq!(w.ammo_remainders[2], 60);
    assert_eq!(w.ammo[3], 1);
    assert_eq!(w.ammo_remainders[3], 20);
    w.enemies.clear();
    let mut restored = World::restore(Config::standard(), &w.save()).unwrap();
    restored.c.upgrades[23].base = 1.0;
    for _ in 0..16 {
        restored.spawn(0, V::new(200.0, 0.0));
        let i = restored.enemies.len() - 1;
        restored.hit(i, 100.0, PROJECTILE);
    }
    assert_eq!(
        restored.ammo[3], 6,
        "Five premium refills preserve the exact 20% gain"
    );
    assert_eq!(restored.ammo_remainders[3], 0);
    assert_eq!(restored.ammo[2], 30);
    assert_eq!(restored.weapon_stats[2].ammo_granted, 30);
    assert_eq!(restored.weapon_stats[2].ammo_discarded, 18);
    assert_eq!(restored.weapon_stats[3].ammo_granted, 6);
    restored.paused = false;
    restored.fire_timer = 0.0;
    restored.input(0.0, 200.0, true, LIGHT);
    restored.advance(DT);
    assert_eq!(
        restored.weapon_stats[1].ammo_spent, 1,
        "One volley spends one ammo, regardless of multishot beams"
    );
    let mut invalid: serde_json::Value = serde_json::from_str(&restored.save()).unwrap();
    invalid["world"]["ammo_remainders"][2] = serde_json::json!(100);
    assert!(World::restore(Config::standard(), &invalid.to_string()).is_err());
}

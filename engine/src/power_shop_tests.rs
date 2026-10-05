use crate::{config::Config, math::V, sim::*};

#[test]
fn stones_and_coins_are_separate_and_purchases_only_work_in_shop() {
    let mut w = World::new(Config::standard(), 42);
    w.stones = 12;
    w.stones_earned = 12;
    assert!(!w.buy_power(0, 0));
    w.phase = 2;
    let coins = w.coins;
    assert!(w.buy_power(0, 0));
    assert_eq!(w.stones, 10);
    assert_eq!(w.coins, coins);
    assert_eq!(w.power_levels[0], [1, 0]);
    assert!(!w.buy_power(16, 0));
    assert!(!w.buy_power(0, 2));
    w.stones = 0;
    assert!(!w.buy_power(0, 1));
}

#[test]
fn ordinary_and_scatter_children_do_not_mint_stones() {
    let mut w = World::new(Config::standard(), 42);
    w.start_wave();
    for k in [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] {
        w.spawn(k, V::new(100.0, 0.0));
    }
    for i in 0..13 {
        w.hit(i, 10000.0, PROJECTILE);
    }
    assert_eq!(w.stones, 14);
    assert_eq!(w.stones_earned, 14);
    w.spawn(SCATTER, V::new(100.0, 0.0));
    let i = w.enemies.len() - 1;
    w.enemies[i].child = true;
    w.hit(i, 10000.0, PROJECTILE);
    assert_eq!(w.stones, 14);
}

#[test]
fn drop_weight_changes_mix_without_minting_more_drops() {
    let mut base = World::new(Config::standard(), 42);
    base.start_wave();
    base.c.upgrades[21].base = 0.1;
    let mut focused = World::new(Config::standard(), 42);
    focused.start_wave();
    focused.c.upgrades[21].base = 0.1;
    focused.power_levels[BLACKHOLE][0] = 5;
    let mut counts = [0usize; 2];
    let mut holes = [0usize; 2];
    for world in [&mut base, &mut focused].iter_mut().enumerate() {
        let (index, w) = world;
        for _ in 0..5000 {
            w.spawn(0, V::new(100.0, 0.0));
            let i = w.enemies.len() - 1;
            w.hit(i, 1000.0, PROJECTILE);
            for drop in w.drops.drain(..) {
                counts[index] += 1;
                if drop.kind == BLACKHOLE {
                    holes[index] += 1;
                }
            }
        }
    }
    assert_eq!(counts[0], counts[1]);
    assert!(holes[1] > holes[0]);
}

#[test]
fn power_builds_persist_and_invalid_levels_are_rejected() {
    let mut w = World::new(Config::standard(), 42);
    w.start_wave();
    w.stones = 20;
    w.stones_earned = 39;
    w.power_levels[GOLDEN] = [2, 3];
    let save = w.save();
    let restored = World::restore(Config::standard(), &save).unwrap();
    assert_eq!(restored.power_levels, w.power_levels);
    assert_eq!(restored.stones, 20);
    let mut invalid: serde_json::Value = serde_json::from_str(&save).unwrap();
    invalid["world"]["power_levels"][0][1] = serde_json::json!(999);
    assert!(World::restore(Config::standard(), &invalid.to_string()).is_err());
    let mut legacy: serde_json::Value = serde_json::from_str(&save).unwrap();
    for field in ["power_levels", "stones", "stones_earned"] {
        legacy["world"].as_object_mut().unwrap().remove(field);
    }
    let old = World::restore(Config::standard(), &legacy.to_string()).unwrap();
    assert_eq!(old.stones, 0);
    assert_eq!(old.power_levels, [[0; 2]; 16]);
}

#[test]
fn reference_stone_budget_requires_specialization_at_wave_300() {
    let c = Config::standard();
    let total: u32 = c
        .power_workshop
        .upgrades
        .iter()
        .flat_map(|u| u.weight_costs.iter().chain(&u.effect_costs))
        .sum();
    let earned = crate::balance::reference_stones(&c, 300);
    println!("POWER_STONE_MODEL earned={earned} total={total}");
    assert!(earned > 200);
    assert!(earned as f32 / (total as f32) < 0.4);
    let fresh = World::milestone_start(c, 42, 50).unwrap();
    assert!(fresh.stones > 0);
    assert_eq!(fresh.power_levels, [[0; 2]; 16]);
}

#[test]
fn effect_upgrades_have_real_incremental_benefits_and_no_duration_path() {
    let mut w = World::new(Config::standard(), 42);
    w.start_wave();
    for power in 0..16 {
        let before = w.power_effect(power);
        w.power_levels[power][1] = 1;
        assert!(
            (w.power_effect(power) - before - w.c.power_workshop.upgrades[power].effect_step).abs()
                < 0.0001
        );
    }
    w.shields = 1;
    w.hp = 10.0;
    w.spawn(0, V::new(w.c.tower_radius + w.c.enemies[0].radius, 0.0));
    w.enemies[0].attack = 0.0;
    w.advance(0.1);
    assert!(w.hp > 10.0);
    assert_eq!(w.shields, 0);
    w.activate(GOLDEN);
    assert!((w.powers[GOLDEN] - w.c.powers.durations[GOLDEN]).abs() < 0.001);
}

#[test]
fn legacy_health_is_migrated_once_and_light_retains_one_hit_advantage() {
    for wave in [9, 10, 20, 100] {
        let mut w = World::new(Config::standard(), 42);
        w.start_wave();
        w.wave = wave;
        w.spawn(2, V::new(100.0, 0.0));
        let hp = w.enemies[0].hp;
        let normal = (hp / w.c.weapons[0].damage).ceil();
        let light = (hp / w.light_damage(0) - 0.00001).ceil();
        assert_eq!(light, (normal - 1.0).max(1.0));
        let mut save: serde_json::Value = serde_json::from_str(&w.save()).unwrap();
        save["world"].as_object_mut().unwrap().remove("hp_scaled");
        save["world"]["enemies"][0]["hp"] = serde_json::json!(w.c.enemies[2].hp - 1.0);
        let restored = World::restore(Config::standard(), &save.to_string()).unwrap();
        assert_eq!(restored.enemies[0].hp, hp - 1.0);
        let twice = World::restore(Config::standard(), &restored.save()).unwrap();
        assert_eq!(twice.enemies[0].hp, hp - 1.0);
    }
}

#[test]
fn malformed_power_prices_effects_and_weights_fail_schema_validation() {
    let original: serde_json::Value =
        serde_json::from_str(include_str!("../balance.json")).unwrap();
    for field in ["weight", "effect_step", "effect_base"] {
        let mut data = original.clone();
        data["power_workshop"]["upgrades"][0][field] = serde_json::json!(-1);
        assert!(Config::parse(&data.to_string()).is_err());
    }
    let mut timing = original.clone();
    timing["powers"]["demon_drop_interval"] = serde_json::json!(0);
    assert!(Config::parse(&timing.to_string()).is_err());
    let mut data = original;
    data["power_workshop"]["upgrades"][0]["weight_costs"] = serde_json::json!([2, 1]);
    assert!(Config::parse(&data.to_string()).is_err());
}

#[test]
fn stone_accounting_rejects_free_levels_and_unearned_balances() {
    let mut w = World::new(Config::standard(), 42);
    w.start_wave();
    w.power_levels[0][0] = 1;
    assert!(World::restore(Config::standard(), &w.save()).is_err());
    w.power_levels[0][0] = 0;
    w.stones = 1;
    assert!(World::restore(Config::standard(), &w.save()).is_err());
}

#[test]
fn demon_strength_applies_to_death_wave_and_orbs_can_generate_displaced_mines() {
    let mut w = World::new(Config::standard(), 42);
    w.start_wave();
    w.spawn(SUPERBOSS, V::new(100.0, 0.0));
    w.enemies[0].hp = 1000.0;
    w.power_levels[DEATHWAVE][1] = 2;
    w.power_levels[11][1] = 2;
    w.demon_time = 30.0;
    w.charges = 1;
    w.death_wave();
    for _ in 0..15 {
        w.advance(DT);
    }
    assert!((w.enemies[0].hp - (1000.0 - 170.0 * 2.1)).abs() < 0.001);
    assert!(w.enemies[0].deathwave_tag);
    w.c.upgrades[16].base = 1.0;
    w.spawn(0, V::new(100.0, 100.0));
    let i = w.enemies.len() - 1;
    w.hit(i, 100.0, ORB_DAMAGE);
    w.advance(DT);
    assert_eq!(w.areas.iter().filter(|a| a.kind == 1).count(), 1);
}

#[test]
fn demon_invulnerability_is_bounded_by_the_power_cooldown() {
    let c = Config::standard();
    let duty = c.powers.demon_invincible_duration / c.powers.demon_drop_interval;
    assert!(
        duty < 0.9,
        "Demon invulnerability must remain below its minimum cooldown: {duty}"
    );
}

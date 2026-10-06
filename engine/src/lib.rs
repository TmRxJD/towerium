mod balance;
mod config;
mod dev;
#[cfg(test)]
mod expansion_tests;
mod math;
mod perks;
mod power_expansion;
mod power_shop;
#[cfg(test)]
mod power_shop_tests;
mod sim;
mod supplies;
#[cfg(test)]
mod tests;
use crate::{config::Config, sim::World};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn balance_report(config_json: &str) -> Result<String, JsValue> {
    let c = Config::parse(config_json).map_err(|e| JsValue::from_str(&e))?;
    let waves = [15, 30, 50, 65, c.elite_reference.waves, 150, 300, 400];
    serde_json::to_string(&waves.map(|wave| balance::reference_income(&c, wave)))
        .map_err(|e| JsValue::from_str(&e.to_string()))
}

#[wasm_bindgen]
pub struct Game {
    world: World,
}
#[wasm_bindgen]
impl Game {
    #[wasm_bindgen(constructor)]
    pub fn new(seed: u32, config_json: &str) -> Result<Game, JsValue> {
        let c = Config::parse(config_json).map_err(|e| JsValue::from_str(&e))?;
        Ok(Self {
            world: World::new(c, seed),
        })
    }
    pub fn save(&self) -> String {
        self.world.save()
    }
    pub fn restore(config_json: &str, data: &str) -> Result<Game, JsValue> {
        let c = Config::parse(config_json).map_err(|e| JsValue::from_str(&e))?;
        Ok(Self {
            world: World::restore(c, data).map_err(|e| JsValue::from_str(&e))?,
        })
    }
    pub fn advance(&mut self, elapsed: f32) {
        self.world.advance(elapsed);
    }
    pub fn retry_checkpoint(config_json: &str, data: &str) -> Result<Game, JsValue> {
        let c = Config::parse(config_json).map_err(|e| JsValue::from_str(&e))?;
        Ok(Self {
            world: World::retry_checkpoint(c, data).map_err(|e| JsValue::from_str(&e))?,
        })
    }
    pub fn milestone_start(seed: u32, config_json: &str, wave: u32) -> Result<Game, JsValue> {
        let c = Config::parse(config_json).map_err(|e| JsValue::from_str(&e))?;
        Ok(Self {
            world: World::milestone_start(c, seed, wave).map_err(|e| JsValue::from_str(&e))?,
        })
    }
    pub fn autoplay_start(seed: u32, config_json: &str, wave: u32) -> Result<Game, JsValue> {
        let c = Config::parse(config_json).map_err(|e| JsValue::from_str(&e))?;
        Ok(Self {
            world: World::autoplay_start(c, seed, wave).map_err(|e| JsValue::from_str(&e))?,
        })
    }
    pub fn input(&mut self, x: f32, y: f32, firing: bool, weapon: u8) {
        self.world.auto_firing = false;
        self.world.input(x, y, firing, weapon);
    }
    pub fn assisted_input(&mut self, x: f32, y: f32, firing: bool, weapon: u8) {
        self.world.assisted_input(x, y, firing, weapon);
    }
    pub fn set_auto_input(&mut self, x: f32, y: f32, firing: bool, weapon: u8) {
        self.world.set_auto_input(x, y, firing, weapon);
    }
    pub fn start_wave(&mut self) -> bool {
        self.world.start_wave()
    }
    pub fn choose_perk(&mut self, index: usize) -> bool {
        self.world.choose_perk(index)
    }
    pub fn buy(&mut self, index: usize) -> bool {
        self.world.buy(index)
    }
    pub fn buy_supply(&mut self, item: usize) -> bool {
        self.world.buy_supply(item)
    }
    pub fn buy_power(&mut self, power: usize, path: usize) -> bool {
        self.world.buy_power(power, path)
    }
    pub fn pause(&mut self, paused: bool) {
        self.world.pause(paused);
    }
    pub fn death_wave(&mut self) -> bool {
        self.world.death_wave()
    }
    pub fn snapshot(&self) -> String {
        serde_json::to_string(&self.world.snapshot()).expect("finite snapshot")
    }
    pub fn dev_balance(&mut self, json: &str) -> Result<(), JsValue> {
        self.world
            .dev_balance(json)
            .map_err(|e| JsValue::from_str(&e))
    }
    pub fn dev_config(json: &str) -> Result<String, JsValue> {
        crate::dev::normalize_balance(json).map_err(|e| JsValue::from_str(&e))
    }
    pub fn dev_run(&mut self, json: &str) -> Result<(), JsValue> {
        self.world.dev_run(json).map_err(|e| JsValue::from_str(&e))
    }
    pub fn dev_spawn(&mut self, kind: usize, count: u32) -> Result<(), JsValue> {
        self.world
            .dev_spawn(kind, count)
            .map_err(|e| JsValue::from_str(&e))
    }
    pub fn dev_power(&mut self, kind: usize) -> bool {
        if kind >= crate::power_shop::POWER_COUNT {
            return false;
        }
        self.world.activate(kind);
        true
    }
    pub fn dev_clear(&mut self) {
        self.world.enemies.clear();
        self.world.hostile.clear();
        self.world.overcharge.clear();
    }
}

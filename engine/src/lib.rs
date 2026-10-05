mod balance;
mod config;
mod math;
mod power_shop;
#[cfg(test)]
mod power_shop_tests;
mod sim;
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
    pub fn input(&mut self, x: f32, y: f32, firing: bool, weapon: u8) {
        self.world.input(x, y, firing, weapon);
    }
    pub fn start_wave(&mut self) -> bool {
        self.world.start_wave()
    }
    pub fn buy(&mut self, index: usize) -> bool {
        self.world.buy(index)
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
}

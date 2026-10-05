use serde::{Deserialize, Serialize};
use std::f32::consts::TAU;

#[derive(Clone, Copy, Debug, Default, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct V {
    pub x: f32,
    pub y: f32,
}
impl V {
    pub const ZERO: V = V { x: 0.0, y: 0.0 };
    pub fn new(x: f32, y: f32) -> Self {
        Self { x, y }
    }
    pub fn polar(a: f32, r: f32) -> Self {
        Self::new(a.cos() * r, a.sin() * r)
    }
    pub fn add(self, b: V) -> V {
        V::new(self.x + b.x, self.y + b.y)
    }
    pub fn sub(self, b: V) -> V {
        V::new(self.x - b.x, self.y - b.y)
    }
    pub fn mul(self, k: f32) -> V {
        V::new(self.x * k, self.y * k)
    }
    pub fn len(self) -> f32 {
        self.x.hypot(self.y)
    }
    pub fn dist(self, b: V) -> f32 {
        self.sub(b).len()
    }
    pub fn angle(self) -> f32 {
        self.y.atan2(self.x)
    }
    pub fn unit(self) -> V {
        self.mul(1.0 / self.len().max(0.001))
    }
}
pub fn angle_delta(a: f32, b: f32) -> f32 {
    (b - a + std::f32::consts::PI).rem_euclid(TAU) - std::f32::consts::PI
}
pub fn segment_distance(p: V, a: V, b: V) -> f32 {
    let d = b.sub(a);
    let n = d.x * d.x + d.y * d.y;
    let t = if n > 0.0 {
        ((p.x - a.x) * d.x + (p.y - a.y) * d.y) / n
    } else {
        0.0
    };
    p.dist(a.add(d.mul(t.clamp(0.0, 1.0))))
}

#[derive(Serialize, Deserialize)]
pub struct Rng(pub u32);
impl Rng {
    pub fn seeded(seed: u32, domain: u32) -> Self {
        let mut mixed = seed ^ domain;
        mixed = (mixed ^ (mixed >> 16)).wrapping_mul(0x7feb352d);
        mixed = (mixed ^ (mixed >> 15)).wrapping_mul(0x846ca68b);
        Self((mixed ^ (mixed >> 16)).max(1))
    }
    pub fn next(&mut self) -> f32 {
        let mut x = self.0;
        x ^= x << 13;
        x ^= x >> 17;
        x ^= x << 5;
        self.0 = x;
        (x >> 8) as f32 / 16_777_216.0
    }
    pub fn chance(&mut self, p: f32) -> bool {
        self.next() < p
    }
}

// Reused cell vectors; entity indices are valid until the end-of-tick compaction.
pub struct Grid {
    cells: Vec<Vec<usize>>,
}
impl Grid {
    pub fn new() -> Self {
        Self {
            cells: (0..256).map(|_| Vec::with_capacity(16)).collect(),
        }
    }
    fn cell(v: f32) -> usize {
        ((v + 600.0) / 75.0).floor().clamp(0.0, 15.0) as usize
    }
    pub fn clear(&mut self) {
        for c in &mut self.cells {
            c.clear();
        }
    }
    pub fn insert(&mut self, p: V, i: usize) {
        self.cells[Self::cell(p.y) * 16 + Self::cell(p.x)].push(i);
    }
    pub fn query(&self, p: V, radius: f32, out: &mut Vec<usize>) {
        out.clear();
        for y in Self::cell(p.y - radius)..=Self::cell(p.y + radius) {
            for x in Self::cell(p.x - radius)..=Self::cell(p.x + radius) {
                out.extend_from_slice(&self.cells[y * 16 + x]);
            }
        }
    }
}

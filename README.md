# Towerium

Towerium is a browser tower-defense mini-game inspired by *Delirium*. It is a standalone game prototype built with a deterministic Rust simulation and a TypeScript canvas interface.

Play the published build at [tmrxjd.github.io/towerium](https://tmrxjd.github.io/towerium/).

## Requirements

- Node.js 22 or newer and npm
- Rust with the `wasm32-unknown-unknown` target
- `wasm-bindgen-cli` 0.2.104

Install the Rust target and matching binding tool once:

```sh
rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli --version 0.2.104 --locked
```

## Run locally

```sh
npm ci
npm run build
npm run dev
```

Vite prints the local address. To build a static production bundle, run `npm run build`; the output is written to `dist/`.

## Controls and screens

- Aim with the pointer or arrow keys; hold the primary fire control or Space to fire.
- On touch devices, drag the Aim Pad to aim and use the separate Fire button to shoot; lifting either finger does not cancel the other action. Tap Fire once for single-shot weapons, including Hook Bomb.
- Touch sensitivity and right/left-handed control placement are available in settings and persist on this device.
- While firing on touch screens, aiming within 14 screen pixels of an enemy or pickup gently locks onto it. The raw cursor stays under your control; desktop aiming is unchanged.
- Select weapons with the weapon buttons, number keys, or the mouse wheel. Right-click or press Q to release Death Wave when a charge is available.
- Use Pause, Help, Music, and Effects from the game controls. The Workshop and wave report share the between-wave flow; Next Wave starts the next attack.
- Saved human runs can be resumed from the opening screen. Restart asks for confirmation.
- Each run has up to three retries from its latest cleared ten-wave checkpoint. Clearing wave 50 unlocks a fresh Wave 50 start with empty shops and reference-based coin and Power Stone budgets.
- Auto Play runs a separate spectator game with selectable start wave, build, aim, weapon preferences, reaction delay, cursor speed and switch delay, keeps advancing when the tab is hidden, and does not use or overwrite the personal human run. Manual runs pause when the window loses focus.

Spend an Auto Play start budget manually before watching. Timing defaults are 250 ms / 900 battlefield pixels per second / 200 ms switch delay; they are tuning assumptions, not proof of human playability. Camera zoom keeps the range circle inside the viewport.

The Workshop has separate coin-funded upgrades and a Powerups category bought with run-local Power Stones. Special weapons have finite ammunition. Ammo drops are collected automatically; power-up drops must be shot to collect them. Music and effects have independent settings. Death Penalty marks an enemy, including bosses; Space Displacer spaces persistent mines evenly inside the orb path and sends them in the opposite direction; Pulsar Harvester procs on weapon hits to reduce that enemy’s speed and mass; Om Chip focuses the nearest elite or boss target.

The timed power set includes Chain Lightning, Chrono Field, Swamp, Black Hole, Spotlight, Death Ray, and Golden Tower. Power Stone purchases upgrade their effects. Enemy health gains one cannon-hit worth of capacity every ten waves. Swamp ticks each enemy once every four seconds even when pools overlap; Death Ray runs a three-second beam and two-second cooldown with a randomized angle at each cycle start. Nuke and Demon drops use their extracted cards, and Demon Mode displays its extracted wing art.

Landmine Radius and Damage specialize mine builds. Wall HP unlocks a contact barrier; ranged attacks bypass it and it rebuilds after Wall Rebuild Time. Max Ammo Capacity raises storage without refilling reserves. Accuracy counts only the main firing line.

Power supply scales with wave density after 100 planned enemies. Base/max global drop investment produces approximately 4/6 pickups per fully cleared late wave; individual drop-share upgrades favor chosen powers. Timed pickups add their full duration without a timer cap. Pulsar Harvester uses the SDK’s 2.5% per-hit proc baseline, adapted to reduce speed and mass by 5% per proc, with a 25% floor.

## Checks

```sh
cargo fmt --manifest-path engine/Cargo.toml --check
cargo test --manifest-path engine/Cargo.toml
cargo clippy --all-targets --manifest-path engine/Cargo.toml -- -D warnings
npm run test:content
npm run typecheck
npm run test:playtest
npm run test:browser
npm run build
```

See [PLAYTESTING.md](PLAYTESTING.md) for the simulation harness and [VALIDATION.md](VALIDATION.md) for the latest recorded verification and open caveats.
The reference values and remaining economy caveats are summarized in [the Tower economy comparison](docs/tower-economy-comparison.md).

## Assets and attribution

The game uses locally extracted Tower artwork and music under `public/tower-assets/`. `npm run assets:sync` refreshes the curated local assets when their source packages are available. It does not download game files.

Towerium is inspired by *Delirium*. Tower artwork was extracted from *The Tower*; the included music tracks are attributed to Krisu in the asset manifest. See the packaged provenance manifests for per-asset source details.

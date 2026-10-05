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

Auto Play spends its starting coin and Power Stone budgets using the selected build, then starts the chosen wave automatically. Timing defaults are 180 ms / 2,400 battlefield pixels per second / 160 ms switch delay (touch: 240 ms / 1,800 pixels per second / 200 ms); Crowd Sweeps favors nearby groups and fires Multishot while turning through them; these defaults are tuning assumptions, not proof of human playability. Camera zoom keeps the range circle inside the viewport.

Supplies sells premium ammo, Death Wave charges and ready powers for coins. The last 20% of workshop levels now cost 75% more, making full workshop affordability an extreme endurance outcome (around wave 900 in the reference model). Ammo drops start at 4%, reaching 7% with investment.

The Workshop has separate coin-funded upgrades and a Powerups category bought with run-local Power Stones. Special weapons have finite ammunition. Ammo drops are collected automatically; power-up drops must be shot to collect them. Music and effects have independent settings. Death Penalty marks an enemy, including bosses; Space Displacer spaces persistent mines evenly inside the orb path and sends them in the opposite direction; Pulsar Harvester procs on weapon hits to reduce that enemy’s speed and mass; Multiverse Nexus activates Golden Tower, Spotlight and Black Hole together.

The timed power set includes Chain Lightning, Chrono Field, Swamp, Black Hole, Spotlight, Death Ray, and Golden Tower. Power Stone purchases upgrade their effects. Enemy health gains one cannon-hit worth of capacity every ten waves. Swamp ticks each enemy once every four seconds even when pools overlap; Death Ray runs a three-second beam and two-second cooldown with a randomized angle at each cycle start. Nuke and Demon drops use their extracted cards, and Demon Mode displays its extracted wing art.

Landmine Radius and Damage specialize mine builds. Wall HP unlocks a contact barrier; ranged attacks bypass it and it rebuilds after Wall Rebuild Time. Max Ammo Capacity raises storage without refilling reserves. Accuracy counts only the main firing line.

Rapid Fire triggers 4× firing speed for 0.25–0.5 seconds, with 2–10% chance on normal volleys. Burst volleys cannot renew the effect. Rapid Fire Chance and Thorns have steep specialization prices.

Power supply scales with wave density after 100 planned enemies. Base/max global drop investment produces approximately 6/8 pickups per fully cleared late wave; individual drop-share upgrades favor chosen powers. Multiverse Nexus is a rarer bundled activation; its duration upgrades extend all three grants. Timed pickups add remaining time up to the Power Stack Cap (50s initially, 70s maximum). Pulsar Harvester uses the SDK’s 2.5% per-hit proc baseline, adapted to reduce speed and mass by 5% per proc, with a 25% floor.

Extra Orbs adds three faster counter-rotating Orbs through Black Hole centers. Area Of Effect expands splash and control fields. Four roaming bots provide coin/Stone rewards, damage amplification, escalating burns or stun/slow control; each bot has its own radius upgrades in Powerups. Gold and Amp are support auras and never attack.

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

## Assisted Aim And Run Perks

Auto Aim is part of normal gameplay: mobile defaults on, desktop defaults off. Eight ordered rules cover tower threats, ranged attackers, fast enemies, bosses/elites, powerups, closest, weakest and strongest. Higher enabled rules break ties before lower rules, with distance and entity ID as final ties. Preferences persist locally. The automatic cannon fires independently alongside manual shots. Manual aiming and weapon selection stay independent. Automatic cooldowns and Rapid Fire bursts are separate, with manual shots taking priority over shared ammo. The Auto Weapons upgrade unlocks automatic LSS, missiles, then Hook Bombs; premium shots target tougher threats. Death Wave stays manual. Results include `aimAssisted`; spectator Auto Play remains separate from human saves/results.

Three seeded, unique, unmaxed perk choices appear after cleared waves 5, 15, 30, 50, 75, 105 and increasingly spaced intervals. One selection is required before the next wave. Perks persist in the run/checkpoint, have explicit caps, and do not alter Workshop purchase levels or prices. Older saves and fresh milestone starts begin a new schedule relative to their starting point. Fifteen perks include five single-level tradeoffs. Cannon Damage adds one base damage per level (maximum five); LSS retains its one-fewer-hit relationship to the improved cannon. Multiplicative tradeoffs apply explicitly to damage, HP, fire rate, range or Orb speed. Heavy Orbs doubles Orb damage. Full definitions are shown in Help.

Bounce redirects now show a gold dashed trail and destination flash. Native regressions cover projectile and LSS bounce hits separately from visual state. These additions require renewed human balance feedback; prior endurance results do not establish the new build balance.

Auto Buy purchases the highest affordable enabled workshop priority. Its checkbox repeats purchases between waves and starts the next wave after five seconds; the button buys once. Configure level limits and automatic perk priorities with the adjacent settings button. Hold a workshop upgrade to buy repeatedly, accelerating while held. Basics award no Coins unless Critical Coin is active; its reward uses the same economy multipliers as other kills.

Accurate original manual cannon hits also earn precision refills: every 12 enemy contacts grant 4 Light Speed and 1 Smart Missile; every fourth refill adds 1 Hook Bomb. Ammo Quantity and capacities apply. Misses, automatic fire, pickups, side pellets and ricochets earn no credit. Runs start with 150 Coins; the first 40 Auto Cannon Efficiency levels cost 100 in total, reaching 50%.

Crowd-control tuning strengthens early Multishot, Bounce, Knockback and Shockwave while retaining SDK enemy progression. Manual accuracy earns precision ammunition; side pellets and automatic fire cannot farm that credit. Current endurance evidence and remaining targets are recorded in [PLAYTESTING.md](PLAYTESTING.md).

Crowd Sweeps keeps standard weapons firing through observed enemies while moving toward the next target, including Multishot fan coverage weighted by its current proc chance. Cursor movement stays bounded and direct; it pauses firing through empty sectors, and keeps premium weapons settled-only. Transit geometry is cached at reaction boundaries; intermediate shots cannot reserve damage against the destination, even when shot-counter snapshots arrive late. LSS route targets stay inside its range.

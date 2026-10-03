import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', shell: false });
  if (result.error) throw new Error(`${command}: ${result.error.message}. Install Rust, the wasm32-unknown-unknown target, and wasm-bindgen-cli 0.2.104.`);
  if (result.status !== 0) process.exit(result.status ?? 1);
}
run(process.env.CARGO || 'cargo', ['build', '--manifest-path', 'engine/Cargo.toml', '--target', 'wasm32-unknown-unknown', '--release', '--target-dir', 'engine/target']);
mkdirSync(resolve(root, 'src/wasm'), { recursive: true });
run(process.env.WASM_BINDGEN || 'wasm-bindgen', ['engine/target/wasm32-unknown-unknown/release/towerium_engine.wasm', '--target', 'web', '--out-dir', 'src/wasm', '--out-name', 'towerium']);

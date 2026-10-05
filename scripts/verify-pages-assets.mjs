import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { gameAssetPath } from 'thetowersdk/assets';

const root = resolve(import.meta.dirname, '..');
const publicRoot = resolve(root, 'public/tower-assets');
const imageManifest = JSON.parse(await readFile(resolve(publicRoot, 'manifest.json'), 'utf8'));
const musicManifest = JSON.parse(await readFile(resolve(publicRoot, 'music/manifest.json'), 'utf8'));
const musicCatalog = JSON.parse(await readFile(resolve(root, 'src/music-catalog.json'), 'utf8'));

async function verifyAsset(relativePath, expectedHash, expectedBytes) {
  const path = resolve(publicRoot, relativePath);
  if (!path.startsWith(publicRoot + sep)) throw new Error(`Asset path escapes public root: ${relativePath}`);
  const bytes = await readFile(path);
  if (expectedBytes !== undefined && bytes.byteLength !== expectedBytes) {
    throw new Error(`Asset size mismatch: ${relativePath}`);
  }
  if (expectedHash && createHash('sha256').update(bytes).digest('hex') !== expectedHash) {
    throw new Error(`Asset checksum mismatch: ${relativePath}`);
  }
}

for (const asset of Object.values(imageManifest.assets)) {
  const size = asset.size ?? (asset.path.endsWith('-lg.webp') ? 'lg' : 'md');
  const sdkPath = gameAssetPath(asset.name, { domain: asset.domain, size });
  if (sdkPath !== asset.path) throw new Error(`SDK asset path mismatch: ${asset.name}: ${sdkPath} != ${asset.path}`);
  await verifyAsset(asset.path, asset.sha256);
}

const musicByFile = new Map(musicManifest.tracks.map(track => [track.file, track]));
for (const file of musicCatalog) {
  const track = musicByFile.get(file);
  if (!track) throw new Error(`Music catalog track has no manifest entry: ${file}`);
  await verifyAsset(`music/${file}`, track.sha256, track.bytes);
}

console.log(`Verified ${Object.keys(imageManifest.assets).length} Tower assets and ${musicCatalog.length} music tracks.`);

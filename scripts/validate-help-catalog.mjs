import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { gameAssetPath } from 'thetowersdk/assets';
import { powers, weapons } from './playtest-policy.mjs';

const readJson = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const [balance, workshop, cosmetics, music] = await Promise.all([
  readJson('../engine/balance.json'),
  readJson('../src/workshop-catalog.json'),
  readJson('../src/cosmetic-catalog.json'),
  readJson('../src/music-catalog.json'),
]);

const assertUnique = (values, label) => {
  assert.equal(new Set(values).size, values.length, `${label} must be unique`);
};
const assertKeys = (value, allowed, label) => {
  assert.deepEqual(Object.keys(value).sort(), [...allowed].sort(), `${label} has missing or unknown keys`);
};
const assertSafeSegment = (value, label) => {
  assert.equal(typeof value, 'string', `${label} must be a string`);
  assert.ok(value.length > 0 && value.trim() === value, `${label} must be nonempty and trimmed`);
  assert.ok(!/[\\/\x00-\x1f]/.test(value) && value !== '.' && value !== '..', `${label} must be a safe path segment`);
};
const assertSafeAssetName = (value, label) => {
  assertNonEmpty(value, label);
  assert.ok(!/[\x00-\x1f]/.test(value) && !/^[\\/]/.test(value), `${label} must be a safe asset name`);
  assert.ok(!value.split(/[\\/]/).includes('..'), `${label} must not contain a parent path`);
};
const assertNonEmpty = (value, label) => {
  assert.equal(typeof value, 'string', `${label} must be a string`);
  assert.ok(value.length > 0 && value.trim() === value, `${label} must be nonempty and trimmed`);
};
const assertAssetExists = async (assetPath, label) => {
  assert.ok(assetPath, `${label} did not resolve to an asset path`);
  await access(new URL(`../public/tower-assets/${assetPath}`, import.meta.url));
};

assert.equal(weapons.length, 4, 'weapon labels must match four engine weapon slots');
assert.equal(powers.length, 10, 'power labels must match ten engine power slots');
assertUnique(weapons, 'weapon labels');
assertUnique(powers, 'power labels');
for (const label of [...weapons, ...powers]) assertNonEmpty(label, 'gameplay label');
assert.equal(balance.enemies.length, 13, 'enemy catalog must contain 13 entries');
assertUnique(balance.enemies.map(enemy => enemy.name), 'enemy names');
assert.equal(balance.upgrades.length, 25, 'balance must contain 25 upgrades');
assert.equal(workshop.length, 25, 'workshop catalog must contain 25 entries');
assertUnique(workshop.map(item => item.index), 'workshop indices');
assert.deepEqual([...workshop.map(item => item.index)].sort((a, b) => a - b),
  Array.from({ length: 25 }, (_, index) => index), 'workshop indices must cover 0–24');
assertUnique(workshop.map(item => item.label), 'workshop labels');
assertUnique(workshop.map(item => `${item.domain}/${item.asset}`), 'workshop asset paths');
for (const item of workshop) {
  assertKeys(item, item.source === undefined ? ['index','label','asset','domain'] : ['index','label','asset','domain','source'], 'workshop entry');
  assertNonEmpty(item.label, 'workshop label');
  assertSafeAssetName(item.asset, 'workshop asset');
  assert.ok(['workshop','icons'].includes(item.domain), `unknown workshop domain: ${item.domain}`);
  if (item.source !== undefined) assertSafeSegment(item.source, 'workshop source');
  await assertAssetExists(gameAssetPath(item.asset, { domain: item.domain }), `workshop/${item.asset}`);
}

assertKeys(cosmetics, ['skins','backgrounds'], 'cosmetic catalog');
assert.ok(Array.isArray(cosmetics.skins) && cosmetics.skins.length > 0, 'skins must be a nonempty array');
assert.ok(Array.isArray(cosmetics.backgrounds) && cosmetics.backgrounds.length > 0, 'backgrounds must be a nonempty array');
assertUnique(cosmetics.skins.map(skin => skin.id), 'skin ids');
assertUnique(cosmetics.skins.map(skin => skin.name), 'skin names');
for (const skin of cosmetics.skins) {
  assertKeys(skin, ['id','name','asset'], 'skin entry');
  assertSafeSegment(skin.id, 'skin id');
  assertSafeSegment(skin.name, 'skin name');
  if (skin.asset !== null) {
    assertSafeAssetName(skin.asset, 'skin asset');
    await assertAssetExists(gameAssetPath(skin.asset, { domain: 'tower-skins', size: 'lg' }), `tower-skins/${skin.asset}`);
  }
}
assertUnique(cosmetics.backgrounds, 'background names');
for (const background of cosmetics.backgrounds) {
  assertSafeAssetName(background, 'background name');
  await assertAssetExists(gameAssetPath(background, { domain: 'backgrounds', size: 'lg' }), `backgrounds/${background}`);
}

assert.ok(Array.isArray(music) && music.length > 0, 'music catalog must be a nonempty array');
assertUnique(music, 'music paths');
for (const track of music) {
  assertSafeSegment(track, 'music path');
  assert.ok(track.endsWith('.ogg'), `unexpected music file type: ${track}`);
  await access(new URL(`../public/tower-assets/music/${track}`, import.meta.url));
}

console.log(`Help catalogs valid: 13 enemies, 25 workshop entries, ${cosmetics.skins.length} skins, ${cosmetics.backgrounds.length} backgrounds, and ${music.length} music tracks.`);

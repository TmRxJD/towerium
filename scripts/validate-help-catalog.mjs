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
assert.equal(powers.length, 23, 'power labels must match engine pickup types');
assertUnique(weapons, 'weapon labels');
assertUnique(powers, 'power labels');
assert.equal(balance.power_workshop.upgrades.length,23);
assert.deepEqual(balance.power_workshop.upgrades.map(u=>u.name),powers,'power shop labels must match pickup identities');
for(const u of balance.power_workshop.upgrades){
  assertKeys(u,['name','weight','weight_step','weight_costs','effect_label','effect_base','effect_step','effect_costs','unit'],'power upgrade');
  assertNonEmpty(u.effect_label,'power effect label');
  for(const costs of [u.weight_costs,u.effect_costs]){
    assert.ok(costs.every((n,i)=>Number.isInteger(n)&&n>0&&(i===0||n>costs[i-1])),'power prices must escalate');
  }
}
assert.equal(balance.waves.hp_hits_every,10);
assert.equal(balance.waves.milestones.length,400);
assert.equal(balance.waves.milestones[0].sdk_wave,1);
assert.equal(balance.waves.milestones[399].sdk_wave,10000);
const provenance=await readJson('../engine/wave-profile-provenance.json');
const lock=await readJson('../package-lock.json');
assert.equal(provenance.sdkVersion,lock.packages['node_modules/thetowersdk'].version,'generated profile must use pinned SDK');
for (const label of [...weapons, ...powers]) assertNonEmpty(label, 'gameplay label');
assert.equal(balance.enemies.length, 13, 'enemy catalog must contain 13 entries');
assertUnique(balance.enemies.map(enemy => enemy.name), 'enemy names');
assert.equal(balance.upgrades.length, 35, 'balance must contain 35 upgrades');
assert.equal(workshop.length, 35, 'workshop catalog must contain 35 entries');
assertUnique(workshop.map(item => item.index), 'workshop indices');
assert.deepEqual([...workshop.map(item => item.index)].sort((a, b) => a - b),
  Array.from({ length: 35 }, (_, index) => index), 'workshop indices must cover 0–34');
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

console.log(`Help catalogs valid: ${balance.enemies.length} enemies, ${workshop.length} workshop entries, ${powers.length} power upgrades, ${balance.waves.milestones.length} SDK wave rows, ${cosmetics.skins.length} skins, ${cosmetics.backgrounds.length} backgrounds, and ${music.length} music tracks.`);

assertKeys(balance.supplies,['ammo_quantities','ammo_prices','power_prices','wave_price_step'],'Supplies');
assert.equal(balance.supplies.ammo_quantities.length,3);
assert.equal(balance.supplies.power_prices.length,23);
assert.ok([...balance.supplies.ammo_prices,...balance.supplies.power_prices].every(n=>Number.isFinite(n)&&n>0));
assert.equal(balance.powers.timer_cap,50);

const perks = await readJson('../engine/perks.json');
assert.equal(perks.length,15);assertUnique(perks.map(p=>p.name),'perks');
for(const [i,p] of perks.entries()) {assertKeys(p,['name','effect','cap','tradeoff'],'perk');assertNonEmpty(p.name,'perk name');assertNonEmpty(p.effect,'perk effect');assert.ok(Number.isInteger(p.cap)&&p.cap>=1&&p.cap<=5);assert.equal(p.tradeoff,i>=10);if(p.tradeoff)assert.equal(p.cap,1);}
console.log('Perk catalog: 15 definitions, 5 tradeoffs validated');

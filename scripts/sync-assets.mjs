import { copyFileSync, existsSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gameAssetPath } from 'thetowersdk/assets';

// Supply your own local extraction. No artwork is fetched or published by this script.
const source = process.env.TOWER_ASSETS_DIR || resolve('../TrackerWebsite/the-tower-run-tracker/packages/tower-assets/assets/game');
const target = resolve('public/tower-assets');
const catalog=JSON.parse(readFileSync(new URL('../src/cosmetic-catalog.json',import.meta.url),'utf8'));
const workshop=JSON.parse(readFileSync(new URL('../src/workshop-catalog.json',import.meta.url),'utf8'));
const entries = [
  ['perk-damage','Damage Meter','workshop'],
  ...['Basic', 'Fast', 'Tank', 'Ranged', 'Protector', 'Boss', 'Vampire', 'Ray', 'Scatter', 'Commander', 'Saboteur', 'Overcharge', 'Boss Ultimate'].map(name => [`enemy-${name.toLowerCase()}`, `Enemy ${name}`, 'enemies']),
  ['tower', 'Cyber Tower', 'tower-skins'],
  ['chain', 'Weapon Chain Lightning', 'ultimate-weapons'],
  ['chrono', 'Weapon Chrono Field', 'ultimate-weapons'],
  ['poison', 'Weapon Swamp', 'ultimate-weapons'],
  ['blackhole', 'Weapon Black Hole', 'ultimate-weapons'],
  ['spotlight', 'Weapon Spotlight', 'ultimate-weapons'],
  ['golden', 'Weapon Golden Tower', 'ultimate-weapons'],
  ['deathwave', 'Weapon Death Wave', 'ultimate-weapons'],
  ['missile', 'Weapon Smart Missilies', 'ultimate-weapons'],
  ['mine', 'Weapon Land Mines', 'ultimate-weapons'],
  ['hook-bomb', 'Land Mine', 'icons'],
  ['recovery', 'Recovery Package', 'workshop'],
  ['deathray', 'Death Ray', 'cards'],
  ['shield','Shield','icons'],
  ['nuke','protector-nuke','cards'],
  ['demon','demon-mode','cards'],
  ['demon-wing','demon-wing-glow','unidentified','lg'],
  ['module-dp','death-penalty','modules'],
  ['module-sd','space-displacer','modules'],
  ['module-ph','pulsar-harvester','modules'],
  ['module-nexus','multiverse-nexus','modules'],
  ['extra-orbs','extra-orb','cards'], ['aoe','aoe','cards'],
  ['gold-bot','golden-bot','icons'], ['amp-bot','amplify-bot','icons'],
  ['flame-bot','flame-bot','icons'], ['thunder-bot','thunder-bot','icons'],
  ['critical-coin','critical-coin','cards'],
  ['coin','Coin','icons'],
  ['power-stone','coin_ultimate','icons'],
  ...workshop.map(item=>[`workshop-${item.index}`,item.asset,item.domain,'md',item.source]),
  ...catalog.skins.filter(s=>s.asset).map(s=>[`skin-${s.id}`,s.asset,'tower-skins','lg']),
  ...catalog.backgrounds.map((name,i)=>[`background-${i}`,name,'backgrounds','lg']),
];
const manifest = {};
for (const [key, name, domain, size='md', authoredIcon] of entries) {
  const path = gameAssetPath(name, { domain, size });
  // Original Main workshop references take precedence over guessed normalized names.
  const from = authoredIcon ? resolve('assets/workshop-icons', authoredIcon) : resolve(source, path);
  if (!existsSync(from)) throw new Error(`Missing extracted asset: ${from}. Set TOWER_ASSETS_DIR to your game asset root.`);
  mkdirSync(dirname(resolve(target, path)), { recursive: true });
  copyFileSync(from, resolve(target, path));
  manifest[key] = { name, domain, path, ...(authoredIcon ? { authoredIcon, provenance:'assets/workshop-icons/provenance.json' } : {}), sha256: createHash('sha256').update(readFileSync(from)).digest('hex') };
}
writeFileSync(resolve(target, 'manifest.json'), JSON.stringify({ source: 'User-supplied Tower extraction', assets: manifest }, null, 2));
console.log(`Synced ${entries.length} extracted Tower assets using thetowersdk asset paths.`);

// Optional user-supplied audio extraction; keep the original audio bytes.
const musicSource=process.env.TOWER_MUSIC_DIR || resolve(source,'music');
if(existsSync(musicSource)) {
  const tracks=readdirSync(musicSource).filter(name=>/\.(mp3|ogg|wav|m4a)$/i.test(name)).sort();
  mkdirSync(resolve(target,'music'),{recursive:true});
  for(const name of tracks)copyFileSync(resolve(musicSource,name),resolve(target,'music',name));
  writeFileSync(resolve('src/music-catalog.json'),JSON.stringify(tracks,null,2)+'\n');
  console.log(`Synced ${tracks.length} user-supplied music tracks.`);
}

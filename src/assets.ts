import { gameAssetPath, towerAssetUrl } from 'thetowersdk/assets';
import catalog from './cosmetic-catalog.json';
import workshopCatalog from './workshop-catalog.json';
import balance from '../engine/balance.json';
export const workshop=workshopCatalog;
export const skins=catalog.skins;
export const enemyNames = balance.enemies.map(enemy => enemy.name);
export { powers as powerNames } from '../scripts/playtest-policy.mjs';
const powerArt = ['Weapon Chain Lightning', 'Weapon Chrono Field', 'Weapon Swamp', 'Weapon Black Hole', 'Weapon Spotlight', 'Death Ray', 'Weapon Golden Tower', 'Recovery Package', 'Weapon Death Wave','Shield','protector-nuke','demon-mode','death-penalty','space-displacer','pulsar-harvester','multiverse-nexus','extra-orb','aoe','golden-bot','amplify-bot','flame-bot','thunder-bot'];
const base = `${import.meta.env.BASE_URL}tower-assets`;
export const assetUrl = (name:string, domain:string, size:'md'|'lg'='md'):string => {
  const url=towerAssetUrl(gameAssetPath(name, { domain, size }),base);
  if(!url)throw new Error(`Cannot resolve extracted asset: ${domain}/${name}`);
  return url;
};
export const enemyUrls = enemyNames.map(name => assetUrl(name==='Super Boss'?'Enemy Boss Ultimate':`Enemy ${name}`, 'enemies'));
export const powerUrls = powerArt.map((name,i) => assetUrl(name,i>=18?'icons':i>=16?'cards':i>=12?'modules':i===9?'icons':i===5||i>=10 ? 'cards' : i===7 ? 'workshop' : 'ultimate-weapons'));
export const workshopUrls=workshop.map(item=>assetUrl(item.asset,item.domain));
export const coinUrl=assetUrl('Coin','icons');
export const stoneUrl=assetUrl('coin_ultimate','icons');
export const towerUrl = assetUrl('Cyber Tower','tower-skins');
export const skinUrls=skins.map(s=>s.asset?assetUrl(s.asset,'tower-skins','lg'):null);
export const backgroundUrls=catalog.backgrounds.map(name=>assetUrl(name,'backgrounds','lg'));
export interface Art { enemies:HTMLImageElement[]; powers:HTMLImageElement[]; tower:HTMLImageElement; mine:HTMLImageElement; hookBomb:HTMLImageElement; demonWing:HTMLImageElement; skins:(HTMLImageElement|null)[]; backgrounds:HTMLImageElement[] }
async function load(url:string) {
  const image=new Image();image.src=url;
  try {await image.decode();}catch(error){throw new Error(`Cannot Decode Tower Asset: ${url}`,{cause:error});}
  return image;
}
export async function loadArt():Promise<Art> {
  const [enemies,powers,tower,mine,hookBomb,demonWing,skinImages,backgrounds]=await Promise.all([
    Promise.all(enemyUrls.map(load)),Promise.all(powerUrls.map(load)),load(towerUrl),load(assetUrl('Weapon Land Mines','ultimate-weapons')),
    load(assetUrl('Land Mine','icons')),
    load(assetUrl('demon-wing-glow','unidentified','lg')),
    Promise.all(skinUrls.map(url=>url?load(url):Promise.resolve(null))),Promise.all(backgroundUrls.map(load)),
  ]);
  return {enemies,powers,tower,mine,hookBomb,demonWing,skins:skinImages,backgrounds};
}

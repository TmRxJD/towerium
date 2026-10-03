import { gameAssetPath, towerAssetUrl } from 'thetowersdk/assets';
import catalog from './cosmetic-catalog.json';
import workshopCatalog from './workshop-catalog.json';
import balance from '../engine/balance.json';
export const workshop=workshopCatalog;
export const skins=catalog.skins;
export const enemyNames = balance.enemies.map(enemy => enemy.name);
export { powers as powerNames } from '../scripts/playtest-policy.mjs';
const powerArt = ['Weapon Chain Lightning', 'Weapon Chrono Field', 'Weapon Swamp', 'Weapon Black Hole', 'Weapon Spotlight', 'Death Ray', 'Weapon Golden Tower', 'Recovery Package', 'Weapon Death Wave','Shield'];
const base = `${import.meta.env.BASE_URL}tower-assets`;
export const assetUrl = (name:string, domain:string, size:'md'|'lg'='md'):string => {
  const url=towerAssetUrl(gameAssetPath(name, { domain, size }),base);
  if(!url)throw new Error(`Cannot resolve extracted asset: ${domain}/${name}`);
  return url;
};
export const enemyUrls = enemyNames.map(name => assetUrl(name==='Super Boss'?'Enemy Boss Ultimate':`Enemy ${name}`, 'enemies'));
export const powerUrls = powerArt.map((name,i) => assetUrl(name,i===9?'icons':i===5 ? 'cards' : i===7 ? 'workshop' : 'ultimate-weapons'));
export const workshopUrls=workshop.map(item=>assetUrl(item.asset,item.domain));
export const coinUrl=assetUrl('Coin','icons');
export const towerUrl = assetUrl('Cyber Tower','tower-skins');
export const skinUrls=skins.map(s=>s.asset?assetUrl(s.asset,'tower-skins','lg'):null);
export const backgroundUrls=catalog.backgrounds.map(name=>assetUrl(name,'backgrounds','lg'));
export interface Art { enemies:HTMLImageElement[]; powers:HTMLImageElement[]; tower:HTMLImageElement; mine:HTMLImageElement; skins:(HTMLImageElement|null)[]; backgrounds:HTMLImageElement[] }
async function load(url:string) {const image=new Image();image.src=url;await image.decode();return image;}
export async function loadArt():Promise<Art> {
  const [enemies,powers,tower,mine,skinImages,backgrounds]=await Promise.all([
    Promise.all(enemyUrls.map(load)),Promise.all(powerUrls.map(load)),load(towerUrl),load(assetUrl('Weapon Land Mines','ultimate-weapons')),
    Promise.all(skinUrls.map(url=>url?load(url):Promise.resolve(null))),Promise.all(backgroundUrls.map(load)),
  ]);
  return {enemies,powers,tower,mine,skins:skinImages,backgrounds};
}

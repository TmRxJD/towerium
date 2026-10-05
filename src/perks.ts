import type { Snapshot } from './types';
import catalog from '../engine/perks.json';
import { perkUrls } from './assets';
export const perks=catalog;
export function nextPerkText(s:Snapshot){return s.perks.offers.length?'Perk Ready':perks.every((p,i)=>s.perks.levels[i]>=p.cap)?'Perks Maxed':`Next Perk · Wave ${s.next_perk_wave}`;}
export function perkBuild(s:Snapshot){
 return s.perks.picks?`<details class="perk-build" open><summary><strong>Your Perks</strong><span>${s.perks.picks} Picks</span></summary><ul class="perk-list">${perks.map(({name,effect,cap,tradeoff},i)=>s.perks.levels[i]?`<li class="owned-perk${tradeoff?' tradeoff':''}"><img src="${perkUrls[i]}" width="36" height="36" alt=""><div><strong>${name}</strong><span>${effect}</span></div><b class="perk-level">${s.perks.levels[i]}/${cap}</b></li>`:'').join('')}</ul></details>`:'';
}
export function perkChoices(s:Snapshot,spectator=false){
 const build=perkBuild(s);
 const next=`<span class="perk-next">${nextPerkText(s)}</span>`;
 if(!s.perks.offers.length)return `<div class="perk-progress">${s.perks.last===-1?'':`<span class="perk-picked">✓ ${perks[s.perks.last].name} · Level ${s.perks.levels[s.perks.last]}</span>`}${next}</div>`+build;
 return `<section class="perk-selection" aria-labelledby="perk-title"><div class="perk-heading"><h3 id="perk-title">Choose One Perk</h3></div><div class="perk-cards">${s.perks.offers.map(i=>{const {name,effect,cap,tradeoff}=perks[i];return `<button data-perk="${i}" class="perk-card${tradeoff?' tradeoff':''}" ${spectator?'disabled title="Auto Play Chooses Perks"':''}><span class="perk-art"><img src="${perkUrls[i]}" width="64" height="64" alt=""></span><strong>${name}</strong><span class="perk-effect">${effect}</span><small><span>${tradeoff?'Tradeoff':'Upgrade'}</span><b>Level ${s.perks.levels[i]+1}/${cap}</b></small></button>`;}).join('')}</div></section>`+build;
}
export { chooseBuildPerk as selectAutoPerk } from '../scripts/perks.mjs';

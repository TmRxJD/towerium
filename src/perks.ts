import type { Snapshot } from './types';
import catalog from '../engine/perks.json';
export const perks=catalog;
export function perkChoices(s:Snapshot,spectator=false){
 const build=s.perks.picks?`<details class="perk-build"><summary>Run Perks · ${s.perks.picks}</summary>${perks.map(({name,effect,cap},i)=>s.perks.levels[i]?`<p><strong>${name} ${s.perks.levels[i]}/${cap}</strong> · ${effect}</p>`:'').join('')}</details>`:'';
 if(!s.perks.offers.length)return s.perks.last===-1?build:build+`<p class="perk-picked">✓ ${perks[s.perks.last].name} · Level ${s.perks.levels[s.perks.last]} · Next Perk: Wave ${s.next_perk_wave}</p>`;
 return build+`<section class="perk-selection" aria-labelledby="perk-title"><h3 id="perk-title">Choose One Perk</h3><div class="perk-cards">${s.perks.offers.map(i=>{const {name,effect,cap,tradeoff}=perks[i];return `<button data-perk="${i}" class="perk-card${tradeoff?' tradeoff':''}" ${spectator?'disabled':''}><strong>${name}</strong><span>${effect}</span><small>${tradeoff?'Tradeoff · ':''}Level ${s.perks.levels[i]} → ${s.perks.levels[i]+1} / ${cap}</small></button>`;}).join('')}</div></section>`;
}
export { chooseBuildPerk as selectAutoPerk } from '../scripts/perks.mjs';

import balance from '../engine/balance.json';
import { powerUrls, stoneUrl } from './assets';
import type { Snapshot } from './types';

export const stoneIcon=`<img class="currency-icon stone-icon" src="${stoneUrl}" alt="" aria-hidden="true">`;
export function powerValue(value:number,unit:string):string {
  const n=unit==='%'?value*100:value;
  return `${Number(n.toFixed(2))}${unit}`;
}
export function powerShop(state:Snapshot,selected:number,spectator:boolean):string {
  const upgrades=balance.power_workshop.upgrades,total=state.power_weights.reduce((a,b)=>a+b,0);
  const u=upgrades[selected],weight=state.power_weights[selected];
  const paths=[
    {label:'Drop Share',value:powerValue(weight/total,'%'),next:powerValue((weight+u.weight_step)/(total+u.weight_step),'%'),cap:u.weight_costs.length},
    {label:u.effect_label,value:powerValue(state.power_effects[selected],u.unit),next:powerValue(state.power_effects[selected]+u.effect_step,u.unit),cap:u.effect_costs.length},
  ];
  return `<div class="power-selector" role="group" aria-label="Choose A Powerup">${upgrades.map((p,i)=>`<button type="button" class="power-choice" data-power-select="${i}" aria-label="${p.name}" aria-pressed="${i===selected}" title="${p.name}"><img src="${powerUrls[i]}" alt="" width="36" height="36"></button>`).join('')}</div><section class="power-upgrades" aria-labelledby="power-shop-title"><h3 id="power-shop-title">${u.name}</h3><div class="power-upgrade-grid">${paths.map((p,path)=>{
    const level=state.power_levels[selected][path],cost=state.power_costs[selected][path],capped=level>=p.cap;
    return `<button type="button" class="upgrade" data-power-buy="${selected}" data-power-path="${path}" ${spectator||capped||state.stones<cost?'disabled':''} aria-label="Upgrade ${u.name} ${p.label}${capped?', Maximum Level':` For ${cost} Power Stones`}"><span class="upgrade-title"><strong>${p.label}</strong><span>${level}/${p.cap}</span></span><div class="upgrade-bottom"><span>${p.value}${capped?'':` → ${p.next}`}</span><b>${capped?'MAX':stoneIcon+cost}</b></div></button>`;
  }).join('')}</div></section>`;
}

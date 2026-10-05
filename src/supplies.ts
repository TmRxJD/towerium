import balance from '../engine/balance.json';
import { powerNames, powerUrls, coinUrl } from './assets';
import { weaponIcons } from './weapon-icons';
import type { Snapshot } from './types';
import { formatNumberForDisplay } from 'thetowersdk/formatting';

export function supplyShop(state:Snapshot,spectator:boolean):string {
  const cap=balance.powers.timer_cap;
  const number=(n:number)=>formatNumberForDisplay(n,'Period (.)',{mode:'compact',smallNumberMaxFractionDigits:0,notationMaxFractionDigits:1});
  const cards=state.supply_costs.map((cost,item)=>{
    const power=item-3,name=item<3?['Light Speed','Smart Missiles','Hook Bomb'][item]:power===10?'Fallout':powerNames[power];
    const icon=item<3?weaponIcons[item+1]:`<img src="${powerUrls[power]}" width="20" height="20" alt="">`;
    let value:string;
    if(item<3){const current=state.ammo[item+1],limit=state.ammo_caps[item+1];value=`${current}→${Math.min(current+balance.supplies.ammo_quantities[item],limit)}`;}
    else if(power===8)value=`${state.charges}→${Math.min(3,state.charges+1)}/3`;
    else if(power===9)value=`${state.shields}→${Math.min(3,state.shields+1)}/3`;
    else if(power===7)value=`+${number(Math.min(state.max_hp*state.power_effects[7],state.max_hp*(1+state.values[24])-state.hp))} HP`;
    else if(power===15)value=`GT · SL · BH`;
    else {
      const remaining=power<7?state.powers[power]:power===10?state.fallout_time:power===11?state.demon_time:power>=16?state.extra_power_times[power-16]:state.module_times[power-12];
      const duration=(power<7?balance.powers.durations[power]:power===10?balance.powers.fallout_duration:power===11?balance.powers.demon_duration:power>=16?(power===17?state.power_effects[17]:balance.expansion.durations[power-16]):balance.modules.durations[power-12])+state.values[20];
      value=`${Math.ceil(remaining)}→${Number(Math.min(remaining+duration,cap).toFixed(1))}s`;
    }
    const full=!state.supply_available[item],disabled=spectator||full||state.coins<cost;
    return `<button class="upgrade supply" data-supply="${item}" ${disabled?'disabled':''} aria-label="Buy ${name} For ${number(cost)} Coins${full?', Full':''}"><span class="upgrade-title">${icon}<strong>${name}</strong></span><div class="upgrade-bottom"><span>${full?'Full':value}</span><b><img class="currency-icon" src="${coinUrl}" alt="">${number(cost)}</b></div></button>`;
  });
  return `<div class="upgrade-grid">${cards.join('')}</div>`;
}

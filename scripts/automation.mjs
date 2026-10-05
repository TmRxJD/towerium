export function defaultAutomation(config,perks){
 const first=[19,30,0,2,11,12,6,9,32,14,21,23];
 const order=[...first,...config.upgrades.map((_,i)=>i).filter(i=>!first.includes(i))];
 return {enabled:false,perkEnabled:true,buy:order.map(id=>({id,enabled:true,limit:Math.min(config.upgrades[id].cap,({19:4,30:40,0:20,2:10,11:10,12:10})[id]??config.upgrades[id].cap)})),perks:[0,6,1,3,4,7,2,5,8,9,10,11,12,13,14].map(id=>({id,enabled:true}))};
}
export function validateAutomation(v,config,perks){
 const fallback=defaultAutomation(config,perks),valid=(rules,count)=>Array.isArray(rules)&&rules.length===count&&new Set(rules.map(r=>r?.id)).size===count&&rules.every(r=>Number.isInteger(r.id)&&r.id>=0&&r.id<count&&typeof r.enabled==='boolean');
 if(!v||typeof v.enabled!=='boolean'||typeof v.perkEnabled!=='boolean'||!valid(v.buy,config.upgrades.length)||!valid(v.perks,perks.length)||v.buy.some(r=>!Number.isInteger(r.limit)||r.limit<0||r.limit>config.upgrades[r.id].cap))return fallback;
 return {enabled:v.enabled,perkEnabled:v.perkEnabled,buy:v.buy.map(({id,enabled,limit})=>({id,enabled,limit})),perks:v.perks.map(({id,enabled})=>({id,enabled}))};
}
export function priorityPurchase(s,prefs){return prefs.buy.find(r=>r.enabled&&s.levels[r.id]<r.limit&&s.costs[r.id]<=s.coins)?.id??-1;}
export function priorityPerk(s,prefs){return prefs.perks.find(r=>r.enabled&&s.perks.offers.includes(r.id))?.id;}
export function holdInterval(milliseconds){return Math.max(55,300*Math.exp(-Math.max(0,milliseconds)/1200));}
/** Real time countdown, halted while an intervening dialog is open. */
export class RoundCountdown {
 constructor(){this.reset();}
 reset(){this.wave=-1;this.remaining=5;}
 tick(wave,seconds,eligible){if(this.wave!==wave){this.wave=wave;this.remaining=5;}if(eligible)this.remaining=Math.max(0,this.remaining-Math.max(0,seconds));return this.remaining;}
}

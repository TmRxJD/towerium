import {baselineAction,baselinePurchase,baselinePowerPurchase,targets} from './playtest-policy.mjs';
export const auditBuilds={
 glass:{strategy:'offense',focus:[0,2,3,4,5,6,8,30,31,32],omit:[11,12,13,27,28],perks:[0,10,3,5,6,4,7]},
 health:{strategy:'defense',focus:[11,24,27,28,13],omit:[12,4,5],perks:[1,11,4,7,8,2,6]},
 regen:{strategy:'defense',focus:[11,12,13,24,27],omit:[4,5,33],perks:[2,1,11,7,4,8,6]},
 hybrid:{strategy:'balanced',focus:[0,2,6,11,12,19,30,31,32],omit:[],perks:[0,1,3,6,4,7,2]},
 devo:{strategy:'economy',focus:[19,9,10,11,12,14,15,21],omit:[4,5],perks:[6,12,9,1,2,7,4]},
};
auditBuilds.economy=auditBuilds.devo;
export const auditProfiles={
 casual:{reactionMs:350,aimSpeed:1600,switchMs:250,manualShare:1,target:[100,150]},
 skilled:{reactionMs:180,aimSpeed:2400,switchMs:160,manualShare:1,target:[400,600]},
 auto:{reactionMs:350,aimSpeed:1600,switchMs:250,manualShare:0,target:[100,150]},
 quarterEffort:{reactionMs:350,aimSpeed:1600,switchMs:250,manualShare:.25,target:[100,150]},
 mixedEffort:{reactionMs:180,aimSpeed:2400,switchMs:160,manualShare:.65,target:[400,600]},
 pro:{reactionMs:100,aimSpeed:3600,switchMs:100,manualShare:1,target:[700,800]},
 best:{reactionMs:80,aimSpeed:5000,switchMs:80,manualShare:1,target:[850,950]},
 perfect:{reactionMs:0,aimSpeed:10000,switchMs:0,manualShare:1,reference:true,target:[950,1050]},
};
export function auditPerk(s,build){const order=auditBuilds[build].perks;return [...s.perks.offers].sort((a,b)=>(order.indexOf(a)<0?99:order.indexOf(a))-(order.indexOf(b)<0?99:order.indexOf(b))||a-b)[0];}
export function auditPurchase(s,c,build,assisted=true){
 const b=auditBuilds[build];
 if(assisted&&s.levels[30]<40&&s.costs[30]<=s.coins)return 30;
 const config={...c,upgrades:c.upgrades.map((u,i)=>({...u,cap:b.omit.includes(i)?s.levels[i]:u.cap}))};
 const weighted={...s,costs:s.costs.map((cost,i)=>cost/(b.focus.includes(i)?3:1))};
 // Do not let weighted ordering create an unaffordable choice.
 weighted.costs=weighted.costs.map((cost,i)=>s.costs[i]>s.coins?Math.max(s.coins+1,cost):cost);
 const candidates=[];
 if(assisted){
   const goal=Math.min(80,Math.max(40,Math.floor(s.wave*.8)));
   for(const [i,benefit] of [[30,.04/Math.max(.1,s.values[30])],[31,.06],[32,s.levels[32]===0?.3:s.levels[32]===1?.12:.04]]){
     if(s.levels[i]<c.upgrades[i].cap&&s.costs[i]<=s.coins&&(i!==30||s.levels[i]<goal))candidates.push({i,score:benefit/s.costs[i]});
   }
 }
 const normal=baselinePurchase(weighted,config,b.strategy,-1,assisted);
 if(normal>=0&&s.costs[normal]<=s.coins){const focus=b.focus.includes(normal)?3:1;candidates.push({i:normal,score:.03*focus/Math.max(1,s.costs[normal])});}
 if(s.wave<15&&s.levels[19]<Math.min(build==='devo'?12:4,s.wave+1)&&s.costs[19]<=s.coins&&s.hp>s.max_hp*.65)return 19;
 return candidates.sort((a,b)=>b.score-a.score||a.i-b.i)[0]?.i??-1;
}
export function auditPowerPurchase(s,c,build){return baselinePowerPurchase(s,c,auditBuilds[build].strategy);}
const inBH=(s,t)=>s.powers[3]>0&&(s.blackholes??[]).some(p=>Math.hypot(p[0]-t.x,p[1]-t.y)<s.power_effects[3]);
const inSL=(s,t,c)=>s.powers[4]>0&&(s.spotlights??[]).some(a=>Math.abs(Math.atan2(Math.sin(a-Math.atan2(t.y,t.x)),Math.cos(a-Math.atan2(t.y,t.x))))<c.powers.spotlight_angle*Math.PI/360);
export function economyHold(s,c,t){
 if(t.drop!==undefined||![0,1,2].includes(t.kind)||t.danger<4||s.hp<s.max_hp*.6)return false;
 const overlap=inBH(s,t)&&s.powers[6]>0&&(inSL(s,t,c)||(s.bots??[]).some(b=>b[0]===18&&Math.hypot(t.x-b[1],t.y-b[2])<b[3]));
 return !overlap&&(s.powers[3]>0||s.drops.some(d=>[3,6,15,16,18].includes(d[1])&&d[4]>2));
}
export function auditAction(s,c,build,context={},mode='crowd'){
 let candidates=targets(s,c,mode);
 if(build==='devo'){
   const waiting=s.enemies.filter(e=>e[4]>0&&(s.blackholes??[]).some(p=>Math.hypot(p[0]-e[2],p[1]-e[3])<s.power_effects[3])).length;
   candidates=candidates.filter(t=>!economyHold(s,c,t)&&!(t.drop===16&&waiting<4&&t.life>3));
   // Valuable tanks wait for overlap; clear cheap basics when no safety warning exists.
   candidates.sort((a,b)=>Number(b.drop!==undefined)-Number(a.drop!==undefined)||Number(a.kind===2)-Number(b.kind===2)||a.danger-b.danger||a.id-b.id);
 }
 return baselineAction(s,c,candidates,mode,2,context);
}

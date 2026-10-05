import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {defaultAutomation,validateAutomation,priorityPurchase,priorityPerk,holdInterval,RoundCountdown} from '../scripts/automation.mjs';
import {auditBuilds,auditPurchase,economyHold} from '../scripts/balance-audit-policy.mjs';
const c=JSON.parse(readFileSync(new URL('../engine/balance.json',import.meta.url))),perks=Array(15).fill({});
test('buy priority skips unaffordable or disabled entries and respects specialization limits',()=>{
 const p=defaultAutomation(c,perks);p.buy=p.buy.map(r=>({...r,enabled:false}));p.buy[0]={id:19,enabled:true,limit:2};p.buy[1]={id:30,enabled:true,limit:40};
 const s={levels:Array(35).fill(0),costs:Array(35).fill(10),coins:5};assert.equal(priorityPurchase(s,p),-1);
 s.coins=20;assert.equal(priorityPurchase(s,p),19);s.levels[19]=2;assert.equal(priorityPurchase(s,p),30);
 assert.deepEqual(validateAutomation(p,c,perks),p);p.buy[1].limit=101;assert.equal(validateAutomation(p,c,perks).enabled,false);
});
test('ranked perks never choose a disabled or unoffered perk',()=>{const p=defaultAutomation(c,perks),s={perks:{offers:[3,6,1]}};assert.equal(priorityPerk(s,p),6);p.perks.forEach(r=>r.enabled=false);assert.equal(priorityPerk(s,p),undefined);});
test('countdown allows five full seconds, suspends during dialogs, resets per wave',()=>{
 const clock=new RoundCountdown();assert.equal(clock.tick(5,2,true),3);assert.equal(clock.tick(5,20,false),3);assert.equal(clock.tick(5,2.9,true),.10000000000000009);assert.equal(clock.tick(5,.1,true)>0,true);assert.equal(clock.tick(5,.01,true),0);assert.equal(clock.tick(6,0,true),5);clock.reset();assert.equal(clock.remaining,5);
});
test('hold purchase accelerates with a bounded interval',()=>{assert.equal(holdInterval(0),300);assert(holdInterval(1000)<holdInterval(500));assert.equal(holdInterval(10000),55);});
test('economy delay has safety and overlap requirements, never delays attackers',()=>{
 const s={hp:100,max_hp:100,powers:[0,0,0,30,30,0,30],power_effects:c.power_workshop.upgrades.map(u=>u.effect_base),blackholes:[[200,0]],spotlights:[0],bots:[],drops:[]};
 const t={kind:2,x:200,y:0,danger:10};assert.equal(economyHold(s,c,t),false);s.powers[6]=0;assert.equal(economyHold(s,c,t),true);assert.equal(economyHold(s,c,{...t,danger:1}),false);assert.equal(economyHold(s,c,{...t,kind:7}),false);s.hp=30;assert.equal(economyHold(s,c,t),false);
});

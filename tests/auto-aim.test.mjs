import test from 'node:test';
import assert from 'node:assert/strict';
import {AutoAimController,manualTargets,manualTargetPlan,aimTarget,defaultAimPreferences,validateAimPreferences} from '../scripts/auto-aim.mjs';
const enemy=(id,kind,x,hp=10)=>[id,kind,x,0,hp,10,0];
const state={range:300,enemies:[enemy(1,0,250),enemy(2,3,290),enemy(3,1,220),enemy(4,12,280)],drops:[]};
test('ranked categories reorder live; danger wins defaults',()=>{
 assert.equal(aimTarget(state,defaultAimPreferences().rules).id,2);
 const rules=[{id:'fast',enabled:true},{id:'closest',enabled:true}];assert.equal(aimTarget(state,rules).id,3);
 assert.equal(aimTarget({...state,enemies:[...state.enemies,enemy(5,0,40)]},defaultAimPreferences().rules).id,5);
});
test('strongest weakest and pickup rules are meaningful',()=>{
 const s={...state,enemies:[enemy(1,0,230,30),enemy(2,2,210,5)]};
 assert.equal(aimTarget(s,[{id:'strongest',enabled:true}]).id,1);assert.equal(aimTarget(s,[{id:'weakest',enabled:true}]).id,2);
 const drops=[[10,0,220,0,15],[11,0,400,0,15]];
 assert.equal(aimTarget({...s,drops},[{id:'pickups',enabled:true}]).id,10);
});
test('cannon can aim beyond range; LSS cannot; dead targets excluded',()=>{
 const s={...state,enemies:[enemy(1,0,400),enemy(2,0,20,0)]};assert.equal(aimTarget(s,[]).id,1);assert.equal(aimTarget(s,[],1),null);
 assert.equal(aimTarget({...s,enemies:[],drops:[]},[]),null);
});
test('preferences enforce full unique rules and booleans',()=>{
 const valid=defaultAimPreferences(true);valid.rules.reverse();assert.deepEqual(validateAimPreferences(valid),valid);
 assert.deepEqual(validateAimPreferences({enabled:true,rules:[{id:'bogus',enabled:true}]},false),defaultAimPreferences(false));
 const duplicate=defaultAimPreferences();duplicate.rules[1]=duplicate.rules[0];assert.deepEqual(validateAimPreferences(duplicate,true),defaultAimPreferences(true));
});

test('shared auto controller obeys travel, delay, unlocks and live targets',()=>{
 const c={bomb_radius:60,weapons:[{damage:1,speed:800}],enemies:Array.from({length:13},()=>({speed:0}))};
 const s={...state,enemies:[enemy(1,0,100)],shots:[],ammo:[0,100,20,2],disabled_weapon:-1,speed_multiplier:1,values:Array(35).fill(0)};
 s.values[30]=.5;s.values[31]=180;s.values[32]=0;
 const controller=new AutoAimController();let a=controller.step(s,c,[],1/60);assert.equal(a.fire,false);assert.equal(a.weapon,0);
 for(let i=0;i<120;i++)a=controller.step(s,c,[],1/60);
 assert.equal(a.fire,true);assert.equal(a.targetId,1);
 s.values[32]=1;a=controller.step(s,c,[],1/60);assert.equal(a.weapon,1);
 s.enemies=[enemy(2,12,100,100)];s.values[32]=3;a=controller.step(s,c,[],1/60);assert.equal(a.weapon,3);assert.equal(a.fire,false);
 s.shots=[[9,3]];a=controller.step(s,c,[],1/60);assert.equal(a.weapon,2);
 s.enemies=[];assert.equal(controller.step(s,c,[],1/60).fire,false);
 controller.reset();assert.equal(controller.targetId,-1);
});

test('approaching enemies take priority over ranged attackers before reaching the wall',()=>{
 const c={tower_radius:41,enemies:Array.from({length:13},()=>({speed:34,radius:17}))};
 const s={...state,range:360,speed_multiplier:2,enemies:[enemy(1,3,360),enemy(2,0,170),enemy(3,0,180),enemy(4,0,190)]};
 assert.equal(aimTarget(s,defaultAimPreferences().rules,0,c).id,2);
 const safe={...s,enemies:[s.enemies[0],enemy(2,0,300),enemy(3,0,310),enemy(4,0,320)]};
 assert.equal(aimTarget(safe,defaultAimPreferences().rules,0,c).id,1);
 assert.equal(aimTarget(s,[{id:'ranged',enabled:true},{id:'danger',enabled:true}],0,c).id,1);
});

test('manual target selection reserves the automatic focus without losing lone targets',()=>{
 const candidates=[{id:1,kind:3},{id:2,kind:0},{id:3,drop:5}];
 assert.deepEqual(manualTargets(candidates,1),candidates.slice(1));
 assert.deepEqual(manualTargets(candidates,3),candidates.slice(0,2));
 assert.deepEqual(candidates.map(t=>t.id),[1,2,3]);
 assert.equal(manualTargets([candidates[0]],1)[0],candidates[0]);
 assert.deepEqual(manualTargets([],1),[]);
});

test('target reservation preserves full crowd observations outside the nominated choices',()=>{
 const s={enemies:[enemy(1,3,200),enemy(2,0,100),enemy(3,0,120),enemy(4,2,180)],drops:[[5,0,100,0,15]]};
 const plan=manualTargetPlan(s,[{id:1},{id:2}],1);
 assert.deepEqual(plan.targets,[{id:2}]);assert.deepEqual(plan.state.enemies.map(e=>e[0]),[2,3,4]);
 assert.deepEqual(plan.state.drops,s.drops);assert.equal(s.enemies.length,4);
 assert.equal(manualTargetPlan(s,[{id:1}],1).state,s);
});

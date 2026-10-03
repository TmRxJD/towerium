import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {targets,combatRequest,shopRequest,shopNominations,decodeChoice,baselineAction,baselineWeapon,baselinePurchase} from '../scripts/playtest-policy.mjs';
const config=JSON.parse(readFileSync(new URL('../engine/balance.json',import.meta.url),'utf8'));
const state={wave:1,hp:100,max_hp:100,coins:50,enemies:[[1,0,100,0,2,2,0],[2,5,200,0,45,45,0],[3,1,500,0,1,1,0]],drops:[[4,8,150,0,8]],range:360,
  ammo:[0,0,18,0],powers:[0,0,0,0,0,0,0],shots:[],charges:0,remaining:10,weapon:0,levels:Array(config.upgrades.length).fill(0),values:config.upgrades.map(u=>u.base),costs:config.upgrades.map(u=>u.costs[0])};
test('observations preserve visible threats and pickups without duplicate targets',()=>{
  const items=targets(state,config);assert.deepEqual(items.map(t=>t.key),['enemy_1','enemy_2','drop_4']);assert.equal(items[0].y,0);
});

test('range-line attackers remain targetable across f32 coordinate rounding',()=>{
  const edge={...state,enemies:[[30,3,state.range+.00003,0,3,3,0],[31,3,state.range+2,0,3,3,0]],drops:[]};
  assert.deepEqual(targets(edge,config).map(t=>t.key),['enemy_30']);
});

test('Scatter children use their smaller collider and faster child speed in threat estimates',()=>{
  const child={...state,enemies:[[77,8,150,0,1,1,0]],enemy_radii:[[77,14]],drops:[]};
  const [target]=targets(child,config);
  assert.equal(target.kind,8);
  assert.equal(target.danger,(150-config.tower_radius-14)/config.enemies[1].speed);
  assert.match(target.text,/Scatter child HP=1/);
});
test('model receives only available weapons and affordable purchases',()=>{
  const req=combatRequest(state,config,targets(state,config),'balanced',.25);
  assert.deepEqual(Object.keys(req.questions.weapon.criteria),['0','2']);assert.equal(req.questions.death_wave,undefined);
  const shop=shopRequest(state,config,'balanced');assert(!('buy_14' in shop.questions.purchase.criteria));assert('buy_0' in shop.questions.purchase.criteria);
});
test('invalid model output fails instead of secretly using a scripted decision',()=>{
  const req=combatRequest(state,config,targets(state,config),'balanced',.25);
  assert.throws(()=>decodeChoice({answers:{weapon:{choice:'1'}}},req,'weapon'),/Invalid Kev choice/);
});

test('priority control shoots a Protector before shielded contacts, and idle control never fires',()=>{
  const warded={...state,enemies:[[1,0,65,0,2,2,0],[2,4,140,0,7,7,0]],drops:[]};
  const candidates=targets(warded,config);
  assert.equal(baselineAction(warded,config,candidates,'nearest').target,'enemy_1');
  assert.equal(baselineAction(warded,config,candidates,'priority').target,'enemy_2');
  assert.equal(baselineAction(warded,config,candidates,'idle').target,'hold');
  assert(candidates.every(t=>t.text.includes('shielded=true')));
});

test('circle control is blind and cannot silently select special weapons or Death Wave',()=>{
  const a=baselineAction({...state,time:0},config,[],'circle',2);
  const b=baselineAction({...state,time:.5},config,targets(state,config),'circle',2);
  assert.equal(a.weapon,0);assert.equal(b.weapon,0);assert.equal(a.deathWave,false);
  assert(Math.abs(a.pointer[0]-state.range*.9)<.001);assert(Math.abs(a.pointer[1])<.001);
  assert(Math.abs(b.pointer[0])<.001);assert(Math.abs(b.pointer[1]-state.range*.9)<.001);
});
test('no-upgrade control saves and dependent baseline upgrades need their prerequisite',()=>{
  assert.equal(baselinePurchase(state,config,'none'),-1);
  const rich={...state,coins:10000};for(let i=0;i<config.upgrades.length;i++)if(![3,5,7,8,15].includes(i))rich.costs=[...rich.costs.slice(0,i),Infinity,...rich.costs.slice(i+1)];
  assert.equal(baselinePurchase(rich,config,'balanced'),-1);
});

test('crowded observations retain each enemy type within the compiled choice limit',()=>{
  const crowded={...state,charges:1,enemies:Array.from({length:36},(_,i)=>[i+10,Math.floor(i/6),80+i*4,0,9,9,0]),
    drops:Array.from({length:12},(_,i)=>[i+100,i%9,150,0,8])};
  const candidates=targets(crowded,config);
  assert.equal(new Set(candidates.filter(t=>t.kind!==undefined).map(t=>t.kind)).size,6);
  const request=combatRequest(crowded,config,candidates,'balanced',.5);
  assert(Object.keys(request.questions.target.criteria).length<=16);
  assert.deepEqual(Object.keys(request.questions.death_wave.criteria),['keep','use']);
});

test('shop nominations cover every upgrade without eliminating the final buy-or-save decision',()=>{
  const request=shopRequest({...state,coins:10000},config,'balanced');
  const nomination=shopNominations(request);
  const groups=Object.values(nomination.questions);
  assert.deepEqual(groups.map(group=>Object.keys(group.criteria).length),[10,10,5]);
  assert(groups.every(group=>!Object.hasOwn(group.criteria,'save')));
  assert.deepEqual(groups.flatMap(group=>Object.keys(group.criteria)),Object.keys(request.questions.purchase.criteria).filter(key=>key!=='save'));
  assert(Object.hasOwn(request.questions.purchase.criteria,'save'));
});

test('sabotaged weapons are excluded from model and scripted choices',()=>{
  const jammed={...state,ammo:[0,100,20,5],disabled_weapon:1,enemies:[[1,4,150,0,7,7,0]],drops:[]};
  const candidates=targets(jammed,config);
  const request=combatRequest(jammed,config,candidates,'balanced',.1);
  assert(!Object.hasOwn(request.questions.weapon.criteria,'1'));
  assert.notEqual(baselineAction(jammed,config,candidates,'priority').weapon,1);
});

test('expanded enemy observations stay within 16 choices and prioritize a charged Ray',()=>{
  const expanded={...state,enemies:Array.from({length:65},(_,i)=>[i+1,i%13,300,0,10,10,0]),
    enemy_effects:[[8,.9,false,false]],drops:Array.from({length:8},(_,i)=>[i+100,i%9,100,0,10])};
  const candidates=targets(expanded,config);
  const request=combatRequest(expanded,config,candidates,'balanced',.1);
  assert(Object.keys(request.questions.target.criteria).length<=16);
  assert.equal(baselineAction(expanded,config,candidates,'priority').target,'enemy_8');
});

test('priority control starts draining the super boss before it reaches the wall',()=>{
  const bossWave={...state,enemies:[[60,12,350,0,600,600,0],[61,0,160,0,2,2,0]],drops:[],ammo:[0,100,40,5]};
  const action=baselineAction(bossWave,config,targets(bossWave,config),'priority');
  assert.equal(action.target,'enemy_60');assert.equal(action.weapon,2);
  const contact={...bossWave,enemies:[bossWave.enemies[0],[61,0,60,0,2,2,0]]};
  assert.equal(baselineAction(contact,config,targets(contact,config),'priority').target,'enemy_61');
});


test('weapon controls never invent ammo and fixed/rotating tests remain explicit',()=>{
  assert.equal(baselineWeapon({...state,ammo:[0,0,0,0]},2,'missile'),0);
  assert.equal(baselineWeapon({...state,ammo:[0,1,1,1],disabled_weapon:-1},0,'missile'),2);
  assert.equal(baselineWeapon({...state,ammo:[0,1,1,1],disabled_weapon:2},0,'missile'),0);
  assert.equal(baselineWeapon({...state,time:12,ammo:[0,1,1,1],disabled_weapon:-1},0,'rotate'),3);
  assert.throws(()=>baselineWeapon(state,0,'unknown'),/Unknown baseline weapon mode/);
});

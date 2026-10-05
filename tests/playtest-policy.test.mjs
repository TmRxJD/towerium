import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {targets,combatRequest,shopRequest,shopNominations,decodeChoice,baselineAction,baselineWeapon,baselinePurchase,baselinePowerPurchase,weaponDamage,predictedDamage,decisionDue} from '../scripts/playtest-policy.mjs';
const config=JSON.parse(readFileSync(new URL('../engine/balance.json',import.meta.url),'utf8'));
const state={wave:1,hp:100,max_hp:100,coins:50,enemies:[[1,0,100,0,2,2,0],[2,5,200,0,45,45,0],[3,1,500,0,1,1,0]],drops:[[4,8,150,0,8]],range:360,
  ammo:[0,0,18,0],powers:[0,0,0,0,0,0,0],module_times:[0,0,0,0],power_effects:config.power_workshop.upgrades.map(u=>u.effect_base),power_levels:Array.from({length:16},()=>[0,0]),power_costs:config.power_workshop.upgrades.map(u=>[u.weight_costs[0],u.effect_costs[0]]),stones:0,shots:[],charges:0,remaining:10,weapon:0,levels:Array(config.upgrades.length).fill(0),values:config.upgrades.map(u=>u.base),costs:config.upgrades.map(u=>u.costs[0])};

test('pressure does not prevent collecting a missing defensive power',()=>{
  const pressured={...state,enemies:[[1,0,50,0,20,20,0],[2,0,0,70,20,20,0],[3,0,-90,0,20,20,0]],drops:[[4,1,120,0,20]]};
  assert.equal(baselineAction(pressured,config,targets(pressured,config),'nearest').target,'drop_4');
  const alreadyActive={...pressured,powers:[0,100,0,0,0,0,0]};
  assert.equal(baselineAction(alreadyActive,config,targets(alreadyActive,config),'nearest').target,'enemy_1');
});

test('safe lit targets receive deliberate Spotlight priority',()=>{
  const s={...state,enemies:[[1,0,140,0,3,3,0],[2,0,0,200,3,3,0]],drops:[],powers:[0,0,0,0,30,0,0],spotlights:[Math.PI/2],ammo:[0,0,0,0]};
  assert.equal(baselineAction(s,config,targets(s,config),'nearest',2,{human:true}).target,'enemy_2');
});
test('DW uses an in-range Super Boss opportunity and never stacks an active pulse',()=>{
  const s={...state,enemies:[[1,12,250,0,360,360,0]],drops:[],charges:1};
  assert.equal(baselineAction(s,config,targets(s,config)).deathWave,true);
  const active={...s,deathwaves:[100]};assert.equal(baselineAction(active,config,targets(active,config)).deathWave,false);
});
test('weapon preferences do not spend bombs collecting powerups',()=>{
  const s={...state,enemies:[],drops:[[1,0,100,0,10]],ammo:[0,100,20,5]};
  const action=baselineAction(s,config,targets(s,config),'nearest',2,{human:true,weaponMode:'hook'});
  assert.equal(action.weapon,0);assert.equal(action.hitDamage,1);
});
test('zoomed range exposes targets beyond the original square',()=>{
  const s={...state,range:600,view_extent:750,enemies:[[1,0,650,0,5,5,0]],drops:[],ammo:[0,0,0,0]};
  const action=baselineAction(s,config,targets(s,config),'nearest',2,{human:true});
  assert(action.pointer[0]>550);
});

test('outside enemies and pickups are targetable with travelling weapons, never LSS',()=>{
  for(const fixture of [
    {enemies:[[8,6,470,0,12,12,0]],drops:[]},
    {enemies:[],drops:[[9,0,470,0,8]]},
  ]){
    const s={...state,...fixture,ammo:[0,200,20,5]};
    const candidates=targets(s,config),action=baselineAction(s,config,candidates,'priority');
    assert.equal(candidates.length,1);assert.equal(action.target,candidates[0].key);
    assert.notEqual(action.weapon,1);assert.equal(action.fire,true);
    assert(action.pointer[0]>state.range);
  }
});

test('late HP bands and upgraded Spotlight Demon and Om Chip use native effective damage',()=>{
  const effects=[...state.power_effects];effects[4]=4.2;effects[11]=2.2;effects[15]=1.3;
  const s={...state,wave:300,power_effects:effects,enemies:[[1,0,120,0,12,32,0]],drops:[]};
  const basic=targets(s,config)[0];
  assert.equal(weaponDamage(s,config,basic,3),32);
  assert(Math.abs(weaponDamage(s,config,basic,1)-32/31)<.00001);
  assert.equal(weaponDamage(s,config,basic,3,{x:470,y:0}),16);
  const bossState={...s,powers:[0,0,0,0,30,0,0],module_times:[0,0,0,30],demon_time:30,spotlights:[0,Math.PI*2/3,Math.PI*4/3],enemies:[[2,12,200,0,390,390,0]]};
  assert(Math.abs(weaponDamage(bossState,config,targets(bossState,config)[0],2)-18*1.5*4.2*1.3*2.2)<.00001);
});

test('Power Stone strategies specialize and never purchase with coins alone',()=>{
  assert.equal(baselinePowerPurchase(state,config,'economy'),undefined);
  const choices=['economy','offense','defense'].map(strategy=>baselinePowerPurchase({...state,stones:100},config,strategy));
  assert(new Set(choices.map(c=>c.power)).size>=2);
  assert(choices.every(c=>state.power_costs[c.power][c.path]<=100));
});

test('damage forecast matches LSS derived full-health damage but respects current target HP, shields and boss falloff',()=>{
  const s={...state,enemies:[[1,0,120,0,.5,2,0],[2,12,400,0,360,360,0]],drops:[]};
  const [basic,boss]=targets(s,config);
  assert.equal(weaponDamage(s,config,basic,1),2);
  assert.equal(weaponDamage(s,config,boss,2),18*1.5*.25);
  assert.equal(weaponDamage({...s,demon_time:20},config,boss,2),18*1.5*.25*2);
  assert.equal(weaponDamage(s,config,boss,1),0);
  const protectedState={...s,enemies:[[3,4,150,0,7,7,0],[4,2,155,0,9,9,0]]};
  const tank=targets(protectedState,config).find(t=>t.id===4);
  assert.equal(weaponDamage(protectedState,config,tank,0),1-config.defense.protector_reduction);
});

test('incoming bullets reserve lethal damage and retarget another enemy before impact',()=>{
  const s={...state,enemies:[[1,0,180,0,1,2,0],[2,0,0,180,2,2,0]],drops:[],shots:[[20,0,100,0,0]],ammo:[0,0,0,0]};
  const candidates=targets(s,config),incoming=predictedDamage(s,config,candidates);
  assert.equal(incoming.get('enemy_1'),1);
  assert.equal(baselineAction(s,config,candidates).target,'enemy_2');
  const alone={...s,enemies:s.enemies.slice(0,1)};
  const waiting=baselineAction(alone,config,targets(alone,config));
  assert.equal(waiting.fire,false);assert.equal(waiting.waitingForImpact,true);
});

test('a projectile credits its first contact only and a pickup blocks damage predictions',()=>{
  const s={...state,enemies:[[1,0,140,0,1,2,0],[2,0,220,0,1,2,0]],drops:[],shots:[[20,0,70,0,0]]};
  const incoming=predictedDamage(s,config,targets(s,config));
  assert.equal(incoming.get('enemy_1'),1);assert.equal(incoming.has('enemy_2'),false);
  const pickup={...s,drops:[[30,0,100,0,10]]};
  const blocked=predictedDamage(pickup,config,targets(pickup,config));
  assert.equal(blocked.has('enemy_1'),false);assert.equal(blocked.get('drop_30'),1);
});

test('moving contacts outside range receive half damage and misses do not reserve kills',()=>{
  const s={...state,enemies:[[1,0,480,0,2,2,0]],drops:[],shots:[[20,0,390,0,0]]};
  assert.equal(predictedDamage(s,config,targets(s,config)).get('enemy_1'),.5);
  const miss={...s,shots:[[20,0,390,0,Math.PI/2]]};
  assert.equal(predictedDamage(miss,config,targets(miss,config)).size,0);
});

test('dense prediction neighborhoods are conservative rather than assuming unbounded kills',()=>{
  const s={...state,enemies:Array.from({length:300},(_,i)=>[i+1,0,180,0,2,2,0]),drops:[],shots:[[20,0,80,0,0]]};
  assert.equal(predictedDamage(s,config,targets(s,config)).size,0);
  assert.equal(baselineAction(s,config,targets(s,config)).fire,true);
});

test('dead targets trigger immediate retarget while live decisions remain within 50ms',()=>{
  const s={...state,time:1.01};
  assert.equal(decisionDue(s,1,'enemy_1',1),false);
  assert.equal(decisionDue({...s,enemies:[]},1,'enemy_1',1),true);
  assert.equal(decisionDue({...s,time:1.06},1,'enemy_1',1),true);
  assert.equal(decisionDue({...s,wave:2},1,'enemy_1',1),true);
});

test('one remaining hit does not spend a missile, and observed lateral movement is led',()=>{
  const s={...state,time:1,enemies:[[1,12,250,0,.5,360,0]],drops:[],ammo:[0,0,20,5]};
  const previous={...s,time:.95,enemies:[[1,12,250,-2,.5,360,0]]};
  const action=baselineAction(s,config,targets(s,config),'priority',2,{previous});
  assert.equal(action.weapon,0);
  assert(action.pointer[1]>0);
  assert(Math.abs(action.pointer[0])<=535&&Math.abs(action.pointer[1])<=535);
});

test('safe openings invest in CPK but low health chooses survival',()=>{
  assert.equal(baselinePurchase(state,config,'balanced'),19);
  assert.equal(baselinePurchase({...state,hp:35},config,'balanced'),11);
  const afterOpening={...state,levels:[...state.levels]};afterOpening.levels[19]=2;
  assert.notEqual(baselinePurchase(afterOpening,config,'balanced'),19);
});

test('later strategy avoids expensive tiny attack-speed gains and useless dependent upgrades',()=>{
  const later={...state,wave:60,coins:10000,levels:[...state.levels],values:[...state.values],costs:[...state.costs]};
  later.levels[0]=50;later.values[0]=2;later.costs[0]=10000;
  const index=baselinePurchase(later,config,'offense');
  assert.notEqual(index,0);assert(![3,5,7,8,15].includes(index));
  const focused={...later,coins:100,costs:Array(25).fill(Infinity)};
  focused.costs[2]=10;focused.costs[11]=6;focused.hp=90;
  assert.equal(baselinePurchase(focused,config,'offense'),2);
  assert.equal(baselinePurchase(focused,config,'defense'),11);
});
test('observations preserve visible threats and pickups without duplicate targets',()=>{
  const items=targets(state,config);assert.deepEqual(new Set(items.map(t=>t.key)),new Set(['enemy_1','enemy_2','enemy_3','drop_4']));assert.equal(items[0].y,0);
});

test('range-line attackers remain targetable across f32 coordinate rounding',()=>{
  const edge={...state,enemies:[[30,3,state.range+.00003,0,3,3,0],[31,3,state.range+2,0,3,3,0]],drops:[]};
  assert.deepEqual(targets(edge,config).map(t=>t.key),['enemy_30','enemy_31']);
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
  const rich={...state,coins:10000,values:[...state.values]};for(const i of [2,4,6,14])rich.values[i]=0;for(let i=0;i<config.upgrades.length;i++)if(![3,5,7,8,15].includes(i))rich.costs=[...rich.costs.slice(0,i),Infinity,...rich.costs.slice(i+1)];
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
  assert.deepEqual(groups.map(group=>Object.keys(group.criteria).length),[10,10,10]);
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

test('priority control spends boss ammunition while still clearing immediate contacts',()=>{
  const bossWave={...state,enemies:[[60,12,350,0,600,600,0],[61,0,160,0,2,2,0]],drops:[],ammo:[0,100,40,5]};
  const action=baselineAction(bossWave,config,targets(bossWave,config),'priority');
  assert.equal(action.target,'enemy_60');
  const distant={...bossWave,enemies:[[60,12,state.range+100,0,600,600,0]]};
  const distantAction=baselineAction(distant,config,targets(distant,config),'priority');
  assert.equal(distantAction.target,'enemy_60');assert.equal(distantAction.weapon,0);
  const inRange={...distant,enemies:[[60,12,state.range-10,0,600,600,0]]};
  assert.equal(baselineAction(inRange,config,targets(inRange,config),'priority').weapon,3);
  assert.equal(baselineAction({...inRange,ammo:[0,100,40,0]},config,targets(inRange,config),'priority').weapon,2);
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

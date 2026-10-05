import {test} from 'node:test';
import assert from 'node:assert/strict';
import {HumanController} from '../scripts/human-controls.mjs';
test('aim speed is bounded and deaths cannot trigger a hidden immediate observation',()=>{
  const controller=new HumanController({reactionMs:400,aimSpeed:550,switchMs:300,initialAim:[0,0]});
  let calls=0;const decide=()=>{calls++;return {pointer:[400,0],weapon:0,fire:true};};
  let prior=[0,0];
  for(let i=0;i<20;i++){
    const action=controller.step({enemies:[],deathwaves:[]},1/60,decide);
    assert(Math.hypot(action.aim[0]-prior[0],action.aim[1]-prior[1])<=550/60+1e-6);
    assert.equal(action.fire,false);prior=action.aim;
  }
  assert.equal(calls,1);
});
test('premium shots wait for movement and switching; active Death Wave is not wasted',()=>{
  const controller=new HumanController({reactionMs:250,aimSpeed:900,switchMs:200,initialAim:[0,0]});
  const decide=()=>({pointer:[0,0],weapon:3,fire:true,deathWave:true});
  for(let i=0;i<11;i++){const action=controller.step({deathwaves:[10]},1/60,decide);assert.equal(action.fire,false);assert.equal(action.deathWave,false);}
  let bursts=0,pulses=0,previousFire=false,frames=0,spent=0;
  for(let i=0;i<180;i++){const action=controller.step({deathwaves:[],weapon_report:[{},{},{},{ammo_spent:spent}]},1/60,decide);if(action.fire&&!previousFire)bursts++;frames+=+action.fire;previousFire=action.fire;pulses+=+action.deathWave;if(action.fire)spent++;}
  assert.equal(bursts,3);assert.equal(frames,3);assert.equal(pulses,1);
});
test('premium firing holds through cooldown without snapping to a nearby pickup',()=>{
  const controller=new HumanController({reactionMs:250,switchMs:0,initialAim:[300,0],assistPixels:14});
  const state={range:360,view_extent:650,enemies:[[1,12,300,0,300,300,0]],drops:[[1,0,310,0,20]],weapon_report:[{},{},{},{ammo_spent:0}]};
  const decide=()=>({pointer:[300,0],weapon:3,fire:true});
  for(let i=0;i<30;i++){const action=controller.step(state,1/60,decide);assert.equal(action.fire,true);assert.deepEqual(action.aim,[300,0]);}
  state.weapon_report[3].ammo_spent=1;
  assert.equal(controller.step(state,1/60,decide).fire,false);
});
test('invalid reaction and aim speed are rejected',()=>{
  assert.throws(()=>new HumanController({reactionMs:NaN}),/Invalid/);
  assert.throws(()=>new HumanController({aimSpeed:0}),/Invalid/);
});
test('zero reaction preserves human observations unless reference is explicitly selected',()=>{
  for(const reference of [false,true]){
    let observed;
    const controller=new HumanController({reactionMs:0,reference});
    controller.step({enemies:[]},1/60,(_state,context)=>{observed=context.human;return {fire:false};});
    assert.equal(observed,!reference);
  }
});
test('moving circle controls can fire without catching their moving aim point',()=>{
  const controller=new HumanController({aimSpeed:50,initialAim:[0,0]});
  const action=controller.step({enemies:[]},1/60,()=>({target:'circle',pointer:[300,0],weapon:0,fire:true,sweep:true}));
  assert.equal(action.fire,true);
});


test('automatic launches do not reserve manual target damage or end manual premium bursts',()=>{
  const controller=new HumanController({reactionMs:0,switchMs:0,initialAim:[0,0]});
  let pending;
  const state={enemies:[[1,0,0,0,100,100,0]],shots:[],deathwaves:[],manual_shots_fired:0,overall_report:{shots_fired:100},manual_ammo_spent:[0,0,0,0],weapon_report:[{},{},{},{ammo_spent:0}]};
  const decide=(_s,context)=>{pending=context.pendingDamage;return {target:'enemy_1',pointer:[0,0],weapon:0,fire:true,hitDamage:2,flightSeconds:1};};
  controller.step(state,1/60,decide);
  state.overall_report.shots_fired=101;controller.step(state,1/60,decide);
  assert.equal(pending.size,0);
  state.manual_shots_fired=1;controller.step(state,1/60,decide);
  assert.equal(pending.get('enemy_1'),2);
  const premium=new HumanController({reactionMs:0,switchMs:0,initialAim:[0,0]});
  const bomb=()=>({pointer:[0,0],weapon:3,fire:true});
  assert.equal(premium.step(state,1/60,bomb).fire,true);
  state.weapon_report[3].ammo_spent=1;
  assert.equal(premium.step(state,1/60,bomb).fire,true);
  state.manual_ammo_spent[3]=1;
  assert.equal(premium.step(state,1/60,bomb).fire,false);
});


test('boss bursts respect native premium cadence without waiting an artificial extra second',()=>{
 const controller=new HumanController({reactionMs:0,switchMs:0,initialAim:[0,0]});
 const state={enemies:[],deathwaves:[],manual_shots_fired:0,manual_ammo_spent:[0,0,0,0],weapon_report:[{},{},{},{ammo_spent:0}]};
 let launches=0,nextLaunch=0;
 for(let frame=0;frame<180;frame++){
  const action=controller.step(state,1/60,()=>({pointer:[0,0],weapon:3,fire:true,premiumInterval:.5}));
  if(action.fire&&frame/60>=nextLaunch){launches++;state.manual_ammo_spent[3]++;state.weapon_report[3].ammo_spent++;nextLaunch=frame/60+.5;}
 }
 assert.equal(launches,6);
});

test('fast observations cannot repeatedly cancel a weapon switch before its first launch',()=>{
 const controller=new HumanController({reactionMs:100,switchMs:100,initialAim:[0,0]});
 const state={enemies:[[1,0,0,0,100,100,0]],ammo:[0,100,100,5],manual_shots_fired:0,deathwaves:[]};
 let calls=0,launches=0;
 const decide=()=>({target:'enemy_1',pointer:[0,0],weapon:++calls%2,fire:true});
 for(let i=0;i<120;i++){
  const action=controller.step(state,1/60,decide);
  if(action.fire){launches++;state.manual_shots_fired++;}
 }
 assert(launches>10);
});
test('urgent targets and unavailable ammo can interrupt a latched switch',()=>{
 for(const urgent of [false,true]){
  const controller=new HumanController({reactionMs:0,switchMs:300,initialAim:[0,0]});
  const state={enemies:[[1,0,0,0,100,100,0]],ammo:[0,100,100,5],manual_shots_fired:0,deathwaves:[]};
  controller.step(state,1/60,()=>({target:'enemy_1',pointer:[0,0],weapon:1,fire:true}));
  if(!urgent)state.ammo[1]=0;
  controller.step(state,1/60,()=>({target:'enemy_1',pointer:[0,0],weapon:0,fire:true,urgent}));
  assert.equal(controller.requestedWeapon,0);
 }
});

test('dead targets and disabled manual intervals release committed weapon switches',()=>{
 const controller=new HumanController({reactionMs:0,switchMs:300,initialAim:[0,0]});
 const state={phase:1,enemies:[[1,0,0,0,100,100,0]],ammo:[0,100,100,5],manual_shots_fired:0,deathwaves:[]};
 const premium=()=>({target:'enemy_1',pointer:[0,0],weapon:1,fire:true});
 controller.step(state,1/60,premium);state.enemies=[];
 controller.step(state,1/60,()=>({target:'enemy_2',pointer:[0,0],weapon:0,fire:true}));
 assert.equal(controller.requestedWeapon,0);
 controller.step(state,1/60,premium);
 const stopped=controller.step(state,1/60,premium,false);
 assert.equal(stopped.fire,false);assert.equal(controller.switchAwaitShot,false);
});

test('switching to hold never waits for an impossible launch and combat can resume',()=>{
 const controller=new HumanController({reactionMs:100,switchMs:100,initialAim:[0,0]});
 const state={enemies:[[1,0,0,0,100,100,0]],ammo:[0,100,100,5],manual_shots_fired:0,deathwaves:[]};
 const step=decide=>controller.step(state,1/60,decide);
 for(let i=0;i<20;i++){const a=step(()=>({target:'enemy_1',pointer:[0,0],weapon:1,fire:true}));if(a.fire)state.manual_shots_fired++;}
 for(let i=0;i<10;i++)step(()=>({target:'hold',weapon:0,fire:false}));
 assert.equal(controller.switchAwaitShot,false);
 let resumed=0;
 for(let i=0;i<30;i++){const a=step(()=>({target:'enemy_1',pointer:[0,0],weapon:1,fire:true}));if(a.fire){state.manual_shots_fired++;resumed++;}}
 assert(resumed>0);
});

test('transfers keep firing across observed enemies but stop through empty sectors',()=>{
 for(const occupied of [true,false]){
  const controller=new HumanController({reactionMs:300,aimSpeed:50,initialAim:[200,0]});
  const action=controller.step({enemies:[]},1/60,()=>({target:'enemy_2',pointer:[0,200],weapon:0,fire:true,transitTargets:occupied?[[200,0,25]]:[],transitFanAngles:[0]}));
  assert.equal(action.fire,occupied);
 }
});
test('opposite transfers stay bounded and arrive without forced detours',()=>{
 const controller=new HumanController({reactionMs:300,aimSpeed:600,initialAim:[200,0]});
 let previous=[200,0],action;
 for(let frame=0;frame<40;frame++){
  action=controller.step({enemies:[]},1/60,()=>({target:'enemy_2',pointer:[-200,0],weapon:0,fire:true,transitTargets:[[0,200,20]],transitFanAngles:[0]}));
  assert(Math.hypot(action.aim[0]-previous[0],action.aim[1]-previous[1])<=10+1e-6);
  assert.equal(action.aim[1],0);previous=action.aim;
 }
 assert.deepEqual(action.aim,[-200,0]);assert.equal(action.fire,true);
});
test('transit shots are not reserved as damage against the destination',()=>{
 const controller=new HumanController({reactionMs:0,aimSpeed:50,initialAim:[200,0]});
 const state={enemies:[[2,0,0,200,100,100,0]],manual_shots_fired:0};let pending;
 const decide=(_s,context)=>{pending=context.pendingDamage;return {target:'enemy_2',pointer:[0,200],weapon:0,fire:true,hitDamage:4,flightSeconds:1,transitTargets:[[200,0,25]],transitFanAngles:[0]};};
 assert.equal(controller.step(state,1/60,decide).fire,true);
 state.manual_shots_fired=1;controller.step(state,1/60,decide);
 assert.equal(pending.size,0);
});
test('premium weapons cannot shoot while crossing occupied sectors',()=>{
 const controller=new HumanController({reactionMs:0,switchMs:0,aimSpeed:50,initialAim:[200,0]});
 const a=controller.step({enemies:[],ammo:[0,100,20,5]},1/60,()=>({target:'enemy_2',pointer:[0,200],weapon:2,fire:true,transitTargets:[[200,0,25]],transitFanAngles:[0]}));
 assert.equal(a.fire,false);
});

test('Multishot coverage contributes to route clearing without inventing main-line hits',()=>{
 for(const fan of [false,true]){
  const controller=new HumanController({reactionMs:300,aimSpeed:50,initialAim:[200,0]});
  const action=controller.step({enemies:[]},1/60,()=>({target:'enemy_2',pointer:[0,200],weapon:0,fire:true,transitTargets:[[200*Math.cos(.14),200*Math.sin(.14),4]],transitChance:1,transitFanAngles:fan?[0,.14]:[0]}));
  assert.equal(action.fire,fan);
 }
});


test('batched snapshots cannot credit a delayed transit launch to the destination',()=>{
 const controller=new HumanController({reactionMs:0,aimSpeed:10000,initialAim:[200,0]});
 const state={time:1,enemies:[[2,0,0,200,100,100,0]],manual_shots_fired:0};let pending;
 const crossing=()=>({target:'enemy_2',pointer:[0,200],weapon:0,fire:true,hitDamage:4,flightSeconds:1,transitTargets:[[200,0,200]],transitFanAngles:[0]});
 controller.step(state,1/60,crossing);
 controller.aim=[0,200];
 const settled=(_s,context)=>{pending=context.pendingDamage;return {target:'enemy_2',pointer:[0,200],weapon:0,fire:true,hitDamage:4,flightSeconds:1};};
 controller.step(state,1/60,settled); // Still before the previous launch appears in a snapshot.
 state.time=1.05;state.manual_shots_fired=1;
 controller.step(state,1/60,settled);assert.equal(pending.size,0);
 state.time=1.1;state.manual_shots_fired=2;
 controller.step(state,1/60,settled);assert.equal(pending.get('enemy_2'),4);
});
test('side-only routes require expected Multishot coverage instead of assuming a proc',()=>{
 for(const count of [1,5]){
  const controller=new HumanController({reactionMs:300,aimSpeed:50,initialAim:[200,0]});
  const side=Array.from({length:count},(_,i)=>[(180+i*4)*Math.cos(.14),(180+i*4)*Math.sin(.14),2]);
  const action=controller.step({time:0,enemies:[]},1/60,()=>({target:'enemy_2',pointer:[0,200],weapon:0,fire:true,transitTargets:side,transitFanAngles:[0,.14],transitChance:.2}));
  assert.equal(action.fire,false);
 }
});

test('distinct occupied Multishot rays can justify a side-only sweep',()=>{
 for(const chance of [.2,.5]){
  const controller=new HumanController({reactionMs:300,aimSpeed:50,initialAim:[200,0]});
  const sides=[-.14,.14].map(angle=>[200*Math.cos(angle),200*Math.sin(angle),2]);
  const action=controller.step({time:0,enemies:[]},1/60,()=>({target:'enemy_2',pointer:[0,200],weapon:0,fire:true,transitTargets:sides,transitFanAngles:[0,-.14,.14],transitChance:chance}));
  assert.equal(action.fire,chance===.5);
 }
});

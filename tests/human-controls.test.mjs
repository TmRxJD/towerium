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
  const action=controller.step({enemies:[]},1/60,()=>({pointer:[300,0],weapon:0,fire:true,sweep:true}));
  assert.equal(action.fire,true);
});

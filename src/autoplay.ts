import balance from '../engine/balance.json';
import { targets, baselineAction, baselinePurchase, baselinePowerPurchase, baselineWeapon, decisionDue } from '../scripts/playtest-policy.mjs';
import type { Snapshot } from './types';
export type AutoAction = {kind:'combat';aim:[number,number];weapon:number;deathWave:boolean;fire:boolean} | {kind:'buy';index:number} | {kind:'buy-power';power:number;path:number} | {kind:'next'};
/** Pure spectator decisions; persistence and mode ownership remain in the UI. */
export class AutoPlayer {
  constructor(readonly strategy='balanced',readonly aim='nearest',readonly weapons='all'){}
  private lastDecision=-1;
  private shopTime=0;
  private lastPurchase=0;
  private readyTime=0;
  private lastTarget='';
  private lastWave=-1;
  private previous?:Snapshot;
  update(state:Snapshot, dt:number):AutoAction|undefined {
    if(state.paused || state.phase===3)return;
    if(state.phase===1){
      this.shopTime=0;this.lastPurchase=0;this.readyTime=0;
      if(!decisionDue(state,this.lastDecision,this.lastTarget,this.lastWave))return;
      this.lastDecision=state.time;
      this.lastWave=state.wave;
      const candidates=targets(state,balance),action=baselineAction(state,balance,candidates,this.aim,2,{previous:this.previous});
      this.previous=state;this.lastTarget=action.target;
      const target=candidates.find(item=>item.key===action.target);
      return {kind:'combat',aim:action.pointer??(target?[target.x,target.y]:[0,-state.range]),weapon:baselineWeapon(state,action.weapon,this.weapons),deathWave:action.deathWave,fire:action.fire??(!!target||!!action.pointer)};
    }
    if(state.phase!==2)return;
    this.shopTime+=dt;
    if(this.shopTime<2 || this.shopTime-this.lastPurchase<.5)return;
    const index=baselinePurchase(state,balance,this.strategy);
    if(index>=0){this.lastPurchase=this.shopTime;this.readyTime=0;return {kind:'buy',index};}
    const power=baselinePowerPurchase(state,balance,this.strategy);
    if(power){this.lastPurchase=this.shopTime;this.readyTime=0;return {kind:'buy-power',...power};}
    if(!this.readyTime)this.readyTime=this.shopTime;
    if(this.shopTime-this.readyTime>=2)return {kind:'next'};
  }
}

import balance from '../engine/balance.json';
import { targets, baselineAction, baselinePurchase, baselinePowerPurchase } from '../scripts/playtest-policy.mjs';
import { HumanController, type HumanOptions } from '../scripts/human-controls.mjs';
import type { Snapshot } from './types';
export type AutoAction = {kind:'combat';aim:[number,number];weapon:number;deathWave:boolean;fire:boolean} | {kind:'buy';index:number} | {kind:'buy-power';power:number;path:number} | {kind:'next'};
/** Pure spectator decisions; persistence and mode ownership remain in the UI. */
export class AutoPlayer {
  private controller:HumanController;
  constructor(readonly strategy='balanced',readonly aim='nearest',readonly weapons='all',readonly options:HumanOptions={}){this.controller=new HumanController(options);}
  private shopTime=0;
  private lastPurchase=0;
  private readyTime=0;
  update(state:Snapshot, dt:number):AutoAction|undefined {
    if(state.paused || state.phase===3)return;
    if(state.phase===1){
      this.shopTime=0;this.lastPurchase=0;this.readyTime=0;
      return {kind:'combat',...this.controller.step(state,dt,(observed,context)=>{
        return baselineAction(observed,balance,targets(observed,balance),this.aim,2,{...context,weaponMode:this.weapons});
      })};
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

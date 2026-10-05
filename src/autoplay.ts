import balance from '../engine/balance.json';
import { targets, baselineAction, baselinePurchase, baselinePowerPurchase, baselineSupplyPurchase } from '../scripts/playtest-policy.mjs';
import { HumanController, type HumanOptions } from '../scripts/human-controls.mjs';
import type { Snapshot } from './types';
type PurchaseAction = {kind:'buy';index:number} | {kind:'buy-power';power:number;path:number} | {kind:'buy-supply';item:number};
export type AutoAction = {kind:'combat';aim:[number,number];weapon:number;deathWave:boolean;fire:boolean} | PurchaseAction | {kind:'next'};
/** Pure spectator decisions; persistence and mode ownership remain in the UI. */
export class AutoPlayer {
  private controller:HumanController;
  constructor(readonly strategy='balanced',readonly aim='crowd',readonly weapons='all',readonly options:HumanOptions={}){this.controller=new HumanController(options);}
  private shopTime=0;
  private lastPurchase=0;
  private readyTime=0;
  purchase(state:Snapshot):PurchaseAction|undefined {
    if(state.paused || state.phase!==2)return;
    const index=baselinePurchase(state,balance,this.strategy);
    if(index>=0)return {kind:'buy',index};
    const power=baselinePowerPurchase(state,balance,this.strategy);
    if(power)return {kind:'buy-power',...power};
    const item=baselineSupplyPurchase(state,balance);
    if(item!==undefined)return {kind:'buy-supply',item};
  }
  update(state:Snapshot, dt:number):AutoAction|undefined {
    if(state.paused || state.phase===3)return;
    if(state.phase===1){
      this.shopTime=0;this.lastPurchase=0;this.readyTime=0;
      return {kind:'combat',...this.controller.step(state,dt,(observed,context)=>{
        return baselineAction(observed,balance,targets(observed,balance,this.aim),this.aim,2,{...context,weaponMode:this.weapons});
      })};
    }
    if(state.phase!==2)return;
    this.shopTime+=dt;
    if(this.shopTime<2 || this.shopTime-this.lastPurchase<.5)return;
    const purchase=this.purchase(state);
    if(purchase){this.lastPurchase=this.shopTime;this.readyTime=0;return purchase;}
    if(!this.readyTime)this.readyTime=this.shopTime;
    if(this.shopTime-this.readyTime>=2)return {kind:'next'};
  }
}

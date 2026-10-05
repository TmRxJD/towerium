import {assistAim} from './aim-assist.mjs';
export const humanDefaults=Object.freeze({mouse:Object.freeze({reactionMs:180,aimSpeed:2400,switchMs:160}),touch:Object.freeze({reactionMs:240,aimSpeed:1800,switchMs:200})});
/** Observations are discrete; movement between them uses only the remembered aim point. */
export class HumanController {
  constructor({reactionMs=humanDefaults.mouse.reactionMs,aimSpeed=humanDefaults.mouse.aimSpeed,switchMs=humanDefaults.mouse.switchMs,initialAim=[0,-220],reference=false,assistPixels=0,arenaWidth=320}={}) {
    if(typeof reference!=='boolean'||!Number.isFinite(reactionMs)||reactionMs<0||reactionMs>2000||!Number.isFinite(aimSpeed)||aimSpeed<50||aimSpeed>10000||!Number.isFinite(switchMs)||switchMs<0||switchMs>2000)throw new Error('Invalid Auto Play timing settings');
    this.reaction=reference?0:reactionMs/1000;this.speed=aimSpeed;this.switchDelay=switchMs/1000;
    this.reference=reference;
    if(!Number.isFinite(assistPixels)||assistPixels<0||assistPixels>24||!Number.isFinite(arenaWidth)||arenaWidth<100||arenaWidth>3000)throw new Error('Invalid aim assist settings');
    this.assistPixels=assistPixels;this.arenaWidth=arenaWidth;this.premiumUntil=0;this.premiumWeapon=0;this.premiumSpent=0;
    this.aim=[...initialAim];this.goal=[...initialAim];this.clock=0;this.nextObserve=0;
    this.weapon=0;this.requestedWeapon=0;this.switchUntil=0;this.lastDeathWave=-Infinity;this.lastPremium=-Infinity;this.previous=undefined;this.action={fire:false};
    this.pending=new Map();this.observedShots=0;this.observedHP=new Map();
  }
  step(state,dt,decide) {
    this.clock+=Math.max(0,Math.min(dt,.1));
    let deathWave=false;
    if(this.clock+1e-8>=this.nextObserve){
      const hp=new Map((state.enemies??[]).map(e=>['enemy_'+e[0],e[4]]));
      const shots=state.overall_report?.shots_fired??0,delta=Math.max(0,shots-this.observedShots);
      if(delta&&!this.action.sweep&&this.action.weapon!==1&&this.action.target?.startsWith('enemy_')){
        const prior=this.pending.get(this.action.target);
        this.pending.set(this.action.target,{damage:(prior?.damage??0)+delta*(this.action.hitDamage??0),expires:this.clock+Math.min(3,this.action.flightSeconds??0)+this.reaction});
      }
      for(const [key,pending] of this.pending){
        pending.damage-=Math.max(0,(this.observedHP.get(key)??hp.get(key)??0)-(hp.get(key)??0));
        if(!hp.has(key)||pending.expires<=this.clock||pending.damage<=0)this.pending.delete(key);
      }
      this.observedShots=shots;this.observedHP=hp;
      this.action=decide(state,{human:!this.reference,aim:[...this.aim],lastTarget:this.action.target,previous:this.previous,pendingDamage:new Map([...this.pending].map(([key,value])=>[key,value.damage]))});
      this.previous=state;this.nextObserve=this.clock+Math.max(1/60,this.reaction);
      if(this.action.pointer)this.goal=[...this.action.pointer];
      const wanted=this.action.weapon??0;
      if(wanted!==this.requestedWeapon){this.requestedWeapon=wanted;this.switchUntil=this.clock+(this.reference?0:this.switchDelay);this.premiumUntil=0;}
      deathWave=!!this.action.deathWave&&this.clock-this.lastDeathWave>=10&&!(state.deathwaves?.length);
      if(deathWave)this.lastDeathWave=this.clock;
    }
    if(this.clock>=this.switchUntil)this.weapon=this.requestedWeapon;
    const dx=this.goal[0]-this.aim[0],dy=this.goal[1]-this.aim[1],distance=Math.hypot(dx,dy),travel=this.reference?distance:Math.min(distance,this.speed*dt);
    if(distance>0){this.aim[0]+=dx/distance*travel;this.aim[1]+=dy/distance*travel;}
    const assist=this.weapon>=2?0:this.assistPixels;
    const snapped=assistAim(state,this.aim,assist,this.arenaWidth,this.weapon);
    const settled=distance-travel<=Math.max(8,assist*(state.view_extent??650)*2/this.arenaWidth);
    let fire=!!this.action.fire&&(settled||!!this.action.sweep)&&this.clock>=this.switchUntil;
    // Hold through native cooldown, then stop as soon as ammunition confirms one launch.
    if(this.premiumWeapon>=2&&(state.weapon_report?.[this.premiumWeapon]?.ammo_spent??0)>this.premiumSpent){this.lastPremium=this.clock;this.premiumUntil=0;this.premiumSpent=state.weapon_report[this.premiumWeapon].ammo_spent;}
    if(this.weapon>=2){
      const spent=state.weapon_report?.[this.weapon]?.ammo_spent??0;
      if(fire&&this.clock>=this.premiumUntil&&this.clock-this.lastPremium>=(this.weapon===3?1:.5)){
        this.lastPremium=this.clock;this.premiumUntil=this.clock+1;this.premiumWeapon=this.weapon;this.premiumSpent=spent;
      }
      fire=fire&&this.premiumWeapon===this.weapon&&this.clock<this.premiumUntil;
    }
    return {aim:snapped,weapon:this.weapon,fire,deathWave,target:this.action.target};
  }
}

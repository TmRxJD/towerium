import { Game } from './wasm/towerium';

interface Checkpoint { seed:number; wave:number; state:string }
export const retryStorageKey='towerium.retries.v1';
const key=retryStorageKey;
export class RunRetries {
  used=0;
  checkpoint:Checkpoint|null=null;
  constructor(private config:string,compatible:(config:unknown)=>boolean) {
    try {
      const stored=JSON.parse(localStorage.getItem(key)??'null');
      if(!stored)return;
      const point=stored.checkpoint;
      if(Object.keys(stored).sort().join(',')!=='checkpoint,config,used,version'||stored.version!==1||!compatible(stored.config)||!Number.isInteger(stored.used)||stored.used<0||stored.used>3||!point||Object.keys(point).sort().join(',')!=='seed,state,wave'||!Number.isInteger(point.seed)||point.seed<0||point.seed>0xffffffff||!Number.isSafeInteger(point.wave)||point.wave<=0||point.wave%10!==0||typeof point.state!=='string'||point.state.length>5_000_000)throw new Error('Invalid Retry Save');
      const check=Game.retry_checkpoint(config,point.state);
      try {if(JSON.parse(check.snapshot()).wave!==point.wave)throw new Error('Invalid Retry Wave');}finally{check.free();}
      this.used=stored.used;this.checkpoint=point;
    } catch {try{localStorage.removeItem(key);}catch{/* Optional storage. */}}
  }
  get available(){return !!this.checkpoint&&this.used<3;}
  reset(){this.used=0;this.checkpoint=null;try{localStorage.removeItem(key);}catch{/* Optional storage. */}}
  capture(seed:number,wave:number,state:string){this.checkpoint={seed,wave,state};this.save();}
  retry():Game|null {
    if(!this.available)return null;
    const game=Game.retry_checkpoint(this.config,this.checkpoint!.state);
    this.used++;this.save();return game;
  }
  private save(){try{localStorage.setItem(key,JSON.stringify({version:1,config:this.config,used:this.used,checkpoint:this.checkpoint}));}catch{/* The current session retains its checkpoint when storage is unavailable. */}}
}

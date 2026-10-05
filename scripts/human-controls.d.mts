export interface HumanOptions { reactionMs?:number; aimSpeed?:number; switchMs?:number; initialAim?:[number,number]; reference?:boolean; assistPixels?:number; arenaWidth?:number }
export class HumanController {
  constructor(options?:HumanOptions);
  step(state:any,dt:number,decide:(state:any,context:any)=>any):{aim:[number,number];weapon:number;fire:boolean;deathWave:boolean;target:string};
}

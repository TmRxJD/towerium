export interface HumanOptions { reactionMs?:number; aimSpeed?:number; switchMs?:number; initialAim?:[number,number]; reference?:boolean; assistPixels?:number; arenaWidth?:number }
export const humanDefaults:Readonly<{mouse:Readonly<{reactionMs:number;aimSpeed:number;switchMs:number}>;touch:Readonly<{reactionMs:number;aimSpeed:number;switchMs:number}>}>;
export class HumanController {
  constructor(options?:HumanOptions);
  step(state:any,dt:number,decide:(state:any,context:any)=>any):{aim:[number,number];weapon:number;fire:boolean;deathWave:boolean;target:string};
}

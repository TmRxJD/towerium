import type { Snapshot } from '../src/types';
interface Candidate { key:string; x:number; y:number; }
export function targets(state:Snapshot, config:unknown, aim?:string):Candidate[];
export function baselineAction(state:Snapshot, config:unknown, candidates:Candidate[], aim?:string, circleSeconds?:number, context?:{previous?:Snapshot}):{target:string; pointer?:[number,number]; weapon:number; deathWave:boolean;fire?:boolean;waitingForImpact?:boolean};
export function baselinePurchase(state:Snapshot, config:unknown, strategy:string):number;
export function baselinePowerPurchase(state:Snapshot, config:unknown, strategy?:string):{power:number;path:number}|undefined;

export function baselineWeapon(state:Snapshot,preferred:number,mode?:string):number;

export const powers: string[];
export const weapons: string[];
export function decisionDue(state:Snapshot,lastDecision:number,lastTarget:string,lastWave:number):boolean;

export function baselineSupplyPurchase(state:Snapshot,config:unknown):number|undefined;

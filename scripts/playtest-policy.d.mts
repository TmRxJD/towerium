import type { Snapshot } from '../src/types';
interface Candidate { key:string; x:number; y:number; }
export function targets(state:Snapshot, config:unknown):Candidate[];
export function baselineAction(state:Snapshot, config:unknown, candidates:Candidate[], aim?:string):{target:string; pointer?:[number,number]; weapon:number; deathWave:boolean};
export function baselinePurchase(state:Snapshot, config:unknown, strategy:string):number;

export function baselineWeapon(state:Snapshot,preferred:number,mode?:string):number;

export const powers: string[];
export const weapons: string[];

import type {Snapshot} from '../src/types';
export interface AimRule {id:string;enabled:boolean}
export interface AimPreferences {enabled:boolean;rules:AimRule[]}
export const priorityRules:readonly {id:string;label:string}[];
export function defaultAimPreferences(enabled?:boolean):AimPreferences;
export function validateAimPreferences(value:unknown,fallback?:boolean):AimPreferences;
export function aimTarget(s:{enemies:readonly (readonly number[])[];drops:readonly (readonly number[])[];range:number},rules:readonly AimRule[],weapon?:number,config?:AutoAimConfig):{id:number;kind:number;x:number;y:number;hp:number;drop:boolean}|null;

export interface AutoAimState {enemies:readonly (readonly number[])[];drops:readonly (readonly number[])[];shots:readonly (readonly number[])[];range:number;values:readonly number[];ammo:readonly number[];disabled_weapon:number;speed_multiplier:number}
export interface AutoAimConfig {bomb_radius:number;weapons:readonly {damage:number;speed:number}[];tower_radius?:number;enemies:readonly {speed:number;radius?:number}[]}
export class AutoAimController {position:number[];targetId:number;wait:number;reset():void;step(s:AutoAimState,config:AutoAimConfig,rules:readonly AimRule[],dt:number):{aim:number[];weapon:number;fire:boolean;targetId:number}}

export function manualTargets<T extends {id:number}>(candidates:T[],automaticTargetId:number):T[];

export function manualTargetPlan<T extends {id:number}>(state:Snapshot,candidates:T[],automaticTargetId:number):{state:Snapshot;targets:T[]};

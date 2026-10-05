import type {Snapshot} from '../src/types';
export interface BuyRule {id:number;enabled:boolean;limit:number}
export interface PerkRule {id:number;enabled:boolean}
export interface AutomationPreferences {enabled:boolean;perkEnabled:boolean;buy:BuyRule[];perks:PerkRule[]}
export function defaultAutomation(config:{upgrades:readonly {cap:number}[]},perks:readonly unknown[]):AutomationPreferences;
export function validateAutomation(value:unknown,config:{upgrades:readonly {cap:number}[]},perks:readonly unknown[]):AutomationPreferences;
export function priorityPurchase(s:Snapshot,prefs:AutomationPreferences):number;
export function priorityPerk(s:Snapshot,prefs:AutomationPreferences):number|undefined;
export function holdInterval(milliseconds:number):number;
export class RoundCountdown{wave:number;remaining:number;reset():void;tick(wave:number,seconds:number,eligible:boolean):number}

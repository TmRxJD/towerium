export type Weapon = 0 | 1 | 2 | 3;
export type Phase = 0 | 1 | 2 | 3;
export type EnemyKind = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
export type Enemy = [id:number, kind:EnemyKind, x:number, y:number, hp:number, maxHp:number, stun:number];
export type Shot = [id:number, kind:number, x:number, y:number, angle:number];
export type Drop = [id:number, kind:number, x:number, y:number, life:number];
export type Fx = [kind:number, x:number, y:number, a:number, b:number, life:number];
export interface WaveReport {
  accuracy:number; shots_fired:number; hits_taken:number; powerups_collected:number;
  coins_earned:number; stones_earned:number; kills:number; duration_seconds:number;
}
export interface Snapshot {
  phase:Phase; paused:boolean; wave:number; time:number; hp:number; max_hp:number;
  wave_time:number; cleanup_seconds:number; golden_kills:number;
  weapon_report:{shots:number;hits:number;kills:number;damage:number;ammo_spent:number;ammo_granted:number;ammo_discarded:number}[];ammo_pickups:number;
  wave_report:WaveReport; overall_report:WaveReport;
  speed_multiplier:number; mass_multiplier:number; power_drop_scale:number; enemy_mobility:[number,number][];
  blackholes:[number,number][]; spotlights:number[];
  chrono_radius:number;
  disabled_weapon:Weapon; disabled_stat:number; sabotage_time:number;
  enemy_effects:[id:number,charge:number,commanded:boolean,draining:boolean][];
  enemy_radii:[id:number,radius:number][];
  ray_spins:[id:number,angle:number][];
  overcharge:[sourceId:number,x:number,y:number,hits:number,toTower:boolean][];
  coins:number; earned:number; kills:number; weapon:Weapon; ammo:number[]; charges:number;
  stones:number; stones_earned:number; power_levels:[number,number][];
  supply_costs:number[]; supply_available:boolean[];
  power_costs:[number,number][]; power_effects:number[]; power_weights:number[];
  shields:number; overheal:number;
  wall_hp:number; wall_max_hp:number; wall_rebuild:number; ammo_caps:number[];
  fallout_time:number; demon_time:number; demon_invincible:number; pending_start_wave:number;
  module_times:[number,number,number,number];
  coin_bonus_kills:number[]; coin_bonus_coins:number[];
  coin_overlap_kills:number[];
  enemy_burns:[number,number,number][]; extra_power_times:number[]; extra_orbs:[number,number][]; bots:[number,number,number,number,number][]; aoe_scale:number;
  powers:number[]; remaining:number; total:number; spawned:number; range:number; view_extent:number; rapid:number;
  shock_in:number; orb_angle:number; orb_count:number; spotlight_angle:number; ray_angle:number; ray_active:boolean;
  enemies:Enemy[]; shots:Shot[]; drops:Drop[]; areas:[number,number,number,number][];
  hostile:[number,number][]; deathwaves:number[]; fx:Fx[]; notice:{text:string;time:number};
  levels:number[]; values:number[]; costs:number[];
}

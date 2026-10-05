export interface AimState {view_extent?:number;range:number;enemies:readonly (readonly number[])[];drops:readonly (readonly number[])[]}
export function assistAim(state:AimState,aim:[number,number],radiusPixels?:number,arenaWidth?:number,weapon?:number):[number,number];

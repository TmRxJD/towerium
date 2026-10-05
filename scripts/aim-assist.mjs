/** A bounded cursor snap; the raw aim remains owned by the player/controller. */
export function assistAim(state,aim,radiusPixels=14,arenaWidth=320,weapon=0) {
  if(radiusPixels<=0||arenaWidth<=0)return [...aim];
  const radius=radiusPixels*(state.view_extent??650)*2/arenaWidth;
  let closest=radius*radius,point=aim;
  const candidates=[...(state.enemies??[]).filter(e=>e[4]>0).map(e=>[e[2],e[3]]),...(state.drops??[]).map(d=>[d[2],d[3]])];
  for(const candidate of candidates){
    if(weapon===1&&Math.hypot(...candidate)>state.range+.1)continue;
    const distance=(candidate[0]-aim[0])**2+(candidate[1]-aim[1])**2;
    if(distance<closest){closest=distance;point=candidate;}
  }
  return [...point];
}

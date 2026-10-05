export const powers = ['Chain Lightning', 'Chrono Field', 'Poison Swamp', 'Black Hole', 'Spotlight', 'Death Ray', 'Golden Tower', 'Recovery Package', 'Death Wave', 'Energy Shield', 'Nuke', 'Demon Mode', 'Death Penalty', 'Space Displacer', 'Pulsar Harvester', 'Multiverse Nexus','Extra Orbs','Area Of Effect','Gold Bot','Amp Bot','Flame Bot','Thunder Bot'];
export const weapons = ['Projectiles', 'Light Speed', 'Smart Missiles', 'Hook Bomb'];
const round = n => Math.round(n * 100) / 100;

const boundaryKinds=new Set([3,6,7,10,11]);
const bossKinds=new Set([5,12]);
const visible=(x,y,r=0,extent=650)=>Math.abs(x)<=extent+r&&Math.abs(y)<=extent+r;
const angleDelta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
function usefulPowerPickup(state,kind) {
  if(kind<7)return (state.powers[kind]??0)<10;
  if(kind===7)return state.hp<state.max_hp*.75;
  if(kind===8)return state.charges<1;
  if(kind===9)return state.shields<3;
  if(kind===10)return state.enemies.filter(e=>e[1]===0&&e[4]>0).length>=8;
  if(kind===11)return (state.demon_time??0)<10;
  if(kind>=16)return (state.extra_power_times[kind-16]??0)<10;
  if(kind===15)return [3,4,6].some(i=>(state.powers[i]??0)<10);
  return (state.module_times[kind-12]??0)<10;
}

function enemyDetails(state,config,e,radii,effects,previous) {
  const childRadius=radii.get(e[0]),child=e[1]===8&&childRadius!==undefined;
  const spec=config.enemies[child?1:e[1]],distance=Math.hypot(e[2],e[3]);
  const ranged=boundaryKinds.has(e[1]);
  const stop=ranged?state.range:config.tower_radius+(childRadius??spec.radius);
  const effect=effects.get(e[0]);
  const slow=state.powers[1]>0&&distance<(state.chrono_radius??state.range)?1-state.power_effects[1]*(1-spec.resistance):1;
  const mobility=(state.enemy_mobility??[]).find(row=>row[0]===e[0])?.[1]??1;
  const speed=e[6]>0?0:spec.speed*(state.speed_multiplier??1)*mobility*slow*(effect?.[2]?1+config.specials.commander_speed_bonus:1);
  let vx=distance>stop&&distance>0?-e[2]/distance*speed:0,vy=distance>stop&&distance>0?-e[3]/distance*speed:0;
  const prior=previous?.positions.get(e[0]);
  if(prior&&previous.elapsed>0&&previous.elapsed<=.25){vx=(e[2]-prior[0])/previous.elapsed;vy=(e[3]-prior[1])/previous.elapsed;}
  const contact=Math.max(0,distance-stop),danger=contact===0?0:contact/Math.max(speed,.01);
  return {key:`enemy_${e[0]}`,id:e[0],kind:e[1],child,spec,radius:childRadius??spec.radius,x:e[2],y:e[3],hp:e[4],maxHp:e[5],distance,vx,vy,stop,charge:effect?.[1]??0,danger,
    text:`${child?'Scatter child':spec.name} HP=${round(e[4])}, distance=${round(distance)}, ${ranged?'attacks from range line':round(danger)+'s until contact'}, hit=${spec.damage}`};
}

export function targets(state, config, aim='nearest') {
  // Rust positions are f32; a unit standing on the range line can round a few
  // hundredths outside it when JS recomputes the distance in f64.
  const radii=new Map(state.enemy_radii??[]),effects=new Map((state.enemy_effects??[]).map(effect=>[effect[0],effect]));
  const extent=state.view_extent??Math.max(650,state.range*1.25);
  const enemies = state.enemies.filter(e=>e[4]>0&&visible(e[2],e[3],radii.get(e[0])??config.enemies[e[1]].radius,extent))
    .map(e=>enemyDetails(state,config,e,radii,effects)).sort((a,b)=>a.danger-b.danger||a.id-b.id);
  // Bound the observation, retaining imminent contacts and one representative per enemy type.
  const selected = enemies.slice(0,6);
  if(aim==='crowd'&&enemies.length){
    const bins=Array(24).fill(0),bin=t=>Math.floor((Math.atan2(t.y,t.x)+Math.PI)/(2*Math.PI)*24)%24;
    for(const enemy of enemies)bins[bin(enemy)]++;
    const dense=enemies.reduce((best,t)=>bins[bin(t)]>bins[bin(best)]?t:best,enemies[0]);
    if(!selected.includes(dense))selected.push(dense);
  }
  for (const kind of [11,10,7,6,4,9,12,8,3,5,2,1,0].filter(kind=>kind<config.enemies.length)) {
    if(selected.length>=11)break;
    const e=enemies.find(e=>e.kind===kind);
    if(e&&!selected.includes(e))selected.push(e);
  }
  // Detailed neighborhood observations are needed only for nominated targets.
  for(const target of selected){
    const nearby=state.enemies.filter(other=>other[0]!==target.id&&Math.hypot(other[2]-target.x,other[3]-target.y)<80).length;
    const shielded=state.enemies.some(other=>other[1]===4&&Math.hypot(other[2]-target.x,other[3]-target.y)<config.defense.protector_radius);
    target.shielded=shielded;
    target.text+=`, nearby=${nearby}, shielded=${shielded}`;
  }
  return [...selected,...state.drops.filter(d=>visible(d[2],d[3],18,extent)).sort((a,b)=>Number(usefulPowerPickup(state,b[1]))-Number(usefulPowerPickup(state,a[1]))||a[4]-b[4]).slice(0,4).map(d=>({
    key:`drop_${d[0]}`,id:d[0],drop:d[1],x:d[2],y:d[3],distance:Math.hypot(d[2],d[3]),
    life:d[4],radius:18,vx:0,vy:0,
    text:`${powers[d[1]]} pickup; expires ${round(d[4])}s`,
  }))];
}

/** Match deterministic direct-hit damage; never assume chance-based procs. */
export function weaponDamage(state,config,target,weapon,position=target) {
  if(target.drop!==undefined)return 1;
  const spec=target.spec??config.enemies[target.kind],distance=Math.hypot(position.x,position.y);
  if(weapon===1&&distance>state.range+.1)return 0;
  const protectedEnemy=target.shielded??state.enemies.some(e=>e[4]>0&&e[1]===4&&Math.hypot(e[2]-position.x,e[3]-position.y)<=config.defense.protector_radius);
  const spotlight=state.powers[4]>0&&(state.spotlights??[]).some(a=>Math.abs(angleDelta(a,Math.atan2(position.y,position.x)))<config.powers.spotlight_angle*Math.PI/360);
  const multiplier=(spotlight?state.power_effects[4]:1)*(target.kind!==4&&protectedEnemy?1-config.defense.protector_reduction:1);
  let damage;
  if((weapon===3||weapon===4)&&!bossKinds.has(target.kind))damage=target.maxHp;
  else if(weapon===1){
    const normalHits=Math.max(1,Math.ceil(target.maxHp/(config.weapons[0].damage*multiplier)-.00001));
    damage=target.maxHp/Math.max(1,normalHits-1);
  }else damage=(weapon===4?config.child_damage:config.weapons[weapon].damage)*multiplier;
  damage*=spec.weapon_damage[weapon===4?3:weapon];
  if(distance>state.range+.1)damage*=bossKinds.has(target.kind)?.25:.5;
  const amplified=(state.bots??[]).some(b=>b[0]===19&&Math.hypot(position.x-b[1],position.y-b[2])<b[3]);
  damage*=(state.demon_time>0?state.power_effects[11]:1)*(amplified?2:1)*(weapon>=3?(state.aoe_scale??1):1);
  if(weapon>=3&&!bossKinds.has(target.kind)&&distance>state.range+.1)damage=Math.min(damage,target.maxHp*.5);
  return damage;
}

function contactTime(shot,target,speed,radius,horizon) {
  const dx=target.x-shot[2],dy=target.y-shot[3];
  const vx=Math.cos(shot[4])*speed-target.vx,vy=Math.sin(shot[4])*speed-target.vy;
  const a=vx*vx+vy*vy,b=-2*(dx*vx+dy*vy),c=dx*dx+dy*dy-radius*radius;
  // A visible shot inside an enemy can be a bounce that already hit it;
  // the public snapshot intentionally does not expose its private hit history.
  if(c<=0)return Infinity;
  const disc=b*b-4*a*c;
  if(a===0||disc<0)return Infinity;
  const t=(-b-Math.sqrt(disc))/(2*a);
  return t>=0&&t<=horizon?t:Infinity;
}

/** Conservatively reserve only the first likely contact of each visible shot. */
export function predictedDamage(state,config,candidates,context={}) {
  const damage=new Map(),wanted=new Map(candidates.map(t=>[t.key,t]));
  if(!state.shots.length)return damage;
  const radii=new Map(state.enemy_radii??[]),effects=new Map((state.enemy_effects??[]).map(e=>[e[0],e]));
  const previous=context.previous?{elapsed:state.time-context.previous.time,positions:new Map(context.previous.enemies.map(e=>[e[0],[e[2],e[3]]]))}:undefined;
  const grid=new Map(),cell=80;
  const add=t=>{const key=`${Math.floor(t.x/cell)},${Math.floor(t.y/cell)}`;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(t);};
  for(const e of state.enemies)if(e[4]>0)add(enemyDetails(state,config,e,radii,effects,previous));
  for(const d of state.drops)add({key:`drop_${d[0]}`,drop:d[1],x:d[2],y:d[3],vx:0,vy:0,radius:18});
  for(const shot of state.shots){
    if(shot[1]===1||shot[1]>4)continue;
    const speed=shot[1]===4?config.weapons[0].speed*.8:config.weapons[shot[1]].speed;
    const horizon=shot[1]===0||shot[1]===4?1:.65;
    const radius=shot[1]>=3?config.bomb_radius*(state.aoe_scale??1):4,nearby=new Set(),seenCells=new Set();
    let crowded=false;
    const steps=Math.ceil(speed*horizon/cell);
    for(let n=0;n<=steps&&!crowded;n++){
      const t=horizon*n/steps,x=Math.floor((shot[2]+Math.cos(shot[4])*speed*t)/cell),y=Math.floor((shot[3]+Math.sin(shot[4])*speed*t)/cell);
      for(let dx=-1;dx<=1&&!crowded;dx++)for(let dy=-1;dy<=1;dy++){
        const key=`${x+dx},${y+dy}`;if(seenCells.has(key))continue;seenCells.add(key);
        for(const target of grid.get(key)??[]){nearby.add(target);if(nearby.size>128){crowded=true;break;}}
      }
    }
    if(crowded)continue;
    let first,time=Infinity;
    for(const target of nearby){
      // Knockback/Black Hole can abruptly bend motion; do not promise those kills.
      const t=contactTime(shot,target,speed,target.radius+(target.drop===undefined?radius:0),horizon);
      if(t<time){time=t;first=target;}
    }
    if(first&&wanted.has(first.key)){
      if(first.drop===undefined&&state.powers[3]>0&&(state.blackholes??[]).some(p=>Math.hypot(p[0]-first.x,p[1]-first.y)<state.power_effects[3]))continue;
      const p={x:first.x+first.vx*time,y:first.y+first.vy*time};
      // Do not extrapolate moving enemies through the tower or range stop.
      if(first.stop&&Math.hypot(p.x,p.y)<first.stop)continue;
      damage.set(first.key,(damage.get(first.key)??0)+weaponDamage(state,config,{...first,shielded:wanted.get(first.key).shielded},shot[1],p));
    }
  }
  return damage;
}

export function combatRequest(state, config, candidates, strategy, interval) {
  const weaponChoices=Object.fromEntries(weapons.flatMap((name,i)=>(i===0||state.ammo[i]>0)&&state.disabled_weapon!==i?[[String(i),
    `${name}: ${i===1?"damage derived: one fewer standard hit than primary":`damage ${config.weapons[i].damage}`}/${config.weapons[i].interval}s, ammo${i===0?'unlimited':state.ammo[i]}; ${['straight; upgrade benefits','instant single target','slow homing','bomb plus six child shots'][i]}`]]:[]));
  return {model:'kev-latest',state:JSON.stringify({
    goal:'Survive waves. Stationary tower, aim and shoot.',
    strategy, wave:state.wave, hp:round(state.hp), maxHP:state.max_hp, coins:round(state.coins),
    enemiesAlive:state.enemies.length, shotsInFlight:state.shots.length,
    attackSpeed:round(state.values[0]), projectileUpgrades:{multishot:round(state.values[2]),rapid:round(state.values[4]),bounce:round(state.values[6])},
    deathWaveCharges:state.charges, energyShieldCharges:state.shields??0, powers:[...state.module_times.map((time,i)=>time>0?`${powers[i+12]} ${round(time)}s`:null),...state.powers.map((time,i)=>time>0?`${powers[i]} ${round(time)}s`:null),state.fallout_time>0?`Nuke fallout ${round(state.fallout_time)}s`:null,state.demon_time>0?`Demon bonus ${round(state.demon_time)}s`:null,state.demon_invincible>0?`Demon invincibility ${round(state.demon_invincible)}s`:null].filter(Boolean),
    sabotage:{weapon:state.disabled_weapon,stat:state.disabled_stat,seconds:state.sabotage_time},enemyEffects:state.enemy_effects,
    actionSeconds:interval,
    rules:'Contact hurts repeatedly. Protectors shield passive damage. Vampires drain at range, Rays charge heavy shots, Commanders buff nearby enemies, Saboteurs temporarily disable equipment, and Overcharge shots grow stronger until their source dies. Scatter splits into children. Use direct weapons on priority threats. Death Wave bypasses shields. Shoot pickups to activate. Projectiles have unlimited ammo; Direct weapon kills supply ammo: LSS and SM refill every pickup; MH every fourth. Passive kills supply coins and powers only.',
  }),questions:{
    target:{type:'choice',instructions:'Aim and shoot which target to survive? Weigh pickups against immediate danger.',criteria:Object.fromEntries([...candidates.map(t=>[t.key,t.text]),['hold','Do not fire.']])},
    ...(Object.keys(weaponChoices).length>1?{weapon:{type:'choice',instructions:'Best weapon for threats and available ammo?',criteria:weaponChoices}}:{}),
    ...(state.charges>0?{death_wave:{type:'choice',instructions:'Spend a Death Wave charge now or save it?',criteria:{keep:'Save the charge.',use:'Release Death Wave.'}}}:{}),
  }};
}

export function shopRequest(state, config, strategy) {
  const criteria={save:'Finish shopping, save remaining coins, and start the next wave.'};
  config.upgrades.forEach((u,i)=>{
    if(state.levels[i]<u.cap&&state.costs[i]<=state.coins) criteria[`buy_${i}`]=`${u.name}: ${round(state.values[i]*u.display_scale)}${u.unit} -> ${round((state.values[i]+u.step)*u.display_scale)}${u.unit}; cost ${state.costs[i]}; level ${state.levels[i]}/${u.cap}. ${u.description}`;
  });
  return {model:'kev-latest',state:JSON.stringify({goal:'Survive many waves. Choose one permanent upgrade, or save. You can make another purchase after this choice.',strategy,
    clearedWave:state.wave,hp:round(state.hp),maxHP:state.max_hp,coins:round(state.coins),
    prerequisites:{orbs:state.levels[14],multishotChance:state.values[2],rapidChance:state.values[4],bounceChance:state.values[6]},
    rules:'Max HP also heals by the added amount. HP regeneration heals during combat. Orb speed requires an orb. Multishot quantity requires multishot chance. Rapid duration requires rapid chance. Bounce range and targets require bounce chance. Overheal expands Recovery Package capacity. Coins multiply future earnings but do not help current survival. Every tenth wave adds one cannon hit of enemy health; waves also bring more enemies faster. Spawns cover all directions from wave one.',
  }),questions:{purchase:{type:'choice',instructions:'Which purchase offers the best value now under your strategy? Only select from the listed affordable choices.',criteria}}};
}

export function decodeChoice(response, request, key) {
  const answer=response?.answers?.[key];
  if(!answer||!Object.hasOwn(request.questions[key].criteria,answer.choice)) throw new Error(`Invalid Kev choice for ${key}: ${JSON.stringify(answer)}`);
  return answer.choice;
}

export function shopNominations(request) {
  const upgrades=Object.entries(request.questions.purchase.criteria).filter(([key])=>key!=='save');
  return {...request,state:request.state+'\nThis is only an upgrade nomination. A separate final decision will offer saving instead of buying.',
    questions:Object.fromEntries(Array.from({length:Math.ceil(upgrades.length/10)},(_,part)=>[`nominee_${part}`,{
      type:'choice',instructions:'Nominate the best-value upgrade from this group. This nomination does not spend coins.',
      criteria:Object.fromEntries(upgrades.slice(part*10,(part+1)*10)),
    }]))};
}

export function baselineAction(state, config, candidates, aim='nearest', circleSeconds=2, context={}) {
  if(aim==='circle') {
    const angle=state.time*Math.PI*2/circleSeconds;
    return {target:'circle',pointer:[Math.cos(angle)*state.range*.9,Math.sin(angle)*state.range*.9],weapon:0,fire:true,sweep:true,deathWave:false};
  }
  if(aim==='idle')return {target:'hold',weapon:0,deathWave:false};
  const committed=context.human?(context.pendingDamage??new Map()):predictedDamage(state,config,candidates,context);
  const open=candidates.filter(t=>(committed.get(t.key)??0)+.00001<(t.drop===undefined?t.hp:1));
  const angle=t=>Math.atan2(t.y,t.x),currentAngle=Math.atan2(context.aim?.[1]??0,context.aim?.[0]??1);
  const groupSize=t=>state.enemies.filter(e=>e[4]>0&&visible(e[2],e[3],0,state.view_extent??650)&&Math.abs(angleDelta(Math.atan2(e[3],e[2]),angle(t)))<.22).length;
  const choose=list=>aim!=='crowd'?list[0]:list.map(t=>({t,score:(1+Math.min(6,groupSize(t))*.3)/(1+Math.abs(angleDelta(angle(t),currentAngle))*3)*(t.key===context.lastTarget&&groupSize(t)>1?.65:1)})).sort((a,b)=>b.score-a.score||a.t.id-b.t.id)[0]?.t;
  const imminent=choose(open.filter(t=>t.drop===undefined&&!bossKinds.has(t.kind)&&t.danger<6));
  const pickup=open.find(t=>t.drop===7&&state.hp<state.max_hp)||open.find(t=>t.drop===11&&state.hp<state.max_hp*.65)||open.find(t=>t.drop===8&&state.charges<3)||open.find(t=>t.drop!==undefined);
  const boss=open.find(t=>t.kind===12);
  const priority=['priority','crowd'].includes(aim)?open.find(t=>t.kind===7&&t.charge>.6)||open.find(t=>[6,10,11].includes(t.kind)&&t.danger<1)||(aim==='priority'?open.find(t=>t.kind===4)||open.find(t=>t.kind===9):undefined):undefined;
  const lit=state.powers[4]>0?choose(open.filter(t=>t.drop===undefined&&t.danger<8&&(state.spotlights??[]).some(a=>Math.abs(angleDelta(angle(t),a))<config.powers.spotlight_angle*Math.PI/360))):undefined;
  const urgent=choose(open.filter(t=>t.drop===undefined&&t.danger<1.5));
  const pressured=state.enemies.filter(e=>e[4]>0&&Math.hypot(e[2],e[3])<state.range).length>=3;
  const rescuePickup=pressured?open.find(t=>t.drop!==undefined&&usefulPowerPickup(state,t.drop)):undefined;
  const premiumAllowed=(context.weaponMode??'all')!=='projectile'&&(context.weaponMode??'all')!=='light';
  const bossOpportunity=boss&&premiumAllowed&&boss.distance<=state.range&&boss.hp-(committed.get(boss.key)??0)>weaponDamage(state,config,boss,0)*2&&([2,3].some(i=>state.ammo[i]>0&&state.disabled_weapon!==i))?boss:undefined;
  const target=priority||rescuePickup||urgent||bossOpportunity||lit||imminent||pickup||(aim==='priority'?boss:undefined)||choose(open.filter(t=>t.drop===undefined));
  let weapon=0;
  const available=i=>state.ammo[i]>0&&state.disabled_weapon!==i&&(i!==1||target?.distance<=state.range+.1);
  if(target?.drop===undefined&&target) {
    const hp=Math.max(.00001,target.hp-(committed.get(target.key)??0));
    const hits=i=>Math.ceil(hp/Math.max(.00001,weaponDamage(state,config,target,i))-.00001);
    const matchup=target.spec.weapon_damage;
    const cluster=open.filter(t=>t.drop===undefined&&Math.hypot(t.x-target.x,t.y-target.y)<100).length;
    if(available(3)&&target.distance<=state.range+.1&&(bossKinds.has(target.kind)||state.ammo[3]>3&&cluster>=4)&&hp>weaponDamage(state,config,target,0)*2)weapon=3;
    else if(available(2)&&hits(0)>3&&(!bossKinds.has(target.kind)||target.distance<=state.range+.1)&&(bossKinds.has(target.kind)||state.ammo[2]>8&&(matchup[2]>matchup[1]||target.kind===2)))weapon=2;
    else if(available(1)&&(hits(1)<hits(0)||state.ammo[1]>=(state.ammo_caps?.[1]??config.weapons[1].capacity)*.4)&&!(target.kind===8&&!target.child&&matchup[0]>matchup[1]))weapon=1;
    // A nearly dead special does not justify a fresh premium missile or bomb.
    if(hits(0)===1&&target.danger>1&&weapon!==1)weapon=0;
  }
  weapon=baselineWeapon(state,weapon,context.weaponMode??'all');
  // Preference modes never turn a pickup or cheap solo kill into a premium shot.
  const bombGroup=target?state.enemies.filter(e=>e[4]>0&&Math.hypot(e[2]-target.x,e[3]-target.y)<100).length:0;
  if(weapon>=2&&(target?.drop!==undefined||!target||target.hp<=weaponDamage(state,config,target,0)*2||bossKinds.has(target.kind)&&target.distance>state.range+.1||weapon===3&&(target.distance>state.range+.1||!bossKinds.has(target.kind)&&bombGroup<4)||!bossKinds.has(target.kind)&&state.ammo[weapon]<=(weapon===3?3:8)))weapon=0;
  let pointer;
  if(target){
    let vx=context.human?0:target.vx??0,vy=context.human?0:target.vy??0;
    const previous=context.previous,elapsed=previous?state.time-previous.time:0;
    const before=target.drop===undefined&&previous?.enemies.find(e=>e[0]===target.id);
    if(before&&elapsed>0&&elapsed<=1){vx=(target.x-before[2])/elapsed;vy=(target.y-before[3])/elapsed;}
    const flight=weapon===1||target.drop!==undefined?0:Math.max(0,target.distance-27)/config.weapons[weapon].speed;
    const lead=target.drop!==undefined?0:Math.min(flight,.75,target.danger);
    let x=target.x+vx*lead,y=target.y+vy*lead;
    const extent=(state.view_extent??Math.max(650,state.range*1.25))-15;
    const scale=Math.min(1,extent/Math.max(Math.abs(x),Math.abs(y),1));x*=scale;y*=scale;pointer=[x,y];
  }
  const close=state.enemies.filter(e=>e[4]>0&&visible(e[2],e[3],0,state.view_extent??650)&&Math.hypot(e[2],e[3])-config.tower_radius-config.enemies[e[1]].radius<config.enemies[e[1]].speed*(state.speed_multiplier??1)*3).length;
  const bossBurst=!!boss&&boss.distance<=state.range&&boss.hp>state.power_effects[8]*.75;
  const sweep=aim==='crowd'&&weapon<2&&target?.drop===undefined&&!!target&&state.values[2]>0&&state.values[3]>1&&groupSize(target)>1&&Math.abs(angleDelta(angle(target),currentAngle))<.45;
  return {target:target?.key||'hold',pointer,weapon,fire:!!target,sweep,hitDamage:target?weaponDamage(state,config,target,weapon):0,flightSeconds:weapon===1?0:(target?.distance??0)/config.weapons[weapon].speed,waitingForImpact:!target&&candidates.length>0&&committed.size>0,deathWave:state.charges>0&&!(state.deathwaves?.length)&&(close>=8||bossBurst||state.hp<state.max_hp*.35&&close>=3)};
}

export function baselinePurchase(state, config, strategy, excluded=-1) {
  if(strategy==='none')return -1;
  const dependencies={3:2,5:4,7:6,8:6,15:14,25:16,26:16,28:27};
  const eligible=i=>i!==excluded&&state.levels[i]<config.upgrades[i].cap&&(!(i in dependencies)||state.values[dependencies[i]]>0);
  const affordable=i=>eligible(i)&&state.costs[i]<=state.coins;
  const health=state.hp/state.max_hp,hits=state.wave_report?.hits_taken??0;
  // Establish income while the opening is safe. Never finance it through a dying tower.
  if(health<.55){
    if(affordable(11))return 11;
    if(affordable(12))return 12;
  }
  if(state.wave<=2&&health>=.9&&state.levels[19]<2&&affordable(19))return 19;
  // Establish a usable spread before buying secondary defenses and proc durations.
  if(state.wave<=9&&health>=.6){
    const spreadGoal=Math.min(8,2+state.wave);
    if(state.levels[2]<spreadGoal&&affordable(2))return 2;
    if(state.wave>=3&&state.levels[3]===0&&affordable(3))return 3;
  }
  const opening={balanced:6,offense:2,defense:3,economy:10}[strategy]??6;
  const economyGoal=Math.min(opening,2+Math.floor(state.wave/2));
  if(state.wave<=10&&health>=.75&&hits<=2&&state.levels[19]<economyGoal&&affordable(19))return 19;
  const v=state.values,step=i=>config.upgrades[i].step;
  const contactWeight=health<.8||hits>2?.6:.08;
  const multi=1+v[2]*(v[3]-1),bounce=1+v[6]*v[8];
  const firingRate=v[0]/config.weapons[0].interval;
  const rapid=(chance,duration)=>1+(config.rapid_multiplier-1)*(chance*duration*firingRate/(1+chance*duration*firingRate));
  const rapidNow=rapid(v[4],v[5]);
  const utility=[
    step(0)/v[0], step(1)/v[1]*.5,
    step(2)*(v[3]-1)/multi*.8, step(3)*v[2]/multi*.8,
    rapid(v[4]+step(4),v[5])/rapidNow-1, rapid(v[4],v[5]+step(5))/rapidNow-1,
    step(6)*v[8]/bounce*.85, step(7)/v[7]*v[6]*.5, step(8)*v[6]/bounce*.85,
    step(9)*v[10]/60, step(10)*v[9]/60,
    step(11)/state.max_hp*(health<.8?1.2:.12), step(12)*30/state.max_hp*(health<.98?1:.08),
    step(13)/v[13]*contactWeight, .4/(1+v[14]), step(15)/v[15]*Math.min(v[14],3)*.3,
    step(16)*.7, step(17)/v[17]*.15, -step(18)/v[18]*.25,
    step(19)/v[19]*(strategy==='economy'?2:1), step(20)/(12+v[20])*.12,
    step(21)*(state.power_drop_scale??1)/v[21]*.18, step(22)/v[22]*.25, step(23)/v[23]*.3,
    step(24)/(1+v[24])*(health>.9?.01:.08),
    step(25)/v[25]*v[16]*.4,step(26)/v[26]*v[16]*.4,
    step(27)/state.max_hp*(health<.8?.7:.12),-step(28)/v[28]*Math.min(1,v[27]/state.max_hp)*.3,
    step(29)/v[29]*((state.weapon_report??[]).some(w=>w.ammo_discarded>0)?.15:.01),
  ];
  const specialties={offense:new Set([0,2,3,4,5,6,7,8,22,23]),defense:new Set([9,10,11,12,13,14,15,16,17,18,24]),economy:new Set([19])};
  const choices=config.upgrades.map((_,i)=>({index:i,score:utility[i]*(specialties[strategy]?.has(i)?1.65:1)/Math.max(1,state.costs[i])}))
    .filter(x=>eligible(x.index)&&Number.isFinite(x.score)&&x.score>0).sort((a,b)=>b.score-a.score||a.index-b.index);
  const best=choices[0],purchase=choices.find(x=>affordable(x.index));
  if(!purchase)return -1;
  // Save for a close, valuable milestone instead of spending its reserve on filler.
  if(best&&best.index===14&&!affordable(14)&&best.score>purchase.score*1.4&&state.costs[14]<=state.coins+Math.max(state.wave_report?.coins_earned??0,10)*2)return -1;
  return purchase.index;
}

export function baselineWeapon(state, preferred, mode='all') {
  const modes={projectile:0,light:1,missile:2,hook:3};
  if(mode==='all')return preferred;
  const chosen=mode==='rotate'?Math.floor(state.time/4)%4:modes[mode];
  if(chosen===undefined)throw new Error(`Unknown baseline weapon mode: ${mode}`);
  // Exhaustion deliberately returns to unlimited Projectiles, rather than firing empty weapons.
  return chosen===0 || state.ammo[chosen]>0&&state.disabled_weapon!==chosen ? chosen:0;
}

export function baselinePowerPurchase(state,config,strategy='balanced') {
  if(strategy==='none')return;
  const builds={offense:[4,19,0,20,5,12],defense:[1,21,9,16,7,13],economy:[6,18,3,4,14],balanced:[4,0,1,19,9,18]};
  const preferred=builds[strategy]??builds.balanced;
  const choices=[];
  for(const [rank,power] of preferred.entries())for(let path=0;path<2;path++){
    const cost=state.power_costs[power][path];
    if(cost===0)continue;
    const level=state.power_levels[power][path];
    const benefit=(path===0?.16:Math.abs(config.power_workshop.upgrades[power].effect_step)/Math.max(.1,Math.abs(state.power_effects[power]))+.06);
    choices.push({power,path,cost,score:benefit*(1-rank*.12)/(cost*(1+level*.1))});
  }
  choices.sort((a,b)=>b.score-a.score||a.power-b.power||a.path-b.path);
  const best=choices[0],affordable=choices.find(c=>c.cost<=state.stones);
  if(!affordable||best&&best.cost>state.stones&&best.score>affordable.score*1.5)return;
  return {power:affordable.power,path:affordable.path};
}

export function decisionDue(state,lastDecision,lastTarget,lastWave) {
  const alive=lastTarget.startsWith('enemy_')?state.enemies.some(e=>`enemy_${e[0]}`===lastTarget&&e[4]>0):lastTarget.startsWith('drop_')?state.drops.some(d=>`drop_${d[0]}`===lastTarget):true;
  return state.wave!==lastWave||!alive||state.time-lastDecision>=.05;
}


export function baselineSupplyPurchase(state,config) {
  if(!state.levels.every((level,i)=>level>=config.upgrades[i].cap))return;
  const next=state.pending_start_wave||state.wave+1;
  const choices=[];
  if(next%10===0&&state.charges<1)choices.push(11);
  for(let weapon=1;weapon<=3;weapon++)if(state.ammo[weapon]<(weapon===1?state.ammo_caps[1]*.25:weapon===2?8:1))choices.push(weapon-1);
  if([3,4,6].every(power=>state.powers[power]<10))choices.push(18);
  for(const power of [1,4,3,6,0,5,2])if(state.powers[power]<10)choices.push(power+3);
  return choices.find(item=>state.supply_available[item]&&state.coins>=state.supply_costs[item]);
}

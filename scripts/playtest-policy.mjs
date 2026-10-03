export const powers = ['Chain Lightning', 'Chrono Field', 'Poison Swamp', 'Black Hole', 'Spotlight', 'Death Ray', 'Golden Tower', 'Recovery Package', 'Death Wave', 'Energy Shield'];
export const weapons = ['Projectiles', 'Light Speed', 'Smart Missiles', 'Hook Bomb'];
const round = n => Math.round(n * 100) / 100;

export function targets(state, config) {
  // Rust positions are f32; a unit standing on the range line can round a few
  // hundredths outside it when JS recomputes the distance in f64.
  const radii=new Map(state.enemy_radii??[]),effects=new Map((state.enemy_effects??[]).map(effect=>[effect[0],effect[1]]));
  const enemies = state.enemies.filter(e=>Math.hypot(e[2],e[3])<=state.range+.1).map(e=>{
    const childRadius=radii.get(e[0]),child=e[1]===8&&childRadius!==undefined;
    const spec=config.enemies[child?1:e[1]],distance=Math.hypot(e[2],e[3]);
    const ranged=[3,6,7,10,11].includes(e[1]);
    const contact=Math.max(0,distance-(ranged?state.range:config.tower_radius+(childRadius??spec.radius)));
    const speed=spec.speed*(state.speed_multiplier??1);
    return {key:`enemy_${e[0]}`,id:e[0],kind:e[1],x:e[2],y:e[3],hp:e[4],distance,charge:effects.get(e[0])??0,danger:contact/speed,
      text:`${child?'Scatter child':spec.name} HP=${round(e[4])}, distance=${round(distance)}, ${ranged?'attacks from range line':round(contact/speed)+'s until contact'}, hit=${spec.damage}`};
  }).sort((a,b)=>a.danger-b.danger);
  // Bound the observation, retaining imminent contacts and one representative per enemy type.
  const selected = enemies.slice(0,6);
  for (const kind of [11,10,7,6,4,9,12,8,3,5,2,1,0].filter(kind=>kind<config.enemies.length)) {
    if(selected.length>=11)break;
    const e=enemies.find(e=>e.kind===kind);
    if(e&&!selected.includes(e))selected.push(e);
  }
  // Detailed neighborhood observations are needed only for nominated targets.
  for(const target of selected){
    const nearby=state.enemies.filter(other=>other[0]!==target.id&&Math.hypot(other[2]-target.x,other[3]-target.y)<80).length;
    const shielded=state.enemies.some(other=>other[1]===4&&Math.hypot(other[2]-target.x,other[3]-target.y)<config.defense.protector_radius);
    target.text+=`, nearby=${nearby}, shielded=${shielded}`;
  }
  return [...selected,...state.drops.filter(d=>Math.hypot(d[2],d[3])<=state.range+.1).slice(0,4).map(d=>({
    key:`drop_${d[0]}`,id:d[0],drop:d[1],x:d[2],y:d[3],distance:Math.hypot(d[2],d[3]),
    text:`${powers[d[1]]} pickup; expires ${round(d[4])}s`,
  }))];
}

export function combatRequest(state, config, candidates, strategy, interval) {
  const weaponChoices=Object.fromEntries(weapons.flatMap((name,i)=>(i===0||state.ammo[i]>0)&&state.disabled_weapon!==i?[[String(i),
    `${name}: ${i===1?"damage derived: one fewer standard hit than primary":`damage ${config.weapons[i].damage}`}/${config.weapons[i].interval}s, ammo${i===0?'unlimited':state.ammo[i]}; ${['straight; upgrade benefits','instant single target','slow homing','bomb plus six child shots'][i]}`]]:[]));
  return {model:'kev-latest',state:JSON.stringify({
    goal:'Survive waves. Stationary tower, aim and shoot.',
    strategy, wave:state.wave, hp:round(state.hp), maxHP:state.max_hp, coins:round(state.coins),
    enemiesAlive:state.enemies.length, shotsInFlight:state.shots.length,
    attackSpeed:round(state.values[0]), projectileUpgrades:{multishot:round(state.values[2]),rapid:round(state.values[4]),bounce:round(state.values[6])},
    deathWaveCharges:state.charges, energyShieldCharges:state.shields??0, powers:state.powers.map((time,i)=>time>0?`${powers[i]} ${round(time)}s`:null).filter(Boolean),
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
    rules:'Max HP also heals by the added amount. HP regeneration heals during combat. Orb speed requires an orb. Multishot quantity requires multishot chance. Rapid duration requires rapid chance. Bounce range and targets require bounce chance. Overheal expands Recovery Package capacity. Coins multiply future earnings but do not help current survival. Enemy HP stays fixed; waves bring more enemies faster. Spawns cover all directions from wave one.',
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

export function baselineAction(state, config, candidates, aim='nearest', circleSeconds=2) {
  if(aim==='circle') {
    const angle=state.time*Math.PI*2/circleSeconds;
    return {target:'circle',pointer:[Math.cos(angle)*state.range*.9,Math.sin(angle)*state.range*.9],weapon:0,deathWave:false};
  }
  if(aim==='idle')return {target:'hold',weapon:0,deathWave:false};
  const imminent=candidates.find(t=>t.drop===undefined&&t.danger<1.2);
  const pickup=candidates.find(t=>t.drop===7&&state.hp<state.max_hp)||candidates.find(t=>t.drop===8&&state.charges<3)||candidates.find(t=>t.drop!==undefined);
  const boss=candidates.find(t=>t.kind===12);
  const priority=aim==='priority'?candidates.find(t=>t.kind===7&&t.charge>.6)||candidates.find(t=>[6,10,11].includes(t.kind)&&t.danger<1)||candidates.find(t=>t.kind===4)||candidates.find(t=>t.kind===9):undefined;
  const target=priority||imminent||(aim==='priority'?boss:undefined)||pickup||candidates.find(t=>t.drop===undefined);
  let weapon=0;
  const available=i=>state.ammo[i]>0&&state.disabled_weapon!==i;
  if(target?.drop===undefined&&target) {
    if(available(2)&&target.hp>=30)weapon=2;
    else if(available(3)&&candidates.filter(t=>t.drop===undefined&&Math.hypot(t.x-target.x,t.y-target.y)<80).length>=4)weapon=3;
    else if(available(1)&&(target.danger<2||[3,4,6,7,9,10,11].includes(target.kind)))weapon=1;
    else if(available(2)&&target.hp>=7)weapon=2;
  }
  if(target?.kind!==undefined) {
    const matchup=config.enemies[target.kind].weapon_damage;
    if(target.kind===8&&matchup[0]>matchup[1])weapon=0;
    else if(available(1)&&matchup[1]>matchup[2])weapon=1;
    else if(available(2)&&matchup[2]>matchup[1])weapon=2;
  }
  return {target:target?.key||'hold',weapon,deathWave:state.charges>0&&(state.hp<state.max_hp*.35||candidates.filter(t=>t.danger<2).length>=6||!!boss&&boss.hp>150&&state.enemies.length>=6)};
}

export function baselinePurchase(state, config, strategy, excluded=-1) {
  if(strategy==='none')return -1;
  const orders={
    balanced:[0,11,14,12,22,2,9,19,6,23,16,18,1,13,4,21,15,17,3,8,20,10,7,5,24],
    offense:[0,2,6,4,22,23,14,1,3,8,15,11,12,9,19,21,16,18,10,17,13,20,7,5,24],
    defense:[11,12,14,9,18,13,16,20,21,0,10,17,15,2,6,19,22,23,1,4,3,8,7,5,24],
    economy:[19,0,14,11,12,21,23,22,2,6,9,16,18,1,13,4,20,15,17,3,8,10,7,5,24],
  };
  const order=(orders[strategy]||orders.balanced).filter(i=>i<config.upgrades.length);
  const specialties={offense:[0,2,3,4,5,6,7,8],defense:[9,10,11,12,13,14,15,16,17,18,24],economy:[19]};
  const dependencies={3:2,5:4,7:6,8:6,15:14};
  const eligible=order.filter(i=>i!==excluded&&state.levels[i]<config.upgrades[i].cap&&state.costs[i]<=state.coins&&(!(i in dependencies)||state.levels[dependencies[i]]>0));
  if(!eligible.length)return -1;
  return eligible.sort((a,b)=>{
    const score=i=>order.indexOf(i)+state.levels[i]*(specialties[strategy]?.includes(i)?1.2:4)+(i===11&&state.hp<state.max_hp*.6?-12:0);
    return score(a)-score(b);
  })[0];
}

export function baselineWeapon(state, preferred, mode='all') {
  const modes={projectile:0,light:1,missile:2,hook:3};
  if(mode==='all')return preferred;
  const chosen=mode==='rotate'?Math.floor(state.time/4)%4:modes[mode];
  if(chosen===undefined)throw new Error(`Unknown baseline weapon mode: ${mode}`);
  // Exhaustion deliberately returns to unlimited Projectiles, rather than firing empty weapons.
  return chosen===0 || state.ammo[chosen]>0&&state.disabled_weapon!==chosen ? chosen:0;
}

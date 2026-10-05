export const priorityRules = [
  {id:'danger',label:'Tower Threats'}, {id:'ranged',label:'Ranged Attackers'},
  {id:'fast',label:'Fast Enemies'}, {id:'boss',label:'Bosses & Elites'},
  {id:'pickups',label:'Powerups'}, {id:'closest',label:'Closest'},
  {id:'weakest',label:'Weakest'}, {id:'strongest',label:'Strongest'},
];
export function defaultAimPreferences(enabled=false) {return {enabled,rules:priorityRules.map(r=>({id:r.id,enabled:!['weakest','strongest'].includes(r.id)}))};}
export function validateAimPreferences(value, fallback=false) {
  if(!value || typeof value.enabled!=='boolean' || !Array.isArray(value.rules) || value.rules.length!==priorityRules.length || new Set(value.rules.map(r=>r?.id)).size!==priorityRules.length || value.rules.some(r=>!priorityRules.some(p=>p.id===r?.id)||typeof r.enabled!=='boolean'))return defaultAimPreferences(fallback);
  return {enabled:value.enabled,rules:value.rules.map(r=>({id:r.id,enabled:r.enabled}))};
}
export function aimTarget(s,rules,weapon=0,config) {
  const targets=s.enemies.filter(e=>e[4]>0 && (weapon!==1 || Math.hypot(e[2],e[3])<=s.range)).map(e=>({id:e[0],kind:e[1],x:e[2],y:e[3],hp:e[4],drop:false}));
  if(rules.some(r=>r.id==='pickups'&&r.enabled))for(const d of s.drops)if(d[4]>0&&Math.hypot(d[2],d[3])<=s.range)targets.push({id:d[0],kind:-1,x:d[2],y:d[3],hp:0,drop:true});
  const distance=t=>Math.hypot(t.x,t.y);
  function rank(t,id){switch(id){
    case 'danger':{
      if(t.drop)return 100000;
      const enemy=config?.enemies[t.kind];
      if(!enemy)return distance(t)<s.range*.6?distance(t)/Math.max(1,s.range):100000;
      // Ranged units stop at the range line; approaching crowds need room to react.
      if([3,6,7,11].includes(t.kind)&&distance(t)>100)return 100000;
      const contact=Math.max(0,distance(t)-(config.tower_radius??41)-(enemy.radius??17))/Math.max(1,enemy.speed*(s.speed_multiplier??1));
      return contact<=2.5?contact:100000;
    }
    case 'ranged':return [3,6,7,11].includes(t.kind)?0:1;
    case 'fast':return t.kind===1?0:1;
    case 'boss':return [5,6,7,8,9,10,11,12].includes(t.kind)?0:1;
    case 'pickups':return t.drop?0:1;
    case 'closest':return distance(t);
    case 'weakest':return t.drop?Infinity:t.hp;
    case 'strongest':return t.drop?Infinity:-t.hp;
    default:return 0;
  }}
  targets.sort((a,b)=>{for(const r of rules){if(!r.enabled)continue;const delta=rank(a,r.id)-rank(b,r.id);if(delta)return delta;}return distance(a)-distance(b)||a.id-b.id;});
  return targets[0]??null;
}

/** Shared by normal gameplay and the balance audit; no privileged future observations. */
export class AutoAimController {
  constructor(){this.reset();}
  reset(){this.position=[0,-220];this.targetId=-1;this.wait=0;}
  step(s,config,rules,dt){
    const target=aimTarget(s,rules,0,config);
    if(!target)return {aim:[...this.position],weapon:0,fire:false,targetId:-1};
    const unlock=Math.floor(s.values[32]),distanceToTarget=Math.hypot(target.x,target.y);
    const threat=[2,4,5,6,7,8,9,10,11,12].includes(target.kind);
    const clustered=s.enemies.filter(e=>e[4]>0&&Math.hypot(e[2]-target.x,e[3]-target.y)<config.bomb_radius*2).length>=5;
    let weapon=unlock>=1&&s.ammo[1]>0&&distanceToTarget<=s.range*s.values[30]?1:0;
    if(!target.drop&&unlock>=2&&s.ammo[2]>0&&threat&&target.hp>config.weapons[0].damage*3)weapon=2;
    if(!target.drop&&unlock>=3&&s.ammo[3]>0&&(clustered||[5,12].includes(target.kind))&&target.hp>config.weapons[0].damage*8&&!s.shots.some(shot=>shot[1]===3||shot[1]===4))weapon=3;
    if(s.disabled_weapon===weapon)weapon=0;
    if(s.disabled_weapon===weapon)return {aim:[...this.position],weapon,fire:false,targetId:target.id};
    let x=target.x,y=target.y;
    if(weapon===0&&!target.drop){const e=s.enemies.find(e=>e[0]===target.id);if(e&&e[6]<=0){const distance=Math.hypot(x,y),flight=distance/config.weapons[0].speed;
      const move=config.enemies[target.kind].speed*s.speed_multiplier*flight,scale=Math.max(0,(distance-move)/Math.max(1,distance));x*=scale;y*=scale;}}
    const distance=Math.hypot(x,y),range=s.range*(weapon<=1?s.values[30]:1),scale=Math.min(1,range/Math.max(1,distance));x*=scale;y*=scale;
    if(target.id!==this.targetId){this.targetId=target.id;this.wait=.09;}
    this.wait=Math.max(0,this.wait-dt);
    const dx=x-this.position[0],dy=y-this.position[1],travel=Math.hypot(dx,dy),step=Math.min(1,s.values[31]*dt/Math.max(1,travel));
    this.position=[this.position[0]+dx*step,this.position[1]+dy*step];
    return {aim:[...this.position],weapon,fire:this.wait===0&&travel<8,targetId:target.id};
  }
}

import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve, dirname} from 'node:path';

// Generation-only evidence model. No WASM, gameplay controller, GPU or local model.
// Reproduce with: node scripts/audit-power-supply.mjs
// Exact reproduction of a captured config: node scripts/audit-power-supply.mjs --snapshot
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const here=resolve(root,'playtest-results/power-supply');
const raw=await readFile(process.argv.includes('--snapshot')?resolve(here,'balance.snapshot.json'):resolve(root,'engine/balance.json'),'utf8');
const c=JSON.parse(raw);
if(c.power_workshop.upgrades[14].name!=='Pulsar Harvester')throw new Error('This audit requires Pulsar Harvester, not Galaxy Compressor');
await mkdir(here,{recursive:true});
await writeFile(resolve(here,'balance.snapshot.json'),raw);
const hash=createHash('sha256').update(raw).digest('hex');
const seeds=[7,17,101,999],duration=180000,waves=[160,300];
const profiles=[
  {name:'base-equal',chanceLevel:0,durationLevel:0,weightLevel:0,effectLevel:0,focus:[]},
  {name:'mid-equal',chanceLevel:10,durationLevel:10,weightLevel:2,effectLevel:4,focus:[]},
  {name:'max-equal',chanceLevel:20,durationLevel:20,weightLevel:5,effectLevel:8,focus:[]},
  {name:'max-focus-chrono-ph',chanceLevel:20,durationLevel:20,weightLevel:0,effectLevel:8,focus:[1,14]},
  {name:'max-focus-dp-ph',chanceLevel:20,durationLevel:20,weightLevel:0,effectLevel:8,focus:[12,14]},
];
const stat=(i,level)=>c.upgrades[i].base+c.upgrades[i].step*level;
const weight=(i,profile)=>{const u=c.power_workshop.upgrades[i];return u.weight+u.weight_step*(profile.focus.includes(i)?u.weight_costs.length:profile.weightLevel);};
const effect=(i,profile)=>{const u=c.power_workshop.upgrades[i];return u.effect_base+u.effect_step*Math.min(profile.name.startsWith('max')?u.effect_costs.length:profile.effectLevel,u.effect_costs.length);};
function waveModel(wave,profile){
  const p=c.waves.milestones.find(row=>row.wave===wave);
  const eliteTypes=[6,7,8].filter(i=>c.enemies[i].unlock<=wave);
  const scatterFraction=eliteTypes.includes(8)?1/eliteTypes.length:0;
  const elites=eliteTypes.length?p.elite_per_wave:0;
  const fleet=p.fleet_per_wave*[9,10,11].filter(i=>c.enemies[i].unlock<=wave).length;
  const protectors=c.enemies[4].unlock<=wave?p.protector_chance:0;
  const bosses=wave%c.waves.boss_every===0?Math.round(p.bosses):0;
  const superboss=wave%10===0?1:0;
  // Expected kills include all possible Scatter children. DW suppression lowers supply.
  const expectedKills=Math.ceil(p.count)+elites+elites*scatterFraction*c.specials.scatter_children+fleet+protectors+bosses+superboss;
  // Mirrors reviewed World::power_drop_scale: all elite slots count toward the
  // conservative Scatter-child denominator, even though only some are Scatter.
  const denominator=p.count+(wave>=c.enemies[8].unlock?p.elite_per_wave*c.specials.scatter_children:0);
  const scale=Math.min(1,c.powers.drop_reference_kills/Math.max(1,denominator));
  const chance=stat(21,profile.chanceLevel)*scale;
  const rate=expectedKills*chance/c.waves.spawn_seconds;
  const D=stat(20,profile.durationLevel);
  const seconds=c.power_workshop.upgrades.map((_,i)=>i<7?c.powers.durations[i]+D:i===10?c.powers.fallout_duration+D:i===11?c.powers.demon_duration+D:i>=12&&i<15?c.modules.durations[i-12]+D:i>=16?(i===17?effect(17,profile):c.expansion.durations[i-16])+D:0);
  const weights=c.power_workshop.upgrades.map((_,i)=>weight(i,profile));
  const total=weights.reduce((a,b)=>a+b,0);
  // Worst eligible denominator: Demon is unavailable. Nexus adds three grants.
  const minimumTotal=total-weights[11];
  const nexusMultiplier=effect(15,profile);
  return {nexusMultiplier,wave,expectedKills,denominator,scale,chance,rate,dropsPerWave:rate*c.waves.spawn_seconds,seconds,weights,
    bounds:c.power_workshop.upgrades.map((u,i)=>({power:u.name,duration:seconds[i],supplyUpperBound:seconds[i]===0?null:
      i===11?seconds[i]/c.powers.demon_drop_interval:
      rate*seconds[i]*(weights[i]+([3,4,6].includes(i)?weights[15]*nexusMultiplier:0))/minimumTotal}))};
}
function simulate(model,seed){
  const timers=Array(c.power_workshop.upgrades.length).fill(0),busy=Array(c.power_workshop.upgrades.length).fill(0),generated=Array(c.power_workshop.upgrades.length).fill(0),supply=Array(c.power_workshop.upgrades.length).fill(0),maxBank=Array(c.power_workshop.upgrades.length).fill(0),nominal=Array(c.power_workshop.upgrades.length).fill(0),discarded=Array(c.power_workshop.upgrades.length).fill(0);
  let last=0,demonUntil=0,rng=seed>>>0,invulnerability=0,invulnerabilityBusy=0;
  const random=()=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/4294967296;};
  const burn=t=>{const dt=t-last;for(let i=0;i<c.power_workshop.upgrades.length;i++){busy[i]+=Math.min(dt,timers[i]);timers[i]=Math.max(0,timers[i]-dt);}invulnerabilityBusy+=Math.min(dt,invulnerability);invulnerability=Math.max(0,invulnerability-dt);last=t;};
  const interval=1/model.rate;
  for(let ordinal=1;ordinal*interval<=duration;ordinal++){
    const t=ordinal*interval;burn(t);
    const eligible=model.weights.map((w,i)=>i===11&&t+1e-9<demonUntil?0:w);
    let pick=random()*eligible.reduce((a,b)=>a+b,0),chosen=15;
    for(let i=0;i<c.power_workshop.upgrades.length;i++){pick-=eligible[i];if(pick<0){chosen=i;break;}}
    generated[chosen]++;
    if(chosen===11){demonUntil=t+c.powers.demon_drop_interval;invulnerability=Math.min(c.powers.timer_cap,invulnerability+c.powers.demon_invincible_duration);}
    for(const power of chosen===15?[3,4,6]:[chosen]){
      const grant=model.seconds[power]*(chosen===15?model.nexusMultiplier:1);
      const accepted=Math.min(grant,c.powers.timer_cap-timers[power]);
      nominal[power]+=grant;discarded[power]+=grant-accepted;
      timers[power]+=accepted;supply[power]+=accepted;maxBank[power]=Math.max(maxBank[power],timers[power]);
    }
  }
  burn(duration);
  for(let i=0;i<c.power_workshop.upgrades.length;i++)if(Math.abs(supply[i]-busy[i]-timers[i])>1e-5)throw new Error('Duration accounting invariant failed');
  return {seed,duration,invulnerabilityUptime:invulnerabilityBusy/duration,powers:c.power_workshop.upgrades.map((u,i)=>({power:u.name,generated:generated[i],
    uptime:model.seconds[i]>0?busy[i]/duration:null,supplyPerSecond:supply[i]/duration,nominalSupplyPerSecond:nominal[i]/duration,discardedDuration:discarded[i],
    nominalNetDrift:model.seconds[i]>0?nominal[i]/duration-1:null,
    finalBank:timers[i],maxBank:maxBank[i]}))};
}
const rows=[];
for(const wave of waves)for(const profile of profiles){const model=waveModel(wave,profile);rows.push({profile,model,runs:seeds.map(seed=>simulate(model,seed))});}
for(const row of rows.filter(row=>row.profile.name==='max-equal')){
  if(row.runs.some(run=>run.powers.some(power=>power.maxBank>c.powers.timer_cap+1e-6)))throw new Error('Power timer cap exceeded');
  if(row.model.bounds.some(power=>power.supplyUpperBound!==null&&power.supplyUpperBound>=1))throw new Error('General power build has unbounded timer growth');
}
const result={schema:3,configSha256:hash,simulationSeconds:duration,seeds,
  assumptions:['Fixed wave repeated; not a survival/progression simulation.','All kills occur and every generated pickup is collected immediately.','Uniform generation timing represents deterministic proc-credit supply; real clustered kill timing can change uptime and peak banks.','Wave length is minimum spawn_seconds=30; extra cleanup decreases supply per second.','All Scatter children die; Death Wave suppression reduces actual generation.','Effect upgrades besides duration affect combat, not timer grants; PH has no GC extension.','Weight profiles retain the configured lower Death Wave weight. Equal means equal upgrade levels, not identical final weights.','Multiverse Nexus grants GT, SL and BH together, including its duration multiplier. Bounds assume Demon is unavailable; only max-equal general builds are guarded, not every specialization.', 'Each duration bank is capped at '+c.powers.timer_cap+' seconds; excess grants are discarded and recorded. Purchased Supplies are not simulated.', 'Untimed powers are generated but no survival/charge-cap utility is simulated.'],rows};
await writeFile(resolve(here,'results.json'),JSON.stringify(result,null,2)+'\n');
const csv=['wave,profile,power,supply_upper_bound,observed_supply_min,observed_supply_max,uptime_min,uptime_max,final_bank_min_s,final_bank_max_s'];
for(const row of rows)for(let i=0;i<c.power_workshop.upgrades.length;i++){const a=row.model.bounds[i];if(a.supplyUpperBound===null)continue;const samples=row.runs.map(r=>r.powers[i]);csv.push([row.model.wave,row.profile.name,a.power,a.supplyUpperBound,Math.min(...samples.map(s=>s.supplyPerSecond)),Math.max(...samples.map(s=>s.supplyPerSecond)),Math.min(...samples.map(s=>s.uptime)),Math.max(...samples.map(s=>s.uptime)),Math.min(...samples.map(s=>s.finalBank)),Math.max(...samples.map(s=>s.finalBank))].join(','));}
await writeFile(resolve(here,'summary.csv'),csv.join('\n')+'\n');
const percent=n=>(100*n).toFixed(1)+'%';
const span=(row,i)=>{const values=row.runs.map(r=>r.powers[i].uptime);return percent(Math.min(...values))+'–'+percent(Math.max(...values));};
const report=['# Pulsar Harvester generation audit','',`Config SHA-256: \`${hash}\`. Reproduce: \`node scripts/audit-power-supply.mjs --snapshot\`.`,
  '',`Generation-only model; ${duration.toLocaleString()} simulated seconds per run, four seeds, two fixed waves, five build profiles. No WASM, GPU or gameplay survival claims.`,
  '',...result.assumptions.map(s=>'- '+s),'',
  '| Wave | Build | Drops/wave | Chrono uptime | DP uptime | PH uptime | Chrono bound | DP bound | PH bound |',
  '|---:|---|---:|---:|---:|---:|---:|---:|---:|'];
for(const row of rows)report.push(`| ${row.model.wave} | ${row.profile.name} | ${row.model.dropsPerWave.toFixed(3)} | ${span(row,1)} | ${span(row,12)} | ${span(row,14)} | ${row.model.bounds[1].supplyUpperBound.toFixed(3)} | ${row.model.bounds[12].supplyUpperBound.toFixed(3)} | ${row.model.bounds[14].supplyUpperBound.toFixed(3)} |`);
report.push('','Supply is duration seconds granted per combat second. Nominal supply above one means excess time can be discarded at the 50-second bank cap. Accepted supply and discarded seconds are recorded separately. Final bank alone is not evidence of balanced uptime.','',
  'Maximum equal investment stays below one granted duration second per combat second even under the conservative upper bounds. Focused investment raises uptime, with all remaining time bounded at 50 seconds.', '',
  'Base/mid/max use Power Duration levels 0/10/20 and Power Drop Chance levels 0/10/20; equal-weight upgrade levels are 0/2/5. Max-focus profiles use maximum chance/duration, maximum weight for exactly the two named powers, and base weights for all other powers. Effect levels are zero, four, or each power’s maximum; PH proc effects do not add duration.','',
  'Native PH sanity review: activate() grants ordinary module duration plus Power Duration without extensions; direct weapon hits and bomb children can proc PH, while passive sources cannot. Each proc multiplies enemy mobility by 0.95, bounded below at 0.25. Movement multiplies by mobility; Black Hole pull, Shockwave and Knockback divide by it, giving at most four times the push/pull from this modifier. New enemies and legacy saves default to 1.0 mobility; restored values are validated against the configured floor. The configured 2.5% base and 4.5% maximum proc chances fit the workshop domain. No obvious sign, zero-division or duration-extension error was found. Debuffs persist on surviving enemies after PH expires; that is the current mechanic.','',
  'Files: balance.snapshot.json captures the audited config; results.json preserves every seed/power; summary.csv contains conservative supply bounds and observed uptime/bank ranges.');
await writeFile(resolve(here,'report.md'),report.join('\n')+'\n');
console.log(report.slice(report.indexOf('| Wave | Build | Drops/wave | Chrono uptime | DP uptime | PH uptime | Chrono bound | DP bound | PH bound |')).join('\n'));

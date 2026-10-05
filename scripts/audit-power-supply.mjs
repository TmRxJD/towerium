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
  const seconds=c.power_workshop.upgrades.map((_,i)=>i<7?c.powers.durations[i]+D:i===10?c.powers.fallout_duration+D:i===11?c.powers.demon_duration+D:i>=12?c.modules.durations[i-12]+D:0);
  const weights=c.power_workshop.upgrades.map((_,i)=>weight(i,profile));
  const total=weights.reduce((a,b)=>a+b,0),wd=weights[11];
  // For evenly spaced generation events, a Demon event is followed by B
  // ineligible events and then a geometric wait with mean total/wd.
  const blocked=Math.max(0,Math.ceil(c.powers.demon_drop_interval*rate-1e-10)-1);
  const demonRate=rate/(blocked+total/wd);
  const expectedRates=weights.map((w,i)=>i===11?demonRate:(rate-demonRate)*w/(total-wd));
  return {wave,expectedKills,denominator,scale,chance,rate,dropsPerWave:rate*c.waves.spawn_seconds,seconds,weights,
    analytic:c.power_workshop.upgrades.map((u,i)=>({power:u.name,rate:expectedRates[i],duration:seconds[i],supplyPerSecond:expectedRates[i]*seconds[i],
      nominalNetDrift:seconds[i]>0?expectedRates[i]*seconds[i]-1:null,
      asymptoticBankGrowth:seconds[i]>0?Math.max(0,expectedRates[i]*seconds[i]-1):null,
      uptime:seconds[i]>0?Math.min(1,expectedRates[i]*seconds[i]):null}))};
}
function simulate(model,seed){
  const timers=Array(16).fill(0),busy=Array(16).fill(0),generated=Array(16).fill(0),supply=Array(16).fill(0),maxBank=Array(16).fill(0);
  let last=0,demonUntil=0,rng=seed>>>0,invulnerability=0,invulnerabilityBusy=0;
  const random=()=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/4294967296;};
  const burn=t=>{const dt=t-last;for(let i=0;i<16;i++){busy[i]+=Math.min(dt,timers[i]);timers[i]=Math.max(0,timers[i]-dt);}invulnerabilityBusy+=Math.min(dt,invulnerability);invulnerability=Math.max(0,invulnerability-dt);last=t;};
  const interval=1/model.rate;
  for(let ordinal=1;ordinal*interval<=duration;ordinal++){
    const t=ordinal*interval;burn(t);
    const eligible=model.weights.map((w,i)=>i===11&&t+1e-9<demonUntil?0:w);
    let pick=random()*eligible.reduce((a,b)=>a+b,0),chosen=15;
    for(let i=0;i<16;i++){pick-=eligible[i];if(pick<0){chosen=i;break;}}
    generated[chosen]++;
    if(chosen===11){demonUntil=t+c.powers.demon_drop_interval;invulnerability+=c.powers.demon_invincible_duration;}
    timers[chosen]+=model.seconds[chosen];supply[chosen]+=model.seconds[chosen];
    maxBank[chosen]=Math.max(maxBank[chosen],timers[chosen]);
  }
  burn(duration);
  for(let i=0;i<16;i++)if(Math.abs(supply[i]-busy[i]-timers[i])>1e-5)throw new Error('Duration accounting invariant failed');
  return {seed,duration,invulnerabilityUptime:invulnerabilityBusy/duration,powers:c.power_workshop.upgrades.map((u,i)=>({power:u.name,generated:generated[i],
    uptime:model.seconds[i]>0?busy[i]/duration:null,supplyPerSecond:supply[i]/duration,
    nominalNetDrift:model.seconds[i]>0?supply[i]/duration-1:null,
    finalBank:timers[i],maxBank:maxBank[i]}))};
}
const rows=[];
for(const wave of waves)for(const profile of profiles){const model=waveModel(wave,profile);rows.push({profile,model,runs:seeds.map(seed=>simulate(model,seed))});}
for(const row of rows.filter(row=>row.profile.name==='max-equal')){
  if(row.model.analytic.some(power=>power.uptime!==null&&power.asymptoticBankGrowth>0))throw new Error('General power build has unbounded timer growth');
}
const result={schema:1,configSha256:hash,simulationSeconds:duration,seeds,
  assumptions:['Fixed wave repeated; not a survival/progression simulation.','All kills occur and every generated pickup is collected immediately.','Uniform generation timing represents deterministic proc-credit supply; real clustered kill timing can change uptime and peak banks.','Wave length is minimum spawn_seconds=30; extra cleanup decreases supply per second.','All Scatter children die; Death Wave suppression reduces actual generation.','Effect upgrades besides duration affect combat, not timer grants; PH has no GC extension.','Weight profiles retain the configured lower Death Wave weight. Equal means equal upgrade levels, not identical final weights.','Untimed powers are generated but no survival/charge-cap utility is simulated.'],rows};
await writeFile(resolve(here,'results.json'),JSON.stringify(result,null,2)+'\n');
const csv=['wave,profile,power,analytic_supply_s_per_s,analytic_net_drift_s_per_s,analytic_bank_growth_s_per_s,uptime_min,uptime_max,final_bank_min_s,final_bank_max_s'];
for(const row of rows)for(let i=0;i<16;i++){const a=row.model.analytic[i];if(a.uptime===null)continue;const samples=row.runs.map(r=>r.powers[i]);csv.push([row.model.wave,row.profile.name,a.power,a.supplyPerSecond,a.nominalNetDrift,a.asymptoticBankGrowth,Math.min(...samples.map(s=>s.uptime)),Math.max(...samples.map(s=>s.uptime)),Math.min(...samples.map(s=>s.finalBank)),Math.max(...samples.map(s=>s.finalBank))].join(','));}
await writeFile(resolve(here,'summary.csv'),csv.join('\n')+'\n');
const percent=n=>(100*n).toFixed(1)+'%';
const span=(row,i)=>{const values=row.runs.map(r=>r.powers[i].uptime);return percent(Math.min(...values))+'–'+percent(Math.max(...values));};
const report=['# Pulsar Harvester generation audit','',`Config SHA-256: \`${hash}\`. Reproduce: \`node scripts/audit-power-supply.mjs --snapshot\`.`,
  '',`Generation-only model; ${duration.toLocaleString()} simulated seconds per run, four seeds, two fixed waves, five build profiles. No WASM, GPU or gameplay survival claims.`,
  '',...result.assumptions.map(s=>'- '+s),'',
  '| Wave | Build | Drops/wave | Chrono uptime | DP uptime | PH uptime | Chrono supply | DP supply | PH supply |',
  '|---:|---|---:|---:|---:|---:|---:|---:|---:|'];
for(const row of rows)report.push(`| ${row.model.wave} | ${row.profile.name} | ${row.model.dropsPerWave.toFixed(3)} | ${span(row,1)} | ${span(row,12)} | ${span(row,14)} | ${row.model.analytic[1].supplyPerSecond.toFixed(3)} | ${row.model.analytic[12].supplyPerSecond.toFixed(3)} | ${row.model.analytic[14].supplyPerSecond.toFixed(3)} |`);
report.push('','Supply is duration seconds granted per combat second. Net drift above zero means a growing unlimited bank once active; negative nominal drift means a stable queue that still forms temporary random stacks. Final bank alone is not evidence of instability.','',
  'At maximum equal weights, ordinary modules have about -0.330 seconds/second nominal drift and Chrono about -0.571: neither has positive asymptotic bank growth. With DP and PH alone receiving maximum weights, both have about +0.180 seconds/second drift (roughly +5.4 bank seconds per 30-second wave). Specializing Chrono and PH sustains PH, but Chrono remains about 75% active after removal of GC extensions.','',
  'Base/mid/max use Power Duration levels 0/10/20 and Power Drop Chance levels 0/10/20; equal-weight upgrade levels are 0/2/5. Max-focus profiles use maximum chance/duration, maximum weight for exactly the two named powers, and base weights for all other powers. Effect levels are 0/4/8; PH proc effects do not add duration.','',
  'Native PH sanity review: activate() grants ordinary module duration plus Power Duration without extensions; direct weapon hits and bomb children can proc PH, while passive sources cannot. Each proc multiplies enemy mobility by 0.95, bounded below at 0.25. Movement multiplies by mobility; Black Hole pull, Shockwave and Knockback divide by it, giving at most four times the push/pull from this modifier. New enemies and legacy saves default to 1.0 mobility; restored values are validated against the configured floor. The configured 2.5% base and 4.5% maximum proc chances fit the workshop domain. No obvious sign, zero-division or duration-extension error was found. Debuffs persist on surviving enemies after PH expires; that is the current mechanic.','',
  'Files: balance.snapshot.json captures the audited config; results.json preserves every seed/power; summary.csv contains analytic drift and observed uptime/bank ranges.');
await writeFile(resolve(here,'report.md'),report.join('\n')+'\n');
console.log(report.slice(report.indexOf('| Wave | Build | Drops/wave | Chrono uptime | DP uptime | PH uptime | Chrono supply | DP supply | PH supply |')).join('\n'));

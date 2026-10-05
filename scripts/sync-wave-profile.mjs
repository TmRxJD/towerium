import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { enemySpeedWaveMult, enemyMassWaveMult, waveInfoEnemySpeed, waveInfoEnemyMass,
  enemySpawnRateCapFromWaveAcceleratorChart, expectedEnemiesPerWaveFromQuantumV29,
  newWaveEnemyDoubleSpawnThresholdV29, expectedEliteKillsPerWave, fleetSpawnSchedule,
  waveInfoSpawnChancePct } from 'thetowersdk/mechanics';

const tier=14, targetWaves=400;
const sdkSource=resolve(process.env.TOWER_SDK_SOURCE??'../TrackerWebsite/the-tower-run-tracker/packages/sdk');
const compositionPath=resolve(process.env.TOWER_COMPOSITION_SOURCE??'../tower-extractor/facts/v29.0.0/wave-composition.json');
const balancePath=resolve('engine/balance.json');
const balance=JSON.parse(readFileSync(balancePath,'utf8'));
const composition=JSON.parse(readFileSync(compositionPath,'utf8')).composition.byWave;
const fields=['chanceNormalEnemy','chanceFastEnemy','chanceTankEnemy','chanceRangedEnemy'];
const mixes=Object.entries(composition).map(([wave,row])=>({wave:Number(wave),weights:fields.map(field=>row[field]?.value)}))
  .filter(row=>row.weights.every(Number.isFinite)&&Math.abs(row.weights.reduce((a,b)=>a+b,0)-100)<.001)
  .sort((a,b)=>a.wave-b.wave);
if(!mixes.length)throw new Error('No resolved ordinary composition rows');
const virtualWave=wave=>1+Math.floor((wave-1)*9999/399);
const density=wave=>wave<=10?1:wave<=50?1+(wave-10)/80:wave<=100?1.5+(wave-50)/100:2+(wave-100)/100;
const fleet=fleetSpawnSchedule(tier);
const fleetGroups=wave=>!fleet||wave<fleet.firstWave?0:1+Math.floor((wave-fleet.firstWave)/fleet.repeatEveryWaves);
const baseSpeed=enemySpeedWaveMult(1,tier);
const profile=Array.from({length:targetWaves},(_,index)=>{
  const wave=index+1, sdkWave=virtualWave(wave);
  const ordinary=expectedEnemiesPerWaveFromQuantumV29({waveLengthSeconds:30,
    enemySpawnChanceThreshold:enemySpawnRateCapFromWaveAcceleratorChart({wave:sdkWave,waveAcceleratorMastery:null}),
    enemyDoubleSpawnThreshold:newWaveEnemyDoubleSpawnThresholdV29({tier}),enemyBalanceMult:1,moreEnemiesResistance:1});
  const mix=mixes.findLast(row=>row.wave<=sdkWave);
  const weights=[...(mix?.weights??[100,0,0,0]),0,0,1,1,1,1,1,1,0];
  const elites=expectedEliteKillsPerWave(tier,sdkWave);
  const fleets=(fleetGroups(sdkWave)-fleetGroups(index?virtualWave(wave-1):0))*(fleet?.fleetsPerSpawn??0);
  return {wave,sdk_wave:sdkWave,count:Math.max(8,Math.ceil(ordinary*density(wave))),bosses:1,weights,
    elite_per_wave:elites,fleet_per_wave:fleets,protector_chance:waveInfoSpawnChancePct({tier,wave:sdkWave,enemyType:'Protector'})/100,
    speed:enemySpeedWaveMult(sdkWave,tier)/baseSpeed,mass:enemyMassWaveMult(sdkWave)};
});
const basic={tier,wave:1,enemyType:'Basic'};
for(const enemy of balance.enemies){
  const input={tier,wave:1,enemyType:enemy.name==='Super Boss'?'Boss':enemy.name};
  enemy.speed=balance.enemies[0].speed*waveInfoEnemySpeed(input)/waveInfoEnemySpeed(basic);
  enemy.mass=waveInfoEnemyMass(input)/waveInfoEnemyMass(basic);
}
balance.waves={spawn_seconds:30,hp_hits_every:10,boss_every:balance.waves.boss_every,fleet_first_wave:fleet.firstWave,fleet_repeat_waves:fleet.repeatEveryWaves,milestones:profile};
delete balance.powers.golden_multiplier;
balance.coin_multipliers=Array(5).fill(1.15);
balance.modules={durations:[30,30,30,30],death_penalty_chance:.05,space_displacer_radius:120,space_displacer_speed:70,galaxy_extension:10};
delete balance.elite_reference.golden_kill_fraction;
const masks={0:.20,1:.35,3:.10,5:.10,9:.10,17:.05,7:.05,31:.05};
balance.elite_reference.overlap_fractions=Array.from({length:32},(_,mask)=>masks[mask]??0);
const expectedCoinMult=balance.elite_reference.overlap_fractions.reduce((sum,p,mask)=>sum+p*balance.coin_multipliers.reduce((mult,value,i)=>mult*((mask>>i)&1?value:1),1),0);
const originalPrices=balance.upgrades.map(upgrade=>upgrade.costs.slice());
function prices(factor){for(const [i,upgrade] of balance.upgrades.entries()){
  const preserved=Math.max(1,Math.floor(upgrade.cap/3)),anchor=originalPrices[i][preserved-1];
  upgrade.costs=originalPrices[i].map((cost,level)=>level<preserved?cost:Math.max(anchor,Math.round(anchor+(cost-anchor)*factor)));
}}
function reference(){let income=0,spend=0,level=0;const economy=balance.upgrades[19];
  for(const row of profile.slice(0,300)){
    const eligible=balance.enemies.map((enemy,i)=>i<4&&enemy.unlock<=row.wave?row.weights[i]:0),weight=eligible.reduce((a,b)=>a+b,0);
    const ordinary=eligible.reduce((sum,w,i)=>sum+w*balance.enemies[i].coins,0)/weight;
    const eliteCoins=(balance.enemies[6].coins+balance.enemies[7].coins+balance.enemies[8].coins+balance.specials.scatter_children*balance.enemies[1].coins)/3;
    const fleetCoins=balance.enemies.slice(9,12).reduce((sum,enemy)=>sum+enemy.coins,0);
    const bosses=row.wave%balance.waves.boss_every===0?row.bosses:0;
    const base=row.count*ordinary+row.elite_per_wave*eliteCoins+row.fleet_per_wave*fleetCoins+(row.wave%10===0?balance.enemies[12].coins:0)+bosses*balance.enemies[5].coins;
    income+=base*(economy.base+economy.step*level)*expectedCoinMult;
    while(level<economy.costs.length&&spend+economy.costs[level]<=income*balance.elite_reference.economy_budget_fraction){spend+=economy.costs[level++];}
  }
  return income/balance.upgrades.flatMap(upgrade=>upgrade.costs).reduce((a,b)=>a+b,0);
}
let priceFactor=existsSync('engine/wave-profile-provenance.json')?JSON.parse(readFileSync('engine/wave-profile-provenance.json','utf8')).priceCalibrationFactor:null;
if(process.argv.includes('--reprice')) {
  let low=.000001,high=1;
  for(let iteration=0;iteration<50;iteration++){const mid=(low+high)/2;prices(mid);if(reference()>1)low=mid;else high=mid;}
  priceFactor=(low+high)/2;prices(priceFactor);
}
writeFileSync(balancePath,JSON.stringify(balance,null,2)+'\n');
const sourceFiles=['src/mechanics/waves/info-panel-stats.ts','src/mechanics/enemies/type-mults.ts','src/mechanics/enemies/elite-spawn-chance.ts'];
const hash=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
writeFileSync('engine/wave-profile-provenance.json',JSON.stringify({sdkVersion:JSON.parse(readFileSync('package-lock.json','utf8')).packages['node_modules/thetowersdk'].version,tier,targetWaves,sourceEndWave:10000,
  mapping:'1 + floor((wave - 1) * 9999 / 399)',spawnSeconds:30,cardsLabsMasteries:false,
  sources:Object.fromEntries(sourceFiles.map(file=>[file,hash(resolve(sdkSource,file))])),compositionSha256:hash(compositionPath),compositionLastResolvedWave:mixes.at(-1).wave,
  adaptations:{densityKnots:[[1,1],[10,1],[50,1.5],[100,2],[200,3],[300,4],[400,5]],post400DensityPerWave:.01,minimumOrdinary:8,fleetRoster:['Commander','Saboteur','Overcharge'],superBossTypeRatios:'Boss'},priceCalibrationFactor:priceFactor,referenceOverlapFractions:masks},null,2)+'\n');
console.log(`Generated ${profile.length} SDK wave rows; reference wave300 affordability ${(reference()*100).toFixed(2)}%.`);

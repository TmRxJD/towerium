import {fork} from 'node:child_process';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import init,{Game} from '../src/wasm/towerium.js';
import {HumanController} from './human-controls.mjs';
import {AutoAimController,defaultAimPreferences,manualTargetPlan} from './auto-aim.mjs';
import {auditBuilds,auditProfiles,auditPerk,auditPurchase,auditPowerPurchase,auditAction,economyHold} from './balance-audit-policy.mjs';
import {targets,baselineSupplyPurchase} from './playtest-policy.mjs';
const root=resolve(import.meta.dirname,'..'),hash=s=>createHash('sha256').update(s).digest('hex');
const names=['balance-audit.mjs','balance-audit-policy.mjs','auto-aim.mjs','human-controls.mjs','playtest-policy.mjs','perks.mjs','aim-assist.mjs'];
async function run(job){
 const raw=await readFile(resolve(root,job.config),'utf8'),config=JSON.parse(raw),wasm=await readFile(resolve(root,'src/wasm/towerium_bg.wasm'));
 await init({module_or_path:wasm});
 const assisted=job.aim==='crowd',settings=auditProfiles[job.profile],game=Game.autoplay_start(job.seed,raw,job.start),human=new HumanController(settings),automatic=new AutoAimController(),rules=defaultAimPreferences(true).rules;
 const snapshot=()=>JSON.parse(game.snapshot());let s=snapshot(),wall=performance.now(),frames=0,lastWave=0,withheld=0,manualFrames=0,autoFrames=0,spent=0,stoneSpent=0,shopCount=0,rows=[],peakEnemies=0;
 const precisionModulus=config.precision_ammo.hits*config.precision_ammo.hook_every;
 let precisionContacts=0,precisionProgress=0;
 const sampleFrames=job.profile==='perfect'?1:3;
 while(s.phase!==3&&s.wave<=job.waves&&s.time<job.seconds&&(performance.now()-wall)/1000<job.wall){
  if(s.phase===2){
   if(!s.pending_start_wave&&lastWave!==s.wave){lastWave=s.wave;if(s.wave%50===0)process.send?.({progress:{profile:job.profile,build:job.build,seed:job.seed,wave:s.wave,time:s.time,enemies:s.enemies.length,shots:s.shots.length,memory:process.memoryUsage()}});rows.push({wave:s.wave,time:s.time,cleanup:s.cleanup_seconds,hp:s.hp,maxHp:s.max_hp,earned:s.earned,coins:s.coins,stones:s.stones,levels:s.levels,powerLevels:s.power_levels,perks:s.perks.levels,report:s.wave_report,weapons:s.weapon_report,overlap:s.coin_overlap_kills,bonus:s.coin_bonus_coins,peakEnemies});peakEnemies=0;}
   if(s.perks?.offers.length){if(!game.choose_perk(auditPerk(s,job.build)))throw new Error('Perk rejected');s=snapshot();continue;}
   if(!s.pending_start_wave&&s.wave>=job.waves)break;
   const buy=auditPurchase(s,config,job.build,assisted);
   if(buy>=0){spent+=s.costs[buy];if(!game.buy(buy))throw new Error('Workshop rejected');shopCount++;s=snapshot();continue;}
   const power=auditPowerPurchase(s,config,job.build);
   if(power){stoneSpent+=s.power_costs[power.power][power.path];if(!game.buy_power(power.power,power.path))throw new Error('Stone shop rejected');s=snapshot();continue;}
   // Supplies cannot displace affordable workshop purchases and never grant free inventory.
   const item=baselineSupplyPurchase(s,config);
   if(item!==undefined){spent+=s.supply_costs[item];if(!game.buy_supply(item))throw new Error('Supply rejected');s=snapshot();continue;}
   game.start_wave();s=snapshot();continue;
  }
  const manualSlot=settings.manualShare>0&&(settings.manualShare>=1||s.time%4<settings.manualShare*4);
  let holdAuto=false;
  if(job.build==='devo'){
   const list=targets(s,config,'crowd'),waiting=list.filter(t=>economyHold(s,config,t));
   holdAuto=waiting.length>0&&!list.some(t=>t.drop!==undefined||t.danger<3||![0,1,2].includes(t.kind));
   if(holdAuto)withheld+=sampleFrames/60;
  }
  for(let frame=0;frame<sampleFrames&&s.phase===1;frame++){
   const auto=automatic.step(s,config,rules,1/60);
   const action=human.step(s,1/60,(observed,context)=>{
    const plan=assisted&&!holdAuto?manualTargetPlan(observed,targets(observed,config,job.aim),auto.targetId):{state:observed};
    return auditAction(plan.state,config,job.build,{...context,human:!settings.reference},job.aim);
   },manualSlot);
   game.input(...action.aim,manualSlot&&action.fire,action.weapon);
   if(manualSlot){if(action.deathWave)game.death_wave();manualFrames++;}
   game.set_auto_input(...auto.aim,assisted&&!holdAuto&&auto.fire,auto.weapon);
   if(assisted&&!holdAuto&&auto.fire)autoFrames++;
   game.advance(1/60);frames++;
  }
  s=snapshot();const progress=s.precision_hit_credit+s.precision_grant_cycle*config.precision_ammo.hits;
  precisionContacts+=(progress-precisionProgress+precisionModulus)%precisionModulus;precisionProgress=progress;
  peakEnemies=Math.max(peakEnemies,s.enemies.length);
 }
 const result={build:job.build,profile:job.profile,seed:job.seed,startWave:job.start,configSha256:hash(raw),wasmSha256:hash(wasm),settings,
  outcome:s.phase===3?'death':s.phase===2&&s.wave>=job.waves?'wave-limit':s.time>=job.seconds?'time-limit':'wall-limit',wave:s.wave,cleared:s.phase===2?s.wave:s.wave-1,
  simulatedSeconds:s.time,wallSeconds:(performance.now()-wall)/1000,earned:s.earned,spent,stoneSpent,shopCount,levels:s.levels,powerLevels:s.power_levels,perks:s.perks.levels,
  overall:s.overall_report,weapons:s.weapon_report,overlapKills:s.coin_overlap_kills,bonusCoins:s.coin_bonus_coins,goldenKills:s.golden_kills,coins:s.coins,stones:s.stones,
  manualFrames,autoFrames,manualShots:s.manual_shots_fired,manualAmmoSpent:s.manual_ammo_spent,precisionContactsLowerBound:precisionContacts,manualPrimaryShots:s.manual_shots_fired-s.manual_ammo_spent.slice(1).reduce((a,b)=>a+b,0),economyWaitSeconds:withheld,rows,finalStateSha256:hash(game.save()),checkpoint:job.checkpoint?game.save():undefined};
 game.free();return result;
}
if(process.argv.includes('--audit-child')){
 process.once('message',async job=>{
  let message;
  try{message={result:await run(job)};}catch(error){message={error:error.stack??String(error)};process.exitCode=1;}
  process.send(message,()=>process.disconnect());
 });
}
else{
 const args=Object.fromEntries(process.argv.slice(2).map(a=>{const [k,...v]=a.replace(/^--/,'').split('=');return [k,v.join('=')];}));
 if('help' in args){console.log('node scripts/balance-audit.mjs --profiles=casual,skilled,pro,best,perfect --builds=glass,health,regen,hybrid,devo --seeds=101,102,103 --waves=1100 --jobs=3 --wall=600 --out=playtest-results/balance-audit\nStarts wave1 with real progression. --start=N is a synthetic funded-start diagnostic, not survival evidence. --aim=crowd|circle|idle probes cheese. --checkpoint=true preserves final native save. No inference/GPU.');process.exit(0);}
 const profiles=(args.profiles??'casual,skilled,pro,best,perfect').split(','),builds=(args.builds??Object.keys(auditBuilds).join(',')).split(','),seeds=(args.seeds??'101,102,103').split(',').map(Number);
 const bounds={waves:Number(args.waves??1100),start:Number(args.start??1),seconds:Number(args.seconds??90000),wall:Number(args.wall??600),jobs:Number(args.jobs??3)};
 if(profiles.some(p=>!auditProfiles[p])||builds.some(b=>!auditBuilds[b])||seeds.some(s=>!Number.isInteger(s)||s<0)||Object.values(bounds).some(v=>!Number.isFinite(v)||v<=0)||bounds.jobs>3||![bounds.jobs,bounds.start,bounds.waves].every(Number.isInteger)||bounds.start>bounds.waves||bounds.waves>10000||!['crowd','circle','idle'].includes(args.aim??'crowd'))throw new Error('Invalid audit arguments');
 const out=resolve(root,args.out??'playtest-results/balance-audit-'+Date.now());await mkdir(out);
 const config=args.config??'engine/balance.json',raw=await readFile(resolve(root,config));
 await mkdir(resolve(out,'harness'),{recursive:true});await mkdir(resolve(out,'src/wasm'),{recursive:true});
 for(const name of names)await writeFile(resolve(out,'harness',name),await readFile(resolve(root,'scripts',name)));
 for(const name of ['towerium.js','towerium_bg.wasm'])await writeFile(resolve(out,'src/wasm',name),await readFile(resolve(root,'src/wasm',name)));
 const metadata={schema:2,execution:'isolated-child-processes',runtime:{node:process.version,platform:process.platform,arch:process.arch},configSha256:hash(raw),harnessHashes:Object.fromEntries(await Promise.all(names.map(async n=>[n,hash(await readFile(resolve(root,'scripts',n)))]))),profiles,builds,seeds,...bounds,aim:args.aim??'crowd',assumptions:['Actual WASM gameplay, real purchases and seeded perk choices; no free upgrades after starting.','Normal assisted cannon uses the exact UI controller and native reduced-stat input. Manual firing uses full stats.','Manual effort is a declared fraction of four-second periods. The independent automatic cannon remains enabled during manual firing. This is not a measured human population.','Non-perfect observations every50ms; reaction, traversal and switching are separately constrained. Perfect observes every engine tick.','No random aim errors or fatigue: human labels are proxies, not proof of attainability.','Devo delays safe cheap targets, preserves tanks and waits for visible coin-overlap opportunities; passive defenses remain active.','Precision contacts are measured from native modulo progress; batched multiples of the modulus can be missed, so this is a lower bound. Aggregate accuracy includes both cannons; manual ammo/shot counters remain separate.',
'Circle and idle controls disable the independent cannon to isolate manual aim; auto-only crowd profiles measure assisted low-effort survival.',
'One baseline policy cannot bound the best possible strategy. Death/time/wall outcomes are distinguished; censored runs are not wins.','Funded starts are diagnostic only; wave1 runs measure progression.']};
 await writeFile(resolve(out,'metadata.json'),JSON.stringify(metadata,null,2));await writeFile(resolve(out,'balance.snapshot.json'),raw);
 const queue=profiles.flatMap(profile=>builds.flatMap(build=>seeds.map(seed=>({...bounds,profile,build,seed,config:'balance.snapshot.json',aim:args.aim??'crowd',checkpoint:args.checkpoint==='true'})))),results=[];
 let saves=Promise.resolve();
 const save=()=>{saves=saves.then(async()=>{
  const temporary=resolve(out,'results.pending.json');
  await writeFile(temporary,JSON.stringify({metadata,runs:results},null,2));
  await rename(temporary,resolve(out,'results.json'));
 });return saves;};
 await Promise.all(Array.from({length:bounds.jobs},async()=>{while(queue.length){
  const job=queue.shift();
  const result=await new Promise(ok=>{
   const child=fork(resolve(out,'harness/balance-audit.mjs'),['--audit-child'],{stdio:['ignore','ignore','pipe','ipc']});
   let completed,error,lastProgress,stderr='',progressWrites=Promise.resolve();
   const watchdog=setTimeout(()=>{error='Audit child exceeded parent watchdog';child.kill();},(job.wall+30)*1000);
   child.stderr.on('data',chunk=>{stderr=(stderr+chunk.toString()).slice(-65536);});
   child.on('message',m=>{
    if(m.progress){lastProgress=m.progress;console.log(JSON.stringify(m.progress));progressWrites=progressWrites.then(()=>writeFile(resolve(out,`${job.profile}-${job.build}-${job.seed}.progress.json`),JSON.stringify(m.progress,null,2)));}
    else if(m.error)error=m.error;
    else completed=m.result;
   });
   child.on('error',e=>{error=e.stack??String(e);});
   child.on('close',async(code,signal)=>{clearTimeout(watchdog);try{await progressWrites;}catch(e){error=String(e);}ok(code===0&&completed&&!error?completed:{profile:job.profile,build:job.build,seed:job.seed,outcome:'error',exitCode:code,signal,error:error??'Audit child ended without a successful result',stderr,lastProgress});});
   child.send(job,e=>{if(e)error=e.stack??String(e);});
  });
  results.push(result);
  await writeFile(resolve(out,`${job.profile}-${job.build}-${job.seed}.json`),JSON.stringify(result,null,2));
  await save();
  console.log(JSON.stringify({profile:job.profile,build:job.build,seed:job.seed,outcome:result.outcome,wave:result.wave,earned:result.earned===undefined?undefined:Math.round(result.earned),accuracy:result.overall?.accuracy,wall:result.wallSeconds===undefined?undefined:Math.round(result.wallSeconds),out}));
 }}));
 await save();
 const failures=results.filter(r=>r.outcome==='error').length;
 console.log(JSON.stringify({completed:results.length-failures,failed:failures,out}));
 if(failures)process.exitCode=1;
}

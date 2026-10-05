import {readFile, mkdir, writeFile, appendFile, readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import init,{Game} from '../src/wasm/towerium.js';
import {targets,combatRequest,shopRequest,shopNominations,decodeChoice,baselineAction, baselineWeapon,baselinePurchase,baselinePowerPurchase} from './playtest-policy.mjs';
import {openKev} from './kev-local.mjs';
import {HumanController} from './human-controls.mjs';

const root=resolve(import.meta.dirname,'..');
const args=Object.fromEntries(process.argv.slice(2).map(arg=>{const [key,...rest]=arg.replace(/^--/,'').split('=');return [key,rest.join('=')||'true'];}));
if(args.help||args.h){
  console.log(`Towerium WASM playtest

Usage: node scripts/playtest.mjs [options]

Common options:
  --policy=baseline|kev       Defaults to baseline. Baseline never uses a model.
  --seed=100                  First deterministic seed.
  --runs=8                    Number of consecutive seeds.
  --waves=40                  Maximum wave count.
  --seconds=3600              Simulated-time limit.
  --decisions=N               Default covers time limit plus 25 shop decisions/wave.
  --interval=0.05             Combat decision interval; matches UI Auto Play.
  --out=playtest-results/run  New, empty output directory.

Baseline options:
  --strategy=balanced|offense|defense|economy|none
  --aim=nearest|priority|idle|circle
  --weapons=all|projectile|light|missile|hook|rotate
  --circle-seconds=2 --circle-from=1 --weapons-from=1

Kev options:
  --laya=/path/to/laya
  --model-file=/path/to/kev.gguf
  --timing=latency
`);
  process.exit(0);
}
const policy=args.policy||'baseline',strategy=args.strategy||'balanced';
const humanOptions={reactionMs:Number(args['reaction-ms']??250),aimSpeed:Number(args['aim-speed']??900),switchMs:Number(args['switch-ms']??200),reference:args.reference==='true',assistPixels:Number(args['assist-pixels']??0),arenaWidth:Number(args['arena-width']??320)};
new HumanController(humanOptions); // Validate before writing artifacts.
const startWave=Number(args['start-wave']??1);
if(!Number.isInteger(startWave)||startWave<1||startWave>10000)throw new Error('Invalid start-wave');
if(!['balanced','offense','defense','economy','none'].includes(strategy))throw new Error('Invalid workshop strategy');
if(args.laya&&!args['model-file'])throw new Error('--laya requires an explicit --model-file');
if(!['kev','baseline'].includes(policy))throw new Error('policy must be kev or baseline');
const aim=args.aim||'nearest';
if(!['nearest','priority','idle','circle'].includes(aim)||policy==='kev'&&args.aim)throw new Error('aim is a baseline-only option: nearest, priority, idle or circle');
const circleSeconds=Number(args['circle-seconds']||2),weaponMode=args.weapons||'all';
const circleFrom=Number(args['circle-from']||1),weaponFrom=Number(args['weapons-from']||1);
if(!Number.isInteger(weaponFrom)||weaponFrom<1||policy==='kev'&&args['weapons-from'])throw new Error('weapons-from must be a positive integer for baseline tests');
if(!Number.isInteger(circleFrom)||circleFrom<1)throw new Error('circle-from must be a positive integer');
if(!Number.isFinite(circleSeconds)||circleSeconds<=0||!['all','projectile','light','missile','hook','rotate'].includes(weaponMode)||policy==='kev'&&args.weapons)throw new Error('Invalid baseline circle period or weapon mode');
const endpoint=args.endpoint||'http://127.0.0.1:8099/v1/systemone';
const url=new URL(endpoint);
if(url.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(url.hostname))throw new Error('This harness only permits local Kev endpoints.');
const interval=Number(args.interval||'.05'),maxWaves=Number(args.waves||'40'),maxSeconds=Number(args.seconds||'3600');
const maxDecisions=Number(args.decisions??Math.ceil(maxSeconds/interval)+maxWaves*25);
const seedStart=Number(args.seed||'100'),count=Number(args.runs||'8'),excluded=Number(args.exclude||'-1');
if(![interval,maxWaves,maxSeconds,maxDecisions,count].every(n=>Number.isFinite(n)&&n>0)||count>1000||interval>5||Math.round(interval*60)<1)throw new Error('Invalid playtest bounds');
if(startWave>maxWaves)throw new Error('start-wave must not exceed waves');
const latencyMode=args.timing==='latency';
const configText=await readFile(resolve(root,args.config||'engine/balance.json'),'utf8'),config=JSON.parse(configText);
const wasm=await readFile(resolve(root,'src/wasm/towerium_bg.wasm'));
const bindings=await readFile(resolve(root,'src/wasm/towerium.js'));
await init({module_or_path:wasm});
const out=resolve(root,args.out||`playtest-results/${new Date().toISOString().replace(/[:.]/g,'-')}-${policy}-${strategy}`);
await mkdir(out,{recursive:true});
if((await readdir(out)).length)throw new Error(`Output directory is not empty: ${out}. Choose a new --out.`);
const localKev=policy==='kev'&&args.laya?openKev(args.laya,args['model-file'],resolve(out,'kev-runtime.log')):null;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const workshopCost=config.upgrades.reduce((sum,u)=>sum+u.costs.reduce((a,b)=>a+b,0),0);
const harnessHashes=Object.fromEntries(await Promise.all(['playtest.mjs','playtest-policy.mjs','kev-local.mjs','human-controls.mjs','aim-assist.mjs'].map(async name=>[name,hash(await readFile(resolve(root,'scripts',name)))])));
const metadata={policy,strategy,aim:policy==='baseline'?aim:null,endpoint:policy==='kev'?(localKev?'local stdio':endpoint):null,modelFile:localKev?(args['model-file']):null,interval,maxWaves,maxSeconds,maxDecisions,seedStart,count,excluded,
  timing:latencyMode?'latency-replayed: previous input continues during measured inference delay':'decision-paused accelerated simulation; inference time is not simulated',
  configHash:hash(configText),wasmHash:hash(wasm),bindingsHash:hash(bindings),harnessHashes,runtime:localKev?.runtime??null,runtimeRotation:localKev?'scheduled restart and recorded warmup in paused shop before each subsequent wave':null,started:new Date().toISOString()};
Object.assign(metadata,{circleSeconds:aim==='circle'?circleSeconds:null,circleFrom,weaponMode,weaponFrom,humanOptions,startWave});
await writeFile(resolve(out,'metadata.json'),JSON.stringify(metadata,null,2));
await writeFile(resolve(out,'balance.json'),configText);
await writeFile(resolve(out,'towerium_bg.wasm'),wasm);
await writeFile(resolve(out,'towerium-bindings.mjs'),bindings);
const results=[];
const percent=(list,p)=>list.length?[...list].sort((a,b)=>a-b)[Math.min(list.length-1,Math.floor(list.length*p))]:null;

async function decide(request) {
  await writeFile(resolve(out,'last-request.json'),JSON.stringify(request));
  const start=performance.now();
  if(localKev)return {response:await localKev.request(request),latency:performance.now()-start};
  const response=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(request),signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw new Error(`Kev HTTP ${response.status}: ${(await response.text()).slice(0,800)}`);
  return {response:await response.json(),latency:performance.now()-start};
}
function summary() {
  return {metadata,runs:results,aggregate:{completedRuns:results.length,
    reachedWaveMedian:percent(results.map(r=>r.wave),.5),reachedWaveMin:Math.min(...results.map(r=>r.wave)),reachedWaveMax:Math.max(...results.map(r=>r.wave)),
    deaths:results.filter(r=>r.outcome==='death').length,censored:results.filter(r=>['wave-limit','time-limit','decision-limit'].includes(r.outcome)).length,errors:results.filter(r=>r.outcome==='error').length,
    simulatedSeconds:results.reduce((n,r)=>n+r.simulatedSeconds,0),modelCalls:results.reduce((n,r)=>n+r.modelCalls,0),
    purchaseCounts:config.upgrades.map((u,i)=>({name:u.name,count:results.reduce((n,r)=>n+r.levels[i],0)})),
  }};
}
for(let run=0;run<count;run++) {
  const seed=seedStart+run,game=Game.autoplay_start(seed,configText,startWave),log=resolve(out,`seed-${seed}.jsonl`),start=performance.now(),controller=new HumanController(humanOptions);
  let s=JSON.parse(game.snapshot()),decisions=0,modelCalls=0,combatFrames=0,error=null;
  const latencies=[],combatLatencies=[],shopLatencies=[],runtimeRestarts=[],purchases=[],powerPurchases=[],waves=[],weapons=[0,0,0,0];
  const powerNames=['Chain Lightning','Chrono Field','Swamp','Black Hole','Spotlight','Death Ray','Golden Tower',null,null,null,'Fallout','Demon Mode','Death Penalty','Space Displacer','Pulsar Harvester','Om Chip'];
  const powerUptime=powerNames.map((name,index)=>name?{index,name,active_seconds:0,peak_bank_seconds:0}:null),wavePowerUptime=new Map();
  const timerValues=state=>[...(state.powers??[]),null,null,null,state.fallout_time,state.demon_time,...(state.module_times??[])];
  let telemetryState=s,lastHp=s.hp,damage=0,stalls=0,impactWaits=0,previousCombat;
  const snapshot=()=>JSON.parse(game.snapshot());
  const advance=seconds=>{
    const frames=Math.max(0,Math.round(seconds*60));
    for(let i=0;i<frames;i++){
      game.advance(1/60);
      const frameState=snapshot(),elapsed=Math.max(0,frameState.time-telemetryState.time),beforeTimers=timerValues(telemetryState),nextTimers=timerValues(frameState),waveKey=telemetryState.wave;
      if(!wavePowerUptime.has(waveKey))wavePowerUptime.set(waveKey,powerNames.map((name,index)=>name?{index,name,active_seconds:0,peak_bank_seconds:0}:null));
      const waveStats=wavePowerUptime.get(waveKey);
      for(let index=0;index<powerUptime.length;index++)if(powerUptime[index]){
        const prior=Math.max(0,beforeTimers[index]??0),current=Math.max(0,nextTimers[index]??0);
        powerUptime[index].peak_bank_seconds=Math.max(powerUptime[index].peak_bank_seconds,prior,current);
        waveStats[index].peak_bank_seconds=Math.max(waveStats[index].peak_bank_seconds,prior,current);
        if(prior>0||current>0){powerUptime[index].active_seconds+=elapsed;waveStats[index].active_seconds+=elapsed;}
      }
      telemetryState=frameState;
    }
    combatFrames+=frames;
    const next=frames?telemetryState:snapshot();telemetryState=next;damage+=Math.max(0,lastHp-next.hp);lastHp=next.hp;
    s=next;
    return frames;
  };
  try {
    s=snapshot();
    await appendFile(log,JSON.stringify({event:'start',seed,startWave,prepare:true,configHash:metadata.configHash})+'\n');
    while(s.phase!==3&&s.wave<=maxWaves&&s.time<maxSeconds&&decisions<maxDecisions) {
      if(s.phase===2) {
        const enteringShop=!s.pending_start_wave&&!waves.some(w=>w.wave===s.wave);
        if(enteringShop)waves.push({wave:s.wave,time:s.time,waveSeconds:s.wave_time,cleanupSeconds:s.cleanup_seconds,hp:s.hp,coins:s.coins,earned:s.earned,ammo:s.ammo,levels:s.levels});
        if(s.wave>=maxWaves&&!s.pending_start_wave)break;
        if(enteringShop&&localKev) {
          // Typed decisions have no conversational state. Rotate only while the
          // game is paused; active-run failures remain errors, never hidden retries.
          const began=performance.now(),restart=await localKev.restart();
          const warmup={model:'kev-latest',state:'Towerium is paused in the shop. No gameplay action will be taken.',questions:{ready:{type:'choice',instructions:'Choose ready to confirm the decision engine is responding.',criteria:{ready:'Ready.',wait:'Wait.'}}}};
          const response=await localKev.request(warmup);
          const event={event:'runtime_restart',wave:s.wave,reason:'scheduled shop rotation',...restart,startupMs:performance.now()-began,request:warmup,response};
          runtimeRestarts.push({wave:s.wave,...restart,startupMs:event.startupMs});
          await appendFile(log,JSON.stringify(event)+'\n');
        }
        let choice,request,response,latency=0;
        if(policy==='kev') {
          request=shopRequest(s,config,strategy);
          if(Object.keys(request.questions.purchase.criteria).length===1)choice=-1;
          else {
            let nominations;
            if(Object.keys(request.questions.purchase.criteria).length>16) {
              const shortlist=shopNominations(request);
              const first=await decide(shortlist);latencies.push(first.latency);shopLatencies.push(first.latency);modelCalls++;
              const keys=[...new Set(['save',decodeChoice(first.response,shortlist,'nominee_0'),decodeChoice(first.response,shortlist,'nominee_1')])];
              nominations={request:shortlist,...first};
              request={...request,questions:{purchase:{...request.questions.purchase,criteria:Object.fromEntries(keys.map(key=>[key,request.questions.purchase.criteria[key]]))}}};
            }
            if(Object.keys(request.questions.purchase.criteria).length===1)choice=-1;
            else {({response,latency}=await decide(request));latencies.push(latency);shopLatencies.push(latency);modelCalls++;const value=decodeChoice(response,request,'purchase');choice=value==='save'?-1:Number(value.slice(4));}
            if(nominations)await appendFile(log,JSON.stringify({event:'shop_nominations',...nominations})+'\n');
          }
        } else choice=baselinePurchase(s,config,strategy,excluded);
        decisions++;
        const before={hp:s.hp,coins:s.coins,levels:s.levels};
        let startedNext=false;
        if(choice<0){
          const power=baselinePowerPurchase(s,config,strategy);
          if(power){if(!game.buy_power(power.power,power.path))throw new Error('Rejected Power Stone purchase');const purchase={wave:s.wave,...power,cost:s.power_costs[power.power][power.path],stones:s.stones};powerPurchases.push(purchase);await appendFile(log,JSON.stringify({event:'power_shop',...purchase})+'\n');}
          else {game.start_wave();previousCombat=undefined;startedNext=true;}
        }
        else {if(!game.buy(choice))throw new Error(`Rejected legal purchase ${choice}`);purchases.push({wave:s.wave,index:choice,cost:s.costs[choice],hp:s.hp});}
        s=snapshot();lastHp=s.hp;
        await appendFile(log,JSON.stringify({event:'shop',wave:before.levels? s.wave:null,choice,startedNext,before,request,response,latency})+'\n');
        continue;
      }
      const candidates=targets(s,config);
      if(policy==='baseline'){
        const inputs=[],observation={wave:s.wave,time:s.time,hp:s.hp,coins:s.coins,enemies:s.enemies.length,kills:s.kills,ammo:s.ammo,charges:s.charges};
        const frames=Math.max(1,Math.round(interval*60));
        for(let frame=0;frame<frames&&s.phase===1;frame++){
          const action=controller.step(s,1/60,(observed,context)=>{
            return baselineAction(observed,config,targets(observed,config),aim==='circle'&&observed.wave<circleFrom?'priority':aim,circleSeconds,{...context,weaponMode:observed.wave<weaponFrom?'all':weaponMode});
          });
          game.input(...action.aim,action.fire,action.weapon);
          const usedDeathWave=action.deathWave&&game.death_wave();
          inputs.push({pointer:action.aim,fire:action.fire,weapon:action.weapon,usedDeathWave});
          weapons[action.weapon]++;advance(1/60);
        }
        decisions++;
        await appendFile(log,JSON.stringify({event:'human_combat',observation,inputs})+'\n');
        continue;
      }
      let action,request,response,latency=0,delayFrames=0;
      if(policy==='kev'&&candidates.length) {
        request=combatRequest(s,config,candidates,strategy,interval);
        ({response,latency}=await decide(request));latencies.push(latency);if(modelCalls>0)combatLatencies.push(latency);modelCalls++;
        action={target:decodeChoice(response,request,'target'),weapon:request.questions.weapon?Number(decodeChoice(response,request,'weapon')):0,deathWave:!!request.questions.death_wave&&decodeChoice(response,request,'death_wave')==='use'};
        // Startup/model compilation happens before handing control to the player.
        // The first inference is recorded but is not charged as reaction delay.
        if(latencyMode&&modelCalls>1)delayFrames=advance(latency/1000);
        if(s.phase!==1){await appendFile(log,JSON.stringify({event:'late_decision',request,response,latency,delayFrames})+'\n');continue;}
      } else action=policy==='kev'?{target:'hold',weapon:0,deathWave:false}:baselineAction(s,config,candidates,aim==='circle'&&s.wave<circleFrom?'priority':aim,circleSeconds,{previous:previousCombat});
      if(policy==='baseline')action.weapon=baselineWeapon(s,action.weapon,s.wave<weaponFrom?'all':weaponMode);
      // Only mechanical mapping: a chosen target becomes its observed pointer coordinates.
      const target=candidates.find(t=>t.key===action.target);
      const pointer=policy==='baseline'&&action.pointer?action.pointer:target?[target.x,target.y]:null;
      const fire=policy==='baseline'?(action.fire??!!pointer):!!pointer;
      game.input(pointer?.[0]??0,pointer?.[1]??200,fire,action.weapon);
      const usedDeathWave=action.deathWave&&game.death_wave();
      weapons[action.weapon]++;
      if(action.waitingForImpact)impactWaits++;
      else if(action.target==='hold'&&candidates.length)stalls++;
      const observation={wave:s.wave,time:s.time,hp:s.hp,coins:s.coins,enemies:s.enemies.length,kills:s.kills,ammo:s.ammo,charges:s.charges};
      previousCombat=s;
      const frames=advance(interval);decisions++;
      await appendFile(log,JSON.stringify({event:'combat',observation,action,pointer,fire,usedDeathWave,frames,delayFrames,startupDelayExcluded:latencyMode&&modelCalls===1&&!!request,request,response,latency})+'\n');
      if(decisions%250===0)console.log(JSON.stringify({progress:true,seed,wave:s.wave,time:Math.round(s.time),hp:Math.round(s.hp),calls:modelCalls}));
    }
  }catch(e){error=e.stack||String(e);console.error(error);}
  s=snapshot();
  const result={seed,outcome:error?'error':s.phase===3?'death':s.wave>=maxWaves&&s.phase===2?'wave-limit':s.time>=maxSeconds?'time-limit':'decision-limit',error,
    wave:s.wave,cleared:s.phase===2?s.wave:s.wave-1,simulatedSeconds:s.time,combatFrames,kills:s.kills,hp:s.hp,earned:s.earned,coins:s.coins,levels:s.levels,
    weaponReport:s.weapon_report,ammoPickups:s.ammo_pickups,powerupsCollected:s.overall_report.powerups_collected,overallReport:s.overall_report,
    stones:s.stones,stonesEarned:s.stones_earned,powerLevels:s.power_levels,powerPurchases,coinOverlapKills:s.coin_overlap_kills,coinBonusCoins:s.coin_bonus_coins,
    damageLowerBound:damage,decisions,modelCalls,weaponDecisions:weapons,holdWithTargets:stalls,waitingForImpact:impactWaits,purchases,waves,
    workshop:{totalCost:workshopCost,affordableShare:s.earned/workshopCost,spentShare:purchases.reduce((sum,p)=>sum+p.cost,0)/workshopCost},
    goldenKillShare:s.kills?s.golden_kills/s.kills:0,
    waveTiming:{median:percent(waves.map(w=>w.waveSeconds),.5),cleanupMedian:percent(waves.map(w=>w.cleanupSeconds),.5),cleanupP95:percent(waves.map(w=>w.cleanupSeconds),.95),cleanupOver15:waves.filter(w=>w.cleanupSeconds>15).length},
    latencyMs:{p50:percent(latencies,.5),p95:percent(latencies,.95),max:latencies.length?Math.max(...latencies):null},
    combatLatencyMs:{p50:percent(combatLatencies,.5),p95:percent(combatLatencies,.95),max:combatLatencies.length?Math.max(...combatLatencies):null},
    shopLatencyMs:{p50:percent(shopLatencies,.5),p95:percent(shopLatencies,.95),max:shopLatencies.length?Math.max(...shopLatencies):null},
    powerUptime,last20WavePowerUptime:[...wavePowerUptime.entries()].sort((a,b)=>a[0]-b[0]).slice(-20).map(([wave,powers])=>({wave,powers})),
    runtimeRestarts,warmupCalls:runtimeRestarts.length,
    wallSeconds:(performance.now()-start)/1000,finalStateHash:hash(game.snapshot())};
  results.push(result);game.free();
  await appendFile(log,JSON.stringify({event:'result',...result})+'\n');
  await writeFile(resolve(out,'summary.json'),JSON.stringify(summary(),null,2));
  console.log(JSON.stringify({seed,policy,strategy,outcome:result.outcome,wave:s.wave,seconds:Math.round(s.time),calls:modelCalls,latency:result.latencyMs,out}));
  if(error){process.exitCode=1;break;}
}
console.log(`Report: ${resolve(out,'summary.json')}`);
await localKev?.close();

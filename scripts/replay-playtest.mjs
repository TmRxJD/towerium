import {readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const file=resolve(process.argv[2]||'');
if(!file.endsWith('.jsonl'))throw new Error('Pass a seed-N.jsonl playtest log');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const meta=JSON.parse(await readFile(resolve(dirname(file),'metadata.json'),'utf8'));
const config=await readFile(resolve(dirname(file),'balance.json'),'utf8');
let wasm;
try{wasm=await readFile(resolve(dirname(file),'towerium_bg.wasm'));}
catch(error){if(error.code!=='ENOENT')throw error;wasm=await readFile(new URL('../src/wasm/towerium_bg.wasm',import.meta.url));}
if(hash(wasm)!==meta.wasmHash||hash(config)!==meta.configHash)throw new Error('Replay requires the exact recorded WASM and balance config');
let bindingsPath=resolve(dirname(file),'towerium-bindings.mjs'),bindings;
try{bindings=await readFile(bindingsPath);}
catch(error){if(error.code!=='ENOENT')throw error;bindingsPath=resolve(import.meta.dirname,'../src/wasm/towerium.js');bindings=await readFile(bindingsPath);}
if(meta.bindingsHash&&hash(bindings)!==meta.bindingsHash)throw new Error('Replay requires the exact recorded JavaScript bindings');
const {default:init,Game}=await import(pathToFileURL(bindingsPath).href);
await init({module_or_path:wasm});
const records=(await readFile(file,'utf8')).trim().split('\n').map(line=>JSON.parse(line));
const prepared=records[0].prepare||records[0].startWave>1;
const game=prepared?Game.autoplay_start(records[0].seed,config,records[0].startWave??1):new Game(records[0].seed,config);if(!prepared)game.start_wave();
const advance=frames=>{for(let i=0;i<frames;i++)game.advance(1/60);};
for(const row of records){
  if(row.event==='late_decision')advance(row.delayFrames);
  if(row.event==='combat'){
    advance(row.delayFrames);game.input(row.pointer?.[0]??0,row.pointer?.[1]??200,row.fire??!!row.pointer,row.action.weapon);
    if(row.usedDeathWave)game.death_wave();advance(row.frames);
  }
  if(row.event==='human_combat')for(const input of row.inputs){game.input(...input.pointer,input.fire,input.weapon);if(input.usedDeathWave)game.death_wave();advance(1);}
  if(row.event==='power_shop'&&!game.buy_power(row.power,row.path))throw new Error('Replay Power Stone purchase rejected');
  if(row.event==='shop'){if(row.choice<0){if(row.startedNext??true)game.start_wave();}else if(!game.buy(row.choice))throw new Error('Replay purchase rejected');}
}
const actual=hash(game.snapshot()),expected=records.at(-1).finalStateHash;
if(process.argv[3])await writeFile(resolve(process.argv[3]),game.snapshot());
game.free();if(actual!==expected)throw new Error(`Replay diverged: ${actual} != ${expected}`);
console.log(`Exact replay passed: ${records[0].seed}, ${actual}`);

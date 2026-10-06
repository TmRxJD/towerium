import './game.css';
import { DevPanel, defaultBalance } from './dev-panel';
import { AutoPlayer } from './autoplay';
import { humanDefaults } from '../scripts/human-controls.mjs';
import { powerShop, stoneIcon } from './power-shop';
import { supplyShop } from './supplies';
import init, { Game } from './wasm/towerium';
import balance from '../engine/balance.json';
import { formatNumberForDisplay } from 'thetowersdk/formatting';
import { loadArt, towerUrl, powerUrls, powerNames, skins, skinUrls, workshop, workshopUrls, coinUrl } from './assets';
import { Cosmetics } from './cosmetics';
import { Renderer } from './renderer';
import { Audio } from './audio';
import type { Snapshot, WaveReport } from './types';
import { weaponIcons } from './weapon-icons';
import { renderHelp, weaponNames } from './help';
import { TouchControls } from './touch-controls';
import { RunRetries, retryStorageKey } from './run-retries';
import { createSaveCompatibility } from './save-compatibility';
import { defaultAutomation, validateAutomation, priorityPurchase, priorityPerk, holdInterval, RoundCountdown } from '../scripts/automation.mjs';
import { perks } from './perks';
import { AutoAimController, priorityRules, validateAimPreferences, type AimPreferences } from '../scripts/auto-aim.mjs';
import { perkChoices, perkBuild, nextPerkText, selectAutoPerk } from './perks';
import { assistAim } from '../scripts/aim-assist.mjs';

const app=document.querySelector<HTMLDivElement>('#app')!;
const number=(n:number)=>formatNumberForDisplay(n,'Period (.)',{mode:'compact',smallNumberMaxFractionDigits:0,notationMaxFractionDigits:1});
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const coinIcon=`<img class="currency-icon" src="${coinUrl}" alt="" aria-hidden="true">`;
const audio=new Audio();
const search=new URLSearchParams(location.search);
const seedText=search.get('seed');
let seed=seedText!==null && /^\d+$/.test(seedText)?Number(seedText)>>>0:crypto.getRandomValues(new Uint32Array(1))[0];
let game:Game;
let snapshot:Snapshot;
let renderer:Renderer;
let aim:[number,number]=[0,-220],firing=false,weapon=0;
let touchControls:TouchControls;
const touchDevice=matchMedia('(any-pointer: coarse)').matches;
const aimKey='towerium.aim.v1';
let aimPreferences:AimPreferences=validateAimPreferences(null,touchDevice),assistedAim:[number,number]|null=null;
try{aimPreferences=validateAimPreferences(JSON.parse(localStorage.getItem(aimKey)??'null'),touchDevice);}catch{/* Optional preferences. */}
let prioritiesOpen=false,prioritiesWasPaused=false,autoWeapon=0,autoTargetId=-1,autoFireReady=false;
const aimController=new AutoAimController();
let automation=defaultAutomation(balance,perks);
try{automation=validateAutomation(JSON.parse(localStorage.getItem('towerium.automation.v1')??'null'),balance,perks);}catch{/* Optional browser storage. */}
const roundCountdown=new RoundCountdown();
let automationOpen=false,automationTab:'buy'|'perks'='buy',automationAppliedWave=-1;
let heldStat=-1,heldPointer=-1,holdSince=0,holdTimer=0,heldPurchased=false,suppressBuyClick=false;
function saveAutomation(){try{localStorage.setItem('towerium.automation.v1',JSON.stringify(automation));}catch{/* Optional browser storage. */}}
function buyRanked(){if(autoPlayer||snapshot.phase!==2)return;let changed=false;
 for(let n=0;n<1000;n++){const id=priorityPurchase(snapshot,automation);if(id<0)break;if(!game.buy(id))throw new Error('Ranked Workshop Purchase Rejected');changed=true;read();}
 if(changed){saveRun();updateHud();returnRunScreen();}
}
function applyAutomaticPerk(){if(!automation.perkEnabled||!snapshot.perks.offers.length)return;const choice=priorityPerk(snapshot,automation);if(choice===undefined)return;
 if(game.choose_perk(choice)){read();if(!devMode&&snapshot.wave%10===0)runRetries.capture(seed,snapshot.wave,game.save());saveRun();returnRunScreen();}
}
function updateAutomation(dt:number){
 if(devPanel?.open||autoPlayer||snapshot.phase!==2||!automation.enabled){roundCountdown.reset();automationAppliedWave=-1;return;}
 const viewing=modal.classList.contains('shop-modal')||modal.classList.contains('report-modal');
 if(!viewing||automationOpen||helpOpen||prioritiesOpen||restartPrompt)return;
 if(automationAppliedWave!==snapshot.wave){applyAutomaticPerk();buyRanked();automationAppliedWave=snapshot.wave;}
 const remaining=roundCountdown.tick(snapshot.wave,dt,!snapshot.perks.offers.length);
 const next=document.getElementById('next-wave');if(next&&!snapshot.perks.offers.length)next.textContent=`Next Wave · ${Math.ceil(remaining)}s`;
 if(remaining===0&&!snapshot.perks.offers.length)startWave();
}
function renderAutomation(){const buying=automationTab==='buy',rules=buying?automation.buy:automation.perks;
 modalContent(`<div class="modal-top"><h2 id="modal-title">${buying?'Buy Priorities':'Perk Priorities'}</h2></div><div class="automation-tabs"><button id="automation-buy-tab" class="secondary" aria-pressed="${buying}">Workshop</button><button id="automation-perk-tab" class="secondary" aria-pressed="${!buying}">Perks</button></div><div class="priority-body"><p>${buying?'Highest affordable priority first. Set a level limit to reserve coins.':'First enabled offered perk wins.'}</p>${buying?'':`<label class="perk-auto-toggle"><input id="auto-perk-enabled" type="checkbox" ${automation.perkEnabled?'checked':''}>Pick Perks Automatically</label>`}<ol class="priority-list">${rules.map((r,i)=>`<li><span>${i+1}</span><button data-auto-rule="${i}" aria-pressed="${r.enabled}">${buying?balance.upgrades[r.id].name:perks[r.id].name}<small>${r.enabled?'On':'Off'}</small></button>${buying?`<input data-auto-limit="${i}" aria-label="${balance.upgrades[r.id].name} Level Limit" type="number" inputmode="numeric" min="0" max="${balance.upgrades[r.id].cap}" value="${automation.buy[i].limit}">`:''}<button data-auto-move="${i}" data-direction="-1" aria-label="Move Priority ${i+1} Up" ${i===0?'disabled':''}>↑</button><button data-auto-move="${i}" data-direction="1" aria-label="Move Priority ${i+1} Down" ${i===rules.length-1?'disabled':''}>↓</button></li>`).join('')}</ol></div><div class="modal-actions"><button id="automation-done" class="primary">Done</button></div>`);modal.classList.add('automation-modal');
}
function openAutomation(){automationOpen=true;roundCountdown.reset();renderAutomation();}
function stopStatHold(){window.clearTimeout(holdTimer);if(heldPurchased)suppressBuyClick=true;heldStat=-1;heldPointer=-1;heldPurchased=false;}
function repeatStat(){if(heldStat<0||snapshot.phase!==2||autoPlayer){stopStatHold();return;}if(!modal.hasPointerCapture(heldPointer))modal.setPointerCapture(heldPointer);if(!game.buy(heldStat)){stopStatHold();return;}heldPurchased=true;read();saveRun();updateHud();renderShop();holdTimer=window.setTimeout(repeatStat,holdInterval(performance.now()-holdSince));}

function saveAimPreferences(){try{localStorage.setItem(aimKey,JSON.stringify(aimPreferences));}catch{/* Optional preferences. */}
}
let last=0,lastHud=0,uiPhase=-1,helpOpen=false,resultSent=false,animation=0;
let best=0;
try {const stored=Number(localStorage.getItem('towerium.best-wave'));if(Number.isSafeInteger(stored)&&stored>0)best=stored;}catch{/* Storage is optional in embedded/private contexts. */}
const cosmetics=new Cosmetics(best);
const runKey='towerium.run.v1';
let configJson=JSON.stringify(balance),devMode=false,devSpeed=1;
let devPanel:DevPanel;
let savedRun:{seed:number;state:string;config:string}|null=null,lastSave=0,restartPrompt=false;
let runRetries:RunRetries;
let compatibleConfig:(config:unknown)=>boolean=config=>config===configJson;
let postWaveView:'report'|'shop'='report';
let shopCategory:'workshop'|'powers'|'supplies'='workshop',selectedPower=0;
let autoPlayer:AutoPlayer|null=null,autoStartWave=1;
let humanGame:Game|null=null,humanSeed=seed;
function resumeAudio(){void audio.resume().catch(error=>{console.error('Audio could not resume:',error);setText('notice','Audio Unavailable');});}
function saveRun() {
  if(devMode || autoPlayer || !game || !snapshot || snapshot.phase===0)return;
  try {
    if(snapshot.phase===3){localStorage.removeItem(runKey);savedRun=null;return;}
    savedRun={seed,state:game.save(),config:configJson};
    localStorage.setItem(runKey,JSON.stringify(savedRun));
  }catch{setText('notice','Run Saving Unavailable');}
}
function showIntro(){
  const milestone=Math.floor(cosmetics.completed/50)*50;
  const retry=!savedRun&&runRetries?.available?`<button id="retry-run" class="secondary">Retry Wave ${runRetries.checkpoint!.wave} · ${3-runRetries.used} Left</button>`:'';
  el('intro').innerHTML=`<img src="${towerUrl}" alt="" width="110" height="110"><h2>TOWERIUM</h2>${savedRun&&!devMode?'<button id="restore-run" class="primary">Resume Run</button>':'<button id="start" class="primary">Play</button>'}<div class="intro-options">${savedRun&&!devMode?'<button id="new-run" class="quiet">New Run</button>':''}${devMode?'':retry}${milestone&&!devMode?`<button id="milestone-run" class="secondary" title="Empty Shops With Coin And Power Stone Budgets">Fresh Wave ${milestone}<small>Empty Shops + Budget</small></button>`:''}<button id="auto-play" class="secondary">Auto Play</button></div><label class="dev-enable"><input id="dev-enable" type="checkbox" ${devMode?'checked':''}> Dev Mode</label>`;
}
function configureAutoPlay(){
  modalContent('<div class="modal-top"><h2 id="modal-title">Auto Play</h2></div><div class="auto-settings"><label>Start Wave<input id="auto-start-wave" type="number" min="1" max="10000" step="1" value="1" required></label><label>Reaction Delay (ms)<input id="auto-reaction" type="number" min="0" max="2000" step="10" required></label><label>Aim Speed (Battlefield Pixels/s)<input id="auto-speed" type="number" min="50" max="10000" step="50" required></label><label>Weapon Switch Delay (ms)<input id="auto-switch" type="number" min="0" max="2000" step="10" required></label><label>Build<select id="auto-build"><option value="balanced">Balanced</option><option value="offense">Offense</option><option value="defense">Defense</option><option value="economy">Economy</option></select></label><label>Aim<select id="auto-aim"><option value="crowd">Crowd Sweeps</option><option value="nearest">Closest Threat</option><option value="priority">Priority Targets</option><option value="circle">Circle Sweep</option></select></label><label>Weapons<select id="auto-weapons"><option value="all">All Weapons</option><option value="projectile">Primary Only</option><option value="light">Favor Light Speed</option><option value="missile">Favor Smart Missiles</option><option value="hook">Favor Hook Bomb</option><option value="rotate">Rotate Weapons</option></select></label></div><div class="modal-actions"><button id="cancel-auto-play" class="quiet">Cancel</button><button id="watch-auto-play" class="primary">Watch</button></div>');
  const defaults=humanDefaults[touchDevice?'touch':'mouse'];
  el<HTMLInputElement>('auto-reaction').value=String(defaults.reactionMs);el<HTMLInputElement>('auto-speed').value=String(defaults.aimSpeed);el<HTMLInputElement>('auto-switch').value=String(defaults.switchMs);
}
function startAutoPlay(){
  if(autoPlayer || snapshot.phase!==0)return;
  for(const field of modal.querySelectorAll<HTMLInputElement>('input'))if(!field.reportValidity())return;
  autoStartWave=Number(el<HTMLInputElement>('auto-start-wave').value);
  humanGame=game;humanSeed=seed;autoPlayer=new AutoPlayer(el<HTMLSelectElement>('auto-build').value,el<HTMLSelectElement>('auto-aim').value,el<HTMLSelectElement>('auto-weapons').value,{reactionMs:Number(el<HTMLInputElement>('auto-reaction').value),aimSpeed:Number(el<HTMLInputElement>('auto-speed').value),switchMs:Number(el<HTMLInputElement>('auto-switch').value),assistPixels:touchDevice?14:0,arenaWidth:canvas.clientWidth});
  seed=crypto.getRandomValues(new Uint32Array(1))[0];game=Game.autoplay_start(seed,configJson,autoStartWave);
  firing=false;weapon=0;uiPhase=-1;resultSent=false;prepareAutoRun();
}
function prepareAutoRun(){
  if(!autoPlayer)return;
  read();
  for(let purchase=autoPlayer.purchase(snapshot);purchase;purchase=autoPlayer.purchase(snapshot)){
    const bought=purchase.kind==='buy'?game.buy(purchase.index):purchase.kind==='buy-power'?game.buy_power(purchase.power,purchase.path):game.buy_supply(purchase.item);
    if(!bought)throw new Error('Auto Play rejected a starting-budget purchase');
    read();
  }
  startWave();
}
function stopAutoPlay(){
  if(!autoPlayer || !humanGame)return;
  audio.pause();game.free();game=humanGame;humanGame=null;seed=humanSeed;autoPlayer=null;
  if(devMode)game.dev_balance(configJson);
  firing=false;weapon=0;helpOpen=false;restartPrompt=false;uiPhase=-1;last=0;resultSent=false;
  closeModal();read();syncPhase();updateHud();showIntro();el('auto-play').focus();
}
function runAutoPlayer(dt:number){
  if(!autoPlayer || devPanel?.open || helpOpen || restartPrompt)return;
  if(snapshot.phase===2&&snapshot.perks.offers.length){game.choose_perk(selectAutoPerk(snapshot,autoPlayer.strategy)!);read();renderReport();return;}
  const action=autoPlayer.update(snapshot,dt);if(!action)return;
  if(action.kind==='combat'){
    aim=action.aim;weapon=action.weapon;firing=action.fire;assistedAim=action.autoAim;autoWeapon=action.autoWeapon;autoTargetId=action.autoTargetId;autoFireReady=action.autoFire;input();game.set_auto_input(...action.autoAim,action.autoFire,action.autoWeapon);
    if(action.deathWave)game.death_wave();
  }else if(action.kind==='buy-supply'){
    shopCategory='supplies';if(game.buy_supply(action.item)){read();renderShop();}
  }else if(action.kind==='buy-power'){
    shopCategory='powers';selectedPower=action.power;
    if(game.buy_power(action.power,action.path)){read();renderShop();}
  }else if(action.kind==='buy'){
    shopCategory='workshop';
    if(game.buy(action.index)){read();renderShop();modal.querySelector(`[data-upgrade="${action.index}"]`)?.classList.add('auto-purchase');}
  }else startWave();
}
function confirmRestart() {
  helpOpen=false;pause(false);restartPrompt=true;
  modalContent(`<div class="modal-top"><h2 id="modal-title">${autoPlayer?'Restart Auto Play?':'Restart Run?'}</h2></div><p class="restart-note">${autoPlayer?'The spectator run will restart.':'Your current run will be lost.'}</p><div class="modal-actions"><button id="cancel-restart" class="quiet">Cancel</button><button id="confirm-restart" class="primary">${autoPlayer?'Restart Auto Play':'Restart Run'}</button></div>`);
  el('cancel-restart').focus();
}
function cancelRestart() {
  restartPrompt=false;closeModal();
  if(snapshot.phase===1)pause();else if(snapshot.phase===2){returnRunScreen();el('request-restart').focus();}else if(snapshot.phase===3)gameOver();
}
function restoreRun() {
  if(!savedRun)return;
  const restored=Game.restore(configJson,savedRun.state);
  game.free();game=restored;seed=savedRun.seed;read();weapon=snapshot.weapon;
  if(!devMode&&runRetries.checkpoint&&runRetries.checkpoint.seed!==seed)runRetries.reset();
  aim=[0,-220];firing=false;uiPhase=-1;last=0;syncPhase();updateHud();
  if(snapshot.phase===1){pause();el('modal-title').textContent=`Run Restored · Wave ${snapshot.wave}`;}
  else if(snapshot.phase===2)void resumeAudio();
}
function retryRun() {
  if(devMode||autoPlayer||!runRetries.available||!runRetries.checkpoint)return;
  const restored=runRetries.retry();if(!restored)return;
  stopFiring();game.free();game=restored;seed=runRetries.checkpoint.seed;
  closeModal();helpOpen=false;aim=[0,-220];weapon=0;firing=false;uiPhase=-1;last=0;resultSent=false;
  input();read();syncPhase();updateHud();saveRun();void resumeAudio();canvas.focus({preventScroll:true});
}
function milestoneRun() {
  if(devMode||autoPlayer)return;
  const wave=Math.floor(cosmetics.completed/50)*50;if(wave<50)return;
  const nextSeed=crypto.getRandomValues(new Uint32Array(1))[0];
  const fresh=Game.milestone_start(nextSeed,configJson,wave);
  stopFiring();game.free();game=fresh;seed=nextSeed;runRetries.reset();
  closeModal();helpOpen=false;aim=[0,-220];weapon=0;firing=false;uiPhase=-1;last=0;resultSent=false;
  read();syncPhase();renderShop();updateHud();saveRun();void resumeAudio();
}

const skinIcon=(index:number)=>skinUrls[index]?`<img src="${skinUrls[index]}" alt="">`:'<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M58 32 45 55 19 55 6 32 19 9 45 9Z" fill="#122934" stroke="#b6fff2" stroke-width="3"/></svg>';

app.innerHTML=`
  <div class="shell">
    <header class="header">
      <div class="brand"><img src="${towerUrl}" alt="" width="28" height="28"><h1>TOWERIUM</h1></div>
      <nav aria-label="Game controls"><button id="dev-open" class="secondary" hidden>Dev</button><button id="help" class="quiet" title="Controls and enemy guide">Help</button><button id="music" class="quiet sound-toggle" aria-pressed="${!audio.musicMuted}" aria-label="Music" title="Music ${audio.musicMuted?'Off':'On'}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 17V5l11-2v12M9 9l11-2"/><ellipse cx="6" cy="18" rx="3" ry="2"/><ellipse cx="17" cy="16" rx="3" ry="2"/></svg></button><button id="effects" class="quiet sound-toggle" aria-pressed="${!audio.effectsMuted}" aria-label="Effects" title="Effects ${audio.effectsMuted?'Off':'On'}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9h4l5-4v14l-5-4H3zM16 8c3 2 3 6 0 8M19 5c5 4 5 10 0 14"/></svg></button><button id="pause" class="quiet" title="Pause or resume · Esc" disabled>Pause</button></nav>
    </header>
    <main class="layout">
      <section class="play-column" aria-label="Towerium game">
        <span id="run-mode" class="auto-badge" hidden>Auto Play</span><div class="hud">
          <div class="wave-progress"><div class="wave-stat"><span class="eyebrow">WAVE</span><strong id="wave">01</strong><span id="wave-timer" aria-label="Wave Timer">00:00</span></div><span id="next-perk" class="next-perk">Next Perk · W5</span></div>
          <div class="health-stat"><div class="stat-label"><span>HP</span><strong id="health-text">100 / 100</strong></div><div class="health-track" role="meter" aria-label="Tower health" aria-valuemin="0" aria-valuemax="200" aria-valuenow="100"><span id="health-fill"></span><span id="overheal-fill"></span></div></div>
          <div class="coin-stat" title="Coins">${coinIcon}<strong id="coins" aria-label="Coins">0</strong><span class="stone-balance" title="Power Stones">${stoneIcon}<strong id="stones" aria-label="Power Stones">0</strong></span></div>
        </div>
        <div class="arena-wrap">
          <canvas id="arena" width="1100" height="1100" tabindex="0" aria-label="Tower battlefield. Mouse aims; hold to fire. On touch, use Trackpad Aim and Fire below the battlefield. Arrow keys aim; Space fires. Weapons 1 through 4 or mouse wheel; Q or right click for Death Wave."></canvas>
          <div id="powers" class="power-strip" role="group" aria-label="Active powers"></div>
          <section id="intro" class="intro" aria-label="Start Towerium"><img src="${towerUrl}" alt="" width="110" height="110"><h2>TOWERIUM</h2><button id="start" class="primary">Play</button></section>
          <div id="notice" class="run-status" role="status" aria-live="polite"></div>
        </div>
        <div class="aim-tools"><button id="auto-aim-toggle" class="secondary" aria-pressed="false">Autocannon: Off</button><button id="aim-priorities" class="secondary">Target Priority</button></div>
        <div class="weapon-bar" aria-label="Weapon selection">${weaponNames.map((name,i)=>`<button class="weapon${i===0?' selected':''}" data-weapon="${i}" aria-label="${name}" aria-pressed="${i===0}" title="${name} · ${i+1}">${weaponIcons[i]}<b id="ammo-${i}" aria-hidden="true">${i===0?'∞':balance.weapons[i].ammo}</b></button>`).join('')}<button id="death-wave" class="weapon death-weapon" aria-label="Death Wave" title="Death Wave · Q · No charges" disabled>${weaponIcons[4]}<b id="charge-count" aria-hidden="true">0/3</b></button></div>
        <div id="touch-controls" class="touch-controls" hidden></div>
      </section>
    </main>
  </div>
  <dialog id="modal" aria-labelledby="modal-title"></dialog>
`;
const el=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const canvas=el<HTMLCanvasElement>('arena'),modal=el<HTMLDialogElement>('modal');
touchControls=new TouchControls(el('touch-controls'),canvas,{
  ready:()=>!!snapshot&&!autoPlayer&&snapshot.phase===1&&!snapshot.paused&&!modal.open,
  fireReady:()=>canFireWeapon(),
  aim:()=>aim,
  move:value=>{aim=value;input();},
  fire:held=>{firing=held;if(game)input();if(held)resumeAudio();},
  weapon:()=>weapon,
  spent:()=>snapshot?.weapon_report[3].ammo_spent??0,
  scale:()=>renderer?.worldExtent??650,
});
const setText=(id:string,text:string)=>{const node=el(id);if(node.textContent!==text)node.textContent=text;};
function post(type:string,payload:Record<string,unknown>={}) {
  window.dispatchEvent(new CustomEvent(type,{detail:payload}));
  if(window.parent!==window && document.referrer) {
    try {const origin=new URL(document.referrer).origin;if(origin!=='null')window.parent.postMessage({type,...payload},origin);}catch{/* Standalone embedding needs no parent handshake. */}
  }
}
function read() {snapshot=JSON.parse(game.snapshot()) as Snapshot;return snapshot;}
function changeDevMode(enabled:boolean){
  if(autoPlayer||snapshot.phase!==0)return;
  devMode=enabled;devSpeed=1;game.free();Object.assign(balance,structuredClone(defaultBalance));configJson=JSON.stringify(balance);
  game=new Game(seed,configJson);read();updateHud();showIntro();
}
function createDevPanel(){
  const resetRoutes=()=>{helpOpen=false;prioritiesOpen=false;automationOpen=false;restartPrompt=false;roundCountdown.reset();};
  return new DevPanel({read:()=>read(),config:()=>balance,seed:()=>seed,speed:value=>{devSpeed=value;},getSpeed:()=>devSpeed,
    leave:()=>{resetRoutes();if(humanGame){humanGame.free();humanGame=null;}autoPlayer=null;closeModal();game.free();devMode=false;devSpeed=1;Object.assign(balance,structuredClone(defaultBalance));configJson=JSON.stringify(balance);game=new Game(seed,configJson);uiPhase=-1;read();syncPhase();updateHud();showIntro();},
    validate:config=>JSON.parse(Game.dev_config(JSON.stringify(config))),
    apply:config=>{const json=Game.dev_config(JSON.stringify(config));game.dev_balance(json);Object.assign(balance,JSON.parse(json));configJson=json;read();updateHud();return balance;},
    run:json=>{game.dev_run(json);read();updateHud();},
    spawn:(kind,count)=>{game.dev_spawn(kind,count);read();},
    power:kind=>{game.dev_power(kind);read();updateHud();},clear:()=>{game.dev_clear();read();},
    fresh:(wave,nextSeed)=>{const fresh=Game.autoplay_start(nextSeed,configJson,wave);resetRoutes();game.free();game=fresh;seed=nextSeed;firing=false;weapon=0;resultSent=false;uiPhase=-1;read();game.pause(true);updateHud();},
    pause:()=>{const was=snapshot.paused;stopFiring();game.pause(true);read();audio.pause();return was;},
    close:was=>{game.pause(was);read();last=0;syncPhase();updateHud();if(!was)resumeAudio();},
  });
}
// Read-only diagnostics for integration tests. No test-only simulation controls.
export function getRenderSnapshot():Snapshot {return JSON.parse(game.snapshot()) as Snapshot;}
export function getControlState(){return {aim:[...aim],effectiveAim:[...displayedAim()],firing,weapon,manualTarget:autoPlayer?.manualTarget??null,autoFireReady,autoWeapon,autoTargetId,autoAim:assistedAim?[...assistedAim]:null,aimPreferences:structuredClone(aimPreferences)};}
function displayedAim():[number,number] {return touchDevice&&!autoPlayer&&firing?assistAim(snapshot,aim,14,canvas.clientWidth,weapon):aim;}
function input() {
 const manualAim=touchDevice&&!autoPlayer&&firing?assistAim(snapshot,aim,14,canvas.clientWidth,weapon):aim;
 game.input(...manualAim,firing,weapon);
 if(!autoPlayer)game.set_auto_input(...(assistedAim??aim),!!assistedAim&&autoFireReady&&aimPreferences.enabled,autoWeapon);
}
function renderPriorities(){
 modalContent(`<div class="modal-top"><h2 id="modal-title">Target Priority</h2><button id="priorities-auto-aim" class="secondary" aria-pressed="${aimPreferences.enabled}">Autocannon: ${aimPreferences.enabled?'On':'Off'}</button></div><div class="priority-body"><p>Higher rules win. Manual aim stays independent.</p><ol class="priority-list">${aimPreferences.rules.map((r,i)=>{const name=priorityRules.find(p=>p.id===r.id)!.label;return `<li><span>${i+1}</span><button data-rule="${r.id}" aria-pressed="${r.enabled}" aria-label="${name}, ${r.enabled?'enabled':'disabled'}">${name}<small>${r.enabled?'On':'Off'}</small></button><button data-move-rule="${i}" data-direction="-1" aria-label="Move ${name} Up" ${i===0?'disabled':''}>↑</button><button data-move-rule="${i}" data-direction="1" aria-label="Move ${name} Down" ${i===aimPreferences.rules.length-1?'disabled':''}>↓</button></li>`;}).join('')}</ol></div><div class="modal-actions"><button id="reset-priorities" class="quiet">Reset</button><button id="close-priorities" class="primary">${snapshot.phase===1&&!prioritiesWasPaused?'Resume':'Done'}</button></div>`);
}
function openPriorities(){prioritiesWasPaused=snapshot.paused;prioritiesOpen=true;if(snapshot.phase===1)pause(false);renderPriorities();}
function closePriorities(){prioritiesOpen=false;assistedAim=null;if(snapshot.phase===1&&!prioritiesWasPaused)resume();else if(snapshot.phase===1)pause();else if(snapshot.phase>=2)returnRunScreen();else closeModal();}
function updateAim(dt:number){
 assistedAim=null;autoFireReady=false;
 if(!aimPreferences.enabled||autoPlayer||snapshot.phase!==1||snapshot.paused||modal.open)return;
 const action=aimController.step(snapshot,balance,aimPreferences.rules,dt);
 autoWeapon=action.weapon;autoTargetId=action.targetId;assistedAim=action.aim as [number,number];autoFireReady=action.fire;

}
function canFireWeapon(){return !!snapshot&&snapshot.disabled_weapon!==weapon&&(weapon===0||snapshot.ammo[weapon]>0);}
function stopFiring() {assistedAim=null;autoTargetId=-1;aimController.reset();autoFireReady=false;touchControls.reset();firing=false;if(game)input();}
function selectWeapon(index:number) {if(snapshot.disabled_weapon===index)return;if(index!==weapon)touchControls.releaseFire();weapon=index;input();read();updateHud();}
function modalContent(html:string) {if(devMode)html=html.replace('</h2>','</h2><button id="modal-dev-open" class="secondary">Dev</button>');if(autoPlayer)html=html.replace('</h2>','</h2><span class="auto-badge">Auto Play</span>');modal.classList.remove('shop-modal','report-modal','automation-modal','help-modal');modal.classList.toggle('auto-mode',!!autoPlayer);modal.innerHTML=html;if(!modal.open)modal.showModal();}
function closeModal() {if(modal.open)modal.close();}
function pause(show=true) {
  if(devPanel?.open || !game || (snapshot.phase!==1 && !(autoPlayer && snapshot.phase===2)))return;
  stopFiring();game.pause(true);audio.pause();read();last=0;updateHud();saveRun();
  if(show && !helpOpen)modalContent(`<div class="modal-top"><h2 id="modal-title">Paused</h2></div><div class="modal-actions"><button class="quiet" id="request-restart">${autoPlayer?'Restart Auto Play':'Restart'}</button>${autoPlayer?'<button class="quiet" id="stop-auto-play">Stop Auto Play</button>':''}<button class="primary" id="resume">Resume</button></div>`);
}
function resume() {helpOpen=false;closeModal();game.pause(false);stopFiring();resumeAudio();last=0;read();updateHud();if(snapshot.phase===2)returnRunScreen();else canvas.focus({preventScroll:true});}
function startWave() {closeModal();helpOpen=false;if(game.start_wave()){resumeAudio();last=0;read();syncPhase();updateHud();saveRun();canvas.focus({preventScroll:true});}}
function restart() {
  restartPrompt=false;
  if(!autoPlayer&&!devMode){savedRun=null;runRetries.reset();}else if(autoPlayer)autoPlayer=new AutoPlayer(autoPlayer.strategy,autoPlayer.aim,autoPlayer.weapons,autoPlayer.options);
  closeModal();game.free();seed=crypto.getRandomValues(new Uint32Array(1))[0];game=autoPlayer?Game.autoplay_start(seed,configJson,autoStartWave):new Game(seed,configJson);
  aim=[0,-220];weapon=0;firing=false;resultSent=false;uiPhase=-1;if(autoPlayer){autoPlayer=new AutoPlayer(autoPlayer.strategy,autoPlayer.aim,autoPlayer.weapons,autoPlayer.options);prepareAutoRun();}else startWave();
}
function help() {
  const live=snapshot.phase===1;helpOpen=true;if(live)pause(false);
  modalContent(renderHelp({live,best,time:clock(snapshot.time),seed}));
  modal.classList.add('help-modal');
}
function statText(value:number,index:number) {
  const u=balance.upgrades[index];
  const n=Math.round(value*u.display_scale*100)/100;
  const formatted=u.unit==='s' && !Number.isInteger(n)?n.toFixed(2):formatNumberForDisplay(n,'Period (.)',{mode:'compact',smallNumberMaxFractionDigits:2,notationMaxFractionDigits:2});
  if(index===13)return `${formatted} ${n===1?'Hit':'Hits'}`;
  return `${index===20?'+':''}${formatted}${u.unit}`;
}
function wallet(){return `<div class="shop-wallet" aria-label="Balances"><span title="Coins">${coinIcon}<strong>${number(snapshot.coins)}</strong></span><span title="Power Stones">${stoneIcon}<strong>${number(snapshot.stones)}</strong></span></div>`;}
function shopSoundButtons() {
  return ['music','effects'].map(id=>{
    const original=el<HTMLButtonElement>(id).cloneNode(true) as HTMLButtonElement;
    original.id=`shop-${id}`;
    return original.outerHTML;
  }).join('');
}
function reportSection(title:string, report:WaveReport, id:string) {
  const stats=[
    ['Accuracy',report.shots_fired===0?'—':`${Math.round(report.accuracy)}%`],
    ['Shots Fired',number(report.shots_fired)],
    ['Hits Taken',number(report.hits_taken)],
    ['Powerups Collected',number(report.powerups_collected)],
    ['Coins Earned',coinIcon+number(report.coins_earned)],
    ['Stones Earned',stoneIcon+number(report.stones_earned)],
    ['Kills',number(report.kills)],
  ];
  if(title==='Overall') {
    const overlaps=snapshot.coin_overlap_kills.reduce((sum,count,mask)=>sum+((mask&(mask-1))!==0?count:0),0);
    stats.push(['Overlap Kills',number(overlaps)]);
  }
  return `<section class="report-section" aria-labelledby="${id}"><div class="report-section-heading"><h3 id="${id}">${title}</h3><span aria-label="Time ${clock(report.duration_seconds)}">${clock(report.duration_seconds)}</span></div><dl class="report-stats">${stats.map(([label,value])=>`<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl></section>`;
}
function runFooter(ended=false) {
  const navigation=postWaveView==='report'?'<button id="open-shop" class="secondary">Shop</button>':'<button id="wave-report" class="secondary">Report</button>';
  const pauseOrRestart=ended?'':autoPlayer?'<button id="auto-pause" class="quiet">Pause</button>':'<button id="request-restart" class="quiet">Restart</button>';
  let actions=ended
    ? autoPlayer?'<button class="secondary" id="stop-auto-play">Stop Auto Play</button><button class="primary" id="restart">Watch Again</button>':'<button class="primary" id="restart">Play Again</button>'
    : `<div class="auto-buy-control"><button id="buy-now" title="Buy Now" ${autoPlayer?'disabled':''}>Buy</button><label title="Auto Buy Between Waves"><input id="auto-buy-enabled" type="checkbox" aria-label="Auto Buy Between Waves" ${automation.enabled?'checked':''} ${autoPlayer?'disabled':''}><span>Auto</span></label><button id="buy-priorities" title="Buy & Perk Priorities" aria-label="Buy & Perk Priorities" ${autoPlayer?'disabled':''}>☷</button></div>`+navigation+`<button id="next-wave" class="primary" ${autoPlayer?'disabled title="Auto Play Starts The Next Wave"':snapshot.perks.offers.length?'disabled title="Choose One Perk In Report First"':''}>${snapshot.perks.offers.length?'Choose A Perk':'Next Wave →'}</button>`;
  if(ended&&!autoPlayer&&!devMode&&runRetries.available&&runRetries.checkpoint?.seed===seed)actions=`<button id="retry-run" class="secondary">Retry Wave ${runRetries.checkpoint.wave} · ${3-runRetries.used} Left</button>`+actions;
  if(ended&&!autoPlayer&&!devMode&&cosmetics.completed>=50)actions=`<button id="milestone-run" class="secondary">Fresh Wave ${Math.floor(cosmetics.completed/50)*50}</button>`+actions;
  if(!ended&&snapshot.pending_start_wave>0)actions=`<button id="next-wave" class="primary" ${autoPlayer?'disabled':''}>Start Wave ${snapshot.pending_start_wave} →</button>`;
  return `<div class="shop-footer"><div class="shop-tools">${shopSoundButtons()}${pauseOrRestart}<button id="shop-aim-priorities" class="quiet" title="Target Priority" aria-label="Target Priority" ${autoPlayer?'disabled':''}>Target Priority</button><button id="shop-help" class="quiet">Help</button><button id="shop-skins" ${autoPlayer?'disabled':''} class="quiet skin-button" title="${autoPlayer?'Skins Are Read Only During Auto Play':'Tower Skins'}" aria-label="Skins${cosmetics.fresh?', new skin unlocked':''}">${skinIcon(cosmetics.selected)}<span${cosmetics.fresh?' class="new-skin"':''}>Skins</span></button></div><p id="purchase-status" class="sr-only" role="status">${snapshot.notice.text.includes('upgraded')?esc(snapshot.notice.text):''}</p><div class="report-actions">${actions}</div></div>`;
}
function returnRunScreen() {
  if(snapshot.phase===3)gameOver();else if(snapshot.pending_start_wave>0||postWaveView==='shop')renderShop();else renderReport();
}
function renderReport() {
  if(snapshot.pending_start_wave>0){renderShop();return;}
  postWaveView='report';
  if(!autoPlayer&&!devMode)cosmetics.clear(snapshot.wave);
  modalContent(`<div class="shop-heading"><h2 id="modal-title">Wave ${snapshot.wave} Cleared</h2>${wallet()}</div><div class="report-body">${perkChoices(snapshot,!!autoPlayer)}${reportSection('This Wave',snapshot.wave_report,'wave-report-heading')}${reportSection('Overall',snapshot.overall_report,'overall-report-heading')}</div>${runFooter()}`);
  modal.classList.add('report-modal');
}
function renderShop() {
  postWaveView='shop';
  if(!autoPlayer&&!devMode)cosmetics.clear(snapshot.wave);
  const categories=`<div class="shop-categories" role="group" aria-label="Shop Category"><button id="category-workshop" class="secondary" aria-pressed="${shopCategory==='workshop'}">Workshop</button><button id="category-powers" class="secondary" aria-pressed="${shopCategory==='powers'}">Powerups</button><button id="category-supplies" class="secondary" aria-pressed="${shopCategory==='supplies'}">Supplies</button></div>`;
  if(shopCategory==='supplies'){
    modalContent(`<div class="shop-heading"><h2 id="modal-title" class="sr-only">Supplies</h2>${categories}${wallet()}</div><div class="shop-body">${supplyShop(snapshot,!!autoPlayer)}</div>${runFooter()}`);
    modal.classList.add('shop-modal');return;
  }
  if(shopCategory==='powers'){
    modalContent(`<div class="shop-heading"><h2 id="modal-title" class="sr-only">Powerups</h2>${categories}${wallet()}</div><div class="shop-body">${powerShop(snapshot,selectedPower,!!autoPlayer)}</div>${runFooter()}`);
    modal.classList.add('shop-modal');return;
  }
  modalContent(`<div class="shop-heading"><h2 id="modal-title" class="sr-only">${snapshot.pending_start_wave>0?`Build For Wave ${snapshot.pending_start_wave}`:'Workshop'}</h2>${categories}${wallet()}</div><div class="shop-body"><div class="upgrade-grid">${workshop.map((item,position)=>{const i=item.index,u=balance.upgrades[i];
    const capped=snapshot.levels[i]>=u.cap,afford=snapshot.coins>=snapshot.costs[i];
    return `<button class="upgrade" data-upgrade="${i}" title="${autoPlayer?'Auto Play Chooses Upgrades':capped?'Maximum Level':!afford?'Not Enough Coins':item.label}" ${autoPlayer||capped||!afford?'disabled':''} aria-label="Buy ${item.label} for ${snapshot.costs[i]} coins"><span class="upgrade-title"><img src="${workshopUrls[position]}" width="20" height="20" alt=""><strong>${item.label}</strong></span><div class="upgrade-bottom"><span><span class="upgrade-value">${statText(snapshot.values[i],i)}</span>${capped?'':' <span class="upgrade-value upgrade-preview">→ '+statText(snapshot.values[i]+u.step*(i===21?snapshot.power_drop_scale:1),i)+'</span>'}</span><b>${capped?'MAX':coinIcon+number(snapshot.costs[i])}</b></div></button>`;
  }).join('')}</div></div>${runFooter()}`);
  modal.classList.add('shop-modal');
}
function renderSkins() {
  if(!devMode)cosmetics.fresh=false;
  modalContent(`<div class="shop-heading"><h2 id="modal-title">Tower Skins</h2></div><div class="skin-grid">${skins.map((skin,i)=>{
    const unlocked=cosmetics.unlocked(i),selected=i===cosmetics.selected;
    return `<button class="skin-card${selected?' selected':''}" data-skin="${i}" ${unlocked?'':'disabled'} aria-pressed="${selected}" aria-label="${skin.name}${unlocked?selected?', selected':'':`, unlocks after wave ${i*30}`}" title="${skin.name}${unlocked?'':` · Clear wave ${i*30}`}">${skinIcon(i)}<span>${unlocked?selected?'✓ '+skin.name:skin.name:'Wave '+i*30}</span></button>`;
  }).join('')}</div><div class="shop-footer"><button id="back-shop" class="quiet">← Back${snapshot.phase===3?' To Results':postWaveView==='shop'?' To Shop':' To Report'}</button></div>`);
  modal.classList.add('shop-modal');
}
function gameOver() {
  const cleared=Math.max(0,snapshot.wave-1);
  if(!autoPlayer&&!devMode&&cleared>best){best=cleared;try{localStorage.setItem('towerium.best-wave',String(best));}catch{/* Optional local best. */}}
  if(!autoPlayer&&!devMode&&!resultSent){audio.tone(180,.5,'triangle',.025,40);post('towerium:result',{payload:{version:1,aimAssisted:snapshot.aim_assisted,seed,waveReached:snapshot.wave,wavesCleared:cleared,kills:snapshot.kills,coinsEarned:snapshot.earned,durationSeconds:Math.round(snapshot.time)}});resultSent=true;}
  modalContent(`<div class="shop-heading"><h2 id="modal-title">Game Over</h2><span class="run-result">Wave ${snapshot.wave} · ${cleared} Cleared</span></div><div class="report-body">${snapshot.aim_assisted?'<p class="perk-picked">Autocannon Used</p>':'<p class="perk-picked">Manual Aim</p>'}${perkBuild(snapshot)}${reportSection('Overall',snapshot.overall_report,'overall-report-heading')}</div>${runFooter(true)}`);
  modal.classList.add('report-modal');
}
function syncPhase() {
  if(devPanel?.open)return;
  if(snapshot.phase===uiPhase)return;uiPhase=snapshot.phase;
  el('intro').hidden=snapshot.phase!==0;
  if(snapshot.phase===2){
    stopFiring();
    if(!autoPlayer&&!devMode&&snapshot.pending_start_wave===0&&snapshot.wave%10===0&&snapshot.perks.offers.length===0)runRetries.capture(seed,snapshot.wave,game.save());
    renderReport();
  }
  if(snapshot.phase===3){stopFiring();gameOver();}
}
function clock(s:number) {return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(Math.floor(s%60)).padStart(2,'0')}`;}
function updateSoundButtons() {
  for(const [id,muted] of [['music',audio.musicMuted],['effects',audio.effectsMuted],['shop-music',audio.musicMuted],['shop-effects',audio.effectsMuted]] as const){
    const button=el<HTMLButtonElement>(id);if(!button)continue;
    const kind=id.endsWith('music')?'Music':'Effects',name=`${kind} ${muted?'Off':'On'}`;
    button.title=name;button.setAttribute('aria-label',kind);button.setAttribute('aria-pressed',String(!muted));
  }
}
function updateHud() {
  const mobile=touchDevice&&!autoPlayer;
  el('touch-controls').hidden=!mobile;
  document.querySelector('.shell')!.classList.toggle('touch-mode',mobile);
  touchControls.update(mobile&&snapshot.phase===1&&!snapshot.paused&&!modal.open,canFireWeapon());
  const toggle=el<HTMLButtonElement>('auto-aim-toggle');toggle.textContent=`Autocannon: ${autoPlayer||aimPreferences.enabled?'On':'Off'}`;toggle.setAttribute('aria-pressed',String(!!autoPlayer||aimPreferences.enabled));toggle.disabled=!!autoPlayer;toggle.title=autoPlayer?'Auto Play Controls The Autocannon':'Toggle The Autocannon';el<HTMLButtonElement>('aim-priorities').disabled=!!autoPlayer;
  const s=snapshot;
  el('run-mode').hidden=!autoPlayer&&!devMode;setText('run-mode',devMode?'Dev Run · Unscored':'Auto Play');el('dev-open').hidden=!devMode;
  setText('wave',String(s.wave||1).padStart(2,'0'));setText('coins',number(s.coins));setText('stones',number(s.stones));
  const cleanup=s.wave_time>=balance.waves.spawn_seconds;
  setText('next-perk',nextPerkText(s).replace('Wave ','W'));
  el('next-perk').title=s.perks.offers.length?'Choose A Perk In The Report':nextPerkText(s)==='Perks Maxed'?'All Perks Are Maxed':`Next Perk After Clearing Wave ${s.next_perk_wave}`;
  setText('wave-timer',cleanup?`+${clock(s.cleanup_seconds)}`:clock(s.wave_time));
  el('wave-timer').title=cleanup?'Cleanup':'Wave Timer';
  el('wave-timer').setAttribute('aria-label',cleanup?`Cleanup ${clock(s.cleanup_seconds)}`:`Wave Timer ${clock(s.wave_time)} of ${clock(balance.waves.spawn_seconds)}`);
  setText('health-text',`${Math.ceil(s.hp)} / ${s.max_hp}`);
  el('health-fill').style.width=`${Math.min(100,s.hp/s.max_hp*100)}%`;
  el('health-fill').classList.toggle('low',s.hp<s.max_hp*0.3);
  el('overheal-fill').style.width=`${(s.overheal>0?Math.max(0,Math.min(100,(s.hp-s.max_hp)/(s.max_hp*s.overheal)*100)):0)}%`;
  const meter=el('health-fill').parentElement!;meter.setAttribute('aria-valuemax',String(s.max_hp*(1+s.overheal)));meter.setAttribute('aria-valuenow',String(Math.ceil(s.hp)));
  meter.setAttribute('aria-valuetext',`${Math.ceil(s.hp)} HP; maximum ${s.max_hp}, recovery cap ${s.max_hp*(1+s.overheal)}`);
  const pauseButton=el<HTMLButtonElement>('pause');pauseButton.disabled=s.phase!==1;pauseButton.textContent=s.paused?'Resume':'Pause';
  document.querySelectorAll<HTMLButtonElement>('[data-weapon]').forEach((button,i)=>{const disabled=s.disabled_weapon===i;button.disabled=disabled||!!autoPlayer;button.classList.toggle('jammed',disabled);button.classList.toggle('selected',i===s.weapon);button.setAttribute('aria-pressed',String(i===s.weapon));button.setAttribute('aria-label',weaponNames[i]+(disabled?`, disabled for ${Math.ceil(s.sabotage_time)} seconds`:i===0?', unlimited ammunition':', '+s.ammo[i]+' rounds'));button.title=autoPlayer?'Auto Play Controls Weapons':disabled?`${weaponNames[i]} · disabled ${Math.ceil(s.sabotage_time)}s`:`${weaponNames[i]} · ${i+1}`;button.classList.toggle('empty',i>0&&s.ammo[i]===0);setText(`ammo-${i}`,disabled?`${Math.ceil(s.sabotage_time)}s`:i===0?'∞':String(s.ammo[i]));});
  setText('charge-count',`${s.charges}/3`);
  const death=el<HTMLButtonElement>('death-wave');death.disabled=!!autoPlayer||s.charges===0||s.phase!==1||s.paused;death.classList.toggle('ready',s.charges>0);
  death.setAttribute('aria-label',`Death Wave · ${s.charges} of 3 charges`);death.title=autoPlayer?'Auto Play Controls Death Wave':s.charges===0?'No Death Wave charges':'Release Death Wave · Q';
  const active=[...s.powers.map((time,i)=>({time,i})),{time:s.fallout_time,i:10},{time:s.demon_time,i:11},...s.module_times.map((time,i)=>({time,i:i+12})),...s.extra_power_times.map((time,i)=>({time,i:i+16}))].filter(p=>p.time>0);
  el('powers').innerHTML=active.map(({time,i})=>`<div role="img" title="${powerNames[i]}" class="active-power${time<balance.powers.warning?' expiring':''}" aria-label="${powerNames[i]}, ${Math.ceil(time)} seconds"><img src="${powerUrls[i]}" width="28" height="28" alt=""><b>${Math.ceil(time)}</b></div>`).join('');
  if(s.shields>0)el('powers').insertAdjacentHTML('beforeend',`<div role="img" class="active-power" title="Energy Shield" aria-label="Energy Shield, ${s.shields} of 3 charges"><img src="${powerUrls[9]}" width="28" height="28" alt=""><b>${'●'.repeat(s.shields)}${'○'.repeat(3-s.shields)}</b></div>`);
  const sabotaged=s.sabotage_time>0&&(s.disabled_weapon>=0||s.disabled_stat>=0);
  const disabledName=s.disabled_weapon>=0?weaponNames[s.disabled_weapon]:balance.upgrades[s.disabled_stat]?.name;
  el('notice').classList.toggle('sabotaged',sabotaged);
  setText('notice',sabotaged?`${disabledName} disabled · ${Math.ceil(s.sabotage_time)}s`:s.notice.time>0 && s.phase===1?s.notice.text:'');
}
document.addEventListener('click',event=>{
  const button=(event.target as HTMLElement).closest<HTMLButtonElement>('button');if(!button || button.disabled || !game)return;
  if(button.dataset.autoRule!==undefined){const rules=automationTab==='buy'?automation.buy:automation.perks;rules[Number(button.dataset.autoRule)].enabled=!rules[Number(button.dataset.autoRule)].enabled;saveAutomation();renderAutomation();return;}
  if(button.dataset.autoMove!==undefined){const rules=automationTab==='buy'?automation.buy:automation.perks,i=Number(button.dataset.autoMove),j=i+Number(button.dataset.direction);if(j>=0&&j<rules.length){[rules[i],rules[j]]=[rules[j],rules[i]];saveAutomation();renderAutomation();}return;}
  if(button.dataset.perk!==undefined&&!autoPlayer){if(game.choose_perk(Number(button.dataset.perk))){read();if(!devMode&&snapshot.wave%10===0)runRetries.capture(seed,snapshot.wave,game.save());saveRun();renderReport();el('next-wave').focus();}return;}
  if(button.dataset.rule){const r=aimPreferences.rules.find(r=>r.id===button.dataset.rule);if(r){r.enabled=!r.enabled;saveAimPreferences();renderPriorities();modal.querySelector<HTMLButtonElement>(`[data-rule="${r.id}"]`)?.focus();}return;}
  if(button.dataset.moveRule!==undefined){const i=Number(button.dataset.moveRule),j=i+Number(button.dataset.direction);if(j>=0&&j<aimPreferences.rules.length){const moved=aimPreferences.rules[i];[aimPreferences.rules[i],aimPreferences.rules[j]]=[aimPreferences.rules[j],aimPreferences.rules[i]];saveAimPreferences();renderPriorities();modal.querySelector<HTMLButtonElement>(`[data-rule="${moved.id}"]`)?.focus();}return;}
  if(button.dataset.weapon!==undefined&&!autoPlayer){selectWeapon(Number(button.dataset.weapon));return;}
  if(button.dataset.skin!==undefined&&!autoPlayer&&!devMode){if(cosmetics.select(Number(button.dataset.skin))){renderer.skin=cosmetics.selected;returnRunScreen();el('shop-skins').focus({preventScroll:true});}return;}
  if(button.dataset.supply!==undefined&&!autoPlayer){const item=Number(button.dataset.supply);if(game.buy_supply(item)){read();saveRun();renderShop();updateHud();modal.querySelector<HTMLButtonElement>(`[data-supply="${item}"]`)?.focus({preventScroll:true});}return;}
  if(button.dataset.powerSelect!==undefined){selectedPower=Number(button.dataset.powerSelect);renderShop();modal.querySelector<HTMLButtonElement>(`[data-power-select="${selectedPower}"]`)?.focus({preventScroll:true});return;}
  if(button.dataset.powerBuy!==undefined&&!autoPlayer){const power=Number(button.dataset.powerBuy),path=Number(button.dataset.powerPath);if(game.buy_power(power,path)){read();saveRun();renderShop();const next=modal.querySelector<HTMLButtonElement>(`[data-power-buy="${power}"][data-power-path="${path}"]`);if(next&&!next.disabled)next.focus({preventScroll:true});else modal.querySelector<HTMLButtonElement>(`[data-power-select="${power}"]`)?.focus({preventScroll:true});updateHud();}return;}
  if(button.dataset.upgrade!==undefined&&!autoPlayer){if(suppressBuyClick&&event.detail>0){suppressBuyClick=false;return;}const id=Number(button.dataset.upgrade);if(game.buy(id)){read();saveRun();const top=modal.querySelector('.shop-body')?.scrollTop??0;renderShop();const body=modal.querySelector('.shop-body');if(body)body.scrollTop=top;const next=modal.querySelector<HTMLButtonElement>(`[data-upgrade="${id}"]`);if(next&&!next.disabled)next.focus({preventScroll:true});else el('next-wave').focus({preventScroll:true});updateHud();}return;}
  switch(button.id){
    case 'auto-aim-toggle':case 'priorities-auto-aim':aimPreferences.enabled=!aimPreferences.enabled;assistedAim=null;saveAimPreferences();input();updateHud();if(prioritiesOpen){renderPriorities();el('priorities-auto-aim').focus();}if(aimPreferences.enabled&&!snapshot.paused)void resumeAudio();break;
    case 'aim-priorities':case 'shop-aim-priorities':openPriorities();break;
    case 'reset-priorities':aimPreferences=validateAimPreferences(null,aimPreferences.enabled);saveAimPreferences();renderPriorities();break;
    case 'close-priorities':closePriorities();break;
    case 'buy-now':buyRanked();break;
    case 'buy-priorities':openAutomation();break;
    case 'automation-buy-tab':automationTab='buy';renderAutomation();break;
    case 'automation-perk-tab':automationTab='perks';renderAutomation();break;
    case 'automation-done':automationOpen=false;returnRunScreen();roundCountdown.reset();break;
    case 'dev-open':case 'modal-dev-open':devPanel.show();break;
    case 'auto-play':configureAutoPlay();break;
    case 'watch-auto-play':startAutoPlay();break;
    case 'cancel-auto-play':closeModal();break;
    case 'stop-auto-play':stopAutoPlay();break;
    case 'auto-pause':snapshot.paused?resume():pause();break;
    case 'start':if(!autoPlayer){if(!devMode)runRetries.reset();startWave();}break;
    case 'next-wave':if(!autoPlayer)startWave();break;
    case 'retry-run':retryRun();break;
    case 'milestone-run':milestoneRun();break;
    case 'pause':snapshot.paused?resume():pause();break;
    case 'resume':resume();break;
    case 'help':case 'shop-help':help();break;
    case 'shop-skins':renderSkins();break;
    case 'category-workshop':shopCategory='workshop';renderShop();el('category-workshop').focus();break;
    case 'category-supplies':shopCategory='supplies';renderShop();el('category-supplies').focus();break;
    case 'category-powers':shopCategory='powers';renderShop();el('category-powers').focus();break;
    case 'open-shop':renderShop();el('wave-report').focus();break;
    case 'wave-report':renderReport();el('open-shop').focus();break;
    case 'back-shop':returnRunScreen();el('shop-skins').focus({preventScroll:true});break;
    case 'close-help':helpOpen=false;if(snapshot.phase===1)resume();else if(snapshot.phase===2||snapshot.phase===3){returnRunScreen();el('shop-help').focus();}else closeModal();break;
    case 'shop-music':case 'music':audio.toggleMusic();updateSoundButtons();if(snapshot.phase===2||snapshot.phase===3||(snapshot.phase===1&&!snapshot.paused))void audio.resume().catch(error=>setText('notice',`Audio unavailable: ${String(error)}`));break;
    case 'shop-effects':case 'effects':void audio.toggleEffects().then(updateSoundButtons).catch(error=>setText('notice',`Audio unavailable: ${String(error)}`));break;
    case 'death-wave':if(!autoPlayer&&game.death_wave()){audio.tone(90,0.5,'sawtooth',0.04);read();updateHud();}break;
    case 'restart':restart();break;
    case 'request-restart':case 'new-run':confirmRestart();break;
    case 'confirm-restart':restart();break;
    case 'cancel-restart':cancelRestart();break;
    case 'restore-run':restoreRun();break;
  }
});
canvas.addEventListener('pointermove',e=>{if(!renderer||autoPlayer||e.pointerType==='touch')return;aim=renderer.point(e.clientX,e.clientY);input();});
function releaseDeathWave(){if(!autoPlayer&&snapshot.phase===1&&!snapshot.paused&&game.death_wave()){void resumeAudio();audio.tone(90,.5,'triangle',.065,35);read();updateHud();}}
canvas.addEventListener('contextmenu',e=>{if(snapshot.phase===1&&!snapshot.paused){e.preventDefault();releaseDeathWave();}});
let wheelAmount=0,wheelAt=0;
canvas.addEventListener('wheel',e=>{
  if(autoPlayer||snapshot.phase!==1||snapshot.paused||e.ctrlKey)return;e.preventDefault();
  if(performance.now()-wheelAt>180)wheelAmount=0;
  wheelAt=performance.now();wheelAmount+=e.deltaY*(e.deltaMode===1?40:e.deltaMode===2?400:1);
  if(Math.abs(wheelAmount)<40)return;
  const direction=Math.sign(wheelAmount);wheelAmount=0;
  for(let step=1;step<=4;step++){const next=(weapon+direction*step+8)%4;if(snapshot.disabled_weapon!==next){selectWeapon(next);break;}}
},{passive:false});
canvas.addEventListener('pointerdown',e=>{if(autoPlayer || e.pointerType==='touch' || e.button!==0 || snapshot.phase!==1 || snapshot.paused)return;e.preventDefault();canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);aim=renderer.point(e.clientX,e.clientY);firing=true;input();resumeAudio();});
for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,e=>{if((e as PointerEvent).pointerType!=='touch')stopFiring();});
window.addEventListener('pointerup',e=>{if(e.pointerType!=='touch'&&!(e.target instanceof Element&&e.target.closest('#touch-controls')))stopFiring();});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
document.addEventListener('keydown',e=>{
  if(devPanel?.open)return;
  if(!game || e.ctrlKey || e.metaKey || e.altKey)return;
  if(e.key==='Escape'){e.preventDefault();if(automationOpen){automationOpen=false;returnRunScreen();roundCountdown.reset();return;}if(prioritiesOpen){closePriorities();return;}if(snapshot.phase===0){closeModal();return;}if(restartPrompt){cancelRestart();return;}if(snapshot.phase===1){if(snapshot.paused)resume();else pause();}else if(snapshot.phase===2){helpOpen=false;if(autoPlayer&&snapshot.paused)resume();else returnRunScreen();}else if(helpOpen){helpOpen=false;closeModal();if(snapshot.phase===3)gameOver();}return;}
  if(modal.open)return;
  if(e.key==='?' || e.key.toLowerCase()==='h'){help();return;}
  if(autoPlayer || snapshot.phase!==1 || snapshot.paused)return;
  if(/^[1-4]$/.test(e.key)){selectWeapon(Number(e.key)-1);return;}
  if(e.key.toLowerCase()==='q' && !e.repeat){if(game.death_wave())audio.tone(90,.5,'sawtooth',.04);read();updateHud();return;}
  const directions:Record<string,[number,number]>={ArrowUp:[0,-280],ArrowDown:[0,280],ArrowLeft:[-280,0],ArrowRight:[280,0]};
  if(directions[e.key]){e.preventDefault();aim=directions[e.key];input();}
  if(e.code==='Space' && e.target===canvas){e.preventDefault();firing=true;input();}
});
document.addEventListener('keyup',e=>{if(e.code==='Space'&&e.target!==el('touch-fire'))stopFiring();});
modal.addEventListener('cancel',e=>{e.preventDefault();if(prioritiesOpen)closePriorities();else if(restartPrompt)cancelRestart();});
window.addEventListener('blur',()=>{if(!autoPlayer)pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&!autoPlayer){pause();saveRun();}backgroundLast=performance.now();last=0;});
const observer=new IntersectionObserver(entries=>{if(entries[0]&&!entries[0].isIntersecting && game && snapshot.phase===1&&!autoPlayer)pause();},{threshold:0.1});observer.observe(canvas);
window.addEventListener('message',e=>{if(e.source===window.parent && e.origin===location.origin && e.data?.type==='towerium:pause')pause();});
window.addEventListener('pagehide',()=>{cancelAnimationFrame(animation);audio.pause();stopFiring();saveRun();});
window.addEventListener('pageshow',e=>{if(e.persisted){last=0;animation=requestAnimationFrame(frame);}});
let backgroundLast=performance.now();
let autoAccumulator=0;
function stepGame(dt:number){
  if(devMode)dt*=devSpeed;
  if(autoPlayer){
    autoAccumulator+=dt;
    while(autoAccumulator+1e-8>=1/60){autoAccumulator-=1/60;runAutoPlayer(1/60);game.advance(1/60);read();syncPhase();}
  }else{autoAccumulator=0;updateAim(dt);input();game.advance(dt);read();syncPhase();}
}
// Hidden tabs suspend animation frames. Catch up in bounded native steps instead.
window.setInterval(()=>{
  const now=performance.now(),elapsed=(now-backgroundLast)/1000;backgroundLast=now;
  if(!game||!autoPlayer||!document.hidden||snapshot.paused||helpOpen||restartPrompt)return;
  for(let remaining=Math.min(elapsed,60);remaining>0;){const dt=Math.min(remaining,.05);stepGame(dt);remaining-=dt;}
  audio.update(snapshot);updateHud();last=0;
},1000);
function frame(now:number) {
  if(autoPlayer&&document.hidden){last=0;animation=requestAnimationFrame(frame);return;}
  const dt=last?Math.min((now-last)/1000,0.1):0;last=now;
  updateAutomation(dt);stepGame(dt);renderer.draw(snapshot,displayedAim(),dt,assistedAim);audio.update(snapshot);
  touchControls.finishShot();
  if(now-lastSave>1000){saveRun();lastSave=now;}
  if(now-lastHud>100){updateHud();lastHud=now;}
  animation=requestAnimationFrame(frame);
}
async function boot() {
  el<HTMLButtonElement>('start').disabled=true;el('start').textContent='Initializing…';
  const [art]=await Promise.all([loadArt(),init()]);
  compatibleConfig=await createSaveCompatibility(configJson,[runKey,retryStorageKey]);
  game=new Game(seed,configJson);runRetries=new RunRetries(configJson,compatibleConfig);renderer=new Renderer(canvas,art);renderer.skin=cosmetics.selected;renderer.touchAim=touchDevice;devPanel=createDevPanel();read();updateHud();
  el<HTMLButtonElement>('start').disabled=false;el('start').textContent='Play';showIntro();
  try {
    const raw=localStorage.getItem(runKey);
    if(raw){
      const candidate=JSON.parse(raw);
      if(!candidate || typeof candidate!=='object' || Object.keys(candidate).sort().join(',')!=='config,seed,state' || !compatibleConfig(candidate.config) || !Number.isInteger(candidate.seed) || candidate.seed<0 || candidate.seed>0xffffffff || typeof candidate.state!=='string' || candidate.state.length>5_000_000)throw new Error('Incompatible Save');
      const check=Game.restore(configJson,candidate.state);check.free();savedRun=candidate;
      showIntro();
    }
  }catch{savedRun=null;try{localStorage.removeItem(runKey);}catch{/* Storage unavailable. */}}

  animation=requestAnimationFrame(frame);post('towerium:ready',{version:1});
  new ResizeObserver(()=>post('towerium:content-height',{height:document.documentElement.scrollHeight})).observe(app);
}
void boot().catch(error=>{
  el('intro').innerHTML='<h2>Unable To Load</h2><p>Check your connection, then reload.</p><button class="primary" id="reload-game">Reload</button>';
  el('reload-game').addEventListener('click',()=>location.reload());
  console.error('Towerium initialization failed:',error);
});

document.addEventListener('change',event=>{const input=event.target as HTMLInputElement;if(input.id==='dev-enable'){changeDevMode(input.checked);return;}if(input.id==='auto-buy-enabled'){automation.enabled=input.checked;roundCountdown.reset();automationAppliedWave=-1;saveAutomation();return;}if(input.id==='auto-perk-enabled'){automation.perkEnabled=input.checked;saveAutomation();return;}if(input.dataset.autoLimit!==undefined){const i=Number(input.dataset.autoLimit),rule=automation.buy[i];rule.limit=Math.max(0,Math.min(balance.upgrades[rule.id].cap,Math.floor(Number(input.value)||0)));saveAutomation();renderAutomation();}});
document.addEventListener('pointerdown',event=>{const button=(event.target as HTMLElement).closest<HTMLButtonElement>('[data-upgrade]');if(!button||button.disabled||autoPlayer||event.button!==0)return;suppressBuyClick=false;heldPurchased=false;heldStat=Number(button.dataset.upgrade);heldPointer=event.pointerId;holdSince=performance.now();holdTimer=window.setTimeout(repeatStat,400);});
document.addEventListener('pointerup',event=>{if(event.pointerId===heldPointer)stopStatHold();});document.addEventListener('pointercancel',stopStatHold);window.addEventListener('blur',stopStatHold);

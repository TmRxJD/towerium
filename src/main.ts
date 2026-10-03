import './game.css';
import { AutoPlayer } from './autoplay';
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
let last=0,lastHud=0,uiPhase=-1,helpOpen=false,resultSent=false,animation=0;
let best=0;
try {const stored=Number(localStorage.getItem('towerium.best-wave'));if(Number.isSafeInteger(stored)&&stored>0)best=stored;}catch{/* Storage is optional in embedded/private contexts. */}
const cosmetics=new Cosmetics(best);
const runKey='towerium.run.v1',configJson=JSON.stringify(balance);
let savedRun:{seed:number;state:string;config:string}|null=null,lastSave=0,restartPrompt=false;
let postWaveView:'report'|'shop'='report';
let autoPlayer:AutoPlayer|null=null;
let humanGame:Game|null=null,humanSeed=seed;
function resumeAudio(){void audio.resume().catch(error=>{console.error('Audio could not resume:',error);setText('notice','Audio Unavailable');});}
function saveRun() {
  if(autoPlayer || !game || !snapshot || snapshot.phase===0)return;
  try {
    if(snapshot.phase===3){localStorage.removeItem(runKey);savedRun=null;return;}
    savedRun={seed,state:game.save(),config:configJson};
    localStorage.setItem(runKey,JSON.stringify(savedRun));
  }catch{setText('notice','Run Saving Unavailable');}
}
function showIntro(){
  el('intro').innerHTML=`<img src="${towerUrl}" alt="" width="110" height="110"><h2>TOWERIUM</h2>${savedRun?'<button id="restore-run" class="primary">Resume Run</button><button id="new-run" class="quiet">New Run</button>':'<button id="start" class="primary">Play</button>'}<button id="auto-play" class="secondary">Auto Play</button>`;
}
function configureAutoPlay(){
  modalContent('<div class="modal-top"><h2 id="modal-title">Auto Play</h2></div><div class="auto-settings"><label>Build<select id="auto-build"><option value="balanced">Balanced</option><option value="offense">Offense</option><option value="defense">Defense</option><option value="economy">Economy</option></select></label><label>Aim<select id="auto-aim"><option value="nearest">Closest Threat</option><option value="priority">Priority Targets</option><option value="circle">Circle Sweep</option></select></label><label>Weapons<select id="auto-weapons"><option value="all">All Weapons</option><option value="projectile">Primary Only</option><option value="light">Favor Light Speed</option><option value="missile">Favor Smart Missiles</option><option value="hook">Favor Hook Bomb</option><option value="rotate">Rotate Weapons</option></select></label></div><div class="modal-actions"><button id="cancel-auto-play" class="quiet">Cancel</button><button id="watch-auto-play" class="primary">Watch</button></div>');
}
function startAutoPlay(){
  if(autoPlayer || snapshot.phase!==0)return;
  humanGame=game;humanSeed=seed;autoPlayer=new AutoPlayer(el<HTMLSelectElement>('auto-build').value,el<HTMLSelectElement>('auto-aim').value,el<HTMLSelectElement>('auto-weapons').value);
  seed=crypto.getRandomValues(new Uint32Array(1))[0];game=new Game(seed,configJson);
  firing=false;weapon=0;uiPhase=-1;resultSent=false;read();startWave();
}
function stopAutoPlay(){
  if(!autoPlayer || !humanGame)return;
  audio.pause();game.free();game=humanGame;humanGame=null;seed=humanSeed;autoPlayer=null;
  firing=false;weapon=0;helpOpen=false;restartPrompt=false;uiPhase=-1;last=0;resultSent=false;
  closeModal();read();syncPhase();updateHud();showIntro();el('auto-play').focus();
}
function runAutoPlayer(dt:number){
  if(!autoPlayer || helpOpen || restartPrompt)return;
  const action=autoPlayer.update(snapshot,dt);if(!action)return;
  if(action.kind==='combat'){
    aim=action.aim;weapon=action.weapon;firing=action.fire;input();
    if(action.deathWave)game.death_wave();
  }else if(action.kind==='buy'){
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
  aim=[0,-220];firing=false;uiPhase=-1;last=0;syncPhase();updateHud();
  if(snapshot.phase===1){pause();el('modal-title').textContent=`Run Restored · Wave ${snapshot.wave}`;}
  else if(snapshot.phase===2)void resumeAudio();
}

const skinIcon=(index:number)=>skinUrls[index]?`<img src="${skinUrls[index]}" alt="">`:'<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M58 32 45 55 19 55 6 32 19 9 45 9Z" fill="#122934" stroke="#b6fff2" stroke-width="3"/></svg>';

app.innerHTML=`
  <div class="shell">
    <header class="header">
      <div class="brand"><img src="${towerUrl}" alt="" width="28" height="28"><h1>TOWERIUM</h1></div>
      <nav aria-label="Game controls"><button id="help" class="quiet" title="Controls and enemy guide">Help</button><button id="music" class="quiet sound-toggle" aria-pressed="${!audio.musicMuted}" aria-label="Music" title="Music ${audio.musicMuted?'Off':'On'}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 17V5l11-2v12M9 9l11-2"/><ellipse cx="6" cy="18" rx="3" ry="2"/><ellipse cx="17" cy="16" rx="3" ry="2"/></svg></button><button id="effects" class="quiet sound-toggle" aria-pressed="${!audio.effectsMuted}" aria-label="Effects" title="Effects ${audio.effectsMuted?'Off':'On'}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9h4l5-4v14l-5-4H3zM16 8c3 2 3 6 0 8M19 5c5 4 5 10 0 14"/></svg></button><button id="pause" class="quiet" title="Pause or resume · Esc" disabled>Pause</button></nav>
    </header>
    <main class="layout">
      <section class="play-column" aria-label="Towerium game">
        <span id="run-mode" class="auto-badge" hidden>Auto Play</span><div class="hud">
          <div class="wave-stat"><span class="eyebrow">WAVE</span><strong id="wave">01</strong><span id="wave-timer" aria-label="Wave Timer">00:00</span></div>
          <div class="health-stat"><div class="stat-label"><span>HP</span><strong id="health-text">100 / 100</strong></div><div class="health-track" role="meter" aria-label="Tower health" aria-valuemin="0" aria-valuemax="200" aria-valuenow="100"><span id="health-fill"></span><span id="overheal-fill"></span></div></div>
          <div class="coin-stat" title="Coins">${coinIcon}<strong id="coins" aria-label="Coins">0</strong></div>
        </div>
        <div class="arena-wrap">
          <canvas id="arena" width="1100" height="1100" tabindex="0" aria-label="Tower battlefield. Aim with the pointer and hold to fire. On touch, drag to aim and fire. Arrow keys aim; Space fires. Weapons 1 through 4 or mouse wheel; Q or right click for Death Wave."></canvas>
          <div id="powers" class="power-strip" role="group" aria-label="Active powers"></div>
          <section id="intro" class="intro" aria-label="Start Towerium"><img src="${towerUrl}" alt="" width="110" height="110"><h2>TOWERIUM</h2><button id="start" class="primary">Play</button></section>
          <div id="notice" class="run-status" role="status" aria-live="polite"></div>
        </div>
        <div class="weapon-bar" aria-label="Weapon selection">${weaponNames.map((name,i)=>`<button class="weapon${i===0?' selected':''}" data-weapon="${i}" aria-label="${name}" aria-pressed="${i===0}" title="${name} · ${i+1}">${weaponIcons[i]}<b id="ammo-${i}" aria-hidden="true">${i===0?'∞':balance.weapons[i].ammo}</b></button>`).join('')}<button id="death-wave" class="weapon death-weapon" aria-label="Death Wave" title="Death Wave · Q · No charges" disabled>${weaponIcons[4]}<b id="charge-count" aria-hidden="true">0/3</b></button></div>
      </section>
    </main>
  </div>
  <dialog id="modal" aria-labelledby="modal-title"></dialog>
`;
const el=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const canvas=el<HTMLCanvasElement>('arena'),modal=el<HTMLDialogElement>('modal');
const setText=(id:string,text:string)=>{const node=el(id);if(node.textContent!==text)node.textContent=text;};
function post(type:string,payload:Record<string,unknown>={}) {
  window.dispatchEvent(new CustomEvent(type,{detail:payload}));
  if(window.parent!==window && document.referrer) {
    try {const origin=new URL(document.referrer).origin;if(origin!=='null')window.parent.postMessage({type,...payload},origin);}catch{/* Standalone embedding needs no parent handshake. */}
  }
}
function read() {snapshot=JSON.parse(game.snapshot()) as Snapshot;return snapshot;}
// Read-only diagnostics for integration tests. No test-only simulation controls.
export function getRenderSnapshot():Snapshot {return JSON.parse(game.snapshot()) as Snapshot;}
function input() {game.input(...aim,firing,weapon);}
function stopFiring() {firing=false;if(game)input();}
function selectWeapon(index:number) {if(snapshot.disabled_weapon===index)return;weapon=index;input();read();updateHud();}
function modalContent(html:string) {if(autoPlayer)html=html.replace('</h2>','</h2><span class="auto-badge">Auto Play</span>');modal.classList.remove('shop-modal','report-modal');modal.classList.toggle('auto-mode',!!autoPlayer);modal.innerHTML=html;if(!modal.open)modal.showModal();}
function closeModal() {if(modal.open)modal.close();}
function pause(show=true) {
  if(!game || (snapshot.phase!==1 && !(autoPlayer && snapshot.phase===2)))return;
  stopFiring();game.pause(true);audio.pause();read();last=0;updateHud();saveRun();
  if(show && !helpOpen)modalContent(`<div class="modal-top"><h2 id="modal-title">Paused</h2></div><div class="modal-actions"><button class="quiet" id="request-restart">${autoPlayer?'Restart Auto Play':'Restart'}</button>${autoPlayer?'<button class="quiet" id="stop-auto-play">Stop Auto Play</button>':''}<button class="primary" id="resume">Resume</button></div>`);
}
function resume() {helpOpen=false;closeModal();game.pause(false);stopFiring();resumeAudio();last=0;read();updateHud();if(snapshot.phase===2)returnRunScreen();else canvas.focus({preventScroll:true});}
function startWave() {closeModal();helpOpen=false;if(game.start_wave()){resumeAudio();last=0;read();syncPhase();updateHud();saveRun();canvas.focus({preventScroll:true});}}
function restart() {restartPrompt=false;if(!autoPlayer)savedRun=null;else autoPlayer=new AutoPlayer(autoPlayer.strategy,autoPlayer.aim,autoPlayer.weapons);closeModal();game.free();seed=crypto.getRandomValues(new Uint32Array(1))[0];game=new Game(seed,JSON.stringify(balance));aim=[0,-220];weapon=0;firing=false;resultSent=false;uiPhase=-1;read();startWave();}
function help() {
  const live=snapshot.phase===1;helpOpen=true;if(live)pause(false);
  modalContent(renderHelp({live,best,time:clock(snapshot.time),seed}));
}
function statText(value:number,index:number) {
  const u=balance.upgrades[index];
  const n=Math.round(value*u.display_scale*100)/100;
  const formatted=u.unit==='s' && !Number.isInteger(n)?n.toFixed(2):formatNumberForDisplay(n,'Period (.)',{mode:'compact',smallNumberMaxFractionDigits:2,notationMaxFractionDigits:2});
  if(index===13)return `${formatted} ${n===1?'Hit':'Hits'}`;
  return `${index===20?'+':''}${formatted}${u.unit}`;
}
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
    ['Kills',number(report.kills)],
  ];
  return `<section class="report-section" aria-labelledby="${id}"><div class="report-section-heading"><h3 id="${id}">${title}</h3><span aria-label="Time ${clock(report.duration_seconds)}">${clock(report.duration_seconds)}</span></div><dl class="report-stats">${stats.map(([label,value])=>`<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl></section>`;
}
function runFooter(ended=false) {
  const navigation=postWaveView==='report'?'<button id="open-shop" class="secondary">Shop</button>':'<button id="wave-report" class="secondary">Report</button>';
  const pauseOrRestart=ended?'':autoPlayer?'<button id="auto-pause" class="quiet">Pause</button>':'<button id="request-restart" class="quiet">Restart</button>';
  const actions=ended
    ? autoPlayer?'<button class="secondary" id="stop-auto-play">Stop Auto Play</button><button class="primary" id="restart">Watch Again</button>':'<button class="primary" id="restart">Play Again</button>'
    : navigation+`<button id="next-wave" class="primary" ${autoPlayer?'disabled title="Auto Play Starts The Next Wave"':''}>Next Wave →</button>`;
  return `<div class="shop-footer"><div class="shop-tools">${shopSoundButtons()}${pauseOrRestart}<button id="shop-help" class="quiet">Help</button><button id="shop-skins" ${autoPlayer?'disabled':''} class="quiet skin-button" title="${autoPlayer?'Skins Are Read Only During Auto Play':'Tower Skins'}" aria-label="Skins${cosmetics.fresh?', new skin unlocked':''}">${skinIcon(cosmetics.selected)}<span${cosmetics.fresh?' class="new-skin"':''}>Skins</span></button></div><p id="purchase-status" class="sr-only" role="status">${snapshot.notice.text.includes('upgraded')?esc(snapshot.notice.text):''}</p><div class="report-actions">${actions}</div></div>`;
}
function returnRunScreen() {
  if(snapshot.phase===3)gameOver();else if(postWaveView==='shop')renderShop();else renderReport();
}
function renderReport() {
  postWaveView='report';
  if(!autoPlayer)cosmetics.clear(snapshot.wave);
  modalContent(`<div class="shop-heading"><h2 id="modal-title">Wave ${snapshot.wave} Cleared</h2><div class="shop-wallet">${coinIcon}<strong>${number(snapshot.coins)}</strong></div></div><div class="report-body">${reportSection('This Wave',snapshot.wave_report,'wave-report-heading')}${reportSection('Overall',snapshot.overall_report,'overall-report-heading')}</div>${runFooter()}`);
  modal.classList.add('report-modal');
}
function renderShop() {
  postWaveView='shop';
  if(!autoPlayer)cosmetics.clear(snapshot.wave);
  modalContent(`<div class="shop-heading"><h2 id="modal-title">Workshop</h2><div class="shop-wallet">${coinIcon}<strong>${number(snapshot.coins)}</strong></div></div><div class="shop-body"><div class="upgrade-grid">${workshop.map((item,position)=>{const i=item.index,u=balance.upgrades[i];
    const capped=snapshot.levels[i]>=u.cap,afford=snapshot.coins>=snapshot.costs[i];
    return `<button class="upgrade" data-upgrade="${i}" title="${autoPlayer?'Auto Play Chooses Upgrades':capped?'Maximum Level':!afford?'Not Enough Coins':item.label}" ${autoPlayer||capped||!afford?'disabled':''} aria-label="Buy ${item.label} for ${snapshot.costs[i]} coins"><span class="upgrade-title"><img src="${workshopUrls[position]}" width="20" height="20" alt=""><strong>${item.label}</strong></span><div class="upgrade-bottom"><span><span class="upgrade-value">${statText(snapshot.values[i],i)}</span>${capped?'':' <span class="upgrade-value upgrade-preview">→ '+statText(snapshot.values[i]+u.step,i)+'</span>'}</span><b>${capped?'MAX':coinIcon+number(snapshot.costs[i])}</b></div></button>`;
  }).join('')}</div></div>${runFooter()}`);
  modal.classList.add('shop-modal');
}
function renderSkins() {
  cosmetics.fresh=false;
  modalContent(`<div class="shop-heading"><h2 id="modal-title">Tower Skins</h2></div><div class="skin-grid">${skins.map((skin,i)=>{
    const unlocked=cosmetics.unlocked(i),selected=i===cosmetics.selected;
    return `<button class="skin-card${selected?' selected':''}" data-skin="${i}" ${unlocked?'':'disabled'} aria-pressed="${selected}" aria-label="${skin.name}${unlocked?selected?', selected':'':`, unlocks after wave ${i*30}`}" title="${skin.name}${unlocked?'':` · Clear wave ${i*30}`}">${skinIcon(i)}<span>${unlocked?selected?'✓ '+skin.name:skin.name:'Wave '+i*30}</span></button>`;
  }).join('')}</div><div class="shop-footer"><button id="back-shop" class="quiet">← Back${snapshot.phase===3?' To Results':postWaveView==='shop'?' To Shop':' To Report'}</button></div>`);
  modal.classList.add('shop-modal');
}
function gameOver() {
  const cleared=Math.max(0,snapshot.wave-1);
  if(!autoPlayer&&cleared>best){best=cleared;try{localStorage.setItem('towerium.best-wave',String(best));}catch{/* Optional local best. */}}
  if(!autoPlayer&&!resultSent){audio.tone(180,.5,'triangle',.025,40);post('towerium:result',{payload:{version:1,seed,waveReached:snapshot.wave,wavesCleared:cleared,kills:snapshot.kills,coinsEarned:snapshot.earned,durationSeconds:Math.round(snapshot.time)}});resultSent=true;}
  modalContent(`<div class="shop-heading"><h2 id="modal-title">Game Over</h2><span class="run-result">Wave ${snapshot.wave} · ${cleared} Cleared</span></div><div class="report-body">${reportSection('Overall',snapshot.overall_report,'overall-report-heading')}</div>${runFooter(true)}`);
  modal.classList.add('report-modal');
}
function syncPhase() {
  if(snapshot.phase===uiPhase)return;uiPhase=snapshot.phase;
  el('intro').hidden=snapshot.phase!==0;
  if(snapshot.phase===2){stopFiring();renderReport();}
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
  const s=snapshot;
  el('run-mode').hidden=!autoPlayer;
  setText('wave',String(s.wave||1).padStart(2,'0'));setText('coins',number(s.coins));
  const cleanup=s.wave_time>=balance.waves.spawn_seconds;
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
  const active=s.powers.map((time,i)=>({time,i})).filter(p=>p.time>0);
  el('powers').innerHTML=active.map(({time,i})=>`<div role="img" title="${powerNames[i]}" class="active-power${time<balance.powers.warning?' expiring':''}" aria-label="${powerNames[i]}, ${Math.ceil(time)} seconds"><img src="${powerUrls[i]}" width="28" height="28" alt=""><b>${Math.ceil(time)}</b></div>`).join('');
  if(s.shields>0)el('powers').insertAdjacentHTML('beforeend',`<div role="img" class="active-power" title="Energy Shield" aria-label="Energy Shield, ${s.shields} of 3 charges"><img src="${powerUrls[9]}" width="28" height="28" alt=""><b>${'●'.repeat(s.shields)}${'○'.repeat(3-s.shields)}</b></div>`);
  const sabotaged=s.sabotage_time>0&&(s.disabled_weapon>=0||s.disabled_stat>=0);
  const disabledName=s.disabled_weapon>=0?weaponNames[s.disabled_weapon]:balance.upgrades[s.disabled_stat]?.name;
  el('notice').classList.toggle('sabotaged',sabotaged);
  setText('notice',sabotaged?`${disabledName} disabled · ${Math.ceil(s.sabotage_time)}s`:s.notice.time>0 && s.phase===1?s.notice.text:'');
}
document.addEventListener('click',event=>{
  const button=(event.target as HTMLElement).closest<HTMLButtonElement>('button');if(!button || button.disabled || !game)return;
  if(button.dataset.weapon!==undefined&&!autoPlayer){selectWeapon(Number(button.dataset.weapon));return;}
  if(button.dataset.skin!==undefined&&!autoPlayer){if(cosmetics.select(Number(button.dataset.skin))){renderer.skin=cosmetics.selected;returnRunScreen();el('shop-skins').focus({preventScroll:true});}return;}
  if(button.dataset.upgrade!==undefined&&!autoPlayer){const id=Number(button.dataset.upgrade);if(game.buy(id)){read();saveRun();const top=modal.querySelector('.shop-body')?.scrollTop??0;renderShop();const body=modal.querySelector('.shop-body');if(body)body.scrollTop=top;const next=modal.querySelector<HTMLButtonElement>(`[data-upgrade="${id}"]`);if(next&&!next.disabled)next.focus({preventScroll:true});else el('next-wave').focus({preventScroll:true});updateHud();}return;}
  switch(button.id){
    case 'auto-play':configureAutoPlay();break;
    case 'watch-auto-play':startAutoPlay();break;
    case 'cancel-auto-play':closeModal();break;
    case 'stop-auto-play':stopAutoPlay();break;
    case 'auto-pause':snapshot.paused?resume():pause();break;
    case 'start':case 'next-wave':if(!autoPlayer)startWave();break;
    case 'pause':snapshot.paused?resume():pause();break;
    case 'resume':resume();break;
    case 'help':case 'shop-help':help();break;
    case 'shop-skins':renderSkins();break;
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
canvas.addEventListener('pointermove',e=>{if(!renderer||autoPlayer)return;aim=renderer.point(e.clientX,e.clientY);input();});
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
canvas.addEventListener('pointerdown',e=>{if(autoPlayer || e.button!==0 || snapshot.phase!==1 || snapshot.paused)return;e.preventDefault();canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);aim=renderer.point(e.clientX,e.clientY);firing=true;input();resumeAudio();});
for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,stopFiring);
window.addEventListener('pointerup',stopFiring);
canvas.addEventListener('contextmenu',e=>e.preventDefault());
document.addEventListener('keydown',e=>{
  if(!game || e.ctrlKey || e.metaKey || e.altKey)return;
  if(e.key==='Escape'){e.preventDefault();if(snapshot.phase===0){closeModal();return;}if(restartPrompt){cancelRestart();return;}if(snapshot.phase===1){if(snapshot.paused)resume();else pause();}else if(snapshot.phase===2){helpOpen=false;if(autoPlayer&&snapshot.paused)resume();else returnRunScreen();}else if(helpOpen){helpOpen=false;closeModal();if(snapshot.phase===3)gameOver();}return;}
  if(modal.open)return;
  if(e.key==='?' || e.key.toLowerCase()==='h'){help();return;}
  if(autoPlayer || snapshot.phase!==1 || snapshot.paused)return;
  if(/^[1-4]$/.test(e.key)){selectWeapon(Number(e.key)-1);return;}
  if(e.key.toLowerCase()==='q' && !e.repeat){if(game.death_wave())audio.tone(90,.5,'sawtooth',.04);read();updateHud();return;}
  const directions:Record<string,[number,number]>={ArrowUp:[0,-280],ArrowDown:[0,280],ArrowLeft:[-280,0],ArrowRight:[280,0]};
  if(directions[e.key]){e.preventDefault();aim=directions[e.key];input();}
  if(e.code==='Space' && e.target===canvas){e.preventDefault();firing=true;input();}
});
document.addEventListener('keyup',e=>{if(e.code==='Space')stopFiring();});
modal.addEventListener('cancel',e=>{e.preventDefault();if(restartPrompt)cancelRestart();});
window.addEventListener('blur',()=>pause());
document.addEventListener('visibilitychange',()=>{if(document.hidden){pause();saveRun();}last=0;});
const observer=new IntersectionObserver(entries=>{if(entries[0]&&!entries[0].isIntersecting && game && snapshot.phase===1)pause();},{threshold:0.1});observer.observe(canvas);
window.addEventListener('message',e=>{if(e.source===window.parent && e.origin===location.origin && e.data?.type==='towerium:pause')pause();});
window.addEventListener('pagehide',()=>{cancelAnimationFrame(animation);audio.pause();stopFiring();saveRun();});
window.addEventListener('pageshow',e=>{if(e.persisted){last=0;animation=requestAnimationFrame(frame);}});
function frame(now:number) {
  const dt=last?Math.min((now-last)/1000,0.1):0;last=now;
  runAutoPlayer(dt);game.advance(dt);read();syncPhase();renderer.draw(snapshot,aim,dt);audio.update(snapshot);
  if(firing&&!snapshot.paused&&snapshot.phase===1&&snapshot.fx.some(f=>f[0]===0))audio.shot(snapshot.time,weapon);
  if(now-lastSave>1000){saveRun();lastSave=now;}
  if(now-lastHud>100){updateHud();lastHud=now;}
  animation=requestAnimationFrame(frame);
}
async function boot() {
  el<HTMLButtonElement>('start').disabled=true;el('start').textContent='Initializing…';
  const [art]=await Promise.all([loadArt(),init()]);
  game=new Game(seed,JSON.stringify(balance));renderer=new Renderer(canvas,art);renderer.skin=cosmetics.selected;read();updateHud();
  el<HTMLButtonElement>('start').disabled=false;el('start').textContent='Play';showIntro();
  try {
    const raw=localStorage.getItem(runKey);
    if(raw){
      const candidate=JSON.parse(raw);
      if(!candidate || typeof candidate!=='object' || Object.keys(candidate).sort().join(',')!=='config,seed,state' || candidate.config!==configJson || !Number.isInteger(candidate.seed) || candidate.seed<0 || candidate.seed>0xffffffff || typeof candidate.state!=='string' || candidate.state.length>5_000_000)throw new Error('Incompatible Save');
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

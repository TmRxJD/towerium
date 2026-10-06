import balance from '../engine/balance.json';
import { powerNames, powerUrls } from './assets';
import type { Snapshot } from './types';
import { weaponNames } from './help';

type Balance = typeof balance;
export interface DevHooks {
  read():Snapshot;
  config():Balance;
  seed():number;
  speed(value:number):void;
  getSpeed():number;
  leave():void;
  apply(config:Balance):Balance;
  validate(config:Balance):Balance;
  run(json:string):void;
  spawn(kind:number,count:number):void;
  power(kind:number):void;
  clear():void;
  fresh(wave:number,seed:number):void;
  pause():boolean;
  close(wasPaused:boolean):void;
}
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const title=(s:string)=>s.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
const labels:Record<string,string>={hp:'HP',speed:'Speed (Units/s)',mass:'Mass',radius:'Radius (Units)',damage:'Damage (HP)',attack_interval:'Attack Interval (s)',unlock:'First Wave',resistance:'Control Resistance (0–1)',heat:'Damage Growth / Contact',interval:'Fire Interval (s)',pickup:'Ammo / Pickup',pickup_every:'Every Nth Ammo Pickup',capacity:'Base Ammo Capacity',coins:'Coins / Kill'};
const clone=<T>(v:T):T=>structuredClone(v);
const scalar=(label:string,value:number,path:string)=>`<label>${escape(label)}<input data-path="${escape(path)}" type="number" step="any" value="${value}" required></label>`;

/** A second dialog preserves the underlying report/shop and its focus. */
export class DevPanel {
  readonly dialog=document.createElement('dialog');
  private draft:Balance;
  private tab='run';
  private group='enemies';
  private row=0;
  private wasPaused=false;
  private dirty=false;
  constructor(private hooks:DevHooks) {
    this.draft=clone(hooks.config());
    this.dialog.className='dev-panel';this.dialog.setAttribute('aria-labelledby','dev-title');
    document.body.append(this.dialog);
    this.dialog.addEventListener('cancel',e=>{e.preventDefault();this.close();});
    this.dialog.addEventListener('change',e=>this.change(e));
    this.dialog.addEventListener('submit',e=>e.preventDefault());
    this.dialog.addEventListener('click',e=>{const b=(e.target as Element).closest<HTMLButtonElement>('button');if(b)this.click(b);});
  }
  get open(){return this.dialog.open;}
  show(){this.wasPaused=this.hooks.pause();this.draft=clone(this.hooks.config());this.dirty=false;this.render();this.dialog.showModal();}
  private close(){this.dialog.close();this.hooks.close(this.wasPaused);}
  private status(text:string,error=false){const node=this.dialog.querySelector<HTMLElement>('#dev-status')!;node.textContent=text;node.classList.toggle('error',error);}
  private runEdit(s:Snapshot){return {coins:s.coins,stones:s.stones,hp:s.hp,ammo:s.ammo,charges:s.charges,shields:s.shields,levels:s.levels,power_levels:s.power_levels};}
  private fields(value:unknown,path:string):string {
    if(typeof value==='number'){const key=path.split('.').at(-1)!;return scalar(labels[key]??title(key),value,path);}
    if(!value||typeof value!=='object')return '';
    if(Array.isArray(value)&&value.every(v=>typeof v==='number')){
      const names=path.endsWith('.weights')||path.endsWith('.stones_per_enemy')?balance.enemies.map(e=>e.name):path.endsWith('.weapon_damage')?weaponNames:null;
      if(names)return `<details><summary>${title(path.split('.').at(-1)!)}</summary><div class="dev-fields">${value.map((v,i)=>scalar(names[i],v,`${path}.${i}`)).join('')}</div></details>`;
      return `<label class="dev-wide">${escape(title(path.split('.').at(-1)!))}<textarea data-path="${escape(path)}" rows="2">${escape(JSON.stringify(value))}</textarea></label>`;
    }
    return Object.entries(value).map(([key,v])=>{
      if(typeof v==='object'&&v!==null)return `<details><summary>${escape(path==='weapons'?weaponNames[Number(key)]:title((v as {name?:string}).name??key))}</summary><div class="dev-fields">${this.fields(v,`${path}.${key}`)}</div></details>`;
      return key==='effect_base'?'':this.fields(v,`${path}.${key}`);
    }).join('');
  }
  private render(){const s=this.hooks.read();
    const groupValue=(this.draft as unknown as Record<string,unknown>)[this.group];
    const wave=this.group==='waves';
    this.dialog.innerHTML=`<header class="dev-heading"><h2 id="dev-title">Dev Mode <small>Paused · Unscored</small></h2><button data-action="close" class="primary">Done</button></header><nav class="dev-tabs" aria-label="Dev Sections">${[['run','Live Run'],['balance','Balance'],['share','Experiments']].map(([id,label])=>`<button data-tab="${id}" aria-pressed="${this.tab===id}">${label}</button>`).join('')}</nav><div class="dev-body">${this.tab==='run'?`
      <form id="dev-run-form"><div class="dev-fields">${['coins','stones','hp','charges','shields'].map(k=>scalar(k==='hp'?'HP':k==='charges'?'Death Wave Charges':title(k),(s as unknown as Record<string,number>)[k],k)).join('')}${[1,2,3].map((i)=>scalar(['','Light Speed Ammo','Missile Ammo','Hook Bomb Ammo'][i],s.ammo[i],`ammo.${i}`)).join('')}</div><details><summary>Workshop Levels</summary><div class="dev-fields">${balance.upgrades.map((u,i)=>scalar(u.name,s.levels[i],`levels.${i}`)).join('')}</div></details><details><summary>Power Shop Levels</summary><div class="dev-fields">${balance.power_workshop.upgrades.map((u,i)=>[0,1].map(p=>scalar(`${u.name} · ${p===0?'Drop Share':'Effect'}`,s.power_levels[i][p],`power_levels.${i}.${p}`)).join('')).join('')}</div></details><button data-action="run" type="button" class="primary">Apply Run Values</button></form>
      <div class="dev-actions"><label>Enemy<select id="dev-enemy">${balance.enemies.map((e,i)=>`<option value="${i}">${escape(e.name)}</option>`).join('')}</select></label><label>Count<input id="dev-count" type="number" min="1" max="100" value="10"></label><button data-action="spawn">Spawn Enemies</button><button data-action="clear">Clear Enemies</button></div>
      <details><summary>Activate Powerups</summary><div class="dev-powers">${powerNames.map((name,i)=>`<button data-power="${i}"><img src="${powerUrls[i]}" alt="">${escape(name)}</button>`).join('')}</div></details>
      <div class="dev-actions"><label>Start Wave<input id="dev-wave" type="number" min="1" max="10000" value="${Math.max(1,s.wave)}"></label><label>Seed<input id="dev-seed" type="number" min="0" max="4294967295" value="${this.hooks.seed()}"></label><button data-action="fresh">New Sandbox At Wave</button></div>
      <label>Simulation Speed<input id="dev-speed" type="number" min="0.1" max="8" step="0.1" value="${this.hooks.getSpeed()}"></label><button data-action="speed">Set Simulation Speed</button>
      <p>New Sandbox replaces this Dev run with empty shops and a wave budget. Ammo grants respect capacity.</p>
    `:this.tab==='balance'?`
      <label>Settings Group<select id="dev-group">${Object.keys(this.draft).map(k=>`<option value="${k}" ${k===this.group?'selected':''}>${title(k)}</option>`).join('')}</select></label>
      ${wave?`<label>Wave Profile<input id="dev-profile" type="number" min="1" max="${this.draft.waves.milestones.length}" value="${this.row+1}"></label>`:''}
      <details><summary>Scale All Wave Profiles</summary><div class="dev-fields"><label>Enemy Count ×<input id="dev-count-scale" type="number" min="0.25" max="2" step="0.05" value="1"></label><label>Enemy Speed ×<input id="dev-speed-scale" type="number" min="0.1" max="5" step="0.05" value="1"></label><label>Enemy Mass ×<input id="dev-mass-scale" type="number" min="0.1" max="5" step="0.05" value="1"></label></div><button data-action="scale">Stage Wave Scaling</button></details>
      <form id="dev-balance-form"><div class="dev-fields">${wave?this.fields({...this.draft.waves,milestones:undefined},'waves')+this.fields(this.draft.waves.milestones[this.row],`waves.milestones.${this.row}`):this.fields(groupValue,this.group)}</div></form>
      <p>Chances use 0–1 (0.05 = 5%). Spawn composition/counts take effect next wave; starting bonuses need a new sandbox. Existing enemy HP stays unchanged. Power Shop bases follow their power settings automatically.</p>
    `:`<label>Experiment Name<input id="dev-name" value="Towerium Balance"></label><div class="dev-actions"><button data-action="export">Export Settings</button><label class="dev-import">Import Settings<input id="dev-import" type="file" accept="application/json,.json"></label></div><details><summary>Full Balance JSON</summary><label class="dev-wide">Balance JSON<textarea id="dev-json" rows="16" spellcheck="false">${escape(JSON.stringify(this.draft,null,2))}</textarea></label><button data-action="json">Stage JSON</button></details><button data-action="defaults">Stage Default Settings</button><div class="dev-exit"><p>Return To The Splash Screen. This Sandbox Run Will Be Discarded.</p><button data-action="leave">Leave Dev Mode</button></div><p>Exports include version, seed and wave notes. Import stages settings; Apply Balance validates them without replacing your run. Start Wave and Seed create a reproducible fresh sandbox.</p>`}</div><footer class="dev-footer"><span id="dev-status" role="status">${this.dirty?'Unapplied Balance Changes':'Sandbox Changes Do Not Affect Normal Saves Or Scores'}</span>${this.tab!=='run'?'<button data-action="apply" class="primary">Apply Balance</button>':''}</footer>`;
  }
  private set(root:unknown,path:string,value:unknown){const keys=path.split('.');let target=root as Record<string,unknown>;for(const key of keys.slice(0,-1))target=target[key] as Record<string,unknown>;target[keys.at(-1)!]=value;}
  private change(e:Event){const field=e.target as HTMLInputElement;
    try {
      if(field.id==='dev-group'){this.group=field.value;this.render();return;}
      if(field.id==='dev-profile'){if(!field.checkValidity())return;this.row=Number(field.value)-1;this.render();return;}
      if(field.id==='dev-import'){void this.import(field.files?.[0]);return;}
      if(field.dataset.path&&field.closest('#dev-balance-form')){const value=field.tagName==='TEXTAREA'?JSON.parse(field.value):field.valueAsNumber;if(typeof value==='number'&&!Number.isFinite(value))throw Error('Enter A Finite Number');this.set(this.draft,field.dataset.path,value);this.dirty=true;this.status('Unapplied Balance Changes');}
    }catch(error){this.status(String(error),true);}
  }
  private async import(file?:File){if(!file)return;try{if(file.size>2_000_000)throw Error('Settings File Exceeds 2 MB');const data=JSON.parse(await file.text());if(data.version!==1||!data.balance)throw Error('Expected Towerium Experiment Version 1');this.draft=this.hooks.validate(data.balance);this.dirty=true;this.render();this.status('Imported Settings Staged · Apply Balance To Use');}catch(error){this.status(String(error),true);}}
  private click(b:HTMLButtonElement){try{
    if(b.dataset.tab){this.tab=b.dataset.tab;this.render();return;}
    if(b.dataset.power){this.hooks.power(Number(b.dataset.power));this.status('Powerup Activated');return;}
    const field=(id:string)=>this.dialog.querySelector<HTMLInputElement>(`#${id}`)!;
    const number=(id:string)=>{const f=field(id);if(!f.reportValidity()||!Number.isFinite(f.valueAsNumber))throw Error('Invalid Number');return f.valueAsNumber;};
    switch(b.dataset.action){
      case 'close':this.close();return;
      case 'leave':this.dialog.close();this.hooks.leave();return;
      case 'speed':this.hooks.speed(number('dev-speed'));this.status('Simulation Speed Applied');break;
      case 'scale':{const count=number('dev-count-scale'),speed=number('dev-speed-scale'),mass=number('dev-mass-scale');for(const row of this.draft.waves.milestones){row.count=Math.max(2,row.count*count);row.speed*=speed;row.mass*=mass;}this.dirty=true;this.render();this.status('Wave Scaling Staged');break;}
      case 'run':{const form=this.dialog.querySelector<HTMLFormElement>('#dev-run-form')!;if(!form.reportValidity())return;const edit=this.runEdit(this.hooks.read());for(const f of form.querySelectorAll<HTMLInputElement>('[data-path]'))this.set(edit,f.dataset.path!,f.valueAsNumber);this.hooks.run(JSON.stringify(edit));this.render();this.status('Run Values Applied');break;}
      case 'spawn':this.hooks.spawn(Number(field('dev-enemy').value),number('dev-count'));this.status('Enemies Spawned');break;
      case 'clear':this.hooks.clear();this.status('Enemies Cleared · No Rewards Granted');break;
      case 'fresh':this.hooks.fresh(number('dev-wave'),number('dev-seed'));this.render();this.status('New Sandbox Ready · Shop Then Start Wave');break;
      case 'apply':this.draft=clone(this.hooks.apply(this.draft));this.dirty=false;this.status('Balance Applied');break;
      case 'json':{const parsed=JSON.parse(field('dev-json').value);this.draft=this.hooks.validate(parsed);this.dirty=true;this.status('JSON Staged');break;}
      case 'defaults':this.draft=clone(defaultBalance);this.dirty=true;this.render();this.status('Defaults Staged · Apply Balance To Use');break;
      case 'export':{const s=this.hooks.read();const file=new Blob([JSON.stringify({version:1,name:field('dev-name').value,seed:this.hooks.seed(),wave:s.pending_start_wave||s.wave,balance:this.draft},null,2)],{type:'application/json'});const url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download='towerium-experiment.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);this.status('Settings Exported');break;}
    }
  }catch(error){this.status(String(error),true);}}
}
export const defaultBalance=clone(balance);

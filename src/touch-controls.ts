type Position = [number,number];
interface TouchInput {
  ready:()=>boolean;
  fireReady:()=>boolean;
  aim:()=>Position;
  move:(aim:Position)=>void;
  fire:(held:boolean)=>void;
  weapon:()=>number;
  spent:()=>number;
}

export class TouchControls {
  private aimPointer:{id:number;x:number;y:number}|null=null;
  private firePointer:number|null=null;
  private pulse:number|null=null;
  private held=false;
  private sensitivity=1;
  private handedness:'right'|'left'='right';
  private pad:HTMLElement;
  private button:HTMLButtonElement;
  constructor(private root:HTMLElement,private canvas:HTMLCanvasElement,private input:TouchInput) {
    this.root.innerHTML=`<div id="aim-pad" role="group" aria-label="Trackpad Aim"><span aria-hidden="true">Drag To Aim</span></div><button id="touch-fire" class="primary" aria-pressed="false">Fire</button><div class="touch-settings"><label for="touch-sensitivity">Sensitivity</label><input id="touch-sensitivity" type="range" min="0.5" max="2" step="0.25" value="1"><label for="touch-hand" class="sr-only">Aiming Hand</label><select id="touch-hand"><option value="right">Right Hand</option><option value="left">Left Hand</option></select></div>`;
    this.pad=this.root.querySelector('#aim-pad')!;
    this.button=this.root.querySelector('#touch-fire')!;
    const sensitivity=this.root.querySelector<HTMLInputElement>('#touch-sensitivity')!;
    const hand=this.root.querySelector<HTMLSelectElement>('#touch-hand')!;
    try {
      const value=JSON.parse(localStorage.getItem('towerium.touch.v1')??'null');
      if(value && typeof value.sensitivity==='number' && value.sensitivity>=.5 && value.sensitivity<=2 && Number.isInteger(value.sensitivity*4) && (value.hand==='left'||value.hand==='right')) {
        this.sensitivity=value.sensitivity;this.handedness=value.hand;
      }
    } catch {/* Invalid or unavailable preferences leave the default controls. */}
    sensitivity.value=String(this.sensitivity);hand.value=this.handedness;
    this.root.dataset.hand=this.handedness;
    sensitivity.addEventListener('input',()=>{this.sensitivity=Number(sensitivity.value);this.save();});
    hand.addEventListener('change',()=>{this.reset();this.handedness=hand.value==='left'?'left':'right';this.root.dataset.hand=this.handedness;this.save();});
    this.pad.addEventListener('pointerdown',e=>{
      if(!this.input.ready()||this.aimPointer||e.button!==0)return;
      e.preventDefault();this.aimPointer={id:e.pointerId,x:e.clientX,y:e.clientY};this.pad.setPointerCapture(e.pointerId);
      this.pad.classList.add('tracking');
    });
    this.pad.addEventListener('pointermove',e=>{
      const previous=this.aimPointer;
      if(!previous||previous.id!==e.pointerId||!this.input.ready())return;
      const scale=1100/this.canvas.getBoundingClientRect().width*this.sensitivity;
      const [x,y]=this.input.aim();
      this.input.move([Math.max(-535,Math.min(535,x+(e.clientX-previous.x)*scale)),Math.max(-535,Math.min(535,y+(e.clientY-previous.y)*scale))]);
      previous.x=e.clientX;previous.y=e.clientY;
    });
    const endAim=(e:PointerEvent)=>{if(this.aimPointer?.id===e.pointerId){this.aimPointer=null;this.pad.classList.remove('tracking');}};
    for(const event of ['pointerup','pointercancel','lostpointercapture'] as const)this.pad.addEventListener(event,endAim);
    this.button.addEventListener('pointerdown',e=>{
      if(!this.input.ready()||!this.input.fireReady()||this.button.disabled||this.firePointer!==null||e.button!==0)return;
      e.preventDefault();this.firePointer=e.pointerId;this.button.setPointerCapture(e.pointerId);
      this.pulse=this.input.weapon()===3?this.input.spent():null;
      this.setFire(true);
    });
    const endFire=(e:PointerEvent,cancelled:boolean)=>{
      if(this.firePointer!==e.pointerId)return;
      this.firePointer=null;
      if(cancelled||this.pulse===null||!this.input.ready()||!this.input.fireReady()){this.pulse=null;this.setFire(false);}
    };
    this.button.addEventListener('pointerup',e=>endFire(e,false));
    for(const event of ['pointercancel','lostpointercapture'] as const)this.button.addEventListener(event,e=>endFire(e,true));
    this.button.addEventListener('keydown',e=>{if((e.code==='Space'||e.key==='Enter')&&!e.repeat&&this.input.ready()&&this.input.fireReady()){e.preventDefault();this.pulse=this.input.weapon()===3?this.input.spent():null;this.setFire(true);}});
    this.button.addEventListener('keyup',e=>{if(e.code==='Space'||e.key==='Enter'){e.preventDefault();if(this.pulse===null||!this.input.ready()||!this.input.fireReady()){this.pulse=null;this.setFire(false);}}});
  }
  private save(){try{localStorage.setItem('towerium.touch.v1',JSON.stringify({sensitivity:this.sensitivity,hand:this.handedness}));}catch{/* Preferences are optional in private contexts. */}}
  private setFire(held:boolean){if(this.held===held)return;this.held=held;this.button.setAttribute('aria-pressed',String(held));this.input.fire(held);}
  update(active:boolean,fireReady:boolean){
    if(!active)this.reset();
    else if(!fireReady)this.releaseFire();
    this.button.disabled=!active||!fireReady;
    this.button.title=!active?'Start Or Resume A Wave To Fire':!fireReady?'Weapon Empty Or Disabled':this.input.weapon()===3?'Tap For One Hook Bomb':'Hold To Fire';
    this.pad.setAttribute('aria-disabled',String(!active));
    this.finishShot();
  }
  finishShot(){if(this.pulse!==null&&(!this.input.ready()||!this.input.fireReady()||this.input.weapon()!==3||this.input.spent()>this.pulse)){this.pulse=null;this.setFire(false);}}
  releaseFire(){this.firePointer=null;this.pulse=null;this.setFire(false);}
  reset(){this.aimPointer=null;this.pad.classList.remove('tracking');this.releaseFire();}
}

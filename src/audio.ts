import type { Snapshot } from './types';
import music from './music-catalog.json';

export class Audio {
  private context?:AudioContext;
  private track?:HTMLAudioElement;
  private trackIndex=0;
  private musicPaused=true;
  private lastShot=-1;
  private previous?:Snapshot;
  private effects=new Set<string>();
  private lastEffect=-1;
  private lastDamage=-1;
  private lastPickup=-1;
  private mix?:GainNode;
  private noiseBuffer?:AudioBuffer;
  private voices=0;
  private flight?:{source:AudioBufferSourceNode;filter:BiquadFilterNode;gain:GainNode};
  private missileFlight(active:boolean){
    const c=this.context;
    if(!active||this.effectsMuted||!c||c.state!=='running'){
      if(this.flight){const flight=this.flight;this.flight=undefined;const now=c?.currentTime??0;flight.gain.gain.cancelScheduledValues(now);flight.gain.gain.setValueAtTime(flight.gain.gain.value,now);flight.gain.gain.linearRampToValueAtTime(0,now+.06);flight.source.stop(now+.06);flight.source.onended=()=>{flight.source.disconnect();flight.filter.disconnect();flight.gain.disconnect();};}return;
    }
    if(this.flight)return;
    const source=c.createBufferSource(),filter=c.createBiquadFilter(),gain=c.createGain();
    const buffer=c.createBuffer(1,c.sampleRate*2,c.sampleRate);const data=buffer.getChannelData(0);
    for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*(.8+.2*Math.sin(i/c.sampleRate*40));
    source.buffer=buffer;source.loop=true;filter.type='lowpass';filter.frequency.value=850;
    gain.gain.setValueAtTime(.0001,c.currentTime);gain.gain.linearRampToValueAtTime(.045,c.currentTime+.06);
    source.connect(filter).connect(gain).connect(this.output(c));source.start();this.flight={source,filter,gain};
  }
  private output(c:AudioContext){
    if(!this.mix){
      this.mix=c.createGain();this.mix.gain.value=.7;
      const limiter=c.createDynamicsCompressor();limiter.threshold.value=-20;limiter.knee.value=18;
      limiter.ratio.value=4;limiter.attack.value=.005;limiter.release.value=.15;
      this.mix.connect(limiter).connect(c.destination);
    }
    return this.mix;
  }
  private noise(duration:number,cutoff:number,volume:number){
    const c=this.context;if(this.effectsMuted||!c||c.state!=='running'||this.voices>=16)return;
    if(!this.noiseBuffer){this.noiseBuffer=c.createBuffer(1,Math.ceil(c.sampleRate*.6),c.sampleRate);const samples=this.noiseBuffer.getChannelData(0);for(let i=0;i<samples.length;i++)samples[i]=Math.random()*2-1;}
    const source=c.createBufferSource(),filter=c.createBiquadFilter(),gain=c.createGain();
    source.buffer=this.noiseBuffer;filter.type='lowpass';filter.frequency.setValueAtTime(cutoff,c.currentTime);
    filter.frequency.exponentialRampToValueAtTime(Math.max(80,cutoff*.25),c.currentTime+duration);
    gain.gain.setValueAtTime(.0001,c.currentTime);gain.gain.linearRampToValueAtTime(volume,c.currentTime+.006);
    gain.gain.exponentialRampToValueAtTime(.0001,c.currentTime+duration);
    source.connect(filter).connect(gain).connect(this.output(c));this.voices++;
    source.start(0,Math.random()*.1);source.stop(c.currentTime+duration);
    source.onended=()=>{this.voices--;source.disconnect();filter.disconnect();gain.disconnect();};
  }
  private explosion(mortar=true){this.noise(mortar?.65:.38,mortar?1400:1100,mortar?.11:.075);this.tone(mortar?85:110,mortar?.6:.35,'sine',mortar?.085:.055,32);}

  musicMuted=false;
  effectsMuted=false;
  constructor(){try{
    const legacy=localStorage.getItem('towerium.muted')==='true';
    this.musicMuted=(localStorage.getItem('towerium.music-muted')??String(legacy))==='true';
    this.effectsMuted=(localStorage.getItem('towerium.effects-muted')??String(legacy))==='true';
  }catch{/* Optional preferences. */}}
  toggleMusic(){this.musicMuted=!this.musicMuted;this.store('music',this.musicMuted);if(this.musicMuted)this.track?.pause();}
  async toggleEffects(){this.effectsMuted=!this.effectsMuted;this.store('effects',this.effectsMuted);
    if(this.effectsMuted){this.missileFlight(false);await this.context?.suspend();}else{this.context??=new AudioContext();await this.context.resume();}
  }
  private store(kind:string,muted:boolean){try{localStorage.setItem(`towerium.${kind}-muted`,String(muted));}catch{/* Optional preference. */}}
  pause(){this.musicPaused=true;this.track?.pause();this.missileFlight(false);}
  async resume(){
    this.musicPaused=false;
    if(!this.effectsMuted){this.context??=new AudioContext();await this.context.resume();}
    if(this.musicMuted)return;
    if(!this.track&&music.length){
      this.track=new globalThis.Audio();this.track.volume=.14;
      this.track.addEventListener('error',()=>console.error('Music could not load:',this.track?.error));
      this.track.addEventListener('ended',()=>{this.trackIndex=(this.trackIndex+1)%music.length;this.playTrack();});
      this.track.src=`${import.meta.env.BASE_URL}tower-assets/music/${music[0]}`;
    }
    if(this.track)await this.track.play().catch(error=>this.playbackError(error));
  }
  private playbackError(error:unknown){if(!(error instanceof DOMException && error.name==='NotAllowedError'))console.error('Music playback failed:',error);}
  private playTrack(){if(!this.track)return;this.track.src=`${import.meta.env.BASE_URL}tower-assets/music/${music[this.trackIndex]}`;if(!this.musicMuted&&!this.musicPaused)void this.track.play().catch(error=>this.playbackError(error));}
  tone(frequency:number,duration:number,type:OscillatorType='sine',volume=.035,end=frequency*.4){
    const c=this.context;if(this.effectsMuted||!c||c.state!=='running'||this.voices>=16)return;
    const oscillator=c.createOscillator(),gain=c.createGain();oscillator.type=type;
    oscillator.frequency.setValueAtTime(frequency,c.currentTime);oscillator.frequency.exponentialRampToValueAtTime(Math.max(20,end),c.currentTime+duration);
    gain.gain.setValueAtTime(.0001,c.currentTime);gain.gain.linearRampToValueAtTime(volume,c.currentTime+.003);gain.gain.exponentialRampToValueAtTime(.001,c.currentTime+duration);
    oscillator.connect(gain).connect(this.output(c));this.voices++;oscillator.start();oscillator.stop(c.currentTime+duration);
    oscillator.onended=()=>{this.voices--;oscillator.disconnect();gain.disconnect();};
  }
  shot(time:number,weapon:number){
    if(time<this.lastShot)this.lastShot=-1;
    if(time-this.lastShot<[.16,.18,.25,.35][weapon])return;this.lastShot=time;
    const variation=.95+Math.random()*.1;
    if(weapon===0){this.noise(.07,1700,.04);this.tone(190*variation,.09,'triangle',.04,75);}
    else if(weapon===1)this.tone(420*variation,.12,'sine',.04,180);
    else if(weapon===2){this.noise(.25,1400,.06);this.tone(115,.2,'sine',.035,65);}
    else if(weapon===3){this.noise(.12,750,.05);this.tone(105*variation,.2,'triangle',.06,45);}
  }

  update(s:Snapshot){
    this.missileFlight(s.phase===1&&!s.paused&&s.shots.some(shot=>shot[1]===2));
    const previous=this.previous;
    if(previous&&s.time>=previous.time&&s.phase===1&&!s.paused){
      const fired=[3,2,1,0].find(i=>s.weapon_report[i].shots>previous.weapon_report[i].shots);
      if(fired!==undefined)this.shot(s.time,fired);
      if(s.hp<previous.hp&&s.time-this.lastDamage>.35){this.lastDamage=s.time;this.tone(170,.12,'sine',.016,65);}
      if(s.charges>previous.charges)this.tone(420,.2,'sine',.018,650);
      if(s.shields>previous.shields)this.tone(260,.2,'sine',.035,420);
      const moduleGain=s.module_times.some((time,i)=>time>previous.module_times[i]+.5);
      if(moduleGain)this.tone(170,.25,'triangle',.025,260);
      else if(s.demon_invincible>previous.demon_invincible+.5)this.tone(110,.3,'triangle',.04,55);
      else {
        const i=s.powers.findIndex((time,index)=>time>previous.powers[index]+.5);
        if(i>=0)this.tone(300+i*35,.2,'sine',.016,480+i*35);
      }
      if(s.ammo.some((a,i)=>i>0&&a>previous.ammo[i])&&s.time-this.lastPickup>.3){this.lastPickup=s.time;this.tone(460,.09,'sine',.009,620);}
    }
    const current=new Set(s.fx.map(f=>f.slice(0,5).join(',')));
    if(!s.paused&&(s.phase===1||s.phase===2)&&s.time-this.lastEffect>.18){
      const candidates=s.fx.filter(f=>!this.effects.has(f.slice(0,5).join(','))&&[2,4,5,7,8,9,10].includes(f[0]));const fresh=candidates.find(f=>f[0]===10||f[0]===7||f[0]===8)??candidates[0];
      if(fresh){this.lastEffect=s.time;const kind=fresh[0];
        if(kind===10){this.noise(.9,380,.1);this.tone(60,.8,'sine',.065,28);}
        else if(kind===7)this.explosion();
        else if(kind===8)this.explosion(false);
        else if(kind===9)this.tone(320,.22,'sine',.045,120);
        else if(kind===5){this.noise(.065,900,.014);this.tone(420,.07,'triangle',.008,210);}
        else if(kind===4)this.tone(100,.18,'triangle',.025);
        else if(kind===2)this.tone(240,.3,'sine',.024,60);

      }
    }
    if(previous&&s.time<previous.time){this.lastEffect=-1;this.lastShot=-1;this.lastDamage=-1;this.lastPickup=-1;}
    this.effects=current;this.previous=s;
  }
}

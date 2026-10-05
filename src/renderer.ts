import balance from '../engine/balance.json';
import type { Art } from './assets';
import type { Snapshot } from './types';

const TAU=Math.PI*2;
const colors=['#cad5e5','#ff6592','#efb85f','#91a8ff','#7ce991','#f97764','#ff637d','#ffe85b','#ad84ff','#ffac58','#ed83cd','#72e8fc','#f265ff'];
const powerColors=['#b8a0ff','#78dce4','#8bd768','#bcb0f9','#ffda7a','#ff7187','#f1c86d','#88e8ac','#cb95ff','#83e9ff','#d6e85f','#ff3f68','#ffb273','#ca91eb','#83dbc0','#91baff','#a9f8e7','#a98dff','#ffd56c','#e497ff','#65b9ff','#a5edff','#e8d772'];
export class Renderer {
  skin=0;
  touchAim=false;
  private ctx:CanvasRenderingContext2D;
  private size=0;
  private ratio=0;
  private previous=new Map<number,[number,number]>();
  private current=new Map<number,[number,number]>();
  private snapshotTime=-1;
  private renderSinceTick=0;
  private extent=650;
  constructor(private canvas:HTMLCanvasElement,private art:Art) {
    const context=canvas.getContext('2d',{alpha:false});if(!context)throw new Error('Canvas 2D is not available in this browser.');this.ctx=context;
  }
  get worldExtent(){return this.extent;}
  point(clientX:number,clientY:number):[number,number] {const r=this.canvas.getBoundingClientRect();return [((clientX-r.left)/r.width*2-1)*this.extent,((clientY-r.top)/r.height*2-1)*this.extent];}
  private circle(x:number,y:number,r:number,stroke:string,fill?:string,width=1) {
    if(!Number.isFinite(r)||r<=0)return;
    const c=this.ctx;c.beginPath();c.arc(x,y,r,0,TAU);if(fill){c.fillStyle=fill;c.fill();}c.strokeStyle=stroke;c.lineWidth=width;c.stroke();
  }
  draw(s:Snapshot,aim:[number,number],frameDelta:number) {
    const c=this.ctx;
    const width=this.canvas.clientWidth,ratio=window.devicePixelRatio || 1;
    if(width!==this.size || ratio!==this.ratio) {this.size=width;this.ratio=ratio;this.canvas.width=Math.round(width*ratio);this.canvas.height=this.canvas.width;}
    const extent=s.view_extent;
    this.extent=extent;
    c.setTransform(this.canvas.width/1100,0,0,this.canvas.height/1100,this.canvas.width/2,this.canvas.height/2);
    c.fillStyle='#090f19';c.fillRect(-550,-550,1100,1100);
    const cleared=s.phase===2?s.wave:Math.max(0,s.wave-1);
    const backgrounds=this.art.backgrounds;
    const background=backgrounds[Math.floor(cleared/30)%backgrounds.length];
    if(background){
      const scale=Math.max(1100/background.width,1100/background.height);
      c.drawImage(background,-background.width*scale/2,-background.height*scale/2,background.width*scale,background.height*scale);
    }
    const glow=c.createRadialGradient(0,0,10,0,0,550);glow.addColorStop(0,background?'#11212b00':'#11212b');glow.addColorStop(1,background?'#090f1900':'#090f19');c.fillStyle=glow;c.fillRect(-550,-550,1100,1100);
    c.setTransform(this.canvas.width/(extent*2),0,0,this.canvas.height/(extent*2),this.canvas.width/2,this.canvas.height/2);
    const screenPixel=extent*2/Math.max(1,width);
    c.setLineDash([3*screenPixel,7*screenPixel]);this.circle(0,0,s.range,'#08131dcc',undefined,3*screenPixel);this.circle(0,0,s.range,'#baf7e0bb',undefined,screenPixel);c.setLineDash([]);
    this.fields(s);
    for(const [power,x,y,radius] of s.bots){
      const color=['#ffd56c','#e497ff','#65b9ff','#a5edff'][power-18];
      this.circle(x,y,radius,color+'55',color+'0b',1.5);
      this.circle(x,y,23,color+'77',color+'22',2);
      c.drawImage(this.art.powers[power],x-20,y-20,40,40);
    }
    for(const [x,y] of s.extra_orbs){this.circle(x,y,11,'#d5fff4','#93f9d8',2);this.circle(x,y,15,'#a0ffe755');}
    if(s.module_times[1]>0)this.circle(0,0,balance.modules.space_displacer_radius,'#dd8cb822');
    if(s.shields>0)this.circle(0,0,balance.tower_radius+10,'#83e9ffbb',undefined,2);
    if(s.wall_max_hp>0){
      this.circle(0,0,balance.tower_radius+5,s.wall_hp>0?'#8ca7bb77':'#8ca7bb22',undefined,4);
      if(s.wall_hp>0){c.beginPath();c.arc(0,0,balance.tower_radius+5,-Math.PI/2,-Math.PI/2+TAU*s.wall_hp/s.wall_max_hp);c.strokeStyle='#b8d7ed';c.lineWidth=4;c.stroke();}
    }
    if(s.time!==this.snapshotTime) {
      this.previous=this.current;this.current=new Map(s.enemies.map(e=>[e[0],[e[2],e[3]]]));
      for(const p of s.shots)this.current.set(p[0],[p[2],p[3]]);
      this.snapshotTime=s.time;this.renderSinceTick=0;
    } else if(!s.paused && s.phase===1) this.renderSinceTick+=frameDelta;
    const alpha=Math.min(1,this.renderSinceTick*60);
    const position=(id:number,x:number,y:number):[number,number]=>{const p=this.previous.get(id);return p&&!s.paused?[p[0]+(x-p[0])*alpha,p[1]+(y-p[1])*alpha]:[x,y];};
    for(const [kind,x,y] of s.areas) {
      if(kind===0) {this.circle(x,y,balance.powers.swamp_radius*s.aoe_scale,'#8dda6b44','#5aa84422',2);this.circle(x,y,balance.powers.swamp_radius*s.aoe_scale*0.65,'#8dda6b22');}
      else {c.drawImage(s.module_times[1]>0?this.art.hookBomb:this.art.mine,x-14,y-14,28,28);this.circle(x,y,18,s.module_times[1]>0?'#dd8cb866':'#efb85f66');}
    }
    const burns=new Map(s.enemy_burns.map(b=>[b[0],b]));
    const effects=new Map((s.enemy_effects??[]).map(effect=>[effect[0],effect]));
    const raySpins=new Map(s.ray_spins??[]);
    const enemyRadii=new Map(s.enemy_radii??[]);
    const mobility=new Map(s.enemy_mobility);
    for(const [id,kind,ex,ey,hp,maxHp,stun] of s.enemies) {
      const [x,y]=position(id,ex,ey);const radius=enemyRadii.get(id)??balance.enemies[kind].radius;
      const effect=effects.get(id);
      if(mobility.has(id))this.circle(x,y,radius+3,'#82d4faaa',undefined,1.5);
      if(kind===4){this.circle(x,y,balance.defense.protector_radius,'#8ee78870','#61ca5b10',2);this.circle(x,y,radius+6,'#a8ffad',undefined,2);}
      if(kind===9)this.circle(x,y,balance.specials.commander_radius,'#ffb55e77','#ce8c3610',2);
      if(effect?.[2])this.circle(x,y,radius+5,'#ffd192',undefined,2);
      if(effect?.[3]){
        c.strokeStyle='#ff467c88';c.lineWidth=2;c.beginPath();c.moveTo(x,y);c.lineTo(0,0);c.stroke();
        const drain=1-(s.time*1.4)%1;this.circle(x*drain,y*drain,4,'#ffb1c7','#f65b89');
      }
      if(kind===7&&effect&&effect[1]>0){
        this.circle(x,y,radius+7,`rgba(255,232,91,${effect[1]*.65})`,undefined,2+effect[1]*2);
      }
      if(kind===12)this.circle(x,y,radius+8,'#f071fa88',undefined,3);
      c.save();c.translate(x,y);c.rotate(kind===7?(raySpins.get(id)??0):Math.atan2(y,x)+Math.PI/2);
      // Extracted sprites have a 16% glow margin around the solid square edge.
      const spriteRadius=radius/0.68;
      c.drawImage(this.art.enemies[kind],-spriteRadius,-spriteRadius,spriteRadius*2,spriteRadius*2);c.restore();
      if(hp<maxHp||kind===12){const width=kind===12?150:radius*2,height=kind===12?6:3;c.fillStyle='#24323b';c.fillRect(x-width/2,y-spriteRadius-8,width,height);c.fillStyle=colors[kind];c.fillRect(x-width/2,y-spriteRadius-8,width*Math.max(0,hp/maxHp),height);}
      if(burns.has(id)){this.circle(x,y,radius+8,'#69c1ff99',undefined,2);for(let n=0;n<3;n++){const a=s.time*2+n*TAU/3;this.circle(x+Math.cos(a)*(radius+4),y+Math.sin(a)*(radius+4),3,'#b8eaff','#63b9ff');}}
      if(stun>0)this.circle(x,y,radius+6,'#fbdb86',undefined,2);
    }
    for(const [id,kind,sx,sy,a] of s.shots) {
      const [x,y]=position(id,sx,sy);c.save();c.translate(x,y);c.rotate(a);
      const color=kind===2?'#bbf74d':kind===3||kind===4?'#ff5266':'#9cf9eb';
      if(kind===2){
        c.fillStyle='#b6f54d88';c.beginPath();c.moveTo(-10,-3);c.lineTo(-27-Math.sin(s.time*45+id)*5,0);c.lineTo(-10,3);c.fill();
        c.fillStyle='#c8fa6a';c.strokeStyle='#6b972f';c.lineWidth=1.5;c.beginPath();c.moveTo(12,0);c.lineTo(4,-4);c.lineTo(-10,-4);c.lineTo(-10,4);c.lineTo(4,4);c.closePath();c.fill();c.stroke();
        c.fillStyle='#88c92f';c.beginPath();c.moveTo(-5,-4);c.lineTo(-13,-8);c.lineTo(-10,0);c.lineTo(-13,8);c.lineTo(-5,4);c.fill();
      }else{c.strokeStyle=color;c.lineWidth=kind===3?6:3;c.beginPath();c.moveTo(-11,0);c.lineTo(4,0);c.stroke();}
      if(kind===3||kind===4)c.drawImage(this.art.hookBomb,-20,-20,40,40);c.restore();
    }
    for(const [x,y] of s.hostile)this.circle(x,y,5,'#ff8c92','#f85d7d',2);
    for(const [sourceId,x,y,hits] of s.overcharge??[]){
      const source=s.enemies.find(e=>e[0]===sourceId);
      if(source){c.strokeStyle='#6cdbf12a';c.lineWidth=1;c.beginPath();c.moveTo(source[2],source[3]);c.lineTo(0,0);c.stroke();}
      this.circle(x,y,6+Math.min(hits,6),'#b5f5ff','#4cbedb',2);
      this.circle(x,y,12+Math.min(hits,6),'#82e9ff55',undefined,2);
    }
    for(const [,kind,x,y,life] of s.drops) {
      c.save();c.globalAlpha=life<balance.powers.warning?0.4+Math.abs(Math.sin(s.time*12))*0.6:1;
      this.circle(x,y,25,powerColors[kind]+'88','#111927',2);c.drawImage(this.art.powers[kind],x-18,y-18,36,36);
      c.restore();
    }
    for(let i=0;i<s.orb_count;i++) {const a=s.orb_angle+i*TAU/s.orb_count;const x=Math.cos(a)*balance.defense.orb_radius,y=Math.sin(a)*balance.defense.orb_radius;this.circle(x,y,9,'#dafff4','#66e7c0',3);this.circle(x,y,14,'#7fffcb33');}
    for(const r of s.deathwaves){this.circle(0,0,r,'#ff5268',undefined,7);if(r>14)this.circle(0,0,r-14,'#db344877',undefined,2);}
    this.effects(s);
    const angle=Math.atan2(aim[1],aim[0]);
    if(s.demon_time>0){
      const wing=this.art.demonWing,width=82,height=width*wing.height/wing.width,flap=Math.sin(s.time*5)*.055;
      for(const side of [-1,1]){c.save();c.scale(side,1);c.translate(-12,7);c.rotate(flap);c.globalAlpha=s.demon_invincible>0?.9:.55;c.drawImage(wing,-width,-height+12,width,height);c.restore();}
    }
    this.circle(0,0,balance.tower_radius,'#69cbbb88','#122934',2);this.circle(0,0,34,'#65d5c55a',undefined,2);
    c.save();c.rotate(angle);c.fillStyle='#b6fff2';c.fillRect(10,-3,34,6);c.restore();
    const skin=this.art.skins?.[this.skin];
    if(skin){const scale=60/Math.max(skin.width,skin.height);c.drawImage(skin,-skin.width*scale/2,-skin.height*scale/2,skin.width*scale,skin.height*scale);}
    else{c.beginPath();for(let i=0;i<6;i++){const a=i*TAU/6;const x=Math.cos(a)*25,y=Math.sin(a)*25;if(i===0)c.moveTo(x,y);else c.lineTo(x,y);}c.closePath();c.fillStyle='#122934';c.fill();c.strokeStyle='#b6fff2';c.lineWidth=3;c.stroke();}
    if(s.hp>s.max_hp)this.circle(0,0,46,'#b899fa99',undefined,3);
    if(s.phase===1 && !s.paused){
      const [x,y]=aim,scale=this.touchAim?extent*2/width:1,radius=this.touchAim?7*scale:10;
      if(this.touchAim)this.circle(x,y,radius,'#080d14',undefined,5*scale);
      this.circle(x,y,radius,'#c5f7e4',undefined,this.touchAim?2*scale:1);
      c.strokeStyle='#c5f7e4';c.lineWidth=this.touchAim?2*scale:1;
      for(const a of [0,Math.PI/2,Math.PI,Math.PI*1.5]){c.beginPath();c.moveTo(x+Math.cos(a)*(radius+4*scale),y+Math.sin(a)*(radius+4*scale));c.lineTo(x+Math.cos(a)*(radius+9*scale),y+Math.sin(a)*(radius+9*scale));c.stroke();}
    }
  }
  private fields(s:Snapshot) {
    const c=this.ctx,p=balance.powers;
    if(s.fallout_time>0){
      for(let i=0;i<20;i++){
        const angle=i*TAU/20+Math.sin(i)*.15,radius=80+((s.time*.1+i*.618)%1)*(s.range-60);
        this.circle(Math.cos(angle)*radius,Math.sin(angle)*radius,1.5,'#d6e85f55','#d6e85f33');
      }
    }
    if(s.powers[1]>0){
      const radius=s.chrono_radius;
      this.circle(0,0,radius,'#65cdd659','#4ab8ce0a',2);
      for(let i=0;i<48;i++){
        const angle=i*TAU/48,travel=(s.time*.38+i*.618)%1;
        const outer=38+travel*(radius-38),inner=Math.max(38,outer-12-travel*18);
        c.strokeStyle=`rgba(123,222,235,${Math.sin(travel*Math.PI)*.18})`;c.lineWidth=1;
        c.beginPath();c.moveTo(Math.cos(angle)*inner,Math.sin(angle)*inner);c.lineTo(Math.cos(angle)*outer,Math.sin(angle)*outer);c.stroke();
      }
    }
    if(s.powers[3]>0)for(const [x,y] of s.blackholes??[]){this.circle(x,y,s.power_effects[3]*s.aoe_scale,'#a495ca55','#6950881c');for(let i=0;i<6;i++)this.circle(x,y,22+i*14,'#ad96ea'+['aa','88','66','44','33','22'][i],i===0?'#04060d':undefined,2);}
    if(s.powers[4]>0)for(const angle of s.spotlights??[]){c.beginPath();c.moveTo(0,0);c.arc(0,0,this.extent*1.5,angle-p.spotlight_angle*Math.PI/360,angle+p.spotlight_angle*Math.PI/360);c.closePath();c.fillStyle='#ffe08420';c.fill();}
    if(s.ray_active){c.save();c.rotate(s.ray_angle);c.fillStyle='#ff486533';c.fillRect(0,-10,740,20);c.fillStyle='#ffc3cb';c.fillRect(0,-3,740,6);c.restore();}
    if(s.powers[6]>0){
      const glow=c.createRadialGradient(0,0,25,0,0,110);glow.addColorStop(0,'#ffdc6320');glow.addColorStop(1,'#ffdc6300');c.fillStyle=glow;c.fillRect(-110,-110,220,220);
      this.circle(0,0,53,'#ffda8538',undefined,2);
    }
  }
  private effects(s:Snapshot) {
    const c=this.ctx;
    for(const [kind,x,y,a,b,life] of s.fx) {
      c.save();c.globalAlpha=Math.min(1,life*4);
      if(kind===1){c.strokeStyle='#b5e4ff';c.lineWidth=3;c.beginPath();c.moveTo(x,y);c.lineTo(a,b);c.stroke();}
      if(kind===16){c.globalAlpha=Math.min(1,life*6);c.strokeStyle='#ffd46b';c.lineWidth=4;c.setLineDash([8,5]);c.beginPath();c.moveTo(x,y);c.lineTo(a,b);c.stroke();c.setLineDash([]);this.circle(a,b,7,'#fff1b5',undefined,2);}
      if(kind===5){
        const dx=a-x,dy=b-y,length=Math.hypot(dx,dy),segments=Math.max(4,Math.min(18,Math.ceil(length/22))),offset=Math.min(17,length*.13);
        c.beginPath();c.moveTo(x,y);
        for(let i=1;i<segments;i++){
          const t=i/segments,jitter=Math.sin(i*2.7+x*.013+y*.019+Math.floor(s.time*24)) * offset;
          c.lineTo(x+dx*t-dy/Math.max(1,length)*jitter,y+dy*t+dx/Math.max(1,length)*jitter);
        }
        c.lineTo(a,b);c.strokeStyle='#739aff55';c.lineWidth=7;c.stroke();c.strokeStyle='#d9ecff';c.lineWidth=1.8;c.stroke();
      }
      if(kind===2 || kind===4 || kind===3 || kind===7){this.circle(x,y,kind===2?a*(1-life/0.6):a*(1-life/0.5),'#'+(kind===3?'ff748b':kind===4||kind===7?'e7b7ff':'91e8df'),undefined,3);}
      if(kind===8)this.circle(x,y,a*(1-life/.4),'#ffb75a',undefined,3);
      if(kind===9)this.circle(x,y,a+(1-life/.4)*14,'#83e9ff',undefined,4);
      if(kind===10){this.circle(x,y,a*(1-life/.7),'#eef09b',undefined,8);this.circle(x,y,a*(1-life/.7)*.92,'#cbdc5b66',undefined,16);}
      if(kind===14 || kind===15){const progress=Math.max(0,Math.min(1,1-life/.65));this.circle(x,y,a*progress,kind===14?'#68bfff':'#aeebff',undefined,kind===14?6:3);if(kind===14)this.circle(x,y,a*progress*.93,'#b7eaff77',undefined,10);}
      if(kind===6){c.fillStyle='#e4c781';c.font='12px ui-monospace,monospace';c.textAlign='center';c.fillText(`+${Math.round(a)}`,x,y-(0.5-life)*35);}
      c.restore();
    }
  }
}

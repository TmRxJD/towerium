import { skins } from './assets';

const key='towerium.cosmetics.v1';
export class Cosmetics {
  completed=0;
  selected=0;
  fresh=false;
  constructor(best=0) {
    this.completed=Number.isSafeInteger(best)&&best>0?best:0;
    try {
      const stored=JSON.parse(localStorage.getItem(key)??'null');
      if(stored&&Number.isSafeInteger(stored.completed)&&stored.completed>=0)this.completed=Math.max(this.completed,stored.completed);
      const index=skins.findIndex(s=>s.id===stored?.selected);
      if(index>=0&&this.unlocked(index))this.selected=index;
    }catch{/* Local cosmetics remain available without storage. */}
  }
  unlocked(index:number) {return Number.isInteger(index)&&index>=0&&index<skins.length&&index*30<=this.completed;}
  clear(wave:number) {
    if(!Number.isSafeInteger(wave)||wave<=this.completed)return;
    if(Math.min(skins.length-1,Math.floor(wave/30))>Math.floor(this.completed/30))this.fresh=true;
    this.completed=wave;this.save();
  }
  select(index:number) {if(!this.unlocked(index))return false;this.selected=index;this.save();return true;}
  private save() {
    try{localStorage.setItem(key,JSON.stringify({completed:this.completed,selected:skins[this.selected].id}));}catch{/* Storage is optional. */}
  }
}

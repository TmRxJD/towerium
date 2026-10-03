import balance from '../engine/balance.json';
import { enemyNames, enemyUrls, workshop } from './assets';

import { weapons as weaponNames } from '../scripts/playtest-policy.mjs';
export { weaponNames };

const weaponDescriptions=[
  'Unlimited steady fire.',
  'Instant hits; one fewer hit against standard enemies. Shares Projectiles upgrades.',
  'Two homing missiles per second.',
  'Magnetic main bomb; six unguided splits.',
];

const enemyDescriptions=[
  'Approaches and attacks.',
  'Fast and fragile.',
  'Heavy; resists knockback.',
  'Fires from the edge of your range.',
  'Blocks passive damage; shoot it directly.',
  'Heavy assault enemy; immune to control.',
  'Drains health from the edge of your range.',
  'Charges a powerful shot from your range line.',
  'Splits into three smaller Scatters; they do not split again.',
  'Boosts nearby enemies; auras do not stack.',
  'Disables a special weapon or combat upgrade temporarily.',
  'Bounces an increasingly powerful shot between itself and the tower.',
  'Every tenth wave; slow, high HP, resists instant kills.',
];

const workshopByIndex=new Map(workshop.map(item=>[item.index,item]));
const upgradeByIndex=balance.upgrades.map((upgrade,index)=>({upgrade,index}));

export function renderHelp({live,best,time,seed}:{live:boolean;best:number;time:string;seed:number}):string {
  return `<div class="modal-top"><h2 id="modal-title">How To Play</h2></div>
    <div class="help-body">
      <section><h3>Controls</h3>
        <p>Aim with the pointer and hold to fire. Touch: drag to aim and fire.</p>
        <p><kbd>1–4</kbd> / Wheel: switch weapon · <kbd>Q</kbd> / Right Click: Death Wave · <kbd>Esc</kbd>: pause.<br>Keyboard: arrows aim, Space fires.</p>
      </section>
      <section><h3>Weapons &amp; Drops</h3>
        <div class="help-weapons">${weaponNames.map((name,i)=>`<div><kbd>${i+1}</kbd><strong>${name}</strong><span>${weaponDescriptions[i]}</span></div>`).join('')}</div>
        <p><strong>Pickups.</strong> Coins and ammo collect automatically. Only direct weapon kills supply ammo; all kills can supply coins and powers. Start with 40/20/5 special rounds. Each pickup adds 30 Light Speed and 2 Smart Missiles before upgrades. Every fourth pickup also adds 1 Hook Bomb round. Reserves hold 200/30/6 respectively. Shoot power-ups to activate them; repeated timed pickups add their full duration. Flashing drops and powers are about to expire.</p>
        <p><strong>Death Wave.</strong> Holds up to 3 charges, clears normal enemies and deals 150 damage to Super Bosses.</p>
        <p><strong>Power Fields.</strong> Black Hole creates two fields; Spotlight sweeps three beams. Poison Swamp covers a wide area and briefly stuns. Chrono Field reaches just beyond your range. Overlapping fields do not multiply effects; each enemy has a short cooldown between Swamp stuns.</p>
      </section>
      <section><h3>Wave Reports</h3>
        <p><strong>Accuracy.</strong> Fired rounds that hit enemies or collect power-ups; multishot rounds count separately, while bounces and split bombs do not add hits.</p>
        <p><strong>Hits Taken And Coins Earned.</strong> Hits Taken excludes shield blocks and Vampire drain. Coins Earned excludes starting coins and remains counted after purchases.</p>
        <p><strong>Time And Procs.</strong> Time is active gameplay, including cleanup. Proc chances fill independent meters; a 10% chance triggers every 10 eligible actions. Progress carries across waves and saves. Waves spawn for 30 seconds, then the timer shows cleanup time.</p>
      </section>
      <section><h3>Enemies</h3>
        <div class="enemy-list">${enemyNames.map((name,i)=>`<div><img src="${enemyUrls[i]}" width="28" height="28" alt=""><strong>${name}</strong><span>${balance.enemies[i].hp} HP</span><small>${enemyDescriptions[i]}${balance.enemies[i].weapon_damage.some(m=>m!==1)?' · '+balance.enemies[i].weapon_damage.map((m,w)=>m===1?'':`${weaponNames[w]} ${m}×`).filter(Boolean).join(', '):''}</small></div>`).join('')}</div>
        <p><strong>Waves.</strong> Special enemies grow more common later. Every 10 waves, base speed rises 5% and mass 8%; heavier enemies resist pushes and pulls. Enemy HP is fixed.</p>
        <p><strong>Contact And Thorns.</strong> Enemies attack on tower contact once per second; repeated hits from one living enemy grow stronger. Thorns returns normal bullet hits, starting at one and gaining one per upgrade. It deals half damage to Bosses and Super Bosses. Vampire drain and Overcharge bounces do not trigger Thorns.</p>
        <p><strong>Special Defenses.</strong> Destroying a Saboteur or Overcharge ends its effect. Sabotage can remove a purchased combat bonus or disable a special weapon, but cannot remove HP, regeneration, range or income upgrades. Protector shields block orbs, Thorns, mines and automatic damage powers; direct weapons and Death Wave still work.</p>
      </section>
      <section><h3>Upgrades</h3>
        <p><strong>Range.</strong> Outside the dashed ring, shots deal half damage, or a quarter to bosses. Bombs deal half a normal enemy’s maximum HP outside range, including split bombs; inside, they kill normal enemies and deal fixed damage to bosses. Split bombs cannot split again.</p>
        <p><strong>Run Upgrades.</strong> Spend coins between waves; upgrades last for the run. Ammo Quantity adds 20% to each base bundle per level; fractional rounds carry into later refills. Ammo chance applies to direct weapon kills; power chance applies to all kills. Power Duration affects the seven timed powers, not Recovery Packages, Death Wave or Energy Shield.</p>
        <p><strong>Health And Shields.</strong> Recovery Packages can heal above Health up to your Overheal % capacity. Energy Shield blocks one discrete hit per charge, up to three; Vampire drain does not consume charges. Blocked hits do not trigger Thorns.</p>
        <dl class="upgrade-help">${upgradeByIndex.map(({upgrade,index})=>`<dt>${workshopByIndex.get(index)!.label}</dt><dd>${upgrade.description}</dd>`).join('')}</dl>
        <p><strong>Cosmetics.</strong> Clear each 30 waves to unlock a tower skin. Skins and selection carry across runs; backgrounds change every 30 cleared waves. Cosmetics do not affect combat.</p>
        <p>Music: Krisu · The Tower soundtrack.</p>
        <p>Best: ${best} waves · <strong>This Run:</strong> ${time} · Seed ${seed}</p>
      </section>
    </div>
    <div class="modal-actions"><button class="primary" id="close-help">${live?'Back To Game':'Close'}</button></div>`;
}

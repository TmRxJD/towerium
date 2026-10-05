import { perks } from './perks';
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
        <p>Mouse: aim and hold to fire. Touch: drag the trackpad to aim; hold Fire with your other thumb. Lift and replant without moving the crosshair. Touch aim gently snaps within 14 screen pixels of enemies and pickups while firing. Hook Bomb fires once per press. Adjust sensitivity and aiming hand below the pad.</p>
        <p><kbd>1–4</kbd> / Wheel: switch weapon · <kbd>Q</kbd> / Right Click: Death Wave · <kbd>Esc</kbd>: pause.<br>Keyboard: arrows aim, Space fires.</p>
      </section>
      <section><h3>Weapons &amp; Drops</h3>
        <div class="help-weapons">${weaponNames.map((name,i)=>`<div><kbd>${i+1}</kbd><strong>${name}</strong><span>${weaponDescriptions[i]}</span></div>`).join('')}</div>
        <p><strong>Critical Coin.</strong> Basics drop no coins normally. This timed power grants their coin reward, multiplied by Coins/Kill and active overlaps.</p><p><strong>Pickups.</strong> Coins and ammo collect automatically. Direct weapon kills drop ammo; all kills can supply coins and powers. Start with 40/20/5 special rounds. Each pickup adds 35 Light Speed and 2 Smart Missiles before upgrades. Every fourth pickup also adds 1 Hook Bomb round. Base reserves hold 200/30/6; Max Ammo Capacity raises these limits. Shoot power-ups to activate them; repeated timed pickups add time up to the Power Stack Cap (50s initially, 70s maximum). Flashing drops and powers are about to expire.</p>
        <p><strong>Precision Refills.</strong> Every ${balance.precision_ammo.hits} original manual cannon hits refill ${balance.precision_ammo.light} Light Speed and ${balance.precision_ammo.missiles} Missile; every ${balance.precision_ammo.hook_every} refills add ${balance.precision_ammo.hooks} Hook Bomb. Extras, bounces and automatic shots do not count. Ammo Quantity and capacity apply.</p>
        <p><strong>Death Wave.</strong> Holds up to 3 charges, clears normal enemies and deals 150 base damage to Super Bosses.</p>
        <p><strong>Power Fields.</strong> Black Hole holds enemies in two fields and deals one bullet hit per second; Spotlight sweeps three beams. Swamp briefly stuns and deals 1 damage every 4 seconds. Chrono Field slows enemies just beyond your range. Death Ray clears Basics, Fasts and Ranged on contact; other enemies take two extra bullet hits per beam contact. It fires for 3 seconds, rests for 2, then restarts from a random angle. Overlapping fields do not stack.</p>
        <p><strong>Nuke.</strong> Clears Basics, Fasts and Ranged; fallout halves enemy attack speed for 30 seconds. <strong>Demon Mode.</strong> Drops at most once per minute. Invincible for 10 seconds; enemies take double damage for 30. Duration upgrades extend fallout and bonus damage, but not invincibility.</p>
        <p><strong>Modules.</strong> Death Penalty makes 5% of enemies die in one hit, including bosses. Landmines remain until triggered; at the mine limit, new mines are skipped. Space Displacer spaces them evenly in an inner orbit opposite the Orbs. Multiverse Nexus activates Golden Tower, Spotlight and Black Hole together, adding time if already active.</p>
        <p><strong>Pulsar Harvester.</strong> Weapon hits have a 2.5% base proc chance. Each proc permanently lowers that enemy’s speed and mass by 5%, down to 25% of its original values.</p>
      </section>
      <section><h3>Wave Reports</h3>
        <p><strong>Wall.</strong> Wall HP unlocks contact protection with normal Thorns. Ranged attacks bypass it. A broken wall rebuilds after its timer. Range automatically zooms the battlefield out.</p>
        <p><strong>Retries.</strong> Three per run. Replay your last cleared ten-wave milestone with both shops restored. Cleared fifty-wave milestones unlock fresh starts with empty shops and coin/Stone budgets. Auto Play is separate and continues out of focus. Choose a wave and build; the bot spends its starting coin/Stone budgets before combat. Reaction delay, aim speed and weapon switching are adjustable.</p>
        <p><strong>Accuracy.</strong> Main shots that hit enemies or collect power-ups. Multishot extras, bounces and split bombs do not affect accuracy.</p>
        <p><strong>Hits Taken And Coins Earned.</strong> Hits Taken excludes shield blocks and Vampire drain. Coins Earned excludes starting coins and remains counted after purchases.</p>
        <p><strong>Time And Procs.</strong> Time is active gameplay, including cleanup. Proc chances fill independent meters; a 10% chance triggers every 10 eligible actions. Progress carries across waves and saves. Waves spawn for 30 seconds, then the timer shows cleanup time.</p>
      </section>
      <section><h3>Automation</h3><p>Buy spends coins once. Its checkbox repeats between waves and starts the next wave after 5s; uncheck to stop. Buy &amp; Perk Priorities sets purchase order, level limits and perk choices. Hold a workshop stat to buy faster over time.</p></section><section><h3>Auto Aim</h3><p>Toggle Auto Aim beside the weapons. Reorder or disable Aim Priorities any time; editing pauses combat. Higher rules win, then distance breaks ties. The automatic cannon fires alongside your manual weapon. It keeps its own priority target and cooldown. Auto Cannon Efficiency scales automatic cannon/LSS combat stats from 10% to 110%, with whole shot quantities. Targeting Speed improves traversal. Auto Weapons unlocks LSS, missiles, then bombs; premium ammo is reserved for tougher threats. Death Wave stays manual. Mobile starts with Auto Aim on. Assisted runs are labelled in results.</p></section>
      <section><h3>Perks</h3><p>Choose one of three after waves 5, 15, 30, 50, 75, then increasingly spaced waves. Perks last for this run; maxed choices leave the pool. Fresh milestone runs and older saves begin their own schedule. Tradeoffs apply both benefits and penalties.</p><div class="perk-help">${perks.map(({name,effect,cap})=>`<p><strong>${name}.</strong> ${effect} · ${cap} ${cap===1?'level':'levels'}.</p>`).join('')}</div></section>
      <section><h3>Extra Powers</h3>
        <p><strong>Extra Orbs.</strong> Three faster Orbs orbit through Black Hole centers in reverse, deal one extra bullet hit, and increase Orb kill coins.</p>
        <p><strong>Area Of Effect.</strong> Doubles bomb, mine, Swamp and Flame splash size and damage, plus Black Hole and Shockwave reach. Chrono reach gains 15%.</p>
        <p><strong>Bots.</strong> Roam inside range; upgrade each radius with Stones. Gold multiplies kill coins by 1.2 and awards a Stone every 20 eligible aura kills. Amp doubles damage from other sources. Neither attacks.</p>
        <p><strong>Flame And Thunder.</strong> Flame pulses every 5s: burns deal 1, 2, 3, 4, then 5 bullet hits over five seconds. Thunder stuns on radius contact for 3s, then slows for 5s at half speed. Protectors block these attacks.</p>
      </section>
      <section><h3>Enemies</h3>
        <div class="enemy-list">${enemyNames.map((name,i)=>`<div><img src="${enemyUrls[i]}" width="28" height="28" alt=""><strong>${name}</strong><span>${balance.enemies[i].hp} HP</span><small>${enemyDescriptions[i]}${balance.enemies[i].weapon_damage.some(m=>m!==1)?' · '+balance.enemies[i].weapon_damage.map((m,w)=>m===1?'':`${weaponNames[w]} ${m}×`).filter(Boolean).join(', '):''}</small></div>`).join('')}</div>
        <p><strong>Waves.</strong> Wave 400 maps to Tower wave 10,000 for speed, mass and special arrivals. Heavier enemies resist pushes and pulls. Every tenth wave adds one cannon hit of enemy health.</p>
        <p><strong>Coin Overlap.</strong> GT, BH, SL, Orb kills and enemies hit by DW each grant 15% more coins. Bonuses multiply: all five give about 2×. BH and SL check where the enemy dies; overlapping holes or beams count once.</p>
        <p><strong>Supplies.</strong> Coins buy ammo, Death Wave charges and ready effects for the next wave. Fallout buys the attack slow; its screen clear is pickup-only. Timed powers add remaining time up to the purchased Power Stack Cap (50–70s); Demon invincibility stays capped at 50s.</p>
        <p><strong>Rapid Fire.</strong> Normal volleys trigger short 4× firing bursts. Chance caps at 10%; active bursts cannot retrigger.</p>
        <p><strong>Contact And Thorns.</strong> Enemies attack on tower contact once per second; repeated hits from one living enemy grow stronger. Thorns returns normal bullet hits, starting at one and gaining one per upgrade. It deals half damage to Bosses and Super Bosses. Vampire drain and Overcharge bounces do not trigger Thorns.</p>
        <p><strong>Special Defenses.</strong> Overcharge doubles damage each tower hit (12 → 24 → 48 → 96). Destroying a Saboteur or Overcharge ends its effect. Sabotage can remove a purchased combat bonus or disable a special weapon, but cannot remove HP, regeneration, range or income upgrades. Protector shields block orbs, Thorns, mines and automatic damage powers; direct weapons and Death Wave still work.</p>
      </section>
      <section><h3>Upgrades</h3>
        <p><strong>Range.</strong> Outside the dashed ring, shots deal half damage, or a quarter to bosses. Bombs deal half a normal enemy’s maximum HP outside range, including split bombs; inside, they kill normal enemies and deal fixed damage to bosses. Split bombs cannot split again.</p>
        <p><strong>Auto Buy.</strong> Buy purchases once. Check the box to buy between waves and start after 5 seconds; uncheck to stop. Settings ranks upgrades, level limits and perk choices. Hold an upgrade to buy faster.</p>
        <p><strong>Run Upgrades.</strong> Spend coins between waves; upgrades last for the run. Ammo Quantity adds 20% per level; fractions carry forward. Ammo comes from direct kills; powers can come from any kill. Above 100 enemies per wave, power chance scales with density to keep supply steady. The shop shows the adjusted chance; upgrades increase supply proportionally. Timed pickups add remaining time up to the Power Stack Cap. Duration upgrades exclude Demon invincibility; packages, Death Wave and shields have no duration.</p>
        <p><strong>Health And Shields.</strong> Recovery Packages can heal above Health up to your Overheal % capacity. Energy Shield blocks one discrete hit per charge, up to three; Vampire drain does not consume charges. Blocked hits do not trigger Thorns.</p>
        <dl class="upgrade-help">${upgradeByIndex.map(({upgrade,index})=>`<dt>${workshopByIndex.get(index)!.label}</dt><dd>${upgrade.description}</dd>`).join('')}</dl>
        <p><strong>Power Stones.</strong> Special enemies award Stones automatically: 1 each, bosses 2, Super Bosses 5. Spend them in Shop → Powerups. Drop Share shifts the mix of powerups without increasing total drops; effect upgrades strengthen the selected power. Both shops reset with a new run.</p>
        <p><strong>Cosmetics.</strong> Clear each 30 waves to unlock a tower skin. Skins and selection carry across runs; backgrounds change every 30 cleared waves. Cosmetics do not affect combat.</p>
        <p>Music: Krisu · The Tower soundtrack.</p>
        <p>Best: ${best} waves · <strong>This Run:</strong> ${time} · Seed ${seed}</p>
      </section>
    </div>
    <div class="modal-actions"><button class="primary" id="close-help">${live?'Back To Game':'Close'}</button></div>`;
}

import { test, expect } from '@playwright/test';

async function readBalance(page) {
  return page.evaluate(async()=>await(await fetch('/engine/balance.json')).json());
}

async function makeClearedWaveSave(page,seed=42) {
  return page.evaluate(async seed=>{
    const {default:init,Game}=await import('/src/wasm/towerium.js');await init();
    const config=await(await fetch('/engine/balance.json')).json(),configText=JSON.stringify(config);
    const game=new Game(seed,configText);
    if(!game.start_wave())throw new Error('Could not start the authentic shop-save fixture wave');
    let snapshot=JSON.parse(game.snapshot()),frames=0;
    while(snapshot.phase===1&&frames<18000){
      const enemy=snapshot.enemies
        .filter(candidate=>Math.hypot(candidate[2],candidate[3])<=snapshot.range+0.1)
        .sort((a,b)=>Math.hypot(a[2],a[3])-Math.hypot(b[2],b[3]))[0];
      game.input(enemy?.[2]??0,enemy?.[3]??200,!!enemy,0);
      for(let i=0;i<15&&frames<18000;i++,frames++)game.advance(1/60);
      snapshot=JSON.parse(game.snapshot());
    }
    const state=game.save();game.free();
    if(snapshot.phase!==2)throw new Error(`Shop-save fixture did not naturally clear wave one: phase=${snapshot.phase}, enemies=${snapshot.enemies.length}, remaining=${snapshot.remaining}, spawned=${snapshot.spawned}, ticks=${snapshot.wave_ticks}`);
    return {seed,config:configText,state};
  },seed);
}

async function stageRunOnNextNavigation(page,saved,marker) {
  await page.addInitScript(({saved,marker})=>{
    if(sessionStorage.getItem(marker))return;
    localStorage.setItem('towerium.run.v1',JSON.stringify(saved));
    sessionStorage.setItem(marker,'true');
  },{saved,marker});
}

async function readSnapshot(page) {
  return page.evaluate(async()=>{
    const entry=[...document.querySelectorAll('script[type="module"][src*="/src/main.ts"]')][0];
    if(!entry)throw new Error('Towerium entry module was not found');
    return (await import(entry.src)).getRenderSnapshot();
  });
}

async function readWaveReport(page) {
  const sections=page.locator('.report-section');
  await expect(sections).toHaveCount(2);
  const labels=['Accuracy','Shots Fired','Hits Taken','Powerups Collected','Coins Earned','Kills'];
  const report=await sections.evaluateAll(nodes=>nodes.map(section=>({
    title:section.querySelector('h3')?.textContent?.trim(),
    time:section.querySelector('.report-section-heading span')?.getAttribute('aria-label'),
    stats:[...section.querySelectorAll('dl.report-stats>div')].map(row=>({
      label:row.querySelector('dt')?.textContent?.trim(),
      value:row.querySelector('dd')?.textContent?.trim(),
    })),
  })));
  expect(report.map(section=>section.title)).toEqual(['This Wave','Overall']);
  for(const section of report){
    expect(section.stats.map(stat=>stat.label)).toEqual(labels);
    expect(section.stats.every(stat=>stat.value.length>0)).toBe(true);
    expect(section.time).toMatch(/^Time \d{2}:\d{2}$/);
  }
  return report;
}

async function expectReportMatchesSnapshot(page,snapshot) {
  const report=await readWaveReport(page);
  for(const [sectionIndex,source] of [[0,snapshot.wave_report],[1,snapshot.overall_report]]){
    const values=Object.fromEntries(report[sectionIndex].stats.map(stat=>[stat.label,stat.value]));
    expect(values.Accuracy).toBe(source.shots_fired===0?'—':`${Math.round(source.accuracy)}%`);
    expect(values['Shots Fired']).toBe(String(source.shots_fired));
    expect(values['Hits Taken']).toBe(String(source.hits_taken));
    expect(values['Powerups Collected']).toBe(String(source.powerups_collected));
    expect(values['Coins Earned']).toBe(String(Math.round(source.coins_earned)));
    expect(values.Kills).toBe(String(source.kills));
  }
  return report;
}

async function expectOverallMatchesSnapshot(page,snapshot) {
  const section=page.locator('.report-section');
  await expect(section).toHaveCount(1);
  await expect(section.locator('h3')).toHaveText('Overall');
  const values=Object.fromEntries(await section.locator('dl.report-stats>div').evaluateAll(rows=>rows.map(row=>[
    row.querySelector('dt')?.textContent?.trim(),row.querySelector('dd')?.textContent?.trim(),
  ])));
  const source=snapshot.overall_report;
  expect(values.Accuracy).toBe(source.shots_fired===0?'—':`${Math.round(source.accuracy)}%`);
  expect(values['Shots Fired']).toBe(String(source.shots_fired));
  expect(values['Hits Taken']).toBe(String(source.hits_taken));
  expect(values['Powerups Collected']).toBe(String(source.powerups_collected));
  expect(values['Coins Earned']).toBe(String(Math.round(source.coins_earned)));
  expect(values.Kills).toBe(String(source.kills));
}

async function footerButtonIds(page) {
  return page.locator('.shop-footer button').evaluateAll(buttons=>buttons.map(button=>button.id).sort());
}

async function expectRunFooter(page,navigationId) {
  const ids=['shop-effects','shop-music','next-wave','request-restart','shop-help','shop-skins',navigationId].sort();
  expect(await footerButtonIds(page)).toEqual(ids);
  const navigation=page.locator(`#${navigationId}`);
  await expect(navigation).toHaveClass(/secondary/);
  expect(await navigation.evaluate(button=>button.nextElementSibling?.id)).toBe('next-wave');
  expect(await navigation.evaluate(button=>button.getBoundingClientRect().right<=button.nextElementSibling.getBoundingClientRect().left+1)).toBe(true);
}

async function expectWeaponControls(page) {
  const names=['Projectiles','Light Speed','Smart Missiles','Hook Bomb','Death Wave'];
  const controls=page.locator('.weapon');
  await expect(controls).toHaveCount(5);
  for(let i=0;i<4;i++) {
    const button=page.locator(`[data-weapon="${i}"]`);
    await expect(button).toHaveAccessibleName(new RegExp(names[i]));
    await expect(button).toHaveAttribute('title',`${names[i]} · ${i+1}`);
  }
  const deathWave=page.locator('#death-wave');
  await expect(deathWave).toHaveAccessibleName(/Death Wave/);
  await expect(deathWave).toHaveAttribute('title',/Death Wave/);
  await expect(page.locator('.weapon strong, .weapon kbd')).toHaveCount(0);
  const icons=page.locator('.weapon-icon');
  await expect(icons).toHaveCount(names.length);
  await expect.poll(()=>icons.evaluateAll(nodes=>nodes.every(icon=>{
    const r=icon.getBoundingClientRect(),button=icon.closest('button').getBoundingClientRect();
    return r.left>=button.left && r.right<=button.right && r.top>=button.top && r.bottom<=button.bottom &&
      (icon.tagName!=='IMG' || (icon.complete && icon.naturalWidth>0));
  }))).toBe(true);
}

test('wheel selects weapons and right click releases a saved Death Wave',async({page})=>{
  await page.goto('/');
  const saved=await page.evaluate(async()=>{
    const {default:init,Game}=await import('/src/wasm/towerium.js');await init();
    const config=await(await fetch('/engine/balance.json')).json();const game=new Game(42,JSON.stringify(config));game.start_wave();
    const state=JSON.parse(game.save());state.world.charges=1;
    game.free();return {seed:42,state:JSON.stringify(state),config:JSON.stringify(config)};
  });
  await page.addInitScript(saved=>localStorage.setItem('towerium.run.v1',JSON.stringify(saved)),saved);
  await page.reload();await page.locator('#restore-run').click();
  await page.getByRole('dialog').getByRole('button',{name:'Resume',exact:true}).click();
  const arena=page.locator('#arena');await arena.hover();await page.mouse.wheel(0,120);
  await expect(page.locator('[data-weapon="1"]')).toHaveAttribute('aria-pressed','true');
  await page.mouse.wheel(0,-120);
  await expect(page.locator('[data-weapon="0"]')).toHaveAttribute('aria-pressed','true');
  await arena.click({button:'right'});
  await expect(page.locator('#charge-count')).toHaveText('0/3');
  expect((await readSnapshot(page)).deathwaves.length).toBeGreaterThan(0);
  await page.keyboard.press('Escape');await arena.dispatchEvent('wheel',{deltaY:120});
  await expect(page.locator('[data-weapon="0"]')).toHaveAttribute('aria-pressed','true');
});

test('start, weapon selection, pointer fire, manual and focus-loss pause',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/?seed=42');
  const balance=await readBalance(page);
  await expect(page.getByRole('button',{name:'Play',exact:true})).toBeEnabled();
  await page.screenshot({path:'test-results/towerium-start.png',fullPage:true});
  await page.getByRole('button',{name:'Help',exact:true}).click();
  await expect(page.getByRole('heading',{name:'How To Play'})).toBeVisible();
  const enemySprites=page.locator('.enemy-list img');
  await expect(enemySprites).toHaveCount(balance.enemies.length);
  await expect.poll(()=>enemySprites.evaluateAll(images=>images.every(image=>image.complete&&image.naturalWidth>0))).toBe(true);
  await page.getByRole('button',{name:'Close',exact:true}).click();
  await page.getByRole('button',{name:'Play',exact:true}).click();
  await page.keyboard.press('2');
  await expect(page.locator('[data-weapon="1"]')).toHaveAttribute('aria-pressed','true');
  const box=await page.locator('#arena').boundingBox();
  await page.mouse.move(box.x+box.width*0.5,box.y+box.height*0.7);
  await page.mouse.down();await page.waitForTimeout(550);await page.mouse.up();
  expect(Number(await page.locator('#ammo-1').textContent())).toBeLessThan(balance.weapons[1].ammo);
  await page.keyboard.press('Escape');await expect(page.getByRole('heading',{name:'Paused',exact:true})).toBeVisible();
  const health=await page.locator('#health-text').textContent(),ammo=await page.locator('#ammo-1').textContent();
  await page.waitForTimeout(1200);expect(await page.locator('#health-text').textContent()).toBe(health);expect(await page.locator('#ammo-1').textContent()).toBe(ammo);
  await page.getByRole('dialog').getByRole('button',{name:'Resume',exact:true}).click();
  await page.keyboard.press('1');
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
  await expect(page.getByRole('heading',{name:'Paused',exact:true})).toBeVisible();
  await page.getByRole('dialog').getByRole('button',{name:'Resume',exact:true}).click();
  await page.screenshot({path:'test-results/towerium-combat.png',fullPage:true});
  expect(errors).toEqual([]);
});

test('mobile layout fits and touch fires without page scrolling',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  const page=await context.newPage();await page.goto('/?seed=42');
  const balance=await readBalance(page);
  await expect(page.getByRole('button',{name:'Play',exact:true})).toBeEnabled();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await expectWeaponControls(page);
  await page.screenshot({path:'test-results/towerium-mobile.png',fullPage:true});
  await page.getByRole('button',{name:'Play',exact:true}).tap();await page.locator('[data-weapon="2"]').tap();
  const box=await page.locator('#arena').boundingBox();
  // Real touch gesture through CDP (pointer capture requires an active pointer).
  const cdp=await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width/2,y:box.y+box.height*0.7}]});
  await page.waitForTimeout(500);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  expect(Number(await page.locator('#ammo-2').textContent())).toBeLessThan(balance.weapons[2].ammo);
  await context.close();
});

test('play through shop purchases, next wave, defeat, and restart',async({page})=>{
  await page.clock.install();await page.goto('/?seed=42');
  const balance=await readBalance(page);
  await expect(page.getByRole('button',{name:'Play',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'Play',exact:true}).click();
  const box=await page.locator('#arena').boundingBox();
  await page.mouse.move(box.x+box.width/2,box.y+box.height*0.7);await page.mouse.down();
  for(let step=0;step<200;step++){
    if(await page.getByRole('heading',{name:'Wave 1 Cleared'}).isVisible())break;
    const s=await readSnapshot(page);
    const target=(()=>{
      const e=s.enemies.filter(e=>Math.hypot(e[2],e[3])<=s.range+0.1).sort((a,b)=>Math.hypot(a[2],a[3])-Math.hypot(b[2],b[3]))[0];
      return e?[e[2],e[3]]:[0,220];
    })();
    await page.mouse.move(box.x+(target[0]+550)/1100*box.width,box.y+(target[1]+550)/1100*box.height);
    await page.clock.runFor(250);
  }
  await page.mouse.up();
  await expect(page.getByRole('heading',{name:'Wave 1 Cleared'})).toBeVisible();
  const firstWave=await readSnapshot(page);
  expect(firstWave.wave_report.shots_fired).toBeGreaterThan(0);
  expect(firstWave.wave_report.kills).toBeGreaterThan(0);
  expect(firstWave.wave_report.coins_earned).toBeGreaterThan(0);
  expect(firstWave.wave_report.duration_seconds).toBeGreaterThan(0);
  expect(await page.locator('#wave-timer').textContent()).not.toBe('00:00');
  const reportBefore=await expectReportMatchesSnapshot(page,firstWave);
  await expectRunFooter(page,'open-shop');
  await page.locator('#request-restart').click();await page.locator('#cancel-restart').click();
  await expect(page.getByRole('heading',{name:'Wave 1 Cleared'})).toBeVisible();
  expect(await expectReportMatchesSnapshot(page,await readSnapshot(page))).toEqual(reportBefore);
  await page.locator('#shop-help').click();await expect(page.getByRole('heading',{name:'How To Play'})).toBeVisible();
  await page.locator('#close-help').click();await expect(page.getByRole('heading',{name:'Wave 1 Cleared'})).toBeVisible();
  expect(await expectReportMatchesSnapshot(page,await readSnapshot(page))).toEqual(reportBefore);
  await page.locator('#shop-skins').click();await expect(page.getByRole('heading',{name:'Tower Skins'})).toBeVisible();
  await page.locator('#back-shop').click();await expect(page.getByRole('heading',{name:'Wave 1 Cleared'})).toBeVisible();
  expect(await expectReportMatchesSnapshot(page,await readSnapshot(page))).toEqual(reportBefore);
  for(const [width,height] of [[1440,1080],[390,844],[320,568],[844,390],[667,375]]) {
    await page.setViewportSize({width,height});
    const documentBounds=await page.evaluate(()=>({scrollHeight:document.documentElement.scrollHeight,innerHeight,bodyHeight:document.body.scrollHeight}));
    expect(documentBounds.scrollHeight<=documentBounds.innerHeight,JSON.stringify({width,height,...documentBounds})).toBe(true);
    expect(await page.locator('.report-section').count()).toBe(2);
    expect(await page.locator('.report-body').evaluate(body=>body.scrollHeight<=body.clientHeight+1)).toBe(true);
    expect(await page.locator('.report-stats>div').count()).toBe(12);
    expect(await page.locator('.report-stats>div').evaluateAll(cards=>cards.every(card=>{const r=card.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;}))).toBe(true);
    await page.screenshot({path:`test-results/towerium-report-${width}x${height}.png`,fullPage:true});
  }
  await page.setViewportSize({width:1440,height:1080});
  await page.locator('#open-shop').click();
  await expect(page.getByRole('heading',{name:'Workshop',exact:true})).toBeVisible();
  await expectRunFooter(page,'wave-report');
  await page.locator('#shop-help').click();await page.locator('#close-help').click();
  await expect(page.getByRole('heading',{name:'Workshop',exact:true})).toBeVisible();
  await expectRunFooter(page,'wave-report');
  await page.locator('#shop-skins').click();await page.locator('#back-shop').click();
  await expect(page.getByRole('heading',{name:'Workshop',exact:true})).toBeVisible();
  await expectRunFooter(page,'wave-report');
  for(const [width,height] of [[1440,1080],[390,844],[320,568],[844,390],[667,375]]) {
    await page.setViewportSize({width,height});
    await expectWeaponControls(page);
    const documentBounds=await page.evaluate(()=>({scrollHeight:document.documentElement.scrollHeight,innerHeight,bodyHeight:document.body.scrollHeight}));
    expect(documentBounds.scrollHeight<=documentBounds.innerHeight,JSON.stringify({width,height,...documentBounds})).toBe(true);
    expect(await page.locator('.upgrade').count()).toBe(balance.upgrades.length);
    expect(await page.locator('.upgrade').evaluateAll(buttons=>buttons.every(button=>{const r=button.getBoundingClientRect();return r.top>=0 && r.bottom<=innerHeight && r.left>=0 && r.right<=innerWidth;}))).toBe(true);
    expect(await page.locator('#modal').evaluate(dialog=>dialog.scrollHeight<=dialog.clientHeight+1),`report modal overflow at ${width}x${height}`).toBe(true);
    expect(await page.locator('.shop-body').evaluate(body=>body.scrollHeight<=body.clientHeight+1)).toBe(true);
    await page.screenshot({path:`test-results/towerium-shop-${width}x${height}.png`,fullPage:true});
  }
  await page.setViewportSize({width:1440,height:1080});
  await page.screenshot({path:'test-results/towerium-shop.png',fullPage:true});
  const coins=Number(await page.locator('#coins').textContent());
  const attackSpeedCost=balance.upgrades[0].costs[0];
  await page.getByRole('button',{name:`Buy Attack Speed for ${attackSpeedCost} coins`,exact:true}).click();
  await expect(page.locator('#coins')).toHaveText(String(coins-attackSpeedCost));
  await page.locator('#wave-report').click();
  const afterPurchase=await readSnapshot(page);
  expect(afterPurchase.wave_report).toEqual(firstWave.wave_report);
  expect(afterPurchase.overall_report).toEqual(firstWave.overall_report);
  expect(await expectReportMatchesSnapshot(page,afterPurchase)).toEqual(reportBefore);
  await page.reload();await page.locator('#restore-run').click();
  await expect(page.getByRole('heading',{name:'Wave 1 Cleared'})).toBeVisible();
  const restored=await readSnapshot(page);
  expect(restored.wave_report).toEqual(firstWave.wave_report);
  expect(restored.overall_report).toEqual(firstWave.overall_report);
  expect(await expectReportMatchesSnapshot(page,restored)).toEqual(reportBefore);
  await page.locator('#next-wave').click();await expect(page.locator('#wave')).toHaveText('02');
  await page.mouse.up();
  const lethalContact=await page.evaluate(async()=>{
    const {default:init,Game}=await import('/src/wasm/towerium.js');await init();
    const config=await(await fetch('/engine/balance.json')).json();
    const key='towerium.run.v1',stored=JSON.parse(localStorage.getItem(key));
    const game=Game.restore(JSON.stringify(config),stored.state);
    let snapshot=JSON.parse(game.snapshot());
    if(snapshot.phase===2){if(!game.start_wave())throw new Error('Saved intermission could not start the verified next wave');snapshot=JSON.parse(game.snapshot());}
    if(snapshot.paused){game.pause(false);snapshot=JSON.parse(game.snapshot());}
    if(snapshot.phase!==1)throw new Error(`Restored next wave is not active: phase=${snapshot.phase}, paused=${snapshot.paused}, wave=${snapshot.wave}`);
    for(let frame=0;frame<300&&snapshot.phase===1&&snapshot.enemies.length===0;frame++){
      game.advance(1/60);snapshot=JSON.parse(game.snapshot());
    }
    const saved=JSON.parse(game.save()),world=saved.world,enemy=world.enemies[0];
    if(!enemy)throw new Error(`Next Wave did not produce an enemy for the lethal contact fixture: phase=${world.phase}, paused=${world.paused}, wave=${world.wave}, ticks=${world.wave_ticks}, spawned=${world.spawned}, remaining=${world.remaining}`);
    enemy.p={x:config.tower_radius+config.enemies[enemy.kind].radius,y:0};
    world.hp=1;world.shields=0;world.firing=false;world.shots=[];world.areas=[];world.hostile=[];world.overcharge=[];world.deathwaves=[];world.powers=[0,0,0,0,0,0,0];
    stored.state=JSON.stringify(saved);
    return {kind:enemy.kind,radius:config.enemies[enemy.kind].radius,towerRadius:config.tower_radius,stored};
  });
  expect(lethalContact.radius).toBeGreaterThan(0);
  await page.addInitScript(({key,stored})=>{
    const marker='towerium.test-lethal-fixture';
    if(sessionStorage.getItem(marker))return;
    localStorage.setItem(key,JSON.stringify(stored));sessionStorage.setItem(marker,'1');
  },{key:'towerium.run.v1',stored:lethalContact.stored});
  await page.reload();await page.locator('#restore-run').click();await page.locator('#resume').click();
  await page.clock.runFor(3000);
  await expect(page.getByRole('heading',{name:'Game Over',exact:true})).toBeVisible();
  const gameOverSnapshot=await readSnapshot(page);
  await expectOverallMatchesSnapshot(page,gameOverSnapshot);
  expect(await footerButtonIds(page)).toEqual(['shop-effects','shop-music','restart','shop-help','shop-skins'].sort());
  await page.locator('#shop-help').click();await page.locator('#close-help').click();
  await expect(page.getByRole('heading',{name:'Game Over',exact:true})).toBeVisible();
  await expectOverallMatchesSnapshot(page,await readSnapshot(page));
  await page.locator('#shop-skins').click();await page.locator('#back-shop').click();
  await expect(page.getByRole('heading',{name:'Game Over',exact:true})).toBeVisible();
  await expectOverallMatchesSnapshot(page,await readSnapshot(page));
  expect(await footerButtonIds(page)).toEqual(['shop-effects','shop-music','restart','shop-help','shop-skins'].sort());
  await page.screenshot({path:'test-results/towerium-game-over.png',fullPage:true});
  await page.setViewportSize({width:320,height:568});
  await expectOverallMatchesSnapshot(page,gameOverSnapshot);
  const gameOverBounds=await page.evaluate(()=>({modal:document.querySelector('#modal').getBoundingClientRect().toJSON(),scrollHeight:document.querySelector('#modal').scrollHeight,clientHeight:document.querySelector('#modal').clientHeight,footer:document.querySelector('.shop-footer').getBoundingClientRect().toJSON()}));
  expect(gameOverBounds.scrollHeight<=gameOverBounds.clientHeight+1,JSON.stringify(gameOverBounds)).toBe(true);
  expect(gameOverBounds.footer.right).toBeLessThanOrEqual(gameOverBounds.modal.right);
  await page.screenshot({path:'test-results/towerium-game-over-320x568.png',fullPage:true});
  await page.setViewportSize({width:1440,height:1080});
  await page.getByRole('button',{name:'Play Again',exact:true}).click();await expect(page.locator('#wave')).toHaveText('01');
  const maxHp=balance.upgrades.find(upgrade=>upgrade.name==='Max HP').base;
  await expect(page.locator('#health-text')).toHaveText(`${maxHp} / ${maxHp}`);
});

test('browser WASM completes a wave, upgrades, and ends a full run',async({page})=>{
  await page.goto('/?seed=42');await expect(page.getByRole('button',{name:'Play',exact:true})).toBeEnabled();
  const result=await page.evaluate(async()=>{
    const {default:init,Game}=await import('/src/wasm/towerium.js');await init();
    const config=await(await fetch('/engine/balance.json')).json();
    const game=new Game(42,JSON.stringify(config));game.start_wave();let state=JSON.parse(game.snapshot());
    const wave=config.waves.milestones.filter(milestone=>milestone.wave<=1).at(-1);
    const expectedKills=Math.ceil(wave.count);
    const bossCount=1%config.waves.boss_every===0?Math.min(Math.round(wave.bosses),Math.floor(expectedKills/2)):0;
    const eligible=config.enemies.slice(0,5).filter((enemy,index)=>enemy.unlock<=1 && wave.weights[index]>0);
    const rewardFloor=config.starting_coins+(expectedKills-bossCount)*Math.min(...eligible.map(enemy=>enemy.coins))+bossCount*config.enemies[5].coins;
    const rewardCeiling=config.starting_coins+(expectedKills-bossCount)*Math.max(...eligible.map(enemy=>enemy.coins))+bossCount*config.enemies[5].coins;
    const upgradeCost=config.upgrades[0].costs[0];
    const maxFrames=Math.ceil((config.waves.spawn_seconds+90)*60);
    for(let i=0;i<maxFrames && state.phase===1;i++){
      const target=state.enemies.filter(e=>Math.hypot(e[2],e[3])<=state.range).sort((a,b)=>Math.hypot(a[2],a[3])-Math.hypot(b[2],b[3]))[0];
      if(target)game.input(target[2],target[3],true,0);else game.input(0,200,false,0);
      game.advance(1/60);state=JSON.parse(game.snapshot());
    }
    const phase=state.phase,coins=state.coins,kills=state.kills;
    const bought=game.buy(0);game.start_wave();const upgraded=JSON.parse(game.snapshot()).levels[0];
    game.input(0,0,false,0);
    for(let i=0;i<9000 && state.phase!==3;i++){game.advance(1/60);state=JSON.parse(game.snapshot());}
    const out={phase,coins,kills,expectedKills,rewardFloor,rewardCeiling,upgradeCost,bought,upgraded,ended:state.phase,hp:state.hp};game.free();return out;
  });
  expect(result.phase).toBe(2);expect(result.kills).toBe(result.expectedKills);expect(result.coins).toBeGreaterThanOrEqual(result.rewardFloor);expect(result.coins).toBeLessThanOrEqual(result.rewardCeiling);expect(result.bought).toBe(result.coins>=result.upgradeCost);expect(result.upgraded).toBe(1);expect(result.ended).toBe(3);expect(result.hp).toBe(0);
});

test('active power indicators appear only after a real drop activation',async({page})=>{
  test.setTimeout(120_000);
  await page.clock.install();await page.goto('/?seed=42');
  await expect(page.getByRole('button',{name:'Play',exact:true})).toBeEnabled();
  await expect(page.locator('#powers .active-power')).toHaveCount(0);
  const box=await page.locator('#arena').boundingBox();
  await page.getByRole('button',{name:'Play',exact:true}).click();
  await page.mouse.move(box.x+box.width/2,box.y+box.height*0.3);await page.mouse.down();
  let activated=false;
  for(let step=0;step<6000;step++){
    if(await page.locator('#powers .active-power').count()>0){activated=true;break;}
    if(await page.getByRole('heading',{name:/Wave \d+ Cleared/}).count()){await page.locator('#next-wave').click();await page.mouse.down();}
    if(await page.getByRole('heading',{name:'Game Over',exact:true}).count())break;
    const s=await readSnapshot(page);
    const target=(()=>{
      const d=s.drops[0];
      const e=s.enemies.filter(enemy=>Math.hypot(enemy[2],enemy[3])<=s.range+0.1)
        .sort((a,b)=>Math.hypot(a[2],a[3])-Math.hypot(b[2],b[3]))[0];
      return d?[d[2],d[3]]:e?[e[2],e[3]]:[0,220];
    })();
    await page.mouse.move(box.x+(target[0]+550)/1100*box.width,box.y+(target[1]+550)/1100*box.height);
    await page.clock.runFor(100);
  }
  await page.mouse.up();
  expect(activated).toBe(true);
  const powers=page.locator('#powers .active-power');
  await expect(powers).not.toHaveCount(0);
  await expect.poll(()=>powers.evaluateAll(nodes=>nodes.every(node=>{
    const image=node.querySelector('img');
    return node.getAttribute('role')==='img' && Boolean(node.getAttribute('aria-label')) &&
      image?.complete && image.naturalWidth>0;
  }))).toBe(true);
  await page.screenshot({path:'.local/review-active-powers.png',fullPage:true});
  const fields=await page.evaluate(async()=>{
    const entry=[...document.querySelectorAll('script[type="module"][src*="/src/main.ts"]')][0];
    const [{getRenderSnapshot},{Renderer},{loadArt}]=await Promise.all([
      import(entry.src),import('/src/renderer.ts'),import('/src/assets.ts'),
    ]);
    const canvas=document.querySelector('#arena');const art=await loadArt();
    const renderer=new Renderer(canvas,art);const original=CanvasRenderingContext2D.prototype.arc;
    const radii=[];
    CanvasRenderingContext2D.prototype.arc=function(x,y,r,start,end,...rest){radii.push(Math.round(r*100)/100);return original.call(this,x,y,r,start,end,...rest);};
    const snapshot=getRenderSnapshot(),chronoRadius=snapshot.chrono_radius??snapshot.range+30;
    const fixture={...snapshot,enemies:[],shots:[],drops:[],areas:[],fx:[],
      chrono_radius:chronoRadius,blackholes:[[100,0],[-100,0]],spotlights:[0,2*Math.PI/3,4*Math.PI/3],powers:Array(9).fill(0)};
    renderer.draw(fixture,[0,-220],1/60);
    const inactive={chrono:radii.filter(r=>r===chronoRadius).length,
      blackHoles:radii.filter(r=>r===200).length,spotlights:radii.filter(r=>r===740).length};
    radii.length=0;
    const active={...fixture,time:fixture.time+1,powers:[...fixture.powers],areas:[[0,180,0,1]]};
    active.powers[1]=10;active.powers[3]=10;active.powers[4]=10;
    renderer.draw(active,[0,-220],1/60);
    const result={inactive,chrono:radii.filter(r=>r===chronoRadius).length,blackHoles:radii.filter(r=>r===200).length,
      spotlights:radii.filter(r=>r===740).length,swamp:radii.filter(r=>r===120).length};
    CanvasRenderingContext2D.prototype.arc=original;
    return result;
  });
  expect(fields.inactive).toEqual({chrono:0,blackHoles:0,spotlights:0});
  expect(fields.chrono).toBe(1);expect(fields.blackHoles).toBe(2);expect(fields.spotlights).toBe(3);expect(fields.swamp).toBe(1);
  await page.screenshot({path:'.local/review-active-power-fields.png',fullPage:true});
  const enemyKinds=await page.evaluate(async()=>{
    const entry=[...document.querySelectorAll('script[type="module"][src*="/src/main.ts"]')][0];
    const [{getRenderSnapshot},{Renderer},{loadArt}]=await Promise.all([
      import(entry.src),import('/src/renderer.ts'),import('/src/assets.ts'),
    ]);
    const canvas=document.querySelector('#arena'),art=await loadArt(),renderer=new Renderer(canvas,art);
    const context=canvas.getContext('2d'),original=context.drawImage,drawn=[];
    context.drawImage=function(image,...args){
      const index=art.enemies.indexOf(image);if(index>=0)drawn.push(index);
      return original.call(this,image,...args);
    };
    try {
      const snapshot=getRenderSnapshot();
      renderer.draw({...snapshot,time:snapshot.time+1,powers:Array(9).fill(0),areas:[],
        enemies:Array.from({length:13},(_,kind)=>[100+kind,kind,-360+kind*60,-180,20,100,0]),
      },[0,-220],1/60);
    } finally {context.drawImage=original;}
    return [...new Set(drawn)].sort((a,b)=>a-b);
  });
  expect(enemyKinds).toEqual(Array.from({length:13},(_,index)=>index));
  await page.screenshot({path:'.local/review-enemy-types.png',fullPage:true});
});

test('Death Wave renders its first and subsequent animation frames without stopping',async({page})=>{
  test.setTimeout(60000);
  await page.goto('/?seed=42');
  const result=await page.evaluate(async()=>{
    const [{default:init,Game},{Renderer},{loadArt}]=await Promise.all([
      import('/src/wasm/towerium.js'),import('/src/renderer.ts'),import('/src/assets.ts'),
    ]);
    await init();
    const config=await(await fetch('/engine/balance.json')).json();
    const dropChance=config.upgrades.find(upgrade=>upgrade.name==='Power Drop Chance');
    if(!dropChance)throw new Error('Power drop chance upgrade is missing');
    dropChance.base=1;dropChance.step=0;config.powers.death_wave_weight=1;
    const canvas=document.createElement('canvas');canvas.width=800;canvas.height=800;
    canvas.style.cssText='position:fixed;left:-10000px;width:800px;height:800px';document.body.append(canvas);
    const renderer=new Renderer(canvas,await loadArt()),game=new Game(42,JSON.stringify(config));
    game.start_wave();let state=JSON.parse(game.snapshot()),frames=0;
    while(frames<24000&&state.phase===1&&state.charges===0){
      const drop=state.drops.find(item=>item[1]===8);
      const enemy=state.enemies.find(item=>Math.hypot(item[2],item[3])<=state.range+0.1);
      const target=drop?[drop[2],drop[3]]:enemy?[enemy[2],enemy[3]]:null;
      game.input(target?.[0]??0,target?.[1]??220,Boolean(target),0);
      game.advance(1/60);frames++;state=JSON.parse(game.snapshot());
      if(frames%120===0)await new Promise(resolve=>requestAnimationFrame(resolve));
    }
    const acquired={frames,charges:state.charges,phase:state.phase};
    if(state.charges===0){game.free();canvas.remove();return {acquired,renderError:'Test fixture did not acquire a Death Wave charge'};}
    if(!game.death_wave()){game.free();canvas.remove();return {acquired,renderError:'Death Wave charge could not be released'};}
    const radii=[];let renderError=null,rafTicks=0,rafId,observe;
    observe=()=>{rafTicks++;rafId=requestAnimationFrame(observe);};rafId=requestAnimationFrame(observe);
    for(let i=0;i<18;i++){
      game.advance(1/60);state=JSON.parse(game.snapshot());
      radii.push(state.deathwaves[0]);
      try{renderer.draw(state,[0,220],1/60);}catch(error){renderError=`${error.name}: ${error.message}`;break;}
      await new Promise(resolve=>requestAnimationFrame(resolve));
    }
    cancelAnimationFrame(rafId);
    const continued={renderFrames:radii.length,firstRadius:radii[0],lastRadius:radii.at(-1),rafTicks};
    game.free();canvas.remove();
    return {acquired,continued,renderError};
  });
  expect(result.renderError).toBeNull();
  expect(result.acquired.charges).toBe(1);
  expect(result.continued.renderFrames).toBe(18);
  expect(result.continued.firstRadius).toBeGreaterThan(0);
  expect(result.continued.lastRadius).toBeGreaterThan(result.continued.firstRadius);
  expect(result.continued.rafTicks).toBeGreaterThan(0);
});

test('skin unlock milestones, selection persistence, and invalid-value fallback',async({page})=>{
  await page.goto('/');
  const progression=await page.evaluate(async()=>{
    const {Cosmetics}=await import('/src/cosmetics.ts'),key='towerium.cosmetics.v1';
    localStorage.removeItem(key);
    const c=new Cosmetics(0),initial={completed:c.completed,hexagon:c.unlocked(0),cyber:c.unlocked(1)};
    c.clear(29);const at29={completed:c.completed,cyber:c.unlocked(1)};
    c.clear(30);const at30={completed:c.completed,cyber:c.unlocked(1),crystal:c.unlocked(2),fresh:c.fresh};
    c.clear(59);const at59={completed:c.completed,crystal:c.unlocked(2)};
    c.clear(60);const at60={completed:c.completed,crystal:c.unlocked(2),starship:c.unlocked(3),fresh:c.fresh};
    c.select(2);const persisted=JSON.parse(localStorage.getItem(key));
    const restored=new Cosmetics(0),restoredState={completed:restored.completed,selected:restored.selected};
    localStorage.setItem(key,JSON.stringify({completed:60,selected:'missing-skin'}));
    const invalid=new Cosmetics(0),invalidState={completed:invalid.completed,selected:invalid.selected};
    localStorage.setItem(key,JSON.stringify({completed:60,selected:'starship'}));
    const locked=new Cosmetics(0),lockedState={completed:locked.completed,selected:locked.selected};
    return {initial,at29,at30,at59,at60,persisted,restoredState,invalidState,lockedState};
  });
  expect(progression.initial).toEqual({completed:0,hexagon:true,cyber:false});
  expect(progression.at29).toEqual({completed:29,cyber:false});
  expect(progression.at30.cyber).toBe(true);expect(progression.at30.crystal).toBe(false);
  expect(progression.at59.crystal).toBe(false);
  expect(progression.at60).toEqual({completed:60,crystal:true,starship:false,fresh:true});
  expect(progression.persisted).toEqual({completed:60,selected:'crystal'});
  expect(progression.restoredState).toEqual({completed:60,selected:2});
  expect(progression.invalidState).toEqual({completed:60,selected:0});
  expect(progression.lockedState).toEqual({completed:60,selected:0});
});

test('shop skin selection is accessible and fits all supported viewport sizes',async({page})=>{
  test.setTimeout(120000);
  await page.addInitScript(()=>localStorage.setItem('towerium.cosmetics.v1',JSON.stringify({completed:60,selected:'crystal'})));
  await page.clock.install();await page.goto('/?seed=42');
  await expect(page.getByRole('button',{name:'Play',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'Play',exact:true}).click();
  const box=await page.locator('#arena').boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height*0.7);await page.mouse.down();
  for(let step=0;step<200;step++){
    if(await page.getByRole('heading',{name:'Wave 1 Cleared'}).isVisible())break;
    const s=await readSnapshot(page),target=(()=>{
      const e=s.enemies.filter(e=>Math.hypot(e[2],e[3])<=s.range+0.1).sort((a,b)=>Math.hypot(a[2],a[3])-Math.hypot(b[2],b[3]))[0];
      return e?[e[2],e[3]]:[0,220];
    })();
    await page.mouse.move(box.x+(target[0]+550)/1100*box.width,box.y+(target[1]+550)/1100*box.height);
    await page.clock.runFor(250);
  }
  await page.mouse.up();await expect(page.getByRole('heading',{name:'Wave 1 Cleared'})).toBeVisible();
  await page.locator('#open-shop').click();
  await expect(page.getByRole('heading',{name:'Workshop',exact:true})).toBeVisible();
  await page.getByRole('button',{name:/Skins/}).click();
  await expect(page.getByRole('heading',{name:'Tower Skins'})).toBeVisible();
  await expect(page.locator('.skin-card')).toHaveCount(11);
  await expect(page.locator('.skin-card[data-skin="0"]')).toBeEnabled();
  await expect(page.locator('.skin-card[data-skin="1"]')).toBeEnabled();
  await expect(page.locator('.skin-card[data-skin="2"]')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('.skin-card[data-skin="3"]')).toBeDisabled();
  await expect.poll(()=>page.locator('.skin-card[data-skin="1"] img').evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
  await page.locator('.skin-card[data-skin="1"]').click();
  await expect(page.getByRole('heading',{name:'Workshop',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('towerium.cosmetics.v1')).selected)).toBe('cyber');
  // Cosmetic progression test asserts `fresh` at wave 30; exercise its longer
  // visible label here without simulating another 29 waves just for layout.
  await page.evaluate(()=>{
    const button=document.querySelector('#shop-skins');
    button.setAttribute('aria-label','Skins, new skin unlocked');
    button.querySelector('span').textContent='New skin';
  });
  for(const [width,height] of [[1440,1080],[390,844],[320,568],[844,390]]){
    await page.setViewportSize({width,height});
    await page.evaluate(()=>{
      const button=document.querySelector('#shop-skins');
      button.setAttribute('aria-label','Skins, new skin unlocked');
      button.querySelector('span').textContent='New skin';
    });
    const shopBounds=await page.evaluate(()=>({scrollHeight:document.documentElement.scrollHeight,innerHeight,modal:document.querySelector('#modal').getBoundingClientRect().toJSON(),tools:['#shop-help','#shop-skins','#next-wave'].map(selector=>document.querySelector(selector).getBoundingClientRect().toJSON())}));
    expect(shopBounds.scrollHeight<=shopBounds.innerHeight,`${width}×${height} shop ${JSON.stringify(shopBounds)}`).toBe(true);
    expect(shopBounds.tools.every(rect=>rect.top>=shopBounds.modal.top&&rect.bottom<=shopBounds.modal.bottom&&rect.left>=shopBounds.modal.left&&rect.right<=shopBounds.modal.right),`${width}×${height} shop control bounds`).toBe(true);
    await page.screenshot({path:`.local/v7-shop-${width}x${height}.png`,fullPage:true});
    await page.getByRole('button',{name:/Skins/}).click();
    const skinBounds=await page.evaluate(()=>({scrollHeight:document.documentElement.scrollHeight,innerHeight,modal:document.querySelector('#modal').getBoundingClientRect().toJSON(),cards:[...document.querySelectorAll('.skin-card')].map(card=>card.getBoundingClientRect().toJSON())}));
    expect(skinBounds.scrollHeight<=skinBounds.innerHeight,`${width}×${height} skins ${JSON.stringify(skinBounds)}`).toBe(true);
    expect(skinBounds.cards.every(rect=>rect.top>=skinBounds.modal.top&&rect.bottom<=skinBounds.modal.bottom&&rect.left>=skinBounds.modal.left&&rect.right<=skinBounds.modal.right),`${width}×${height} skin card bounds`).toBe(true);
    await page.screenshot({path:`.local/v7-skins-${width}x${height}.png`,fullPage:true});
  await page.getByRole('button',{name:'← Back To Shop'}).click();
  }
});

test('Scatter death creates exactly three small sprite children',async({page})=>{
  test.setTimeout(90000);
  await page.goto('/?seed=42');
  const result=await page.evaluate(async()=>{
    const [{default:init,Game},{Renderer},{loadArt}]=await Promise.all([
      import('/src/wasm/towerium.js'),import('/src/renderer.ts'),import('/src/assets.ts'),
    ]);
    await init();
    const config=await(await fetch('/engine/balance.json')).json();
    for(const wave of config.waves.milestones){wave.weights=Array(config.enemies.length).fill(0);wave.weights[0]=1;wave.weights[8]=1;wave.elite_per_wave=2;wave.fleet_per_wave=0;}
    config.enemies[8].unlock=1;config.enemies[8].speed=8;
    config.upgrades.find(upgrade=>upgrade.name==='Range').base=360;
    const maxHp=config.upgrades.find(upgrade=>upgrade.name==='Max HP');maxHp.base=100000;maxHp.step=0;
    const game=new Game(42,JSON.stringify(config));
    if(!game.start_wave())throw new Error('Test fixture could not start wave one');
    let state=JSON.parse(game.snapshot()),frames=0,children=[];
    for(;frames<6000;frames++){
      const target=state.enemies.find(enemy=>enemy[1]===8&&Math.hypot(enemy[2],enemy[3])<=Math.min(state.range+0.1,300));
      game.input(target?.[2]??0,target?.[3]??220,Boolean(target),0);
      game.advance(1/60);state=JSON.parse(game.snapshot());
      const radii=new Map(state.enemy_radii??[]);
      children=state.enemies.filter(enemy=>enemy[1]===8&&radii.get(enemy[0])===14);
      if(children.length===3)break;
      if(frames%300===0)await new Promise(resolve=>requestAnimationFrame(resolve));
      if(state.phase!==1)break;
    }
    const childRadii=new Map(state.enemy_radii??[]);
    const canvas=document.createElement('canvas');canvas.id='scatter-child-fixture';canvas.width=1100;canvas.height=1100;
    canvas.style.cssText='position:fixed;left:0;top:0;width:800px;height:800px;z-index:10000;background:#090f19';document.body.append(canvas);
    const art=await loadArt(),renderer=new Renderer(canvas,art),context=canvas.getContext('2d'),original=context.drawImage,drawn=[];
    context.drawImage=function(image,...args){if(image===art.enemies[8])drawn.push({x:args[0],y:args[1],width:args[2],height:args[3]});return original.call(this,image,...args);};
    let renderError=null;
    try{renderer.draw(state,[0,-220],1/60);}catch(error){renderError=`${error.name}: ${error.message}`;}
    finally{context.drawImage=original;}
    const childData=children.map(enemy=>({id:enemy[0],kind:enemy[1],hp:enemy[4],maxHp:enemy[5],radius:childRadii.get(enemy[0])}));
    game.free();
    return {frames,phase:state.phase,parentRadius:config.enemies[8].radius,childData,drawn,renderError};
  });
  expect(result.renderError).toBeNull();
  expect(result.childData).toHaveLength(3);
  expect(result.childData.every(child=>child.kind===8&&child.hp===1&&child.maxHp===1&&child.radius===14)).toBe(true);
  expect(result.childData.every(child=>child.radius<result.parentRadius)).toBe(true);
  const childSprites=result.drawn.filter(sprite=>sprite.width<result.parentRadius*2/0.68-0.1);
  expect(childSprites).toHaveLength(3);
  expect(childSprites.every(sprite=>Math.abs(sprite.width-14*2/0.68)<0.1)).toBe(true);
  await page.locator('#scatter-child-fixture').screenshot({path:'.local/scatter-children.png'});
});

test('contacting enemies stay outside the visible tower wall',async({page})=>{
  await page.clock.install();await page.goto('/?seed=42');
  await page.getByRole('button',{name:'Play',exact:true}).click();
  let contact;
  for(let step=0;step<300;step++){
    const s=await readSnapshot(page);
    contact=await page.evaluate(async(s)=>{
      const c=await(await fetch('/engine/balance.json')).json();
      const nearest=Math.min(...s.enemies.map(e=>Math.hypot(e[2],e[3])-c.enemies[e[1]].radius));
      return {nearest,wall:c.tower_radius,hp:s.hp,phase:s.phase};
    },s);
    if(contact.nearest<=contact.wall+0.1 || contact.phase===3)break;
    await page.clock.runFor(100);
  }
  expect(contact.nearest).toBeLessThanOrEqual(contact.wall+0.1);
  expect(contact.hp).toBeLessThan(100);expect(contact.nearest).toBeGreaterThanOrEqual(contact.wall-0.01);
  expect(contact.nearest).toBeLessThan(contact.wall+0.1);
  await page.screenshot({path:'test-results/towerium-wall-contact.png',fullPage:true});
});

 test('saved run resumes paused and restart can be cancelled',async({page})=>{
  await page.goto('/');await page.locator('#start').click();
  await page.waitForTimeout(1300);await page.locator('#pause').click();
  const before=await readSnapshot(page);
  await page.reload();await page.locator('#restore-run').click();
  const restored=await readSnapshot(page);
  expect(restored.paused).toBe(true);expect(restored.wave).toBe(before.wave);
  expect(restored.enemies).toEqual(before.enemies);expect(restored.ammo).toEqual(before.ammo);
  expect(restored.hp).toBe(before.hp);expect(restored.coins).toBe(before.coins);
  await page.locator('#request-restart').click();await page.locator('#cancel-restart').click();
  expect((await readSnapshot(page)).enemies).toEqual(before.enemies);
  await page.locator('#request-restart').click();await page.locator('#confirm-restart').click();
  expect((await readSnapshot(page)).wave).toBe(1);expect((await readSnapshot(page)).kills).toBe(0);
  await expect(page.locator('#intro')).toBeHidden();
 });

test('shop save restores upgrades and Title Case labels without scrolling',async({page})=>{
  const workshopImageResponses=[];
  page.on('response',response=>{
    if(response.request().resourceType()==='image'&&response.url().includes('/workshop/')){
      workshopImageResponses.push({url:response.url(),status:response.status(),contentType:response.headers()['content-type']});
    }
  });
  await page.goto('/');await page.locator('#start').click();
  const saved=await makeClearedWaveSave(page);
  // Set a valid shield balance in this save fixture to verify that restore preserves its HUD display.
  const state=JSON.parse(saved.state);state.world.shields=2;saved.state=JSON.stringify(state);
  await stageRunOnNextNavigation(page,saved,'towerium.test-shop-ready');
  await page.reload();await page.locator('#restore-run').click();
  const initial=await readSnapshot(page);const initialReport=await expectReportMatchesSnapshot(page,initial);
  await page.locator('#open-shop').click();await expect(page.locator('.upgrade')).toHaveCount(25);
  for(const label of await page.locator('.upgrade-title strong').allTextContents())expect(label.split(/\s+/).every(word=>!/[a-z]/.test(word[0]))).toBe(true);
  expect(await page.locator('.upgrade-title strong').allTextContents()).toEqual([
    'Attack Speed','Range','Health','Regen','Coins/Kill',
    'Multishot Chance','Multishot Qty','Thorns','Overheal %','Ammo Drop Chance',
    'Rapid Fire Chance','Rapid Fire Duration','Knockback Chance','Knockback Force','Ammo Qty',
    'Bounce Chance','Bounce Targets','Orb Speed','Orb Qty','Power Up Chance',
    'Bounce Range','Landmine Chance','Shockwave Size','Shockwave Freq','Powerup Duration',
  ]);
  try{
    await expect.poll(()=>page.locator('.upgrade-title img').evaluateAll(images=>images.every(image=>image.complete&&image.naturalWidth>0))).toBe(true);
  }catch(error){
    const imageState=await page.locator('.upgrade-title img').evaluateAll(images=>images.map(image=>({src:image.src,currentSrc:image.currentSrc,complete:image.complete,naturalWidth:image.naturalWidth,naturalHeight:image.naturalHeight})));
    console.error('WORKSHOP_ICON_DIAGNOSTIC',JSON.stringify({imageState,workshopImageResponses}));
    throw error;
  }
  expect(await page.locator('.shop-wallet img').getAttribute('src')).toContain('/icons/coin-md.webp');
  await page.locator('[data-upgrade="0"]').click();const bought=await readSnapshot(page);
  await page.locator('#wave-report').click();
  expect((await readSnapshot(page)).wave_report).toEqual(initial.wave_report);
  expect((await readSnapshot(page)).overall_report).toEqual(initial.overall_report);
  expect(await expectReportMatchesSnapshot(page,await readSnapshot(page))).toEqual(initialReport);
  await page.reload();await page.locator('#restore-run').click();
  const restored=await readSnapshot(page);expect(restored.levels).toEqual(bought.levels);
  expect(restored.wave_report).toEqual(initial.wave_report);expect(restored.overall_report).toEqual(initial.overall_report);
  expect(await expectReportMatchesSnapshot(page,restored)).toEqual(initialReport);
  await page.locator('#open-shop').click();
  for(const viewport of [{width:320,height:568},{width:844,height:390}]){
    await page.setViewportSize(viewport);
    expect(await page.locator('#modal').evaluate(el=>el.scrollHeight<=el.clientHeight+1)).toBe(true);
    const footer=await page.locator('.shop-footer').boundingBox();expect(footer.x+footer.width).toBeLessThanOrEqual(viewport.width);
  }
  await page.locator('#request-restart').click();await page.locator('#cancel-restart').click();await expect(page.locator('.upgrade')).toHaveCount(25);
  await page.locator('#next-wave').click();
  await expect(page.locator('#powers [aria-label="Energy Shield, 2 of 3 charges"]')).toBeVisible();
});

test('Krisu music plays, pauses, and mute survives reload',async({page})=>{
  await page.addInitScript(()=>{
    window.__toweriumMusic=[];const NativeAudio=window.Audio;
    window.Audio=function(...args){const audio=new NativeAudio(...args);window.__toweriumMusic.push(audio);return audio;};window.Audio.prototype=NativeAudio.prototype;
  });
  await page.goto('/');await page.locator('#start').click();
  await expect.poll(()=>page.evaluate(()=>window.__toweriumMusic.some(a=>!a.paused&&a.currentTime>0&&a.readyState>=2)),{timeout:10000}).toBe(true);
  await page.locator('#pause').click();
  expect(await page.evaluate(()=>window.__toweriumMusic.every(a=>a.paused))).toBe(true);
  await page.locator('#resume').click();await page.locator('#music').click();await expect(page.locator('#music')).toHaveAttribute('aria-pressed','false');await expect(page.locator('#effects')).toHaveAttribute('aria-pressed','true');
  await page.reload();await expect(page.locator('#music')).toHaveAttribute('aria-pressed','false');await expect(page.locator('#effects')).toHaveAttribute('aria-pressed','true');await page.locator('#restore-run').click();await page.locator('#resume').click();
  expect(await page.evaluate(()=>window.__toweriumMusic.length)).toBe(0);
  await page.locator('#music').click();
  await expect.poll(()=>page.evaluate(()=>window.__toweriumMusic.some(a=>!a.paused&&a.currentTime>0)),{timeout:10000}).toBe(true);
  await page.locator('#effects').click();await expect(page.locator('#effects')).toHaveAttribute('aria-pressed','false');
  expect(await page.evaluate(()=>window.__toweriumMusic.some(a=>!a.paused))).toBe(true);
  await page.reload();await expect(page.locator('#music')).toHaveAttribute('aria-pressed','true');await expect(page.locator('#effects')).toHaveAttribute('aria-pressed','false');
  const saved=await makeClearedWaveSave(page);await stageRunOnNextNavigation(page,saved,'towerium.test-music-shop');
  await page.reload();await page.locator('#restore-run').click();
  await expect(page.getByRole('heading',{name:'Wave 1 Cleared'})).toBeVisible();
  await expectReportMatchesSnapshot(page,await readSnapshot(page));
  await expect.poll(()=>page.evaluate(()=>window.__toweriumMusic.some(a=>!a.paused&&a.currentTime>0)),{timeout:10000}).toBe(true);
  await page.locator('#shop-music').click();expect(await page.evaluate(()=>window.__toweriumMusic.every(a=>a.paused))).toBe(true);
  await page.locator('#shop-music').click();
  await expect.poll(()=>page.evaluate(()=>window.__toweriumMusic.some(a=>!a.paused&&a.currentTime>0)),{timeout:10000}).toBe(true);
});


test('Auto Play buys upgrades and advances without changing personal progress',async({page})=>{
  test.setTimeout(90000);
  await page.goto('/?seed=42');await expect(page.locator('#start')).toBeEnabled();
  const saved=await makeClearedWaveSave(page,42);
  await page.evaluate(saved=>{
    localStorage.setItem('towerium.run.v1',JSON.stringify(saved));
    localStorage.setItem('towerium.best-wave','0');
    localStorage.setItem('towerium.cosmetics.v1',JSON.stringify({completed:0,selected:'hexagon'}));
  },saved);
  await page.reload();await expect(page.locator('#restore-run')).toBeVisible();
  const personal=await page.evaluate(()=>Object.fromEntries(['towerium.run.v1','towerium.best-wave','towerium.cosmetics.v1'].map(key=>[key,localStorage.getItem(key)])));
  await page.locator('#auto-play').click();await page.locator('#watch-auto-play').click();
  await expect(page.locator('#run-mode')).toBeVisible();
  await expect(page.locator('#wave')).toHaveText('02',{timeout:60000});
  await page.locator('#pause').click();await expect(page.locator('#stop-auto-play')).toBeVisible();
  expect(await page.evaluate(()=>Object.fromEntries(['towerium.run.v1','towerium.best-wave','towerium.cosmetics.v1'].map(key=>[key,localStorage.getItem(key)])))).toEqual(personal);
  await page.locator('#request-restart').click();await page.locator('#confirm-restart').click();
  await expect(page.locator('#wave')).toHaveText('01');await page.locator('#pause').click();await page.locator('#stop-auto-play').click();
  await expect(page.locator('#restore-run')).toBeVisible();await expect(page.locator('#run-mode')).toBeHidden();
  expect(await page.evaluate(()=>Object.fromEntries(['towerium.run.v1','towerium.best-wave','towerium.cosmetics.v1'].map(key=>[key,localStorage.getItem(key)])))).toEqual(personal);
  await page.locator('#auto-play').click();await page.locator('#auto-aim').selectOption('circle');await page.locator('#auto-weapons').selectOption('projectile');await page.locator('#watch-auto-play').click();
  await page.waitForTimeout(1200);await page.reload();await expect(page.locator('#restore-run')).toBeVisible();
  expect(await page.evaluate(()=>Object.fromEntries(['towerium.run.v1','towerium.best-wave','towerium.cosmetics.v1'].map(key=>[key,localStorage.getItem(key)])))).toEqual(personal);
});

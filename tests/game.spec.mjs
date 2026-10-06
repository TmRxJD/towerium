import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';

test('Help groups concise rules and opens power references accessibly on mobile',async({page})=>{
 await page.setViewportSize({width:320,height:568});
 await page.goto('/');await page.getByRole('button',{name:'Help',exact:true}).click();
 await expect(page.locator('.help-section')).toHaveCount(9);
 await expect(page.locator('.help-section[open]')).toHaveCount(1);
 await expect(page.locator('.help-controls')).toBeVisible();
 const powers=page.locator('.help-section').filter({has:page.locator('summary',{hasText:'Pickups & Powers'})});
 await powers.locator('summary').first().click();
 await expect(powers.locator('.help-powers dt')).toHaveCount(23);
 expect(await powers.innerText()).not.toContain('undefined');
 await expect(powers.getByText('Demon invincibility never stacks or exceeds 10s.',{exact:false})).toBeVisible();
 await expect(powers.locator('dt').filter({hasText:'Demon Mode'})).toBeVisible();
 await expect(page.locator('#close-help')).toBeInViewport();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(320);
 await page.setViewportSize({width:568,height:320});
 await expect(page.locator('#close-help')).toBeInViewport();
 await page.locator('.help-body').evaluate(body=>body.scrollTop=body.scrollHeight);
 await expect(page.locator('.help-section>summary').last()).toBeInViewport();
 await page.locator('#close-help').click();await expect(page.getByRole('button',{name:'Play',exact:true})).toBeVisible();
});

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

async function makeWaveTenRetryRecord(page,used=0,seed=42) {
  const cleared=await makeClearedWaveSave(page,seed);
  const checkpoint=await page.evaluate(async saved=>{
    const {default:init,Game}=await import('/src/wasm/towerium.js');await init();
    const state=JSON.parse(saved.state);state.world.wave=10;state.world.wave_ticks=1800;
    const stateText=JSON.stringify(state),retry=Game.retry_checkpoint(saved.config,stateText);
    try{if(JSON.parse(retry.snapshot()).wave!==10)throw new Error('Native retry fixture did not restore wave ten');}
    finally{retry.free();}
    return {seed:saved.seed,wave:10,state:stateText};
  },cleared);
  return {version:1,config:cleared.config,used,checkpoint};
}

async function clickAndReadSnapshot(page,selector) {
  return page.evaluate(async selector=>{
    document.querySelector(selector)?.click();
    const entry=[...document.querySelectorAll('script[type="module"][src*="/src/main.ts"]')][0];
    if(!entry)throw new Error('Towerium entry module was not found');
    return (await import(entry.src)).getRenderSnapshot();
  },selector);
}

async function nativeAutoBuild(page,startWave,strategy='balanced',seed=42) {
  return page.evaluate(async({startWave,strategy,seed})=>{
    const [{default:init,Game},{AutoPlayer}]=await Promise.all([
      import('/src/wasm/towerium.js'),import('/src/autoplay.ts'),
    ]);
    await init();
    const config=await(await fetch('/engine/balance.json')).json();
    const game=Game.autoplay_start(seed,JSON.stringify(config),startWave);
    let state=JSON.parse(game.snapshot());
    const initial=state;
    const player=new AutoPlayer(strategy,'nearest','all');
    const plan=[];
    for(let count=0;count<5000;count++){
      const purchase=player.purchase(state);
      if(!purchase)break;
      const bought=purchase.kind==='buy'?game.buy(purchase.index):game.buy_power(purchase.power,purchase.path);
      if(!bought){game.free();throw new Error(`Native Auto Play rejected ${JSON.stringify(purchase)} for ${strategy}`);}
      plan.push(purchase);state=JSON.parse(game.snapshot());
    }
    const prepared=state,started=game.start_wave(),firstCombat=JSON.parse(game.snapshot());
    game.free();
    return {strategy,initial,plan,prepared,started,firstCombat};
  },{startWave,strategy,seed});
}

async function readControlState(page) {
  return page.evaluate(async()=>{
    const entry=[...document.querySelectorAll('script[type="module"][src*="/src/main.ts"]')][0];
    if(!entry)throw new Error('Towerium entry module was not found');
    return (await import(entry.src)).getControlState();
  });
}

async function readSnapshotAndControlState(page) {
  return page.evaluate(async()=>{
    const entry=[...document.querySelectorAll('script[type="module"][src*="/src/main.ts"]')][0];
    if(!entry)throw new Error('Towerium entry module was not found');
    const main=await import(entry.src);
    return {snapshot:main.getRenderSnapshot(),control:main.getControlState()};
  });
}

function expectAutoBuild(actual,expected,startWave,{beforeFirstSpawn=true}={}) {
  expect(actual.phase).toBe(1);expect(actual.wave).toBe(startWave);expect(actual.pending_start_wave).toBe(0);
  if(beforeFirstSpawn)expect(actual.spawned).toBe(0);
  expect(actual.levels).toEqual(expected.prepared.levels);
  expect(actual.power_levels).toEqual(expected.prepared.power_levels);
  expect(actual.coins).toBe(expected.prepared.coins);expect(actual.stones).toBe(expected.prepared.stones);
}

async function captureIntroLayouts(page,prefix) {
  for(const viewport of [{width:320,height:568},{width:844,height:390}]){
    await page.setViewportSize(viewport);
    const bounds=await page.evaluate(()=>({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,buttons:[...document.querySelectorAll('#intro button')].map(button=>button.getBoundingClientRect().toJSON())}));
    expect(bounds.width,`${prefix} ${viewport.width} horizontal overflow`).toBeLessThanOrEqual(viewport.width);
    expect(bounds.height,`${prefix} ${viewport.height} vertical overflow`).toBeLessThanOrEqual(viewport.height);
    expect(bounds.buttons.every(rect=>rect.left>=0&&rect.right<=viewport.width&&rect.top>=0&&rect.bottom<=viewport.height),`${prefix} ${viewport.width} button bounds ${JSON.stringify(bounds.buttons)}`).toBe(true);
    await page.screenshot({path:`.local/intro-${prefix}-${viewport.width}x${viewport.height}.png`,fullPage:true});
  }
}

async function readWaveReport(page) {
  const sections=page.locator('.report-section');
  await expect(sections).toHaveCount(2);
  const labels=[
    ['Accuracy','Shots Fired','Hits Taken','Powerups Collected','Coins Earned','Stones Earned','Kills'],
    ['Accuracy','Shots Fired','Hits Taken','Powerups Collected','Coins Earned','Stones Earned','Kills','Overlap Kills'],
  ];
  const report=await sections.evaluateAll(nodes=>nodes.map(section=>({
    title:section.querySelector('h3')?.textContent?.trim(),
    time:section.querySelector('.report-section-heading span')?.getAttribute('aria-label'),
    stats:[...section.querySelectorAll('dl.report-stats>div')].map(row=>({
      label:row.querySelector('dt')?.textContent?.trim(),
      value:row.querySelector('dd')?.textContent?.trim(),
    })),
  })));
  expect(report.map(section=>section.title)).toEqual(['This Wave','Overall']);
  for(const [index,section] of report.entries()){
    expect(section.stats.map(stat=>stat.label)).toEqual(labels[index]);
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
    expect(values['Stones Earned']).toBe(String(Math.round(source.stones_earned)));
    expect(values.Kills).toBe(String(source.kills));
    if(sectionIndex===1){
      const overlaps=snapshot.coin_overlap_kills.reduce((sum,count,mask)=>sum+((mask&(mask-1))!==0?count:0),0);
      expect(values['Overlap Kills']).toBe(String(overlaps));
    }
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
  expect(values['Stones Earned']).toBe(String(Math.round(source.stones_earned)));
  expect(values.Kills).toBe(String(source.kills));
  const overlaps=snapshot.coin_overlap_kills.reduce((sum,count,mask)=>sum+((mask&(mask-1))!==0?count:0),0);
  expect(values['Overlap Kills']).toBe(String(overlaps));
}

async function footerButtonIds(page) {
  return page.locator('.shop-footer button').evaluateAll(buttons=>buttons.map(button=>button.id).sort());
}

async function expectRunFooter(page,navigationId) {
  const ids=['buy-now','buy-priorities','shop-effects','shop-music','next-wave','request-restart','shop-help','shop-skins','shop-aim-priorities',navigationId].sort();
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

test('mobile controls preserve aim, separate hold fire, and fit portrait and landscape',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('/?seed=42');
  const balance=await readBalance(page);
  await expect(page.getByRole('button',{name:'Play',exact:true})).toBeEnabled();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await expectWeaponControls(page);
  await expect(page.locator('#touch-controls')).toBeVisible();
  await expect(page.locator('#aim-pad')).toBeVisible();
  await expect(page.locator('#touch-fire')).toBeVisible();
  await page.screenshot({path:'test-results/towerium-mobile.png',fullPage:true});
  await page.getByRole('button',{name:'Play',exact:true}).tap();
  const pad=await page.locator('#aim-pad').boundingBox(),fire=await page.locator('#touch-fire').boundingBox();
  const cdp=await context.newCDPSession(page);
  const aimPoint={id:1,x:pad.x+pad.width/2,y:pad.y+pad.height/2};
  const initial=await readControlState(page),arena=await page.locator('#arena').boundingBox();
  const viewExtent=(await readSnapshot(page)).view_extent*2;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[aimPoint]});
  expect((await readControlState(page)).aim).toEqual(initial.aim);
  const initialAmmo=Number(await page.locator('#ammo-1').textContent());
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...aimPoint,x:aimPoint.x+24,y:aimPoint.y-16}]});
  const moved=await readControlState(page);
  expect(moved.aim).not.toEqual(initial.aim);expect(moved.firing).toBe(false);
  expect(moved.aim[0]-initial.aim[0]).toBeCloseTo(24*viewExtent/arena.width,1);
  expect(moved.aim[1]-initial.aim[1]).toBeCloseTo(-16*viewExtent/arena.width,1);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  expect((await readControlState(page)).aim).toEqual(moved.aim);
  expect(Number(await page.locator('#ammo-1').textContent())).toBe(initialAmmo);

  // Independent pointer IDs: lifting the aim finger must leave Fire held.
  await page.locator('[data-weapon="1"]').tap();
  const ammoBeforeHold=Number(await page.locator('#ammo-1').textContent());
  const points=[{...aimPoint,id:11},{id:12,x:fire.x+fire.width/2,y:fire.y+fire.height/2}];
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[points[0]]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points});
  await expect(page.locator('#touch-fire')).toHaveAttribute('aria-pressed','true');
  await page.waitForTimeout(400);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[points[0]]});
  await expect(page.locator('#touch-fire')).toHaveAttribute('aria-pressed','true');
  await expect.poll(async()=>Number(await page.locator('#ammo-1').textContent())).toBeLessThan(ammoBeforeHold);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[points[1]]});
  await expect(page.locator('#touch-fire')).toHaveAttribute('aria-pressed','false');

  await page.locator('[data-weapon="3"]').tap();
  const spentBefore=(await readSnapshot(page)).weapon_report[3].ammo_spent;
  await page.locator('#touch-fire').tap();
  await expect.poll(async()=>(await readSnapshot(page)).weapon_report[3].ammo_spent).toBeGreaterThan(spentBefore);
  const spentAfter=(await readSnapshot(page)).weapon_report[3].ammo_spent;
  await page.waitForTimeout(350);
  expect((await readSnapshot(page)).weapon_report[3].ammo_spent).toBe(spentAfter);

  await page.locator('[data-weapon="0"]').tap();
  const firePoint={id:21,x:fire.x+fire.width/2,y:fire.y+fire.height/2};
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[firePoint]});
  await expect(page.locator('#touch-fire')).toHaveAttribute('aria-pressed','true');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading',{name:'Paused',exact:true})).toBeVisible();
  await expect(page.locator('#touch-fire')).toHaveAttribute('aria-pressed','false');
  await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});

  await page.locator('#touch-sensitivity').evaluate(input=>{input.value='1.75';input.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.locator('#touch-hand').selectOption('left');
  await expect(page.locator('#touch-controls')).toHaveAttribute('data-hand','left');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('towerium.touch.v1')))).toEqual({sensitivity:1.75,hand:'left'});
  for(const viewport of [{width:320,height:568},{width:844,height:390}]){
    await page.setViewportSize(viewport);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await expect(page.locator('#touch-fire')).toBeInViewport();
    await expect(page.locator('#aim-pad')).toBeInViewport();
  }
  expect(errors).toEqual([]);
  await context.close();
});

test('held touch aim snaps to a nearby live enemy without changing raw aim',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const page=await context.newPage();
  await page.goto('/?seed=42');
  const saved=await page.evaluate(async()=>{
    const {default:init,Game}=await import('/src/wasm/towerium.js');await init();
    const config=await(await fetch('/engine/balance.json')).json(),game=new Game(42,JSON.stringify(config));
    game.start_wave();let state=JSON.parse(game.snapshot());
    for(let frame=0;frame<600&&state.enemies.length===0;frame++){
      game.advance(1/60);state=JSON.parse(game.snapshot());
    }
    const record=JSON.parse(game.save());game.free();
    if(!record.world.enemies.length)throw new Error('Touch-snap fixture wave did not spawn a live enemy');
    record.world.enemies.forEach((enemy,index)=>{enemy.p={x:0,y:index===0?-210:500};});
    record.world.drops=[];
    return {seed:42,config:JSON.stringify(config),state:JSON.stringify(record)};
  });
  await page.addInitScript(saved=>localStorage.setItem('towerium.run.v1',JSON.stringify(saved)),saved);
  await page.reload();await page.locator('#restore-run').click();
  await page.getByRole('dialog').getByRole('button',{name:'Resume',exact:true}).click();
  const arena=await page.locator('#arena').boundingBox(),pad=await page.locator('#aim-pad').boundingBox(),fire=await page.locator('#touch-fire').boundingBox();
  const cdp=await context.newCDPSession(page),aimPoint={id:31,x:pad.x+pad.width/2,y:pad.y+pad.height/2},firePoint={id:32,x:fire.x+fire.width/2,y:fire.y+fire.height/2};
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[aimPoint]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[aimPoint,firePoint]});
  const {control:snapped,snapshot:nearby}=await readSnapshotAndControlState(page);
  expect(snapped.firing).toBe(true);expect(snapped.aim).toEqual([0,-220]);
  const liveTarget=nearby.enemies.find(enemy=>enemy[4]>0&&Math.hypot(enemy[2]-snapped.aim[0],enemy[3]-snapped.aim[1])<14*nearby.view_extent*2/arena.width);
  expect(liveTarget).toBeTruthy();
  expect(snapped.effectiveAim[0]).toBeCloseTo(liveTarget[2],2);expect(snapped.effectiveAim[1]).toBeCloseTo(liveTarget[3],2);
  const movedAim={...aimPoint,x:aimPoint.x+60};
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[movedAim,firePoint]});
  const outside=await readControlState(page);
  expect(outside.aim).not.toEqual(snapped.aim);expect(outside.effectiveAim).toEqual(outside.aim);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
  await context.close();
});

test('touch settings restore, malformed settings fall back, and desktop hides touch controls',async({browser,page})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const mobile=await context.newPage(),errors=[];mobile.on('pageerror',error=>errors.push(error.message));
  await mobile.addInitScript(()=>{if(!localStorage.getItem('towerium.touch.v1'))localStorage.setItem('towerium.touch.v1',JSON.stringify({sensitivity:99,hand:'sideways'}));});
  await mobile.goto('/');
  await expect(mobile.locator('#touch-sensitivity')).toHaveValue('1');
  await expect(mobile.locator('#touch-hand')).toHaveValue('right');
  await mobile.locator('#touch-sensitivity').evaluate(input=>{input.value='1.5';input.dispatchEvent(new Event('input',{bubbles:true}));});
  await mobile.locator('#touch-hand').selectOption('left');await mobile.reload();
  await expect(mobile.locator('#touch-sensitivity')).toHaveValue('1.5');
  await expect(mobile.locator('#touch-hand')).toHaveValue('left');
  await mobile.locator('#auto-play').click();
  await expect(mobile.locator('#auto-reaction')).toHaveValue('240');await expect(mobile.locator('#auto-speed')).toHaveValue('1800');await expect(mobile.locator('#auto-switch')).toHaveValue('200');
  await expect(mobile.locator('#auto-aim')).toHaveValue('crowd');await expect(mobile.locator('#auto-aim option:checked')).toHaveText('Crowd Sweeps');
  await mobile.screenshot({path:'.local/human-ui/autoplay-defaults-mobile-390x844.png'});
  await mobile.locator('#watch-auto-play').click();
  await expect(mobile.locator('#touch-controls')).toBeHidden();
  expect(errors).toEqual([]);
  await context.close();
  await page.goto('/');await page.locator('#auto-play').click();
  await expect(page.locator('#auto-reaction')).toHaveValue('180');await expect(page.locator('#auto-speed')).toHaveValue('2400');await expect(page.locator('#auto-switch')).toHaveValue('160');
  await expect(page.locator('#auto-aim')).toHaveValue('crowd');await expect(page.locator('#auto-aim option:checked')).toHaveText('Crowd Sweeps');
  await page.screenshot({path:'.local/human-ui/autoplay-defaults-desktop-1440x1080.png'});
  await page.locator('#cancel-auto-play').click();
  await expect(page.locator('#touch-controls')).toBeHidden();
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
    const extent=s.view_extent;
    await page.mouse.move(box.x+(target[0]+extent)/(extent*2)*box.width,box.y+(target[1]+extent)/(extent*2)*box.height);
    await page.clock.runFor(250);
  }
  await page.mouse.up();
  await expect(page.getByRole('heading',{name:'Wave 1 Cleared'})).toBeVisible();
  const firstWave=await readSnapshot(page);
  expect(firstWave.wave_report.shots_fired).toBeGreaterThan(0);
  expect(firstWave.wave_report.kills).toBeGreaterThan(0);
  expect(firstWave.wave_report.coins_earned).toBeGreaterThanOrEqual(0);
  expect(firstWave.coins).toBe(balance.starting_coins+firstWave.wave_report.coins_earned);
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
  for(const [width,height] of [[1440,1080],[390,844],[320,568],[844,390],[568,320],[667,375]]) {
    await page.setViewportSize({width,height});
    const documentBounds=await page.evaluate(()=>({scrollHeight:document.documentElement.scrollHeight,innerHeight,bodyHeight:document.body.scrollHeight}));
    expect(documentBounds.scrollHeight<=documentBounds.innerHeight,JSON.stringify({width,height,...documentBounds})).toBe(true);
    expect(await page.locator('.report-section').count()).toBe(2);
    const reportBodyBounds=await page.locator('.report-body').evaluate(body=>({scrollHeight:body.scrollHeight,clientHeight:body.clientHeight,rect:body.getBoundingClientRect().toJSON()}));
    expect(reportBodyBounds.scrollHeight<=reportBodyBounds.clientHeight+1,JSON.stringify({width,height,...reportBodyBounds})).toBe(true);
    expect(await page.locator('.report-stats>div').count()).toBe(15);
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
  for(const [width,height] of [[1440,1080],[390,844],[320,568],[844,390],[568,320],[667,375]]) {
    await page.setViewportSize({width,height});
    await expectWeaponControls(page);
    const documentBounds=await page.evaluate(()=>({scrollHeight:document.documentElement.scrollHeight,innerHeight,bodyHeight:document.body.scrollHeight}));
    expect(documentBounds.scrollHeight<=documentBounds.innerHeight,JSON.stringify({width,height,...documentBounds})).toBe(true);
    expect(await page.locator('.upgrade').count()).toBe(balance.upgrades.length);
    expect(await page.locator('.upgrade').evaluateAll(buttons=>buttons.every(button=>{const r=button.getBoundingClientRect();return r.top>=0 && r.bottom<=innerHeight && r.left>=0 && r.right<=innerWidth;}))).toBe(true);
    const reportGeometry=await page.locator('#modal').evaluate(dialog=>({scrollHeight:dialog.scrollHeight,clientHeight:dialog.clientHeight,rect:dialog.getBoundingClientRect().toJSON()}));
    expect(reportGeometry.scrollHeight<=reportGeometry.clientHeight+1,`report modal overflow at ${width}x${height}: ${JSON.stringify(reportGeometry)}`).toBe(true);
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
  expect(await footerButtonIds(page)).toEqual(['shop-effects','shop-music','restart','shop-help','shop-skins','shop-aim-priorities'].sort());
  await page.locator('#shop-help').click();await page.locator('#close-help').click();
  await expect(page.getByRole('heading',{name:'Game Over',exact:true})).toBeVisible();
  await expectOverallMatchesSnapshot(page,await readSnapshot(page));
  await page.locator('#shop-skins').click();await page.locator('#back-shop').click();
  await expect(page.getByRole('heading',{name:'Game Over',exact:true})).toBeVisible();
  await expectOverallMatchesSnapshot(page,await readSnapshot(page));
  expect(await footerButtonIds(page)).toEqual(['shop-effects','shop-music','restart','shop-help','shop-skins','shop-aim-priorities'].sort());
  await page.screenshot({path:'test-results/towerium-game-over.png',fullPage:true});
  await page.setViewportSize({width:320,height:568});
  await expectOverallMatchesSnapshot(page,gameOverSnapshot);
  const gameOverBounds=await page.evaluate(()=>({modal:document.querySelector('#modal').getBoundingClientRect().toJSON(),scrollHeight:document.querySelector('#modal').scrollHeight,clientHeight:document.querySelector('#modal').clientHeight,footer:document.querySelector('.shop-footer').getBoundingClientRect().toJSON()}));
  expect(gameOverBounds.scrollHeight<=gameOverBounds.clientHeight+1,JSON.stringify(gameOverBounds)).toBe(true);
  expect(gameOverBounds.footer.right).toBeLessThanOrEqual(gameOverBounds.modal.right);
  await page.screenshot({path:'test-results/towerium-game-over-320x568.png',fullPage:true});
  await page.setViewportSize({width:1440,height:1080});
  await page.getByRole('button',{name:'Play Again',exact:true}).click();await expect(page.locator('#wave')).toHaveText('01');
  const startingHp=balance.upgrades.find(upgrade=>upgrade.name==='Max HP').base;
  await expect(page.locator('#health-text')).toHaveText(`${startingHp} / ${startingHp}`);
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
    const bought=game.buy(0);if(!game.start_wave())throw new Error('Could not start the second wave');state=JSON.parse(game.snapshot());const upgraded=state.levels[0];
    game.input(0,0,false,0);
    for(let i=0;i<9000 && state.phase!==3;i++){
      if(state.phase===2){
        if(!game.start_wave())break;
        state=JSON.parse(game.snapshot());
      }
      game.advance(1/60);state=JSON.parse(game.snapshot());
    }
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
    if(await page.getByRole('heading',{name:/Wave \d+ Cleared/}).count()){
      await page.mouse.up();
      if(await page.locator('[data-perk]').count()){
        await page.locator('[data-perk]').first().click();
        await expect(page.locator('[data-perk]')).toHaveCount(0,{timeout:5000});
      }
      await expect(page.locator('#next-wave')).toBeEnabled({timeout:5000});
      await page.locator('#next-wave').click();await page.mouse.down();
    }
    if(await page.getByRole('heading',{name:'Game Over',exact:true}).count())break;
    const s=await readSnapshot(page);
    const target=(()=>{
      const d=s.drops[0];
      const e=s.enemies.filter(enemy=>Math.hypot(enemy[2],enemy[3])<=s.range+0.1)
        .sort((a,b)=>Math.hypot(a[2],a[3])-Math.hypot(b[2],b[3]))[0];
      return d?[d[2],d[3]]:e?[e[2],e[3]]:[0,220];
    })();
    const extent=s.view_extent;
    await page.mouse.move(box.x+(target[0]+extent)/(extent*2)*box.width,box.y+(target[1]+extent)/(extent*2)*box.height);
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
    const snapshot=getRenderSnapshot(),chronoRadius=snapshot.chrono_radius??snapshot.range+30,spotlightRadius=snapshot.view_extent*1.5;
    const fixture={...snapshot,enemies:[],shots:[],drops:[],areas:[],fx:[],
      chrono_radius:chronoRadius,blackholes:[[100,0],[-100,0]],spotlights:[0,2*Math.PI/3,4*Math.PI/3],powers:Array(9).fill(0)};
    renderer.draw(fixture,[0,-220],1/60);
    const inactive={chrono:radii.filter(r=>r===chronoRadius).length,
      blackHoles:radii.filter(r=>r===200).length,spotlights:radii.filter(r=>r===spotlightRadius).length};
    radii.length=0;
    const active={...fixture,time:fixture.time+1,powers:[...fixture.powers],areas:[[0,180,0,1]]};
    active.powers[1]=10;active.powers[3]=10;active.powers[4]=10;
    renderer.draw(active,[0,-220],1/60);
    const result={inactive,chrono:radii.filter(r=>r===chronoRadius).length,blackHoles:radii.filter(r=>r===200).length,
      spotlights:radii.filter(r=>r===spotlightRadius).length,swamp:radii.filter(r=>r===120).length};
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
    dropChance.base=1;dropChance.step=0;
    config.power_workshop.upgrades.forEach(upgrade=>upgrade.weight=0.34);
    config.power_workshop.upgrades.find(upgrade=>upgrade.name==='Death Wave').weight=100;
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
    const extent=s.view_extent;
    await page.mouse.move(box.x+(target[0]+extent)/(extent*2)*box.width,box.y+(target[1]+extent)/(extent*2)*box.height);
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
    expect(shopBounds.tools.every(rect=>rect.top>=shopBounds.modal.top&&rect.bottom<=shopBounds.modal.bottom&&rect.left>=shopBounds.modal.left&&rect.right<=shopBounds.modal.right),`${width}×${height} shop control bounds ${JSON.stringify(shopBounds)}`).toBe(true);
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
  const startingHp=(await readBalance(page)).upgrades.find(upgrade=>upgrade.name==='Max HP').base;
  expect(contact.hp).toBeLessThan(startingHp);expect(contact.nearest).toBeGreaterThanOrEqual(contact.wall-0.01);
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

test('released balance and legacy save format can resume',async({page})=>{
  await page.goto('/');await page.locator('#start').click();
  const saved=await makeClearedWaveSave(page);
  const releasedConfig=JSON.stringify(JSON.parse(execFileSync('git',['show','90cc74f:engine/balance.json'],{encoding:'utf8'})));
  const legacy=await page.evaluate(async({saved,releasedConfig})=>{
    const {default:init,Game}=await import('/src/wasm/towerium.js');await init();
    const game=Game.restore(saved.config,saved.state);
    if(!game.buy(0)||!game.start_wave())throw new Error('Could not prepare legacy-format active run');
    for(let i=0;i<90;i++)game.advance(1/60);
    const current=JSON.parse(game.snapshot()),state=JSON.parse(game.save());game.free();
    const expected={wave:current.wave,coins:current.coins,levels:current.levels};
    delete state.world.ray_cycle;
    for(const enemy of state.world.enemies)delete enemy.swamp_hit_cd;
    return {saved:{seed:saved.seed,config:releasedConfig,state:JSON.stringify(state)},expected};
  },{saved,releasedConfig});
  await stageRunOnNextNavigation(page,legacy.saved,'towerium.test-legacy-save');
  await page.reload();await expect(page.locator('#restore-run')).toBeVisible();
  await page.locator('#restore-run').click();
  const restored=await readSnapshot(page);
  expect(restored.wave).toBe(legacy.expected.wave);
  expect(restored.coins).toBe(legacy.expected.coins);
  expect(restored.levels).toEqual(legacy.expected.levels);
  expect(restored.paused).toBe(true);
});

test('unknown run and retry configs are rejected while malformed storage is cleared',async({page})=>{
  await page.goto('/');
  const saved=await makeClearedWaveSave(page),retry=await makeWaveTenRetryRecord(page,1);
  const unknownConfig=JSON.stringify({...JSON.parse(saved.config),waves:{...JSON.parse(saved.config).waves,spawn_seconds:JSON.parse(saved.config).waves.spawn_seconds+1}});
  saved.config=unknownConfig;retry.config=unknownConfig;
  await page.addInitScript(({saved,retry})=>{
    if(sessionStorage.getItem('towerium.test-unknown-config'))return;
    localStorage.setItem('towerium.run.v1',JSON.stringify(saved));
    localStorage.setItem('towerium.retries.v1',JSON.stringify(retry));
    sessionStorage.setItem('towerium.test-unknown-config','1');
  },{saved,retry});
  await page.reload();
  await expect(page.locator('#start')).toBeEnabled();
  await expect(page.locator('#restore-run')).toHaveCount(0);
  expect(await page.evaluate(()=>[localStorage.getItem('towerium.run.v1'),localStorage.getItem('towerium.retries.v1')])).toEqual([null,null]);
});

test('three module HUD timers persist and restore while Multiverse Nexus has no timer',async({page})=>{
  await page.goto('/');
  const saved=await page.evaluate(async()=>{
    const {default:init,Game}=await import('/src/wasm/towerium.js');await init();
    const config=JSON.stringify(await(await fetch('/engine/balance.json')).json()),game=new Game(42,config);
    if(!game.start_wave())throw new Error('Could not start module timer fixture');
    const state=JSON.parse(game.save());game.free();state.world.module_times=[42,41,40,39];
    return {seed:42,config,state:JSON.stringify(state)};
  });
  await stageRunOnNextNavigation(page,saved,'towerium.test-module-timers');
  await page.reload();await expect(page.locator('#restore-run')).toBeVisible();await page.locator('#restore-run').click();
  const expected=['Death Penalty, 42 seconds','Space Displacer, 41 seconds','Pulsar Harvester, 40 seconds'];
  const snapshot=await readSnapshot(page);
  expect(snapshot.module_times).toEqual([42,41,40,0]);
  await expect(page.locator('#powers [aria-label*="Multiverse Nexus"]')).toHaveCount(0);
  for(const label of expected)await expect(page.locator('#powers [aria-label="'+label+'"]')).toBeVisible();
  await page.reload();await expect(page.locator('#restore-run')).toBeVisible();await page.locator('#restore-run').click();
  expect((await readSnapshot(page)).module_times).toEqual([42,41,40,0]);
});

test('tenth-wave retry count persists, caps at three, and survives reload',async({page})=>{
  await page.goto('/');
  const record=await makeWaveTenRetryRecord(page,2),marker='towerium.test-retry-metadata';
  await page.addInitScript(({record,marker})=>{
    const stage=sessionStorage.getItem(marker);
    if(stage===null){
      localStorage.removeItem('towerium.run.v1');
      localStorage.setItem('towerium.retries.v1',JSON.stringify(record));
      sessionStorage.setItem(marker,'staged');
    }else if(stage==='clear-run'){
      localStorage.removeItem('towerium.run.v1');sessionStorage.removeItem(marker);
    }
  },{record,marker});
  await page.reload();
  await expect(page.locator('#retry-run')).toHaveText('Retry Wave 10 · 1 Left');
  await captureIntroLayouts(page,'retry');
  await page.locator('#retry-run').click();
  await expect(page.locator('#wave')).toHaveText('10');
  const afterRetry=await page.evaluate(()=>JSON.parse(localStorage.getItem('towerium.retries.v1')));
  expect(afterRetry.used).toBe(3);
  expect(afterRetry.checkpoint).toEqual(record.checkpoint);
  expect(Object.keys(afterRetry).sort()).toEqual(['checkpoint','config','used','version']);
  await page.evaluate(marker=>sessionStorage.setItem(marker,'clear-run'),marker);
  await page.reload();
  await expect(page.locator('#retry-run')).toHaveCount(0);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('towerium.retries.v1')).used)).toBe(3);
});

test('wave fifty start unlocks from progression, stays empty, and resumes its purchased run',async({page})=>{
  await page.goto('/');
  const balance=await readBalance(page);
  await expect(page.locator('#milestone-run')).toHaveCount(0);
  await page.evaluate(()=>localStorage.setItem('towerium.cosmetics.v1',JSON.stringify({completed:50,selected:'cyber'})));
  await page.reload();
  await expect(page.locator('#milestone-run')).toBeVisible();
  await captureIntroLayouts(page,'milestone');
  await page.locator('#milestone-run').click();
  const fresh=await readSnapshot(page);
  expect(fresh.pending_start_wave).toBe(50);expect(fresh.phase).toBe(2);expect(fresh.coins).toBeGreaterThan(0);
  expect(fresh.levels).toEqual(Array(balance.upgrades.length).fill(0));
  await page.locator('[data-upgrade="0"]').click();
  const purchased=await readSnapshot(page);
  expect(purchased.levels[0]).toBe(1);expect(purchased.coins).toBeLessThan(fresh.coins);
  await page.locator('#next-wave').click();
  await expect(page.locator('#wave')).toHaveText('50');
  const started=await readSnapshot(page);
  expect(started.pending_start_wave).toBe(0);expect(started.levels).toEqual(purchased.levels);
  await page.reload();await expect(page.locator('#restore-run')).toBeVisible();
  await page.locator('#restore-run').click();
  const restored=await readSnapshot(page);
  expect(restored.wave).toBe(started.wave);expect(restored.levels).toEqual(started.levels);
  expect(restored.paused).toBe(true);
});

test('shop save restores upgrades and Title Case labels without scrolling',async({page})=>{
  const workshopImageResponses=[];
  page.on('response',response=>{
    if(response.request().resourceType()==='image'&&response.url().includes('/workshop/')){
      workshopImageResponses.push({url:response.url(),status:response.status(),contentType:response.headers()['content-type']});
    }
  });
  await page.goto('/');const balance=await readBalance(page);await page.locator('#start').click();
  const saved=await makeClearedWaveSave(page);
  // Set a valid shield balance in this save fixture to verify that restore preserves its HUD display.
  const state=JSON.parse(saved.state);state.world.shields=2;saved.state=JSON.stringify(state);
  await stageRunOnNextNavigation(page,saved,'towerium.test-shop-ready');
  await page.reload();await page.locator('#restore-run').click();
  const initial=await readSnapshot(page);const initialReport=await expectReportMatchesSnapshot(page,initial);
  await page.locator('#open-shop').click();await expect(page.locator('.upgrade')).toHaveCount(balance.upgrades.length);
  for(const label of await page.locator('.upgrade-title strong').allTextContents())expect(label.split(/\s+/).every(word=>!/[a-z]/.test(word[0]))).toBe(true);
  expect(await page.locator('.upgrade-title strong').allTextContents()).toEqual([
    'Attack Speed','Range','Health','Regen','Coins/Kill',
    'Multishot Chance','Multishot Qty','Thorns','Overheal %','Ammo Drop Chance',
    'Rapid Fire Chance','Rapid Fire Duration','Knockback Chance','Knockback Force','Ammo Qty',
    'Bounce Chance','Bounce Targets','Orb Speed','Orb Qty','Power Up Chance',
    'Bounce Range','Landmine Chance','Shockwave Size','Shockwave Freq','Powerup Duration',
    'Landmine Radius','Landmine Damage','Wall HP','Wall Rebuild Time','Max Ammo Capacity',
    'Auto Cannon Efficiency','Targeting Speed','Auto Weapons','Missile Fire Rate','Power Stack Cap',
  ]);
  try{
    await expect.poll(()=>page.locator('.upgrade-title img').evaluateAll(images=>images.every(image=>image.complete&&image.naturalWidth>0))).toBe(true);
  }catch(error){
    const imageState=await page.locator('.upgrade-title img').evaluateAll(images=>images.map(image=>({src:image.src,currentSrc:image.currentSrc,complete:image.complete,naturalWidth:image.naturalWidth,naturalHeight:image.naturalHeight})));
    console.error('WORKSHOP_ICON_DIAGNOSTIC',JSON.stringify({imageState,workshopImageResponses}));
    throw error;
  }
  await expect(page.locator('.shop-wallet span[title="Coins"]')).toBeVisible();
  await expect(page.locator('.shop-wallet span[title="Power Stones"]')).toBeVisible();
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
  for(const viewport of [{width:320,height:568},{width:844,height:390},{width:568,height:320}]){
    await page.setViewportSize(viewport);
    const shopGeometry=await page.locator('#modal').evaluate(el=>({scrollHeight:el.scrollHeight,clientHeight:el.clientHeight,rect:el.getBoundingClientRect().toJSON()}));
    expect(shopGeometry.scrollHeight<=shopGeometry.clientHeight+1,JSON.stringify({viewport,...shopGeometry})).toBe(true);
    const footer=await page.locator('.shop-footer').boundingBox();expect(footer.x+footer.width).toBeLessThanOrEqual(viewport.width);
    const wallet=await page.locator('.shop-wallet').boundingBox();expect(wallet.y).toBeGreaterThanOrEqual(0);expect(wallet.y+wallet.height).toBeLessThanOrEqual(viewport.height);
  }
  await page.locator('#request-restart').click();await page.locator('#cancel-restart').click();await expect(page.locator('.upgrade')).toHaveCount(balance.upgrades.length);
  await page.locator('#next-wave').click();
  await expect(page.locator('#powers [aria-label="Energy Shield, 2 of 3 charges"]')).toBeVisible();
});

test('Powerups shop spends run-local Stones, restores purchases, and fits phone layouts',async({page})=>{
  await page.goto('/');
  const saved=await makeClearedWaveSave(page),state=JSON.parse(saved.state);
  state.world.stones=10000;state.world.stones_earned=10000;
  state.world.power_levels=Array.from({length:22},()=>[0,0]);saved.state=JSON.stringify(state);
  await stageRunOnNextNavigation(page,saved,'towerium.test-power-shop');
  await page.reload();await expect(page.locator('#restore-run')).toBeVisible();await page.locator('#restore-run').click();
  await page.locator('#open-shop').click();
  await page.locator('#category-powers').click();
  await expect(page.locator('#category-powers')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#category-workshop')).toHaveAttribute('aria-pressed','false');
  await expect(page.locator('.power-choice')).toHaveCount(23);
  await expect(page.locator('#modal h2')).toHaveText('Powerups');
  await expect(page.locator('.shop-wallet span[title="Coins"]')).toBeVisible();
  await expect(page.locator('.shop-wallet span[title="Power Stones"]')).toBeVisible();
  const before=await readSnapshot(page),cost=before.power_costs[0][0];
  expect(before.stones).toBe(10000);expect(before.coins).toBeGreaterThan(0);
  await page.locator('[data-power-buy="0"][data-power-path="0"]').click();
  const bought=await readSnapshot(page);
  expect(bought.power_levels[0][0]).toBe(1);expect(bought.stones).toBe(before.stones-cost);expect(bought.coins).toBe(before.coins);
  for(const viewport of [{width:320,height:568},{width:844,height:390},{width:568,height:320}]){
    await page.setViewportSize(viewport);
    expect(await page.locator('#modal').evaluate(el=>el.scrollHeight<=el.clientHeight+1)).toBe(true);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    expect(await page.locator('.power-selector').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
    const footer=await page.locator('.shop-footer').boundingBox();expect(footer.x+footer.width).toBeLessThanOrEqual(viewport.width);
    const wallet=await page.locator('.shop-wallet').boundingBox();expect(wallet.y).toBeGreaterThanOrEqual(0);expect(wallet.y+wallet.height).toBeLessThanOrEqual(viewport.height);
  }
  await page.reload();await expect(page.locator('#restore-run')).toBeVisible();await page.locator('#restore-run').click();
  const restored=await readSnapshot(page);
  expect(restored.stones).toBe(bought.stones);expect(restored.coins).toBe(bought.coins);expect(restored.power_levels).toEqual(bought.power_levels);
  await page.locator('#open-shop').click();await page.locator('#category-powers').click();
  await expect(page.locator('[data-power-buy="0"][data-power-path="0"]')).toBeEnabled();
  for(const viewport of [{width:320,height:568},{width:844,height:390},{width:568,height:320}]){
    await page.setViewportSize(viewport);
    expect(await page.locator('#modal').evaluate(el=>el.scrollHeight<=el.clientHeight+1)).toBe(true);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    expect(await page.locator('.power-selector').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
    const footer=await page.locator('.shop-footer').boundingBox();expect(footer.x+footer.width).toBeLessThanOrEqual(viewport.width);
    const wallet=await page.locator('.shop-wallet').boundingBox();expect(wallet.y).toBeGreaterThanOrEqual(0);expect(wallet.y+wallet.height).toBeLessThanOrEqual(viewport.height);
    await page.screenshot({path:`.local/powerups-purchased-${viewport.width}x${viewport.height}.png`,fullPage:true});
  }
});

test('Power workshop exposes six extra powers and saves Radius upgrades for all four bots',async({page})=>{
  await page.goto('/');
  const saved=await makeClearedWaveSave(page),state=JSON.parse(saved.state);
  state.world.stones=10000;state.world.stones_earned=10000;state.world.coins=10000;state.world.power_levels=Array.from({length:22},()=>[0,0]);saved.state=JSON.stringify(state);
  await stageRunOnNextNavigation(page,saved,'towerium.test-bot-power-shop');
  await page.reload();await expect(page.locator('#restore-run')).toBeVisible();await page.locator('#restore-run').click();
  await page.locator('#open-shop').click();await page.locator('#category-powers').click();
  await expect(page.locator('.power-choice')).toHaveCount(23);
  const names=['Gold Bot','Amp Bot','Flame Bot','Thunder Bot'];
  let spent=0;const starting=await readSnapshot(page);
  for(let bot=0;bot<names.length;bot++){
    const index=18+bot,choice=page.locator(`[data-power-select="${index}"]`);
    await choice.click();await expect(choice).toHaveAttribute('aria-pressed','true');
    await expect(page.locator('#power-shop-title')).toHaveText(names[bot]);
    await expect(page.locator('.power-upgrades .upgrade-title strong').nth(1)).toHaveText('Radius');
    const before=await readSnapshot(page),cost=before.power_costs[index][1];
    await page.locator(`[data-power-buy="${index}"][data-power-path="1"]`).click();
    const after=await readSnapshot(page);spent+=cost;
    expect(after.power_levels[index][1]).toBe(before.power_levels[index][1]+1);
    expect(after.stones).toBe(before.stones-cost);expect(after.coins).toBe(before.coins);
  }
  await page.reload();await expect(page.locator('#restore-run')).toBeVisible();await page.locator('#restore-run').click();
  const restored=await readSnapshot(page);
  expect(restored.stones).toBe(starting.stones-spent);expect(restored.coins).toBe(starting.coins);
  for(let bot=0;bot<names.length;bot++)expect(restored.power_levels[18+bot][1]).toBe(1);
  await page.locator('#open-shop').click();await page.locator('#category-powers').click();
  for(let bot=0;bot<names.length;bot++){
    const choice=page.locator(`[data-power-select="${18+bot}"]`);
    await choice.click();await expect(page.locator('#power-shop-title')).toHaveText(names[bot]);
    await expect(page.locator('.power-upgrades .upgrade-title strong').nth(1)).toHaveText('Radius');
    await expect(page.locator(`[data-power-buy="${18+bot}"][data-power-path="1"]`)).toContainText('1/10');
  }
  await page.locator('[data-power-select="18"]').click();
  for(const viewport of [{width:320,height:568},{width:568,height:320}]){
    await page.setViewportSize(viewport);
    const bounds=await page.evaluate(()=>({
      width:document.documentElement.scrollWidth,modal:document.querySelector('#modal').getBoundingClientRect().toJSON(),
      selector:document.querySelector('.power-selector').getBoundingClientRect().toJSON(),
      choice:document.querySelector('[data-power-select="18"]').getBoundingClientRect().toJSON(),
      footer:document.querySelector('.shop-footer').getBoundingClientRect().toJSON(),
      radius:document.querySelector('[data-power-buy="18"][data-power-path="1"]').getBoundingClientRect().toJSON(),
    }));
    expect(bounds.width).toBeLessThanOrEqual(viewport.width);
    for(const rect of [bounds.modal,bounds.selector,bounds.footer,bounds.radius])expect(rect.left>=0&&rect.right<=viewport.width&&rect.top>=0&&rect.bottom<=viewport.height,JSON.stringify({viewport,rect})).toBe(true);
    expect(bounds.modal.height).toBeLessThanOrEqual(viewport.height);
    if(viewport.width>viewport.height)expect(bounds.choice.height).toBeGreaterThanOrEqual(44);
    await page.screenshot({path:`.local/human-ui/bot-radius-${viewport.width}x${viewport.height}.png`,fullPage:true});
  }
  await page.locator('#category-supplies').click();await page.locator('[data-supply="21"]').click();
  await page.locator('#next-wave').click();
  await expect.poll(async()=>{
    const snapshot=await readSnapshot(page);
    return snapshot.bots.some(bot=>bot[0]===18)&&snapshot.extra_power_times[2]>0;
  }).toBe(true);
  const activeBots=await readSnapshot(page);
  expect(activeBots.bots.some(bot=>bot[0]===18)).toBe(true);
  await page.screenshot({path:'.local/human-ui/active-bot-game-568x320.png',fullPage:true});
  await page.setViewportSize({width:1440,height:1080});
  await page.screenshot({path:'.local/human-ui/active-bot-game-1440x1080.png',fullPage:true});
});

test('Supplies shop uses Coins, restores ammo, and fits portrait and landscape without scrolling',async({page})=>{
  await page.goto('/');
  const saved=await makeClearedWaveSave(page),config=JSON.parse(saved.config);
  const ammoCapacity=await page.evaluate(async({saved})=>{
    const {default:init,Game}=await import('/src/wasm/towerium.js');await init();
    const game=Game.restore(saved.config,saved.state),snapshot=JSON.parse(game.snapshot());game.free();
    return snapshot.ammo_caps[1];
  },{saved});
  const world=JSON.parse(saved.state);world.world.ammo[1]=ammoCapacity-1;world.world.coins=10000;saved.state=JSON.stringify(world);
  const nativePower=await page.evaluate(async saved=>{
    const {default:init,Game}=await import('/src/wasm/towerium.js');await init();
    const game=Game.restore(saved.config,saved.state),before=JSON.parse(game.snapshot());
    const bought=game.buy_supply(9),after=JSON.parse(game.snapshot()),started=game.start_wave(),combat=JSON.parse(game.snapshot());
    game.free();return {before,bought,after,started,combat};
  },saved);
  expect(nativePower.bought).toBe(true);expect(nativePower.before.powers[6]).toBe(0);
  expect(nativePower.after.powers[6]).toBeGreaterThan(0);expect(nativePower.started).toBe(true);
  expect(nativePower.combat.phase).toBe(1);expect(nativePower.combat.powers[6]).toBe(nativePower.after.powers[6]);
  expect(nativePower.before.supply_costs[11]).toBe(Math.max(...nativePower.before.supply_costs));

  await stageRunOnNextNavigation(page,saved,'towerium.test-supplies-shop');
  await page.reload();await expect(page.locator('#restore-run')).toBeVisible();await page.locator('#restore-run').click();
  await page.locator('#open-shop').click();
  const before=await readSnapshot(page);
  await expect(page.locator('#category-workshop')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('.upgrade')).toHaveCount(config.upgrades.length);
  await expect(page.locator('.shop-footer')).toBeVisible();
  await expect(page.locator('.shop-wallet span[title="Coins"]')).toBeVisible();
  await expect(page.locator('.shop-wallet span[title="Power Stones"]')).toBeVisible();
  await page.locator('#category-powers').click();
  await expect(page.locator('.power-choice')).toHaveCount(23);
  await expect(page.locator('.shop-footer')).toBeVisible();await expect(page.locator('.shop-wallet')).toBeVisible();
  await page.locator('#category-supplies').click();
  await expect(page.locator('#modal h2')).toHaveText('Supplies');
  await expect(page.locator('.supply')).toHaveCount(26);
  await expect(page.locator('.shop-footer')).toBeVisible();await expect(page.locator('.shop-wallet')).toBeVisible();
  expect(before.ammo[1]).toBe(ammoCapacity-1);
  await page.locator('[data-supply="0"]').click();
  const boughtAmmo=await readSnapshot(page);
  expect(boughtAmmo.ammo[1]).toBe(ammoCapacity);expect(boughtAmmo.coins).toBe(before.coins-before.supply_costs[0]);
  expect(boughtAmmo.stones).toBe(before.stones);expect(boughtAmmo.power_levels).toEqual(before.power_levels);
  for(const viewport of [{width:320,height:568},{width:568,height:320}]){
    await page.setViewportSize(viewport);
    const geometry=await page.evaluate(()=>({
      documentWidth:document.documentElement.scrollWidth,modal:document.querySelector('#modal').getBoundingClientRect().toJSON(),
      modalHeight:document.querySelector('#modal').clientHeight,modalScroll:document.querySelector('#modal').scrollHeight,
      bodyHeight:document.querySelector('.shop-body').clientHeight,bodyScroll:document.querySelector('.shop-body').scrollHeight,
      footer:document.querySelector('.shop-footer').getBoundingClientRect().toJSON(),
      wallet:document.querySelector('.shop-wallet').getBoundingClientRect().toJSON(),
      tabs:[...document.querySelectorAll('.shop-categories button')].map(button=>button.getBoundingClientRect().toJSON()),
      cards:[...document.querySelectorAll('.supply')].map(card=>card.getBoundingClientRect().toJSON()),
    }));
    expect(geometry.documentWidth,JSON.stringify({viewport,...geometry})).toBeLessThanOrEqual(viewport.width);
    expect(geometry.modalScroll,JSON.stringify({viewport,...geometry})).toBeLessThanOrEqual(geometry.modalHeight+1);
    expect(geometry.bodyScroll,JSON.stringify({viewport,...geometry})).toBeLessThanOrEqual(geometry.bodyHeight+1);
    for(const box of [geometry.footer,geometry.wallet,...geometry.tabs,...geometry.cards])expect(box.left>=0&&box.right<=viewport.width&&box.top>=0&&box.bottom<=viewport.height,JSON.stringify({viewport,box})).toBe(true);
    await page.screenshot({path:`.local/human-ui/supplies-${viewport.width}x${viewport.height}.png`,fullPage:true});
  }
  await page.reload();await expect(page.locator('#restore-run')).toBeVisible();await page.locator('#restore-run').click();
  const restored=await readSnapshot(page);
  expect(restored.ammo[1]).toBe(ammoCapacity);expect(restored.coins).toBe(boughtAmmo.coins);expect(restored.stones).toBe(boughtAmmo.stones);
  await page.locator('#open-shop').click();await page.locator('#category-supplies').click();
  await expect(page.locator('[data-supply="0"]')).toBeDisabled();
  await expect(page.locator('[data-supply="0"]')).toHaveAttribute('aria-label',/Full/);
  await page.locator('#next-wave').click();await expect(page.locator('#wave')).toHaveText('02');
  const next=await readSnapshot(page);
  expect(next.ammo[1]).toBe(ammoCapacity);expect(next.coins).toBe(boughtAmmo.coins);expect(next.stones).toBe(boughtAmmo.stones);
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


test('Auto Play spends the wave-160 build and Stone budgets before its first spawn and rebuilds on restart',async({page})=>{
  await page.clock.install();
  await page.goto('/?seed=42');
  const expected=await nativeAutoBuild(page,160,'balanced',42);
  expect(expected.initial.phase).toBe(2);expect(expected.initial.pending_start_wave).toBe(160);
  expect(expected.plan.length).toBeGreaterThan(0);
  expect(expected.initial.coins,JSON.stringify({initialCoins:expected.initial.coins,preparedCoins:expected.prepared.coins,plan:expected.plan})).toBeGreaterThan(expected.prepared.coins);
  expect(expected.initial.stones,JSON.stringify({initialStones:expected.initial.stones,preparedStones:expected.prepared.stones,plan:expected.plan})).toBeGreaterThan(expected.prepared.stones);
  expect(expected.prepared.levels.some(level=>level>0)).toBe(true);
  expect(expected.prepared.power_levels.flat().some(level=>level>0)).toBe(true);
  expect(expected.started).toBe(true);expect(expected.firstCombat.phase).toBe(1);expect(expected.firstCombat.spawned).toBe(0);
  for(const index of [1,3,4,6])expect(expected.firstCombat.powers[index]).toBeGreaterThanOrEqual(20);
  expect(expected.firstCombat.extra_power_times[0]).toBeGreaterThanOrEqual(20);
  expect(expected.firstCombat.extra_power_times[6]).toBeGreaterThanOrEqual(20);
  expect(expected.firstCombat.shields).toBeGreaterThanOrEqual(1);

  const strategies=await Promise.all(['balanced','offense','defense','economy'].map(strategy=>nativeAutoBuild(page,160,strategy,42)));
  const signatures=Object.fromEntries(strategies.map(build=>[build.strategy,JSON.stringify(build.plan)]));
  for(const strategy of ['offense','defense','economy'])expect(signatures[strategy],`${strategy} should differ from balanced: ${JSON.stringify(signatures)}`).not.toBe(signatures.balanced);

  const saved=await makeClearedWaveSave(page,42);
  await page.evaluate(saved=>{
    localStorage.setItem('towerium.run.v1',JSON.stringify(saved));
    localStorage.setItem('towerium.best-wave','17');
    localStorage.setItem('towerium.cosmetics.v1',JSON.stringify({completed:17,selected:'hexagon'}));
  },saved);
  await page.reload();await expect(page.locator('#restore-run')).toBeVisible();
  const personal=await page.evaluate(()=>Object.fromEntries(['towerium.run.v1','towerium.best-wave','towerium.cosmetics.v1'].map(key=>[key,localStorage.getItem(key)])));
  await page.locator('#auto-play').click();await page.locator('#auto-start-wave').fill('160');
  const first=await clickAndReadSnapshot(page,'#watch-auto-play');await expect(page.locator('#run-mode')).toBeVisible();expectAutoBuild(first,expected,160);
  for(const index of [1,3,4,6])expect(first.powers[index]).toBeGreaterThan(19);
  expect(await page.evaluate(()=>Object.fromEntries(['towerium.run.v1','towerium.best-wave','towerium.cosmetics.v1'].map(key=>[key,localStorage.getItem(key)])))).toEqual(personal);

  await page.locator('#pause').click();await page.locator('#request-restart').click();
  const restarted=await clickAndReadSnapshot(page,'#confirm-restart');await expect(page.locator('#run-mode')).toBeVisible();expectAutoBuild(restarted,expected,160,{beforeFirstSpawn:false});
  await page.locator('#pause').click();await page.locator('#stop-auto-play').click();
  await expect(page.locator('#restore-run')).toBeVisible();await expect(page.locator('#run-mode')).toBeHidden();
  expect(await page.evaluate(()=>Object.fromEntries(['towerium.run.v1','towerium.best-wave','towerium.cosmetics.v1'].map(key=>[key,localStorage.getItem(key)])))).toEqual(personal);
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
  await expect(page.locator('#wave')).toHaveText('01');await expect(page.locator('#run-mode')).toBeVisible();await page.locator('#pause').click();await page.locator('#stop-auto-play').click();
  await expect(page.locator('#restore-run')).toBeVisible();await expect(page.locator('#run-mode')).toBeHidden();
  expect(await page.evaluate(()=>Object.fromEntries(['towerium.run.v1','towerium.best-wave','towerium.cosmetics.v1'].map(key=>[key,localStorage.getItem(key)])))).toEqual(personal);
  await page.locator('#auto-play').click();await page.locator('#auto-aim').selectOption('circle');await page.locator('#auto-weapons').selectOption('projectile');await page.locator('#watch-auto-play').click();
  await page.waitForTimeout(1200);await page.reload();await expect(page.locator('#restore-run')).toBeVisible();
  expect(await page.evaluate(()=>Object.fromEntries(['towerium.run.v1','towerium.best-wave','towerium.cosmetics.v1'].map(key=>[key,localStorage.getItem(key)])))).toEqual(personal);
});

test('Auto Play exposes and fires its independent automatic cannon',async({page})=>{
  await page.goto('/?seed=42');await expect(page.locator('#start')).toBeEnabled();
  await expect(page.locator('#auto-aim-toggle')).toHaveText('Autocannon: Off');
  await page.locator('#auto-play').click();await page.locator('#watch-auto-play').click();
  await expect(page.locator('#auto-aim-toggle')).toHaveText('Autocannon: On');
  await expect.poll(async()=>{
    const s=await readSnapshot(page);return s.overall_report.shots_fired-s.manual_shots_fired;
  },{timeout:30000}).toBeGreaterThan(0);
  const controls=await page.evaluate(async()=>{
    const entry=document.querySelector('script[type="module"][src*="/src/main.ts"]');
    return (await import(entry.src)).getControlState();
  });
  expect(controls.autoAim).not.toBeNull();expect(Number.isInteger(controls.autoTargetId)).toBe(true);
  await page.locator('#pause').click();await page.locator('#stop-auto-play').click();
  await expect(page.locator('#auto-aim-toggle')).toHaveText('Autocannon: Off');
});

test('Auto Play advances out of focus while a human run pauses on blur',async({page})=>{
  await page.clock.install();await page.goto('/?seed=42');
  await page.locator('#auto-play').click();await page.locator('#watch-auto-play').click();
  await expect(page.locator('#run-mode')).toBeVisible();
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
  expect((await readSnapshot(page)).paused).toBe(false);
  const before=await readSnapshot(page);
  await page.evaluate(()=>{
    Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.runFor(3200);
  const background=await readSnapshot(page);
  expect(background.paused).toBe(false);expect(background.time).toBeGreaterThan(before.time);

  const manual=await page.context().newPage();
  await manual.clock.install();await manual.addInitScript(()=>localStorage.removeItem('towerium.run.v1'));
  await manual.goto('/?seed=42');await manual.locator('#start').click();
  await manual.evaluate(()=>window.dispatchEvent(new Event('blur')));
  expect((await readSnapshot(manual)).paused).toBe(true);
  await manual.close();
});

test('all 23 power assets decode and expanded native snapshots render without errors',async({page})=>{
  const pageErrors=[];page.on('pageerror',error=>pageErrors.push(error.message));
  await page.goto('/');
  const saved=await makeClearedWaveSave(page);
  const result=await page.evaluate(async saved=>{
    const [{loadArt},{Renderer},{default:init,Game}]=await Promise.all([
      import('/src/assets.ts'),import('/src/renderer.ts'),import('/src/wasm/towerium.js'),
    ]);
    await init();const art=await loadArt();
    const canvas=document.createElement('canvas');canvas.style.width='440px';canvas.style.height='440px';document.body.append(canvas);
    const renderer=new Renderer(canvas,art),record=JSON.parse(saved.state);
    record.world.extra_power_times=Array(7).fill(20);record.world.extra_orb_angle=0.5;
    record.world.bots=Array.from({length:4},(_,index)=>({position:{x:40+index*10,y:30},target:{x:40+index*10,y:30},pulse_in:0,initialized:true}));
    const game=Game.restore(saved.config,JSON.stringify(record)),snapshot=JSON.parse(game.snapshot());
    snapshot.demon_time=10;snapshot.demon_invincible=5;
    snapshot.drops.push([1001,10,-90,20,10],[1002,11,90,20,10],[1003,12,-60,60,10],[1004,13,-20,80,10],[1005,14,20,80,10],[1006,15,60,60,10],[1007,22,80,100,10]);
    renderer.draw(snapshot,[0,0],0);
    const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
    const result={
      nuke:{complete:art.powers[10].complete,width:art.powers[10].naturalWidth},
      demonCard:{complete:art.powers[11].complete,width:art.powers[11].naturalWidth},
      modules:art.powers.slice(12,16).map(image=>({complete:image.complete,width:image.naturalWidth,src:new URL(image.src).pathname})),
      expansion:art.powers.slice(16,23).map(image=>({complete:image.complete,width:image.naturalWidth,src:new URL(image.src).pathname})),
      nativeExpansion:{extraPowerTimes:snapshot.extra_power_times,extraOrbs:snapshot.extra_orbs,bots:snapshot.bots},
      demonWing:{complete:art.demonWing.complete,width:art.demonWing.naturalWidth,height:art.demonWing.naturalHeight},
      pixelColors:new Set(Array.from({length:Math.floor(pixels.length/4)},(_,i)=>`${pixels[i*4]},${pixels[i*4+1]},${pixels[i*4+2]}`)).size,
    };
    game.free();canvas.remove();return result;
  },saved);
  expect(result.nuke.complete).toBe(true);expect(result.nuke.width).toBeGreaterThan(0);
  expect(result.demonCard.complete).toBe(true);expect(result.demonCard.width).toBeGreaterThan(0);
  expect(result.modules.map(image=>image.complete)).toEqual([true,true,true,true]);
  expect(result.modules.map(image=>image.width).every(width=>width>0)).toBe(true);
  expect(result.modules.map(image=>image.src)).toEqual([
    '/tower-assets/modules/death-penalty-md.webp','/tower-assets/modules/space-displacer-md.webp',
    '/tower-assets/modules/pulsar-harvester-md.webp','/tower-assets/modules/multiverse-nexus-md.webp',
  ]);
  expect(result.expansion.map(image=>image.complete)).toEqual(Array(7).fill(true));
  expect(result.expansion.map(image=>image.width).every(width=>width>0)).toBe(true);
  expect(result.expansion.map(image=>image.src)).toEqual([
    '/tower-assets/cards/extra-orb-md.webp','/tower-assets/cards/aoe-md.webp',
    '/tower-assets/icons/golden-bot-md.webp','/tower-assets/icons/amplify-bot-md.webp',
    '/tower-assets/icons/flame-bot-md.webp','/tower-assets/icons/thunder-bot-md.webp',
    '/tower-assets/cards/critical-coin-md.webp',
  ]);
  expect(result.nativeExpansion.extraPowerTimes).toEqual(Array(7).fill(20));
  expect(result.nativeExpansion.extraOrbs).toHaveLength(3);
  expect(result.nativeExpansion.bots.map(bot=>bot[0])).toEqual([18,19,20,21]);
  expect(result.demonWing.complete).toBe(true);expect(result.demonWing.width).toBeGreaterThan(0);expect(result.demonWing.height).toBeGreaterThan(0);
  expect(result.pixelColors).toBeGreaterThan(20);expect(pageErrors).toEqual([]);
});


test('auto target priority persist and manual fire remains available',async({page})=>{
 await page.goto('/?seed=42');await expect(page.locator('#start')).toBeEnabled();
 await expect(page.locator('#auto-aim-toggle')).toHaveText('Autocannon: Off');
 await page.locator('#auto-aim-toggle').click();await expect(page.locator('#auto-aim-toggle')).toHaveAttribute('aria-pressed','true');
 await page.locator('#start').click();await page.locator('#aim-priorities').click();
 await expect(page.getByRole('heading',{name:'Target Priority',exact:true})).toBeVisible();
 await expect(page.locator('.priority-list li')).toHaveCount(8);
 await page.getByRole('button',{name:'Move Powerups Up',exact:true}).click();
 await page.locator('[data-rule="weakest"]').click();
 const before=await readControlState(page);expect(before.aimPreferences.rules[3].id).toBe('pickups');
 await page.screenshot({path:'test-results/aim-priorities-desktop.png'});
 await page.keyboard.press('Escape');await expect(page.locator('#modal')).not.toBeVisible();
 await page.locator('#arena').hover();await page.mouse.down();expect((await readControlState(page)).firing).toBe(true);await page.mouse.up();
 await page.locator('#pause').click();await page.reload();await page.locator('#aim-priorities').click();
 const after=await readControlState(page);expect(after.aimPreferences).toEqual(before.aimPreferences);
 await page.locator('#close-priorities').click();await page.locator('#restore-run').click();await page.locator('#resume').click();
 await expect(page.locator('#auto-aim-toggle')).toHaveText('Autocannon: On');
});

test('mobile auto aim and new workshop row fit; perk choice survives reload',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});const page=await context.newPage();
 await page.goto('/?seed=73');await expect(page.locator('#start')).toBeEnabled();
 await expect(page.locator('#auto-aim-toggle')).toHaveText('Autocannon: On');
 await page.locator('#aim-priorities').click();await page.locator('[data-rule="strongest"]').scrollIntoViewIfNeeded();
 await expect(page.locator('#close-priorities')).toBeInViewport();await page.screenshot({path:'test-results/aim-priorities-mobile.png'});await page.locator('#close-priorities').click();
 const saved=await page.evaluate(async()=>{
  const {default:init,Game}=await import('/src/wasm/towerium.js');await init();const config=JSON.stringify(await(await fetch('/engine/balance.json')).json());
  const g=new Game(73,config);g.start_wave();const data=JSON.parse(g.save());g.free();
  // Valid cleared-wave state: report rendering and save validation remain real engine paths.
  Object.assign(data.world,{phase:2,wave:5,ticks:1800,wave_ticks:1800,time:30,total:0,remaining:0,spawned:0,coins:10000});
  data.world.enemies=[];data.world.shots=[];data.world.hostile=[];data.world.overcharge=[];data.world.deathwaves=[];data.world.deathwave_hits=[];
  data.world.perks.offers=[0,10,4];const valid=Game.restore(config,JSON.stringify(data));const state=valid.save();valid.free();return {seed:73,config,state};
 });
 await stageRunOnNextNavigation(page,saved,'perks-mobile-new');await page.reload();await page.locator('#restore-run').click();
 await expect(page.locator('[data-perk]')).toHaveCount(3);await expect(page.locator('#next-wave')).toBeDisabled();
 await expect(page.locator('#next-perk')).toHaveText('Perk Ready');
 await expect(page.locator('[data-perk] img')).toHaveCount(3);
 await expect.poll(()=>page.locator('[data-perk] img').evaluateAll(images=>images.every(i=>i.complete&&i.naturalWidth>0))).toBe(true);
 await page.setViewportSize({width:568,height:320});await page.locator('.perk-selection').scrollIntoViewIfNeeded();
 const compactCards=await page.locator('.perk-card').evaluateAll(cards=>{
  const footer=document.querySelector('.shop-footer').getBoundingClientRect();
  return cards.map(card=>{const b=card.getBoundingClientRect(),parts=[...card.querySelectorAll('strong,.perk-effect,small')].map(n=>n.getBoundingClientRect());return {inside:parts.every(r=>r.left>=b.left&&r.right<=b.right&&r.top>=b.top&&r.bottom<=b.bottom),visible:b.top>=0&&b.bottom<=innerHeight,aboveFooter:b.bottom<=footer.top};});
 });
 expect(compactCards).toHaveLength(3);expect(compactCards.every(card=>card.inside&&card.visible&&card.aboveFooter)).toBe(true);
 await expect(page.locator('#next-wave')).toBeInViewport();
 await page.screenshot({path:'test-results/perks-offer-landscape-568x320.png'});
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:'test-results/perks-mobile-before.png'});
 await page.locator('#open-shop').click();await expect(page.locator('[data-upgrade]')).toHaveCount(35);await expect(page.locator('#shop-aim-priorities')).toHaveText('Target Priority');await expect(page.locator('#shop-aim-priorities')).toHaveAttribute('aria-label','Target Priority');
 await page.locator('[data-upgrade="30"]').click();await page.locator('[data-upgrade="32"]').click();
 await expect(page.locator('[data-upgrade="30"]')).toContainText('11%');
 await page.screenshot({path:'test-results/auto-upgrades-mobile.png'});
 await page.locator('#wave-report').click();await page.locator('[data-perk="0"]').click();await expect(page.locator('#next-wave')).toBeEnabled();
 await page.screenshot({path:'test-results/perks-mobile-after.png'});await page.reload();await page.locator('#restore-run').click();
 await expect(page.locator('[data-perk]')).toHaveCount(0);await expect(page.locator('.perk-picked')).toContainText('Sharp Shots');await expect(page.locator('#next-wave')).toBeEnabled();
 await expect(page.locator('.owned-perk')).toHaveCount(1);await expect(page.locator('.owned-perk')).toContainText('Sharp Shots');await expect(page.locator('.perk-level')).toHaveText('1/5');
 await expect(page.locator('#next-perk')).toHaveText('Next Perk · W15');
 await context.close();
});


test('Auto Buy is manual when unchecked, holds accelerate, priorities persist and countdown can be cancelled',async({page})=>{
 await page.goto('/?seed=81');await expect(page.locator('#start')).toBeEnabled();
 const saved=await makeClearedWaveSave(page,81);
 const funded=await page.evaluate(async saved=>{
  const {Game}=await import('/src/wasm/towerium.js');const data=JSON.parse(saved.state);data.world.coins=10000;
  const g=Game.restore(saved.config,JSON.stringify(data));const state=g.save();g.free();return {...saved,state};
 },saved);
 await stageRunOnNextNavigation(page,funded,'automation-fixture');await page.reload();await page.locator('#restore-run').click();
 await expect(page.locator('#auto-buy-enabled')).not.toBeChecked();
 await page.locator('#open-shop').click();const initial=await readSnapshot(page);
 const stat=page.locator('[data-upgrade="0"]');await stat.hover();await page.mouse.down();await page.waitForTimeout(1300);await page.mouse.up();
 const heldLevels=(await readSnapshot(page)).levels[0];await stat.focus();await stat.press('Enter');
 expect((await readSnapshot(page)).levels[0]).toBe(heldLevels+1);expect(heldLevels).toBeGreaterThan(initial.levels[0]+1);
 await page.locator('#buy-priorities').click();await expect(page.locator('[data-auto-limit]')).toHaveCount(35);
 await page.locator('[data-auto-limit="0"]').fill('2');await page.locator('[data-auto-limit="0"]').dispatchEvent('change');
 await page.locator('#automation-perk-tab').click();await expect(page.locator('[data-auto-rule]')).toHaveCount(15);
 await page.locator('#automation-done').click();await expect(page.locator('#modal')).not.toHaveClass(/automation-modal/);
 await page.locator('#buy-now').click();const purchased=await readSnapshot(page);expect(purchased.coins).toBeLessThan(initial.coins);
 await page.waitForTimeout(5500);expect((await readSnapshot(page)).phase).toBe(2);
 await page.locator('#auto-buy-enabled').check();await expect(page.locator('#next-wave')).toContainText('s');
 await page.waitForTimeout(1500);await page.locator('#auto-buy-enabled').uncheck();await page.waitForTimeout(4500);expect((await readSnapshot(page)).phase).toBe(2);
 await page.reload();await page.locator('#restore-run').click();await page.locator('#buy-priorities').click();await expect(page.locator('[data-auto-limit="0"]')).toHaveValue('2');
 await page.locator('#automation-done').click();await page.locator('#auto-buy-enabled').check();
 await expect.poll(async()=> (await readSnapshot(page)).phase,{timeout:7000}).toBe(1);
});


test('background pixels retain original artwork color outside gameplay overlays',async({page})=>{
 await page.goto('/');await expect(page.locator('#start')).toBeEnabled();
 const result=await page.evaluate(async()=>{
  const {backgroundUrls}=await import('/src/assets.ts'),source=new Image();source.src=backgroundUrls[0];await source.decode();
  const actual=document.querySelector('#arena'),expected=document.createElement('canvas');expected.width=actual.width;expected.height=actual.height;
  const c=expected.getContext('2d'),scale=Math.max(expected.width/source.width,expected.height/source.height);c.drawImage(source,(expected.width-source.width*scale)/2,(expected.height-source.height*scale)/2,source.width*scale,source.height*scale);
  const observed=actual.getContext('2d'),samples=[];
  for(const [x,y] of [[.08,.08],[.92,.08],[.08,.92],[.92,.92]]){const px=Math.floor(x*actual.width),py=Math.floor(y*actual.height);samples.push([...observed.getImageData(px,py,1,1).data].slice(0,3).map((v,i)=>Math.abs(v-c.getImageData(px,py,1,1).data[i])));}
  return samples;
 });expect(Math.max(...result.flat())).toBeLessThanOrEqual(2);
});


test('normal Autocannon fires independently while manual shots keep their own weapon and aim',async({page})=>{
  await page.clock.install();await page.goto('/?seed=73');
  await expect(page.locator('#start')).toBeEnabled();
  const saved=await page.evaluate(async()=>{
    const {default:init,Game}=await import('/src/wasm/towerium.js');await init();
    const config=JSON.stringify(await(await fetch('/engine/balance.json')).json());
    const g=Game.autoplay_start(73,config,1);
    for(let i=0;i<40;i++)if(!g.buy(30))throw new Error('Opening efficiency budget rejected');
    g.start_wave();const state=g.save();g.free();return {seed:73,config,state};
  });
  await stageRunOnNextNavigation(page,saved,'concurrent-auto-cannon');await page.reload();
  await page.locator('#restore-run').click();await page.locator('#resume').click();
  await page.locator('#auto-aim-toggle').click();
  await expect(page.locator('#auto-aim-toggle')).toHaveText('Autocannon: On');
  await page.clock.runFor(6000);const before=await readSnapshot(page);
  expect(before.overall_report.shots_fired).toBeGreaterThan(0);expect(before.manual_shots_fired).toBe(0);
  const box=await page.locator('#arena').boundingBox();
  await page.mouse.move(box.x+box.width*.85,box.y+box.height*.85);await page.mouse.down();
  await page.clock.runFor(6000);const after=await readSnapshot(page);
  expect(after.manual_shots_fired).toBeGreaterThan(0);
  expect(after.overall_report.shots_fired-after.manual_shots_fired).toBeGreaterThan(before.overall_report.shots_fired);
  const controls=await readControlState(page);expect(controls.weapon).toBe(0);
  expect(Math.hypot(controls.autoAim[0]-controls.aim[0],controls.autoAim[1]-controls.aim[1])).toBeGreaterThan(20);await page.mouse.up();
  await page.locator('#pause').click();const paused=await readSnapshot(page);await page.clock.runFor(1000);
  expect((await readSnapshot(page)).overall_report.shots_fired).toBe(paused.overall_report.shots_fired);
});

 test('spectator manual decisions reserve a different target from the automatic cannon',async({page})=>{
  await page.goto('/?seed=42');await expect(page.locator('#start')).toBeEnabled();
  const decision=await page.evaluate(async()=>{
   const [{AutoPlayer},{default:init,Game}]=await Promise.all([import('/src/autoplay.ts'),import('/src/wasm/towerium.js')]);
   await init();const config=JSON.stringify(await(await fetch('/engine/balance.json')).json());
   const game=new Game(42,config);game.start_wave();const s=JSON.parse(game.snapshot());game.free();
   s.enemies=[[1,3,220,0,3,3,0],[2,0,-120,0,2,2,0]];
   const bot=new AutoPlayer('balanced','crowd','all',{reactionMs:180,aimSpeed:2400,switchMs:160});
   const action=bot.update(s,1/60);return {automatic:action.autoTargetId,manual:bot.manualTarget};
  });
  expect(decision.automatic).toBe(2);expect(decision.manual).toBe('enemy_1');
 });

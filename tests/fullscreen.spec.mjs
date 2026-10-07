import { test, expect } from '@playwright/test';

test('fullscreen fallback preserves touch controls across orientation', async ({ browser }) => {
  const context = await browser.newContext({ viewport:{width:320,height:568}, hasTouch:true, isMobile:true });
  const page = await context.newPage();
  await page.addInitScript(() => Object.defineProperty(document, 'fullscreenEnabled', {get:()=>false}));
  await page.goto('http://127.0.0.1:5184/');
  await expect(page.locator('#start')).toBeEnabled();
  await page.locator('[data-fullscreen]').click();
  await expect(page.locator('html')).toHaveClass(/viewport-play/);
  await expect(page.locator('#start')).toBeInViewport();
  await page.locator('#start').click();
  await expect(page.locator('#touch-fire')).toBeInViewport();
  await expect(page.locator('#aim-pad')).toBeInViewport();
  await page.setViewportSize({width:568,height:320});
  await expect(page.locator('#touch-fire')).toBeInViewport();
  await expect(page.locator('#aim-pad')).toBeInViewport();
  await expect(page.locator('#pause')).toBeInViewport();
  await page.locator('[data-fullscreen]').click();
  await expect(page.locator('html')).not.toHaveClass(/viewport-play/);
  await context.close();
});

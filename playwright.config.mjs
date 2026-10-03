import { defineConfig } from '@playwright/test';
const baseURL=process.env.TOWERIUM_URL || 'http://127.0.0.1:5184';
export default defineConfig({
  testDir: './tests', timeout: 60000, fullyParallel:false, workers:1,
  use: {baseURL,channel:process.platform==='win32'?'chrome':undefined,viewport:{width:1440,height:1080},screenshot:'only-on-failure',trace:'retain-on-failure'},
  reporter:'list',
  webServer:{command:'npm run dev',url:baseURL,reuseExistingServer:true,timeout:30000},
});

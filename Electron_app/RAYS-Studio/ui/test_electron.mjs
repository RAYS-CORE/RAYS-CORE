import { _electron as electron } from 'playwright';
import path from 'path';

(async () => {
  const electronApp = await electron.launch({
    executablePath: 'C:\\Users\\shaur\\OneDrive\\Desktop\\rays_v2_fresh_clone\\repo\\Electron_app\\RAYS-Studio\\desktop\\release\\win-unpacked\\RAYS Studio.exe'
  });

  const window = await electronApp.firstWindow();
  
  window.on('console', msg => console.log('BROWSER_LOG:', msg.text()));
  window.on('pageerror', error => console.log('PAGE_ERROR:', error));

  await window.waitForLoadState('networkidle');

  // Find the RaySpy link and click it
  console.log("Looking for Rayspy link...");
  const rayspyLink = window.locator('a:has-text("Rayspy")');
  await rayspyLink.click();
  
  console.log("Clicked Rayspy link, waiting for iframe...");
  await window.waitForTimeout(3000);

  const frames = window.frames();
  for (const frame of frames) {
    if (frame.url().includes('5176')) {
      console.log("Found RaySpy iframe:", frame.url());
      const iframeTitle = await frame.title();
      console.log("Iframe title:", iframeTitle);
    }
  }

  await electronApp.close();
})();

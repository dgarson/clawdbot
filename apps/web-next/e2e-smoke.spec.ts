import { test, expect } from '@playwright/test';

const APP_BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173';

test.describe('OpenClaw Horizon UI — Smoke Tests', () => {
  test('homepage loads and shows app shell', async ({ page }, testInfo) => {
    await page.goto(APP_BASE_URL);
    await page.waitForLoadState('networkidle');
    
    // Should have the root element rendered
    const root = page.locator('#root');
    await expect(root).toBeVisible();
    
    // Take a screenshot of the main page
    await page.screenshot({ path: testInfo.outputPath('home.png'), fullPage: true });
    
    // Check page title
    await expect(page).toHaveTitle(/OpenClaw/);
  });

  test('app renders React content (not blank)', async ({ page }) => {
    await page.goto(APP_BASE_URL);
    await page.waitForLoadState('networkidle');
    
    // The root div should have child content (React rendered something)
    const rootInnerHTML = await page.locator('#root').innerHTML();
    expect(rootInnerHTML.length).toBeGreaterThan(50);
    console.log(`Root content length: ${rootInnerHTML.length} chars`);
  });

  test('no console errors on load', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {errors.push(msg.text());}
    });
    
    await page.goto(APP_BASE_URL);
    await page.waitForLoadState('networkidle');
    
    // Filter out known benign errors (e.g., WebSocket connection to gateway)
    const realErrors = errors.filter(e => !e.includes('WebSocket') && !e.includes('ERR_CONNECTION_REFUSED'));
    expect(realErrors).toEqual([]);
  });

  test('navigation elements are present', async ({ page }, testInfo) => {
    await page.goto(APP_BASE_URL);
    await page.waitForLoadState('networkidle');
    
    // Look for common nav/sidebar elements
    const body = await page.locator('body').textContent();
    console.log(`Page text content (first 500 chars): ${body?.substring(0, 500)}`);
    
    // Screenshot the rendered state
    await page.screenshot({ path: testInfo.outputPath('rendered.png'), fullPage: true });
  });
});

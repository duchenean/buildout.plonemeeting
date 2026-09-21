const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8091/Plone';
const OUT = process.env.OUT || __dirname;
const problems = [];
function track(page) {
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) problems.push(`${m.type()}: ${m.text().slice(0, 300)}`); });
  page.on('pageerror', e => problems.push(`pageerror: ${e.message.slice(0, 300)}`));
  page.on('requestfailed', r => problems.push(`requestfailed: ${r.url()} ${r.failure() && r.failure().errorText}`));
  page.on('response', r => { if (r.status() >= 400) problems.push(`http ${r.status()}: ${r.url()}`); });
}
async function start() {
  let browser;
  try { browser = await chromium.launch({ headless: true }); }
  catch (e) { browser = await chromium.launch({ headless: true, channel: 'chrome' }); }
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  track(page);
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="__ac_name"]', process.env.PM_USER || 'admin');
  await page.fill('input[name="__ac_password"]', process.env.PM_PASS || 'admin');
  await page.click('button[name="buttons.login"]');
  await page.waitForLoadState('networkidle');
  problems.length = 0;
  return { browser, page };
}
function drain(label) {
  const p = problems.filter(x => !x.includes('rel=preload'));
  console.log(`[${label}] problems (${p.length}):`, p.length ? JSON.stringify(p, null, 1) : 'none');
  problems.length = 0;
}
async function shot(page, name) { await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: !!process.env.FULL }); }
module.exports = { BASE, OUT, start, drain, shot, problems };

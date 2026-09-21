const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8091/Plone';
const OUT = process.env.OUT || '.';
const problems = [];
const track = (page) => {
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) problems.push(`${m.type()}: ${m.text().slice(0, 300)}`); });
  page.on('pageerror', e => problems.push(`pageerror: ${e.message.slice(0, 300)}`));
  page.on('requestfailed', r => problems.push(`requestfailed: ${r.url()} ${r.failure() && r.failure().errorText}`));
  page.on('response', r => { if (r.status() >= 400) problems.push(`http ${r.status()}: ${r.url()}`); });
};
const globals = () => ({
  Faceted: typeof Faceted,
  widgets: (typeof Faceted !== 'undefined' && Faceted.Widgets) ? Object.keys(Faceted.Widgets) : null,
  qq: typeof qq, PloneQuickUpload: typeof PloneQuickUpload, imio_modal: typeof imio_modal,
  initializeOverlays: typeof initializeOverlays, select2: typeof (window.jQuery && jQuery.fn.select2),
  tinymce: typeof tinymce, tableDnD: typeof (window.jQuery && jQuery.fn.tableDnD),
  facetedWidgetsInDom: document.querySelectorAll('.faceted-widget').length,
  collectionWidgetInDom: document.querySelectorAll('div.faceted-tagscloud-collection-widget').length,
  scripts: [...document.querySelectorAll('script[src]')].map(s => s.src.replace(/^.*\/Plone\//, '').replace(/\?.*$/, '')),
});
(async () => {
  let browser;
  try { browser = await chromium.launch({ headless: true }); }
  catch (e) { console.error('bundled chromium unavailable, using system chrome:', e.message.split('\n')[0]); browser = await chromium.launch({ headless: true, channel: 'chrome' }); }
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  track(page);
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="__ac_name"]', 'admin');
  await page.fill('input[name="__ac_password"]', 'admin');
  await page.click('button[name="buttons.login"]');
  await page.waitForLoadState('networkidle');
  const links = await page.$$eval('a[href*="/mymeetings/"]', as => [...new Set(as.map(a => a.href))]);
  console.log('mymeetings links:', links.slice(0, 5));
  if (!links.length) { await page.screenshot({ path: `${OUT}/home.png` }); throw new Error('no mymeetings link after login'); }
  problems.length = 0;
  await page.goto(links[0]);
  await page.waitForLoadState('networkidle');
  console.log('dashboard url:', page.url());
  await page.waitForTimeout(1500);
  const g = await page.evaluate(globals);
  console.log('globals:', JSON.stringify(g, null, 1));
  await page.screenshot({ path: `${OUT}/dashboard.png`, fullPage: false });
  const itemLinks = await page.$$eval('table.faceted-table-results a.pretty_link, .faceted-table-results td a[href*="/mymeetings/"]', as => [...new Set(as.map(a => a.href))]);
  console.log('item links:', itemLinks.length, itemLinks.slice(0, 2));
  console.log('dashboard problems:', JSON.stringify(problems, null, 1));
  await browser.close();
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });

const { BASE, start, drain, shot } = require('./lib');
(async () => {
  const { browser, page } = await start();
  await page.goto(`${BASE}/Members/admin/mymeetings/plonemeeting-assembly/searches_items`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  const info = await page.evaluate(() => {
    const box = s => { const el = document.querySelector(s); if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
    return { results: box('.faceted-table-results'), form: box('.faceted-form'), content: box('#content'), main: box('main, #main-container'), leftcol: box('.faceted-tagscloud-collection-widget'), rows: document.querySelectorAll('.faceted-table-results tbody tr').length, bodyH: document.body.scrollHeight };
  });
  console.log(JSON.stringify(info));
  process.env.FULL = '1';
  await shot(page, 'dashboard_full');
  drain('dashboard');
  await browser.close();
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });

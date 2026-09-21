const { BASE, start, drain, shot } = require('./lib');
const dump = (label) => async (page) => {
  const d = await page.evaluate(() => ({
    body: document.body.className.slice(0, 120),
    modals: [...document.querySelectorAll('[class*="modal"]')].map(e => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return `${e.tagName}.${e.className.toString().slice(0, 60)} box=${Math.round(r.width)}x${Math.round(r.height)} display=${cs.display} vis=${cs.visibility} op=${cs.opacity}`; }).slice(0, 12),
  }));
  console.log(`[${label}]`, JSON.stringify(d, null, 1));
};
(async () => {
  const { browser, page } = await start();
  const item = `${BASE}/Members/admin/mymeetings/plonemeeting-assembly/copy_of_recItem2`;
  await page.goto(item); await page.waitForLoadState('networkidle');
  // which inline script fails to parse?
  const bad = await page.evaluate(() => [...document.scripts].filter(s => !s.src && s.type !== 'application/json' && s.type !== 'text/template').map(s => { try { new Function(s.textContent); return null; } catch (e) { return { err: e.message, start: s.textContent.trim().slice(0, 200), type: s.type }; } }).filter(Boolean));
  console.log('inline script parse failures:', JSON.stringify(bad, null, 1));
  drain('item');
  await page.goto(`${item}/@@categorized-annexes`); await page.waitForLoadState('networkidle');
  await page.click('a.link-overlay-pm-annex[href$="++add++annex"]');
  await page.waitForTimeout(3000);
  await dump('after add_annex click')(page);
  await shot(page, 'add_annex_debug');
  drain('add_annex');
  await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  const dash = `${BASE}/Members/admin/mymeetings/plonemeeting-assembly/searches_items`;
  await page.goto(dash); await page.waitForLoadState('networkidle'); await page.waitForTimeout(1500);
  const cb = await page.$('.faceted-table-results tbody input[type=checkbox]'); if (cb) await cb.check();
  await page.click('#transition-batch-action-but');
  await page.waitForTimeout(3000);
  await dump('after batch click')(page);
  await shot(page, 'batch_debug');
  drain('batch');
  await browser.close();
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });

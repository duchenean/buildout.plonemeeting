const { BASE, start, drain, shot } = require('./lib');
const MODAL = '.modal-wrapper .modal.show';
const net = [];
async function openModal(page, selector, label) {
  const el = await page.$(selector);
  if (!el) { console.log(`[${label}] trigger not found: ${selector}`); return false; }
  net.length = 0;
  await el.scrollIntoViewIfNeeded();
  await el.click();
  try { await page.waitForSelector(MODAL, { state: 'visible', timeout: 15000 }); }
  catch (e) { console.log(`[${label}] modal did not open; network:`, JSON.stringify(net.slice(0, 8), null, 1)); await shot(page, `${label}_noopen`); drain(label); return false; }
  await page.waitForTimeout(1200);
  const info = await page.evaluate((MODAL) => {
    const m = document.querySelector(MODAL); const q = s => m.querySelectorAll(s).length;
    return { title: (m.querySelector('.plone-modal-title, h1, h2') || {}).textContent?.trim().slice(0, 80), forms: q('form'), textareas: q('textarea'), selects: q('select'),
      uploader: q('.qq-uploader, .qq-upload-button'), uploadButtons: q('.uploadifybuttons input'),
      buttons: [...m.querySelectorAll('button, input[type=submit], input[type=button]')].map(b => (b.value || b.textContent || '').trim().slice(0, 30)).filter(Boolean).slice(0, 10),
      textStart: m.innerText.replace(/\s+/g, ' ').slice(0, 140) };
  }, MODAL);
  console.log(`[${label}] modal open:`, JSON.stringify(info));
  await shot(page, `${label}_modal`);
  return true;
}
async function closeModal(page, label) {
  for (const sel of ['.modal input[name$="buttons.cancel"]', '.modal button[name$="buttons.cancel"]', '.modal .pattern-modal-buttons input[value*="Annuler"]', '.modal .btn-close.modal-close']) {
    const b = await page.$(sel); if (b && await b.isVisible()) { await b.click(); console.log(`[${label}] closed via ${sel}`); break; }
  }
  try { await page.waitForSelector(MODAL, { state: 'hidden', timeout: 8000 }); console.log(`[${label}] modal closed`); }
  catch (e) { console.log(`[${label}] modal still visible; Escape`); await page.keyboard.press('Escape'); await page.waitForTimeout(800); }
  await page.waitForLoadState('networkidle'); drain(label);
}
(async () => {
  const { browser, page } = await start();
  page.on('response', async r => { const t = r.request().resourceType(); if (['xhr', 'fetch', 'script', 'document'].includes(t)) net.push(`${t} ${r.status()} ${r.headers()['content-type'] || ''} ${r.url().replace(BASE, '')}`.slice(0, 200)); });
  page.on('pageerror', e => net.push('pageerror: ' + (e.stack || e.message).split('\n').slice(0, 3).join(' | ').slice(0, 300)));
  const dash = `${BASE}/Members/admin/mymeetings/plonemeeting-assembly/searches_items`;
  const item = `${BASE}/Members/admin/mymeetings/plonemeeting-assembly/copy_of_recItem2`;
  // item view: which script parse fails?
  net.length = 0;
  await page.goto(item); await page.waitForLoadState('networkidle'); await page.waitForTimeout(1000);
  console.log('item view net (non-200 or errors):', JSON.stringify(net.filter(n => !/ 200 /.test(n) || n.startsWith('pageerror')), null, 1));
  drain('item view');
  if (await openModal(page, '.contentHistory a', 'history')) await closeModal(page, 'history');
  // annexes page
  await page.goto(`${item}/@@categorized-annexes`); await page.waitForLoadState('networkidle'); await page.waitForTimeout(800);
  const annexLinks = await page.$$eval('a.link-overlay-pm-annex', as => as.map(a => a.getAttribute('href')));
  console.log('annex links:', annexLinks);
  drain('annexes page');
  if (await openModal(page, 'a.link-overlay-pm-annex[href*="quick_upload?typeupload=annex"]', 'quick_upload')) await closeModal(page, 'quick_upload');
  if (await openModal(page, 'a.link-overlay-pm-annex[href$="++add++annex"]', 'add_annex')) await closeModal(page, 'add_annex');
  // dashboard batch transition
  await page.goto(dash); await page.waitForLoadState('networkidle'); await page.waitForTimeout(1500);
  const cb = await page.$('.faceted-table-results tbody input[type=checkbox]'); if (cb) await cb.check();
  if (await openModal(page, '#transition-batch-action-but', 'batch_transition')) await closeModal(page, 'batch_transition');
  await browser.close();
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });

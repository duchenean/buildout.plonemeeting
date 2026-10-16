const { BASE, start, drain, shot } = require('./lib');
const MODAL = '.modal-wrapper .modal.show';
(async () => {
  const { browser, page } = await start();
  const item = `${BASE}/Members/admin/mymeetings/plonemeeting-assembly/copy_of_recItem2`;
  await page.goto(`${item}/@@categorized-annexes`); await page.waitForLoadState('networkidle');
  const before = await page.$$eval('.categorized-childs a.pretty_link, table.categorized-childs-table tr, .annexes .pretty_link', els => els.length);
  console.log('annex elements before:', before);
  await page.click('a.link-overlay-pm-annex[href*="@@quick_upload"]');
  await page.waitForSelector(MODAL, { state: 'visible', timeout: 15000 });
  await page.waitForTimeout(800);
  const fileInput = await page.$(`${MODAL} input[type=file]`);
  if (!fileInput) { console.log('no file input in modal'); await shot(page, 'upload_nofileinput'); await browser.close(); return; }
  await fileInput.setInputFiles(`${__dirname}/qu_test.txt`);
  await page.waitForTimeout(2500);
  const row = await page.evaluate((MODAL) => {
    const m = document.querySelector(MODAL);
    return { items: m.querySelectorAll('.qq-upload-list li').length,
      titleInputs: m.querySelectorAll('input[name="form.widgets.title"]').length,
      categorySelects: [...m.querySelectorAll('select[name="form.widgets.content_category:list"]')].map(s => ({ value: s.value, options: s.options.length })),
      uploadBtnVisible: !!(m.querySelector('#uploadify-upload') && m.querySelector('#uploadify-upload').offsetParent),
      text: m.innerText.replace(/\s+/g, ' ').slice(0, 200) };
  }, MODAL);
  console.log('after file selection:', JSON.stringify(row));
  await shot(page, 'upload_selected');
  drain('selection');
  if (row.titleInputs) { await page.fill(`${MODAL} input[name="form.widgets.title"]`, 'Quick upload test annex'); }
  await page.click(`${MODAL} #uploadify-upload`);
  try { await page.waitForSelector(`${MODAL} .qq-upload-success, ${MODAL} .qq-upload-fail`, { timeout: 30000 }); } catch (e) { console.log('no success/fail marker within 30s'); }
  await page.waitForTimeout(1500);
  const result = await page.evaluate((MODAL) => { const m = document.querySelector(MODAL); return m ? { success: m.querySelectorAll('.qq-upload-success').length, fail: m.querySelectorAll('.qq-upload-fail').length, text: m.innerText.replace(/\s+/g, ' ').slice(0, 300) } : { modal: 'gone', url: location.href }; }, MODAL);
  console.log('upload result:', JSON.stringify(result));
  await shot(page, 'upload_done');
  drain('upload');
  await page.goto(`${item}/@@categorized-annexes`); await page.waitForLoadState('networkidle');
  const after = await page.evaluate(() => document.body.innerText.includes('Quick upload test annex') || document.body.innerText.includes('qu_test'));
  console.log('annex visible on annexes page after upload:', after);
  await shot(page, 'annexes_after');
  drain('annexes after');
  await browser.close();
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });

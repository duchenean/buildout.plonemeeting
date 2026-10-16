const { BASE, start } = require('./lib');
(async () => {
  const { browser, page } = await start();
  await page.addInitScript(() => { window.__errs = []; window.addEventListener('error', e => window.__errs.push({ msg: e.message, file: e.filename, line: e.lineno, col: e.colno }), true); });
  const item = `${BASE}/Members/admin/mymeetings/plonemeeting-assembly/copy_of_recItem2`;
  await page.goto(item); await page.waitForLoadState('networkidle'); await page.waitForTimeout(1000);
  const errs = await page.evaluate(() => window.__errs);
  console.log('errors:', JSON.stringify(errs));
  const html = await page.content();
  const lines = html.split('\n');
  for (const e of errs) if (e.file === page.url() || e.file.startsWith(BASE)) {
    if (e.file === page.url()) { console.log(`--- ${e.file} line ${e.line}:`); console.log(lines.slice(Math.max(0, e.line - 4), e.line + 2).join('\n').slice(0, 1200)); }
    else { const r = await page.request.get(e.file); const t = (await r.text()).split('\n'); console.log(`--- ${e.file} (${r.status()} ${r.headers()['content-type']}) line ${e.line}:`); console.log(t.slice(Math.max(0, e.line - 3), e.line + 1).join('\n').slice(0, 600)); }
  }
  await browser.close();
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });

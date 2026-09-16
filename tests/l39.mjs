import './_exit.mjs';
import { chromium } from 'playwright';
const SP = new URL('shots/', import.meta.url).pathname;
const fail = [];
const ok = (c, m, x = '') => { console.log((c ? 'PASS ' : 'FAIL ') + m + (x ? ' — ' + x : '')); if (!c) fail.push(m); };
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await b.newPage({ viewport: { width: 400, height: 840 } });
const errs = [];
page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && errs.push(m.text()));
page.on('pageerror', (e) => errs.push(String(e)));
const btn = (re) => page.getByRole('button', { name: re }).first();
const dlg = () => page.getByRole('dialog').last();

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.getByLabel('שם משתמש').fill('admin');
await page.getByLabel('סיסמה').fill('admin2026');
await btn('כניסה').click(); await page.waitForTimeout(1600);
await btn(/לקוח ראשון|לקוח חדש|הוספת לקוח/).click(); await page.waitForTimeout(500);
await dlg().getByLabel('שם').first().fill('חומרים');
await dlg().getByLabel(/עיר/).fill('לוד');
await dlg().getByRole('button', { name: /שמירה|הוספה/ }).click(); await page.waitForTimeout(900);
await btn(/חומרים/).click(); await page.waitForTimeout(700);
await btn(/פרויקט ראשון|פרויקט חדש|הוספת פרויקט/).click(); await page.waitForTimeout(500);
await dlg().getByRole('button', { name: /^מטבח/ }).click(); await page.waitForTimeout(800);
await btn(/קיר יחיד/).click(); await page.waitForTimeout(700);
await btn(/קיר נקי/).click(); await page.waitForTimeout(700);
await dlg().getByRole('button', { name: /יצירת הפרויקט/ }).click(); await page.waitForTimeout(1800);

/* הגוונים נבחרים אחרי היצירה — "גוון לכולם" בסרגל ההדמיה */
await btn(/גוון לכולם/).click(); await page.waitForTimeout(900);
const white = dlg().getByRole('button', { name: 'לבן' });
for (let i = 0; i < 4; i++) { await white.nth(i).click(); await page.waitForTimeout(250); }
await page.screenshot({ path: SP + '/L39-0-finishes.png' });

/* מה נבחר בפועל — הצ'יפ החומר הפעיל בכל מקטע */
const picked = await dlg().locator('section').evaluateAll((secs) =>
  secs.map((s) => {
    const h = s.querySelector('h3')?.textContent ?? '';
    const on = [...s.querySelectorAll('button')].filter((b) => /bg-stone-900/.test(b.className));
    return [h, on.map((b) => b.textContent.trim())];
  }));
console.log('picked:', JSON.stringify(picked));
const of = (name) => (picked.find((p) => p[0] === name)?.[1] ?? []).join('|');
ok(of('גוף').includes('סנדוויץ'), 'גוף ← סנדוויץ׳', of('גוף'));
ok(of('חזיתות').includes('MDF'), 'חזיתות ← MDF', of('חזיתות'));
ok(of('דפנות זרות').includes('MDF'), 'דפנות זרות ← MDF', of('דפנות זרות'));
ok(of('גב').includes('דיקט') || of('גב').includes('סנדוויץ'), 'גב ← דיקט', of('גב'));

while (await page.getByRole('dialog').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(250); }
await page.waitForTimeout(500);
const defs = await page.evaluate(async () => {
  const db = await new Promise((res, rej) => { const r = indexedDB.open('easycraft'); r.onsuccess = () => res(r.result); r.onerror = rej; });
  const [p, mats] = await Promise.all([
    new Promise((res) => { const t = db.transaction('projects').objectStore('projects').getAll(); t.onsuccess = () => res(t.result[0]); }),
    new Promise((res) => { const t = db.transaction('materials').objectStore('materials').getAll(); t.onsuccess = () => res(t.result); }),
  ]);
  const name = (id) => mats.find((m) => m.id === id)?.name;
  return Object.fromEntries(Object.entries(p.defaults ?? {}).map(([k, v]) => [k, name(v.materialId)]));
});
console.log('saved defaults:', JSON.stringify(defs));
ok(/סנדוויץ/.test(defs.carcass ?? ''), 'נשמר: גוף סנדוויץ׳', defs.carcass);
ok(/^MDF/.test(defs.front ?? '') && /^MDF/.test(defs.exposed ?? ''), 'נשמר: חזיתות ודפנות MDF', `${defs.front}/${defs.exposed}`);
ok(/דיקט/.test(defs.back ?? ''), 'נשמר: גב דיקט', defs.back);

console.log('errors:', errs.length, errs.slice(0, 4));
await b.close();
console.log(fail.length ? 'FAILURES: ' + fail.join(' | ') : 'ALL PASS');

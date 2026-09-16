import { chromium } from 'playwright';
import { setup, addNamed } from './mk.mjs';
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
const table = (name) => page.evaluate(async (n) => {
  const db = await new Promise((res, rej) => { const r = indexedDB.open('easycraft'); r.onsuccess = () => res(r.result); r.onerror = rej; });
  return await new Promise((res) => {
    const tx = db.transaction(n).objectStore(n).getAll();
    tx.onsuccess = () => res(tx.result);
  });
}, name);

await setup(page, { name: 'מלאי אוטומטי' });
await addNamed(page, /^ארגז שתי דלתות/);
await btn('סיום עריכה').click(); await page.waitForTimeout(400);
await btn(/^חישוב/).click(); await page.waitForTimeout(1600);
await dlg().getByRole('button', { name: /מכירה והתחלת עבודה/ }).click(); await page.waitForTimeout(900);
await dlg().getByRole('button', { name: /סימון כנמכר/ }).click(); await page.waitForTimeout(1300);
while (await page.getByRole('dialog').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(250); }

/* נותנים מלאי התחלתי */
await page.evaluate(async () => {
  const db = await new Promise((res, rej) => { const r = indexedDB.open('easycraft'); r.onsuccess = () => res(r.result); r.onerror = rej; });
  const fins = await new Promise((res) => { const t = db.transaction('finishes').objectStore('finishes').getAll(); t.onsuccess = () => res(t.result); });
  const mats = await new Promise((res) => { const t = db.transaction('materials').objectStore('materials').getAll(); t.onsuccess = () => res(t.result); });
  const now = Date.now();
  const st = db.transaction('stock', 'readwrite').objectStore('stock');
  /* שורה חדשה שייכת לאותה נגרייה כמו מה שכבר יש, אחרת המאגר לא רואה אותה */
  const workshopId = fins[0].workshopId;
  for (const f of fins) for (const m of mats)
    st.put({
      id: `${f.id}-${m.id}`, finishId: f.id, materialId: m.id, sheets: 20, ordered: 0,
      workshopId, rev: 1, createdAt: now, updatedAt: now,
    });
});
const before = (await table('stock')).map((s) => s.sheets);
console.log('stock before:', JSON.stringify(before));

/* סימון מהיר: כל הגופים נחתכו */
await btn(/^תכנון$/).click(); await page.waitForTimeout(700);
await btn(/סימון מהיר/).click(); await page.waitForTimeout(800);
await page.screenshot({ path: SP + '/L35-0-bulk.png' });

/* מסמנים את כל המסלולים עד "נחתך" */
const markAll = async (stage, tracks = ['גוף', 'גב', 'חזיתות']) => {
  for (const track of tracks) {
    const row = dlg().getByRole('button', { name: new RegExp(`${track} — ${stage}`) });
    if (await row.count()) { await row.first().click(); await page.waitForTimeout(700); }
    if (!(await page.getByRole('dialog').count())) {
      await btn(/סימון מהיר/).click(); await page.waitForTimeout(700);
    }
  }
};
/* קודם רק הגוף — שורה שלא כולה נחתכה לא מפחיתה כלום */
await markAll('מוכן לחיתוך', ['גוף']);
await markAll('נחתך', ['גוף']);
while (await page.getByRole('dialog').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(250); }
await page.waitForTimeout(700);
/*
  לכל חלק חומר משלו — גוף מסנדוויץ׳, חזיתות מ-MDF, גב מדיקט — ולכן
  כל אחד הוא שורת לוחות נפרדת. סימון הגופים לבדם משלים בדיוק שורה
  אחת, וזו בדיוק ההתנהגות שנדרשה: כל הגופים נחתכו, הלוחות ירדו.
*/
const afterBody = await table('consumption');
ok(afterBody.length === 1, 'סימון הגופים לבדם מפחית את שורת הגוף בלבד', `${afterBody.length} שורות`);
const dropBody = before.reduce((a, n) => a + n, 0)
  - (await table('stock')).reduce((a, s) => a + s.sheets, 0);
ok(dropBody === afterBody[0].sheets, 'המלאי ירד בדיוק בשורה שהושלמה', String(dropBody));

await btn(/סימון מהיר/).click(); await page.waitForTimeout(700);
await markAll('מוכן לחיתוך');
await markAll('נחתך');
while (await page.getByRole('dialog').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(250); }
await page.waitForTimeout(900);

console.log('work:', JSON.stringify((await table('units')).map((u) => u.work)));
const after = (await table('stock')).map((s) => s.sheets);
const cons = await table('consumption');
console.log('stock after:', JSON.stringify(after));
console.log('consumption:', JSON.stringify(cons.map((c) => [c.lineKey, c.sheets])));
ok(cons.length === 3, 'נרשמה צריכה לכל שורת גוון+חומר', `${cons.length} שורות`);
const dropped = before.reduce((a, n) => a + n, 0) - after.reduce((a, n) => a + n, 0);
const consumed = cons.reduce((a, c) => a + c.sheets, 0);
ok(dropped === consumed && dropped > 0, 'המלאי ירד בדיוק בכמות שנרשמה', `ירד ${dropped}, נרשם ${consumed}`);

/* ביטול הסימון מחזיר את הפלטות */
await page.locator('svg g[data-unit-id]').first().click(); await page.waitForTimeout(800);
await dlg().getByRole('button', { name: /^נחתך$/ }).first().click(); await page.waitForTimeout(900);
while (await page.getByRole('dialog').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(250); }
await page.waitForTimeout(800);
const back = (await table('stock')).map((s) => s.sheets);
const cons2 = await table('consumption');
console.log('stock back:', JSON.stringify(back), 'consumption:', cons2.length);
/* בוטל סימון החיתוך של הגוף בלבד — רק שורת הגוף חוזרת */
ok(cons2.length === cons.length - 1, 'ביטול סימון מוחק את שורת הצריכה שלו', `${cons2.length} נשארו`);
const backTotal = back.reduce((a, n) => a + n, 0);
const consTotal = cons2.reduce((a, c) => a + c.sheets, 0);
ok(backTotal === before.reduce((a, n) => a + n, 0) - consTotal,
  'הפלטות שבוטלו חזרו למלאי', `${backTotal} מול ${consTotal} שנצרכו`);

/* מסמנים שוב, ובודקים שמסך המלאי מספר מה נחתך */
await btn(/סימון מהיר/).click(); await page.waitForTimeout(700);
await markAll('נחתך');
while (await page.getByRole('dialog').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(250); }
await page.waitForTimeout(800);
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(1600);
await btn(/מלאי/).click(); await page.waitForTimeout(1500);
await page.screenshot({ path: SP + '/L35-1-stock.png' });
const stockTxt = await page.innerText('main');
ok(/נחתך\s*1/.test(stockTxt), 'מסך המלאי מציג מה נחתך', stockTxt.split('\n').find((l) => l.includes('נחתך')) ?? '');
console.log('errors:', errs.length, errs.slice(0, 4));
await b.close();
console.log(fail.length ? 'FAILURES: ' + fail.join(' | ') : 'ALL PASS');

import './_exit.mjs';
/*
 * שכבה 120 — האינטראקציה עצמה.
 *
 * B09 — במצב ייצור נגיעה בארגז בתלת־ממד פותחת את לוח העבודה שלו,
 *       והצבע אומר מה נעשה בו — כמו בחזית.
 * B10 — כפתורי התלת־ממד נגישים במקלדת, ולא לאצבע בלבד.
 * E08 — גרירה אינה כותבת לבסיס הנתונים בכל תזוזה, אלא פעם אחת
 *       בסופה. זו הסיבה שעשרים ארגזים על הקיר האטו את התנועה.
 */
import { chromium } from 'playwright';
import { setup, addNamed } from './mk.mjs';

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + String(e).slice(0, 200)));
const out = [];
const ok = (name, cond, extra = '') => {
  const line = `${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' | ' + extra : ''}`;
  out.push(line);
  console.log(line);
};
const btn = (re) => page.getByRole('button', { name: re }).first();

const rows = () =>
  page.evaluate(async () => {
    const req = indexedDB.open('easycraft');
    const dbh = await new Promise((res) => (req.onsuccess = () => res(req.result)));
    const tx = dbh.transaction('units', 'readonly');
    const all = await new Promise((res) => {
      const g = tx.objectStore('units').getAll();
      g.onsuccess = () => res(g.result);
    });
    dbh.close();
    return all.map((u) => ({ id: u.id, x: u.xMm, y: u.yMm, rot: u.rotationDeg ?? 0 }));
  });

await setup(page, { name: 'תנועה בע״מ' });
await addNamed(page, /^ארגז/);
await page.waitForTimeout(700);
await btn(/סיום עריכה/).click().catch(() => {});
await page.waitForTimeout(500);

/* ------------------------------------------------------------------ */
/* E08 — מה נכתב, ומתי                                                 */
/* ------------------------------------------------------------------ */

const before = await rows();
const rect = page.locator('[data-unit-id]').first();
const box = await rect.boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
for (let i = 1; i <= 10; i++) {
  await page.mouse.move(box.x + box.width / 2 + i * 12, box.y + box.height / 2, { steps: 1 });
  await page.waitForTimeout(25);
}
const during = await rows();
/* הציור כבר זז — התצוגה המקדימה היא מה שרואים */
const movedOnScreen = (await rect.boundingBox()).x !== box.x;
await page.mouse.up();
await page.waitForTimeout(800);
const after = await rows();

ok('the drag moved the cabinet on screen', movedOnScreen);
ok('while nothing was written mid-drag', during[0].x === before[0].x, `${before[0].x} → ${during[0].x}`);
ok('and the release wrote it once', after[0].x !== before[0].x, `${before[0].x} → ${after[0].x}`);

/* ------------------------------------------------------------------ */
/* B10 — מקלדת                                                         */
/* ------------------------------------------------------------------ */

await btn(/^תלת־ממד/).click();
await page.waitForTimeout(1300);
await page.locator('[data-unit]').first().click({ force: true });
await page.waitForTimeout(900);

const spin = page.getByRole('button', { name: 'סיבוב ימינה' }).first();
ok('the rotate control is on the picture', (await spin.count()) > 0);
const reachable = await spin.evaluate((el) => el.tabIndex);
ok('and it can be reached by keyboard', reachable === 0, String(reachable));

const ring = page.getByRole('button', { name: 'עריכה מהירה' }).first();
ok('so can the quick edit button', (await ring.evaluate((el) => el.tabIndex)) === 0);

const rotBefore = (await rows())[0].rot;
await spin.focus();
await page.keyboard.press('Enter');
await page.waitForTimeout(800);
const rotAfter = (await rows())[0].rot;
ok('Enter turns the cabinet a quarter', rotAfter === (rotBefore + 90) % 360, `${rotBefore} → ${rotAfter}`);

await spin.focus();
await page.keyboard.press(' ');
await page.waitForTimeout(800);
ok('and so does Space', (await rows())[0].rot === (rotAfter + 90) % 360, String((await rows())[0].rot));

/* ------------------------------------------------------------------ */
/* B09 — מצב ייצור בתלת־ממד                                            */
/* ------------------------------------------------------------------ */

await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const { db } = await import('/src/db/db.ts' + v);
  const p = (await db.projects.toArray())[0];
  await db.projects.update(p.id, { soldAt: Date.now() });
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1600);
await btn(/תנועה/).click();
await page.waitForTimeout(900);
await btn(/^מטבח/).click();
await page.waitForTimeout(1600);

/*
 * מנהל נכנס לפרויקט מכור במצב תכנון, ועובר לייצור במתג.
 * הכפתור נושא את שם המצב הנוכחי, ולכן "תכנון" הוא זה שמעביר.
 */
await btn(/^תכנון$/).click().catch(() => {});
await page.waitForTimeout(1200);
const toolbar = await page.innerText('body');
ok('production mode is on', /סימון מהיר/.test(toolbar), JSON.stringify(toolbar.slice(0, 200)));
ok('and the colours have a legend', /לא התחיל/.test(toolbar) && /בחיתוך/.test(toolbar));

await btn(/^תלת־ממד/).click();
await page.waitForTimeout(1300);
await page.locator('[data-unit]').first().click({ force: true });
await page.waitForTimeout(1000);
const opened = (await page.getByRole('dialog').count()) > 0;
ok('a tap in 3D opens the work sheet', opened);
const sheet = opened ? await page.getByRole('dialog').last().innerText() : '';
ok('and it is the work sheet', /חיתוך|הרכבה|התקנה/.test(sheet), JSON.stringify(sheet.slice(0, 160)));

ok('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
const bad = out.filter((l) => l.startsWith('FAIL'));
console.log(bad.length ? `\n${bad.length} נפלו` : '\nהכול עבר');
await browser.close();

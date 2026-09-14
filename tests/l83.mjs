/** משימות 83 ו-94: מודל הלוח — ליבה וגוון, גוון שני, פחתים ומחשבון. */
import { chromium } from 'playwright';

const SP = new URL('shots/', import.meta.url).pathname;
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));

const btn = (re) => page.getByRole('button', { name: re }).first();
const dlg = () => page.getByRole('dialog').last();
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  (cond ? pass++ : fail++);
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' | ' + extra : ''}`);
};
const esc = async () => {
  while (await page.getByRole('dialog').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(250); }
};

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.getByLabel('שם משתמש').fill('admin');
await page.getByLabel('סיסמה').fill('admin2026');
await btn('כניסה').click();
await page.waitForTimeout(1500);

/* ---------- 83: הליבות שנזרעו ---------- */
const seeded = await page.evaluate(async () => {
  const db = await new Promise((res, rej) => {
    const r = indexedDB.open('easycraft');
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  return new Promise((res) => {
    const tx = db.transaction('materials', 'readonly').objectStore('materials').getAll();
    tx.onsuccess = () => res(tx.result);
  });
});
ok('שלוש ליבות נזרעו', seeded.length === 3, seeded.map((m) => m.name).join(', '));
const byCore = (c) => seeded.find((m) => m.core === c);
ok('סנדוויץ׳ 17 מ״מ', byCore('sandwich')?.thicknessMm === 17, String(byCore('sandwich')?.thicknessMm));
ok('MDF 18 מ״מ עם צבע ליבה', byCore('mdf')?.thicknessMm === 18 && byCore('mdf')?.coreColor === 'חום', `${byCore('mdf')?.thicknessMm} ${byCore('mdf')?.coreColor}`);
ok('דיקט 5 מ״מ', byCore('plywood')?.thicknessMm === 5, String(byCore('plywood')?.thicknessMm));

/* ---------- 83: מסך ההגדרות מדבר לוחות ---------- */
await btn(/הגדרות/).click();
await page.waitForTimeout(900);
ok('הכותרת היא "לוחות"', await page.getByText('לוחות', { exact: true }).first().isVisible());
ok('כפתור "לוח חדש"', await btn(/^לוח חדש$/).isVisible());
ok('הסבר ליבה וגוון', await page.getByText(/ליבה היא הגוף הפיזי/).isVisible());
await page.screenshot({ path: SP + 'L83-1-settings.png' });

/* ---------- 83: עורך הליבה ---------- */
await btn(/^לוח חדש$/).click();
await page.waitForTimeout(600);
ok('שאלת הליבה', await dlg().getByText('ליבה', { exact: true }).isVisible());
for (const c of ['סנדוויץ׳', 'MDF', 'דיקט']) {
  ok(`ליבה ${c}`, await dlg().getByRole('button', { name: c, exact: true }).isVisible());
}
await dlg().getByRole('button', { name: 'MDF', exact: true }).click();
await page.waitForTimeout(300);
ok('עוביי MDF: 18 ו-9', await dlg().getByRole('button', { name: '18', exact: true }).isVisible() && await dlg().getByRole('button', { name: '9', exact: true }).isVisible());
ok('צבעי ליבה ל-MDF', await dlg().getByRole('button', { name: 'שחור', exact: true }).isVisible());
ok('MDF מודבק משני הצדדים', await dlg().getByText(/מודבק בגוון אחר בצד השני/).isVisible());
await dlg().getByRole('button', { name: 'שחור', exact: true }).click();
await page.waitForTimeout(200);
const ph = await dlg().getByPlaceholder(/MDF/).first().getAttribute('placeholder');
ok('השם נגזר מהליבה', /MDF שחור 18/.test(ph ?? ''), ph ?? '');
/* דיקט אין לו צבע ליבה */
await dlg().getByRole('button', { name: 'דיקט', exact: true }).click();
await page.waitForTimeout(300);
ok('לדיקט אין צבע ליבה', (await dlg().getByRole('button', { name: 'שחור', exact: true }).count()) === 0);
ok('דיקט 5 מ״מ בלבד', await dlg().getByRole('button', { name: '5', exact: true }).isVisible());
await page.screenshot({ path: SP + 'L83-2-core.png' });
await esc();

/* ---------- 94: המחשבון במלאי ---------- */
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
await btn(/מלאי/).click();
await page.waitForTimeout(900);
ok('מחשבון בכותרת המלאי', await page.getByRole('button', { name: 'מחשבון' }).isVisible());
await page.getByRole('button', { name: 'מחשבון' }).click();
await page.waitForTimeout(500);
ok('המחשבון נפתח', (await page.getByRole('dialog').count()) > 0);
await esc();

/* ---------- 83: הוספת לוח למלאי — ליבה קודם, ואז גוון ---------- */
await btn(/הוספת לוח למלאי/).click();
await page.waitForTimeout(600);
ok('שואלים ליבה קודם', await dlg().getByText('ליבה', { exact: true }).isVisible());
ok('ואז גוון', await dlg().getByText('גוון', { exact: true }).first().isVisible());
await dlg().getByRole('button', { name: /MDF/ }).first().click();
await page.waitForTimeout(300);
await dlg().getByRole('button', { name: /לבן/ }).first().click();
await page.waitForTimeout(400);
ok('גוון בצד השני מוצע ל-MDF', await dlg().getByText('גוון בצד השני').isVisible());
await dlg().locator('section').filter({ hasText: 'גוון בצד השני' }).getByRole('button', { name: /אלון/ }).click();
await page.waitForTimeout(200);
await dlg().getByRole('button', { name: '3', exact: true }).first().click();
await page.waitForTimeout(200);
await dlg().getByRole('button', { name: /הוספה למלאי/ }).click();
await page.waitForTimeout(900);
await page.screenshot({ path: SP + 'L83-3-stock.png' });

const stock = await page.evaluate(async () => {
  const db = await new Promise((res) => { const r = indexedDB.open('easycraft'); r.onsuccess = () => res(r.result); });
  return new Promise((res) => {
    const tx = db.transaction('stock', 'readonly').objectStore('stock').getAll();
    tx.onsuccess = () => res(tx.result);
  });
});
ok('פלטה אחת נשמרה, לא שתיים', stock.length === 1, JSON.stringify(stock.map((s) => s.sheets)));
ok('הצד השני נשמר', !!stock[0]?.backFinishId);
ok('שלוש פלטות', stock[0]?.sheets === 3, String(stock[0]?.sheets));
ok('דו-צדדי מוצג בשורה', await page.getByText(/דו-צדדי עם/).first().isVisible());
ok('הרזרבה מוצגת בשורה השנייה', await page.getByText(/3 בצד השני/).first().isVisible());

/* ---------- 94: פחתים ---------- */
await btn(/אין פחתים/).click();
await page.waitForTimeout(600);
ok('מסך הפחתים נפתח', await dlg().getByText('אין פחתים רשומים ללוח הזה.').isVisible());
await dlg().getByRole('button', { name: /פחת נוסף/ }).click();
await page.waitForTimeout(300);
await dlg().getByLabel(/רוחב/).first().fill('120');
await dlg().getByLabel(/אורך/).first().fill('60');
await page.waitForTimeout(200);
ok('שטח הפחת מחושב', await dlg().getByText(/0\.72 מ״ר/).isVisible());
await dlg().getByRole('button', { name: /שמירה/ }).click();
await page.waitForTimeout(900);
ok('הפחת מסומן בשורה', await page.getByText(/פחת אחד/).first().isVisible());
await page.screenshot({ path: SP + 'L94-offcuts.png' });

const saved = await page.evaluate(async () => {
  const db = await new Promise((res) => { const r = indexedDB.open('easycraft'); r.onsuccess = () => res(r.result); });
  return new Promise((res) => {
    const tx = db.transaction('stock', 'readonly').objectStore('stock').getAll();
    tx.onsuccess = () => res(tx.result);
  });
});
const cuts = saved.flatMap((s) => s.offcuts ?? []);
ok('מידות הפחת נשמרו במ״מ', cuts.length === 1 && cuts[0].widthMm === 1200 && cuts[0].heightMm === 600, JSON.stringify(cuts));

console.log(`\n${pass} pass, ${fail} fail`);
if (errs.length) console.log('PAGEERROR ' + errs.slice(0, 4).join(' | '));
await browser.close();

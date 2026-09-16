import './_exit.mjs';
import { chromium } from 'playwright';
import { setup, addUnit } from './mk.mjs';
const SP = new URL('shots/', import.meta.url).pathname;
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await b.newPage({ viewport: { width: 400, height: 840 }, deviceScaleFactor: 2 });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && errs.push(m.text()));
const btn = (re) => page.getByRole('button', { name: re }).first();
const dlg = () => page.getByRole('dialog').last();
const ok = (l, c, e = '') => console.log(`${c ? 'PASS' : 'FAIL'}  ${l}${e ? ' — ' + e : ''}`);
const shot = (n) => page.screenshot({ path: `${SP}/L53-${n}.png`, fullPage: true });
/* הידיות של הדלתות: קו אנכי קצר בכל דלת */
const handles = () =>
  page
    .locator('g[data-unit-id] line')
    .evaluateAll((els) =>
      els
        .map((e) => ['x1', 'y1', 'x2', 'y2'].map((k) => +e.getAttribute(k)))
        .filter(([x1, y1, x2, y2]) => Math.abs(x1 - x2) < 1 && Math.abs(y2 - y1) < 400).length,
    );

await setup(page, { name: 'חזיתות בע״מ' });
await addUnit(page, 0);
await page.waitForTimeout(400);
/* ארגז גבוה, שיהיה מקום לשלושה תאים */
await btn(/גובה/).click(); await page.waitForTimeout(400);
await btn(/הקלדת גובה מדויק/).click(); await page.waitForTimeout(400);
await page.getByRole('spinbutton', { name: 'גובה מדויק' }).fill('200');
await page.keyboard.press('Enter'); await page.waitForTimeout(700);

/* עורך הפנים */
await btn(/הסתרת חזיתות/).click(); await page.waitForTimeout(700);
const split = btn(/מדף מפריד/);
await split.scrollIntoViewIfNeeded();
await split.click(); await page.waitForTimeout(500);
await split.click(); await page.waitForTimeout(500);
ok('three cells', (await page.getByRole('button', { name: /^תא \d/ }).count()) === 3);
await shot('1-cells');

/* אייקון תוכן לכל תא */
const icons = await page.locator('li button svg rect').count();
ok('content icon per cell', icons >= 3, String(icons));

/* --- חזית אחת מול חזית לכל תא --- */
ok('front mode buttons', (await btn(/דלת אחת לכל הארון/).count()) === 1 && (await btn(/דלת לכל תא/).count()) === 1);
ok('whole is the default', (await btn(/דלת אחת לכל הארון/).getAttribute('aria-pressed')) === 'true');
await btn(/הצגת חזיתות/).click(); await page.waitForTimeout(700);
const oneFront = await handles();
ok('one front draws one handle', oneFront === 1, String(oneFront));
await shot('2-one-front');

await btn(/הסתרת חזיתות/).click(); await page.waitForTimeout(600);
await btn(/דלת לכל תא/).click(); await page.waitForTimeout(700);
ok('per-cell is on', (await btn(/דלת לכל תא/).getAttribute('aria-pressed')) === 'true');
await btn(/הצגת חזיתות/).click(); await page.waitForTimeout(700);
const perCell = await handles();
ok('a front per cell', perCell === 3, String(perCell));
await shot('3-per-cell');

/* --- חזית אחת לשני תאים: התא האמצעי חוזר להמשך --- */
await btn(/הסתרת חזיתות/).click(); await page.waitForTimeout(600);
await page.getByRole('button', { name: /^תא 2/ }).click(); await page.waitForTimeout(500);
await btn(/ממשיכה את התא שמתחת/).click(); await page.waitForTimeout(600);
await shot('4-merged');
await btn(/הצגת חזיתות/).click(); await page.waitForTimeout(700);
const merged = await handles();
ok('merging two cells leaves two fronts', merged === 2, String(merged));

/* --- תא בלי דלת: נישה פתוחה בתוך ארון סגור --- */
await btn(/הסתרת חזיתות/).click(); await page.waitForTimeout(600);
await page.getByRole('button', { name: /^תא 2/ }).click(); await page.waitForTimeout(500);
await btn(/^בלי דלת$/).click(); await page.waitForTimeout(600);
await btn(/הצגת חזיתות/).click(); await page.waitForTimeout(700);
const openCell = await handles();
ok('an open cell has no door', openCell === 2, String(openCell));
await shot('6-open-cell');
/* חוזרים לחזית משלה, כדי שהמשך הבדיקה יראה שלוש חזיתות */
await btn(/הסתרת חזיתות/).click(); await page.waitForTimeout(600);
await page.getByRole('button', { name: /^תא 2/ }).click(); await page.waitForTimeout(500);
await btn(/^חזית משלה$/).click(); await page.waitForTimeout(600);
await btn(/הצגת חזיתות/).click(); await page.waitForTimeout(600);

/*
  --- המסור רואה את אותן חזיתות ---
  שתי חזיתות בשני גבהים הן שני לוחות בשתי מידות, ולא לוח אחד.
*/
await page.getByRole('button', { name: 'סיום עריכה' }).first().click(); await page.waitForTimeout(500);
await btn(/ניסור/).click(); await page.waitForTimeout(1800);
await dlg().getByRole('button', { name: /MDF/ }).first().click().catch(() => {});
await page.waitForTimeout(700);
const nest = await dlg().innerText();
const sizes = [...nest.matchAll(/(\d+(?:\.\d+)?)×(\d+(?:\.\d+)?)/g)].map((m) => `${m[1]}x${m[2]}`);
ok('two door sizes in the cut list', new Set(sizes.filter((x) => !x.startsWith('122'))).size >= 2, sizes.join(','));
await shot('5-nesting');
await shot('5-calc');

console.log(errs.length ? 'ERRORS: ' + errs.join(' | ') : 'no console errors');
await b.close();

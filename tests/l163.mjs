import './_exit.mjs';
/*
 * שכבה 163 — "מידות פנימיות" מראה את החלוקה, לא את הקופסה.
 *
 * הכפתור צייר מלבן אחד לכל אזור, ועליו הגובה הנקי של האזור כולו.
 * זו לא השאלה שנגר שואל: בארון עם ארבעה מדפים הוא רוצה לדעת כמה
 * נשאר בין מדף למדף, ובארגז מגירות — מה גובה כל שורה. מספר אחד
 * על חמישה מרווחים אינו תשובה חלקית אלא תשובה שגויה.
 *
 * מה שנבדק כאן:
 *   • מדפים מחלקים את התא, וכל מדף גוזל את עוביו.
 *   • מרווחים שנקבעו ביד נשמרים ביחס שלהם, ולא בחלוקה שווה.
 *   • שורת מגירה אחת היא תא, וגם עמודה של מגירות זו לצד זו.
 *   • קושרת מחלקת את הרוחב לפי החלק שנשמר בה, ולכל עמודה התוכן שלה.
 *   • ועל המסך: הכפתור מצייר תא לכל חלוקה, לא לכל ארגז.
 */
import { chromium } from 'playwright';
import { setup, addUnit } from './mk.mjs';

const SP = new URL('shots/', import.meta.url).pathname;
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
const out = [];
const ok = (name, cond, extra = '') => {
  const line = `${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' | ' + extra : ''}`;
  out.push(line);
  console.log(line);
};
const btn = (re) => page.getByRole('button', { name: re }).first();
const near = (a, b) => Math.abs(a - b) < 0.6;

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });

/* ------------------------------------------------------------------ */
/* המודל                                                               */
/* ------------------------------------------------------------------ */

const m = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const I = await import('/src/features/design/interior.ts' + v);
  /* ארגז 800 רחב על 720 גבוה, בלי רגליים: נקי 764, גובה תא 702 */
  const u = (o = {}) => ({
    id: 'u', projectId: 'p', wallId: 'w', catalogItemId: 'c', name: 'ארגז',
    glyph: 'doors', level: 'floor', doors: 2, socleMm: 0,
    xMm: 0, yMm: 0, widthMm: 800, heightMm: 720, depthMm: 580,
    createdAt: 0, updatedAt: 0, ...o,
  });
  const cells = (o) => I.interiorCells(u(o));
  return {
    shelves3: cells({ glyph: 'shelves', shelves: 3 }),
    uneven: cells({ glyph: 'shelves', shelves: 2, shelfGapsMm: [400, 200, 200] }),
    drawers4: cells({ glyph: 'drawers', drawers: 4 }),
    twoWide: cells({ glyph: 'drawers', drawers: 2, drawerCols: 2 }),
    rod: cells({ zones: [{ id: 'z', heightMm: 720, kind: 'rod' }] }),
    columns: cells({
      zones: [{
        id: 'z', heightMm: 720, kind: 'shelves',
        columns: [
          { id: 'c1', widthShare: 1, kind: 'shelves', shelves: 1 },
          { id: 'c2', widthShare: 2, kind: 'drawers', drawers: 2 },
        ],
      }],
    }),
    stacked: cells({
      heightMm: 2000,
      zones: [
        { id: 'z1', heightMm: 700, kind: 'drawers', drawers: 3 },
        { id: 'z2', heightMm: 800, kind: 'shelves', shelves: 2 },
        { id: 'z3', heightMm: 500, kind: 'rod' },
      ],
    }),
    appliance: cells({ glyph: 'oven' }),
    board: cells({ glyph: 'plain' }),
  };
});

/* שלושה מדפים = ארבעה מרווחים. 702 פחות 3×18 = 648, לארבע */
ok('שלושה מדפים נותנים ארבעה מרווחים', m.shelves3.length === 4, String(m.shelves3.length));
ok('וכל מרווח הוא הגובה הנקי חלקי ארבע',
  m.shelves3.every((c) => near(c.heightMm, 162)), m.shelves3.map((c) => c.heightMm).join());
ok('המדף גוזל את עוביו מהמרווח שמעליו',
  near(m.shelves3[1].yMm - (m.shelves3[0].yMm + m.shelves3[0].heightMm), 18),
  `${m.shelves3[0].yMm}+${m.shelves3[0].heightMm} → ${m.shelves3[1].yMm}`);
ok('והרוחב הוא הנקי בין הדפנות', m.shelves3.every((c) => near(c.widthMm, 764)));

/* מרווחים ידניים 2:1:1 על 666 פנוי — 333, 166.5, 166.5 */
ok('מרווח שנקבע ביד נשמר ביחס שלו',
  m.uneven.length === 3 && near(m.uneven[0].heightMm, 333) && near(m.uneven[1].heightMm, 166.5),
  m.uneven.map((c) => Math.round(c.heightMm)).join());
ok('ולא בחלוקה שווה', !near(m.uneven[0].heightMm, m.uneven[1].heightMm));

/* ארבע מגירות = ארבע שורות, בלי לוח ביניהן */
ok('ארבע מגירות הן ארבע שורות', m.drawers4.length === 4, String(m.drawers4.length));
ok('וכל שורה היא הגובה הנקי חלקי ארבע',
  m.drawers4.every((c) => near(c.heightMm, 175.5)), m.drawers4.map((c) => c.heightMm).join());
ok('שורות מגירה נוגעות זו בזו — אין לוח מפריד',
  near(m.drawers4[1].yMm, m.drawers4[0].yMm + m.drawers4[0].heightMm));

/* שתי שורות על שתי עמודות = ארבעה תאים, חצי רוחב כל אחד */
ok('מגירות זו לצד זו הן תא לכל אחת', m.twoWide.length === 4, String(m.twoWide.length));
ok('וכל אחת בחצי הרוחב', m.twoWide.every((c) => near(c.widthMm, 382)),
  m.twoWide.map((c) => c.widthMm).join());

/* מוט תלייה אינו מתחלק */
ok('מוט תלייה נשאר תא אחד', m.rod.length === 1 && m.rod[0].kind === 'rod',
  JSON.stringify(m.rod.map((c) => c.kind)));

/* קושרת: שליש ושני שלישים מתוך 746 שנשארו אחרי המחיצה */
const left = m.columns.filter((c) => c.kind === 'shelves');
const right = m.columns.filter((c) => c.kind === 'drawers');
ok('קושרת מחלקת את הרוחב לפי החלק שנשמר בה',
  near(left[0].widthMm, 248.7) && near(right[0].widthMm, 497.3),
  `${Math.round(left[0].widthMm)} / ${Math.round(right[0].widthMm)}`);
ok('ולא בחלוקה שווה', !near(left[0].widthMm, right[0].widthMm));
ok('ולכל עמודה התוכן שלה', left.length === 2 && right.length === 2,
  `מדפים ${left.length}, מגירות ${right.length}`);
ok('והשנייה מתחילה אחרי המחיצה',
  near(right[0].xMm - (left[0].xMm + left[0].widthMm), 18),
  `${Math.round(left[0].xMm + left[0].widthMm)} → ${Math.round(right[0].xMm)}`);

/* שלושה אזורים זה מעל זה */
ok('אזורים נערמים לפי הסדר',
  m.stacked.filter((c) => c.kind === 'drawers').length === 3 &&
  m.stacked.filter((c) => c.kind === 'shelves').length === 3 &&
  m.stacked.filter((c) => c.kind === 'rod').length === 1,
  m.stacked.map((c) => c.kind).join());
ok('והמגירות למטה', m.stacked[0].kind === 'drawers' && m.stacked[0].yMm === 0);

/* מה שאין לו פנים שנבנה כאן */
ok('מכשיר שנקנה שלם אינו מקבל מידה פנימית', m.appliance.length === 0);
ok('וגם לא לוח בודד', m.board.length === 0);

/* ------------------------------------------------------------------ */
/* על המסך                                                             */
/* ------------------------------------------------------------------ */

await setup(page, { name: 'חלוקה פנימית' });
await addUnit(page, 0);
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
await btn(/סיום עריכה/).click().catch(() => {});
await page.waitForTimeout(600);

/* ארון מדפים, ולצידו ארגז מגירות */
await page.evaluate(async () => {
  const { db } = await import('/src/db/db.ts');
  const u = (await db.units.toArray())[0];
  await db.units.update(u.id, {
    glyph: 'shelves', shelves: 4, widthMm: 900, heightMm: 1400, zones: undefined,
  });
  const { id: _id, ...rest } = u;
  await db.units.add({
    ...rest, id: 'u-drawers', name: 'מגירות', glyph: 'drawers',
    drawers: 4, shelves: undefined, xMm: 950, widthMm: 800, heightMm: 900, zones: undefined,
  });
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1600);
await btn(/חלוקה פנימית/).click().catch(() => {});
await page.waitForTimeout(900);
await btn(/^מטבח/).click().catch(() => {});
await page.waitForTimeout(1600);

const before = await page.locator('svg rect[stroke="#0d9488"]').count();
ok('בלי הכפתור אין מלבני פנים', before === 0, String(before));

await btn(/מידות פנימיות/).click();
await page.waitForTimeout(1200);
await page.screenshot({ path: SP + 'L163-interior.png' });

const rects = await page.locator('svg rect[stroke="#0d9488"]').count();
/* ארבעה מדפים = חמישה מרווחים, ועוד ארבע שורות מגירה */
ok('הכפתור מצייר תא לכל חלוקה ולא לכל ארגז', rects === 9, String(rects));

const labels = await page.locator('svg text[fill="#0f766e"]').allTextContents();
ok('לכל תא יש מידה קריאה', labels.length === 9, String(labels.length));
ok('המרווח בין המדפים נכון', labels.filter((t) => t === '86.4×24.2').length === 5, labels.join());
ok('וגובה שורת המגירה נכון', labels.filter((t) => t === '76.4×19.6').length === 4, labels.join());

ok('בלי שגיאות בדפדפן', errs.length === 0, errs.slice(0, 2).join(' | '));

const bad = out.filter((l) => l.startsWith('FAIL'));
console.log(bad.length ? `\n${bad.length} נפלו` : '\nהכול עבר');
await browser.close();
if (bad.length) process.exitCode = 1;

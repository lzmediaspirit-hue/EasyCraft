import './_exit.mjs';
/*
 * שכבה 155 — A09/A10: יכולת נגזרת מהמבנה, לא מהשם ולא מהאיור.
 *
 * שינוי שם של ארגז דלתות ל"כיור" הספיק כדי שיעבור כארגז כיור,
 * ואייקון תנור לבדו סיפק גם תנור וגם מיקרוגל. בכיוון ההפוך,
 * שינוי שם של EC-057 ל-Custom cabinet העלים את אזהרת הייצור
 * שלו בלי לשנות לוח אחד.
 *
 * מה שנבדק כאן: היכולת נקראת מהאזורים של הארגז ומהמידות שלו,
 * ומידות המכשירים הן תקן ולא "נתוני יצרן".
 */
import { chromium } from 'playwright';

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + String(e).slice(0, 200)));
const out = [];
const ok = (name, cond, extra = '') => out.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' | ' + extra : ''}`);

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(400);

const r = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const { unitCaps, capsProvide, unitProvides } = await import('/src/catalog/capabilities.ts' + v);
  const { APPLIANCES, CUTOUTS, nicheFits } = await import('/src/catalog/appliances.ts' + v);

  const box = (over) => ({
    glyph: 'doors', name: 'ארגז', widthMm: 600, heightMm: 720, depthMm: 580,
    socleMm: 0, counterMm: 0, backKind: 'thin', ...over,
  });

  /* נישת תנור במידות תקן: 560×590×550 */
  const ovenNiche = box({
    glyph: 'open', applianceType: 'oven', widthMm: 600, heightMm: 800, depthMm: 580,
    zones: [{ id: 'a', heightMm: 190, kind: 'empty' }, { id: 'b', heightMm: 610, kind: 'empty' }],
  });
  /* אותו ארגז, בלי חלוקה — חלל אחד בגובה 800 אינו נישה */
  const ovenNoNiche = box({
    glyph: 'open', applianceType: 'oven', widthMm: 600, heightMm: 800, depthMm: 580,
    zones: [{ id: 'a', heightMm: 800, kind: 'empty' }],
  });
  /* ארגז מדפים ששמו "ארון תנור" */
  const namedOnly = box({ glyph: 'doors', name: 'ארון תנור', doors: 2, shelves: 2 });

  /* ארגז כיור: משטח, וחלל פנוי מתחתיו */
  const sinkBox = box({
    glyph: 'sink', name: 'ארון כיור', widthMm: 800, heightMm: 900, socleMm: 100,
    counterMm: 30, depthMm: 580, zones: [{ id: 'z', heightMm: 800, kind: 'empty' }],
  });
  /* אותו ארגז, מלא מגירות — אין לאן להכניס את הקערה */
  const sinkDrawers = box({
    ...sinkBox, glyph: 'drawers',
    zones: [{ id: 'z', heightMm: 800, kind: 'drawers', drawers: 3, drawerCols: 1, drawerStyle: 'outer' }],
  });
  /* וארגז דלתות רגיל ששמו הוחלף ל"כיור" */
  const renamed = box({ name: 'ארון כיור', doors: 2, shelves: 1 });

  /* תנור ומיקרוגל: שתי נישות נפרדות, ולא חלל אחד גדול */
  const twoNiches = box({
    glyph: 'open', applianceType: 'ovenMicro', widthMm: 600, heightMm: 2100, depthMm: 580,
    zones: [
      { id: 'a', heightMm: 700, kind: 'empty' },
      { id: 'b', heightMm: 610, kind: 'empty' },
      { id: 'c', heightMm: 400, kind: 'empty' },
      { id: 'd', heightMm: 390, kind: 'empty' },
    ],
  });
  const oneBigCavity = box({
    glyph: 'open', applianceType: 'ovenMicro', widthMm: 600, heightMm: 2100, depthMm: 580,
    zones: [{ id: 'a', heightMm: 2100, kind: 'empty' }],
  });

  return {
    oven: unitProvides(ovenNiche, 'oven'),
    ovenNoNiche: unitProvides(ovenNoNiche, 'oven'),
    namedOnly: unitProvides(namedOnly, 'oven'),
    sink: unitProvides(sinkBox, 'sink'),
    sinkDrawers: unitProvides(sinkDrawers, 'sink'),
    renamed: unitProvides(renamed, 'sink'),
    twoNiches: unitProvides(twoNiches, 'ovenMicro'),
    oneBigCavity: unitProvides(oneBigCavity, 'ovenMicro'),
    /* והתקן עצמו: מה שכתוב בו הוא מה שנבדק */
    ovenStd: APPLIANCES.oven.niches[0],
    sinkCut: CUTOUTS.sink,
    slackOk: nicheFits({ fromMm: 0, widthMm: 564, heightMm: 592, depthMm: 576 }, APPLIANCES.oven.niches[0]),
    slackTooTall: nicheFits({ fromMm: 0, widthMm: 564, heightMm: 900, depthMm: 576 }, APPLIANCES.oven.niches[0]),
    caps: unitCaps(sinkBox),
    capsProvideSink: capsProvide(unitCaps(sinkBox), 'sink'),
  };
});

ok('נישה במידות תקן ממלאת תפקיד תנור', r.oven === true, String(r.oven));
ok('חלל לא מוגדר בגובה 800 אינו נישה', r.ovenNoNiche === false, String(r.ovenNoNiche));
ok('ושם בלבד אינו יוצר נישה', r.namedOnly === false, String(r.namedOnly));

ok('משטח וחלל מתחתיו הם ארגז כיור', r.sink === true, String(r.sink));
ok('ארגז מגירות מלא אינו ארגז כיור', r.sinkDrawers === false, String(r.sinkDrawers));
ok('ושינוי שם אינו הופך ארגז דלתות לכיור', r.renamed === false, String(r.renamed));

ok('תנור ומיקרוגל דורשים שתי נישות', r.twoNiches === true, String(r.twoNiches));
ok('וחלל אחד גדול אינו מספק את שתיהן', r.oneBigCavity === false, String(r.oneBigCavity));

ok('מידת נישת התנור היא תקן ולא נתון יצרן',
  r.ovenStd.widthMm === 560 && r.ovenStd.heightMm === 590 && r.ovenStd.depthMm === 550,
  JSON.stringify(r.ovenStd));
ok('וחיתוך הכיור הוא 490×430', r.sinkCut.widthMm === 490 && r.sinkCut.depthMm === 430,
  JSON.stringify(r.sinkCut));
ok('נישה בסובלנות סבירה מתקבלת', r.slackOk === true, String(r.slackOk));
ok('ונישה בגובה כפול אינה נישה', r.slackTooTall === false, String(r.slackTooTall));
ok('היכולות נגזרות מהמבנה', r.capsProvideSink === true && r.caps.worktop === true,
  JSON.stringify({ worktop: r.caps.worktop, cut: r.caps.cutWidthMm }));

await browser.close();
for (const e of errs) out.push('FAIL ' + e);
console.log(out.join('\n'));
const fail = out.filter((l) => l.startsWith('FAIL')).length;
console.log(`${out.length - fail} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);

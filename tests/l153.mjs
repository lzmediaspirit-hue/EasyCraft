import './_exit.mjs';
/*
 * שכבה 153 — N12 והספרייה: מה שאינו מוכן לייצור נאמר, ומה
 * שאושר מתועד.
 *
 * ארגז יכול להיראות נכון בכל התצוגות ועדיין לא להיות בר־ייצור:
 * "ארון תנור עם מגירה" הוא אזור מגירה אחד בלי נישה, ו"ארון פינה L"
 * נחתך כתיבה מלבנית. תצוגה יפה נקראת כאישור לייצור, וזו הקריאה
 * שצריך למנוע.
 */
import { chromium } from 'playwright';

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + String(e).slice(0, 200)));
const out = [];
const ok = (name, cond, extra = '') => out.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' | ' + extra : ''}`);

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);

const gap = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const { productionGap, nameMismatch } = await import('/src/catalog/production.ts' + v);
  const { SHIPPED_LIBRARY } = await import('/src/catalog/shipped.ts' + v);
  const { itemSpec } = await import('/src/catalog/roles.ts' + v);
  const { unitProvides } = await import('/src/catalog/capabilities.ts' + v);
  const at = (code) => SHIPPED_LIBRARY.find((i) => i.code === code);
  const spec = (code) => itemSpec(at(code));

  /* עמודה שמצהירה על תנור ואין בה נישה — כאן, ולא בספרייה */
  const fake = {
    glyph: 'open', applianceType: 'oven', name: 'עמודת תנור',
    widthMm: 600, heightMm: 2100, depthMm: 580, socleMm: 0,
    zones: [{ id: 'z', heightMm: 2100, kind: 'empty' }],
  };
  /* ארגז דלתות רגיל ששמו הוחלף ל"כיור" */
  const renamedToSink = {
    glyph: 'doors', name: 'ארון כיור', doors: 2,
    widthMm: 600, heightMm: 720, depthMm: 580, socleMm: 0, counterMm: 0,
    zones: [{ id: 'z', heightMm: 720, kind: 'shelves', shelves: 1 }],
  };

  return {
    /* התבניות שתוקנו: נישות ומשטח במידות תקן, ולכן אין בהן חוסר */
    sink: productionGap(spec('EC-053')),
    oven: productionGap(spec('EC-057')),
    lShape: productionGap(spec('EC-059')),
    plain: productionGap(spec('EC-081')),
    /* מכשיר שנקנה שלם אינו נבנה כאן, ולכן אין בו חוסר ייצור */
    bought: productionGap({ glyph: 'fridge', name: 'מקרר', widthMm: 600, heightMm: 1800, depthMm: 600 }),
    /* ספרייה מוכנה לעבודה: אפס אזהרות בנייה מתוך כל התבניות */
    flagged: SHIPPED_LIBRARY.filter((i) => productionGap(itemSpec(i))).length,
    mislabelled: SHIPPED_LIBRARY.filter((i) => nameMismatch(itemSpec(i))).length,
    total: SHIPPED_LIBRARY.length,

    /* והחוק שאינו משתנה: שם אינו בונה נישה ואינו מבטל אותה */
    fakeGap: productionGap(fake),
    fakeRenamedGap: productionGap({ ...fake, name: 'Custom cabinet' }),
    renamedIsSink: unitProvides(renamedToSink, 'sink'),

    /* גבהי ההתקנה שאושרו במפורש */
    offsets: ['EC-047', 'EC-075', 'EC-080'].map((c) => [c, at(c)?.defaultYMm]),
  };
});

ok('ארון הכיור בנוי ואין בו חוסר', gap.sink === null, String(gap.sink));
ok('ארון התנור קיבל נישה במידות תקן', gap.oven === null, String(gap.oven));
ok('ופינת ה-L נבנית כשני גופים מלבניים', gap.lShape === null, String(gap.lShape));
ok('ארגז רגיל אינו מסומן', gap.plain === null, String(gap.plain));
ok('מכשיר שנקנה שלם אינו מסומן', gap.bought === null, String(gap.bought));
ok('אפס אזהרות בנייה בספרייה', gap.flagged === 0, `${gap.flagged}/${gap.total}`);
ok('ואפס אי־התאמות בין שם למבנה', gap.mislabelled === 0, `${gap.mislabelled}/${gap.total}`);

/* A10: הסטטוס נגזר מהמבנה, ולכן שינוי שם אינו מעלים אותו */
ok('עמודה שמצהירה על תנור בלי נישה מסומנת', !!gap.fakeGap, String(gap.fakeGap));
ok('ושינוי שם אינו מנקה אותה', gap.fakeRenamedGap === gap.fakeGap, String(gap.fakeRenamedGap));
/* A09: וגם ההפך — שם אינו מקנה יכולת */
ok('שינוי שם ל"כיור" אינו הופך ארגז לארגז כיור', gap.renamedIsSink === false, String(gap.renamedIsSink));

ok('גבהי ההתקנה שאושרו נשמרו',
  JSON.stringify(gap.offsets) === JSON.stringify([['EC-047', 1500], ['EC-075', 1500], ['EC-080', 600]]),
  JSON.stringify(gap.offsets));

/* ------------------------------------------------------------------ */
/* ועל המסך: התג נראה בספרייה                                         */
/* ------------------------------------------------------------------ */
await page.getByLabel('שם משתמש').waitFor({ state: 'visible', timeout: 15000 });
await page.getByLabel('שם משתמש').fill('admin');
await page.getByLabel('סיסמה').fill('admin2026');
await page.getByRole('button', { name: 'כניסה' }).first().click();
await page.waitForTimeout(1600);
await page.getByRole('button', { name: /ספריית הארגזים/ }).first().click();
await page.waitForTimeout(1200);
/* הספרייה נפתחת ברשימת החדרים; הארגזים עצמם בתוך חדר */
await page.getByRole('button', { name: /^מטבח/ }).first().click();
await page.waitForTimeout(1200);

/*
 * ספרייה מוכנה לעבודה אינה מציגה אזהרת בנייה.
 *
 * זו הייתה הבדיקה ההפוכה — שהתג נראה — כי ארבע־עשרה תבניות נשאו
 * אזהרה שאי אפשר היה להסיר. עכשיו הן בנויות, ולכן מה שנבדק הוא
 * שהמסך שקט. התג עצמו עדיין נבדק, על מפרט שבאמת חסר, למעלה.
 */
const shown = await page.evaluate(() =>
  [...document.querySelectorAll('[role="dialog"] p')]
    .filter((p) => p.textContent.includes('חסר מידע לייצור')).length,
);
ok('אין אזהרת בנייה בספריית הארגזים', shown === 0, String(shown));

await browser.close();
for (const e of errs) out.push('FAIL ' + e);
console.log(out.join('\n'));
const fail = out.filter((l) => l.startsWith('FAIL')).length;
console.log(`${out.length - fail} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);

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
  const { productionGap } = await import('/src/catalog/construction.ts' + v);
  const { SHIPPED_LIBRARY } = await import('/src/catalog/shipped.ts' + v);
  const at = (code) => SHIPPED_LIBRARY.find((i) => i.code === code);
  const why = (code) => productionGap(at(code) ?? { glyph: 'doors' });
  return {
    /* נישת מכשיר אמיתית */
    sink: why('EC-053'),
    /* שם שמבטיח תנור, תבנית שהיא מגירה */
    ovenName: why('EC-057'),
    /* פינה שמצוירת L ונחתכת מלבן */
    lShape: why('EC-059'),
    /* ארגז רגיל — אין מה לומר עליו */
    plain: why('EC-081'),
    /* מכשיר שנקנה שלם אינו נבנה כאן, ולכן אין בו חוסר ייצור */
    bought: productionGap({ glyph: 'fridge', name: 'מקרר' }),
    /* וכמה מסומנים בסך הכול — מספר שנקרא, לא ריק ולא הכול */
    flagged: SHIPPED_LIBRARY.filter((i) => productionGap(i)).length,
    total: SHIPPED_LIBRARY.length,
    /* גבהי ההתקנה שאושרו במפורש */
    offsets: ['EC-047', 'EC-075', 'EC-080'].map((c) => [c, at(c)?.defaultYMm]),
  };
});

ok('נישת כיור מסומנת', !!gap.sink, String(gap.sink));
ok('שם שמבטיח תנור בלי נישה מסומן', !!gap.ovenName, String(gap.ovenName));
ok('ופינה L שנחתכת מלבן', !!gap.lShape, String(gap.lShape));
ok('ארגז דלתות רגיל אינו מסומן', gap.plain === null, String(gap.plain));
ok('מכשיר שנקנה שלם אינו מסומן', gap.bought === null, String(gap.bought));
ok('הסימון אינו על הכול ואינו על כלום',
  gap.flagged > 0 && gap.flagged < gap.total, `${gap.flagged} מתוך ${gap.total}`);
ok('גבהי ההתקנה שאושרו הם מה שמתועד',
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

const shown = await page.evaluate(() =>
  [...document.querySelectorAll('[role="dialog"] p')]
    .filter((p) => p.textContent.includes('חסר מידע לייצור')).length,
);
ok('התג נראה בספריית הארגזים', shown > 0, String(shown));

await browser.close();
for (const e of errs) out.push('FAIL ' + e);
console.log(out.join('\n'));
const fail = out.filter((l) => l.startsWith('FAIL')).length;
console.log(`${out.length - fail} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);

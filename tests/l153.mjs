import './_exit.mjs';
/*
 * שכבה 153 — יכולת נגזרת מהמבנה, ולא מהשם.
 *
 * כאן ישבו גם אזהרות הייצור — "חסר מידע לייצור", "השם מבטיח נישת
 * תנור" — והן ירדו לבקשת הבעלים. מה שלא ירד הוא הכלל שמאחוריהן,
 * וזה מה שנבדק כאן: שם אינו בונה נישה ואינו הורס אותה, ולכן הוא
 * גם אינו מעניק יכולת. התכנון האוטומטי נשען על זה כשהוא בוחר
 * לאיזה ארגז מכניסים כיור או תנור.
 *
 * ובנוסף: גבהי ההתקנה שאושרו במפורש בספרייה, שלא ישתנו בשקט
 * בייצוא הבא של הכלי שכותב אותה.
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

const r = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const { SHIPPED_LIBRARY } = await import('/src/catalog/shipped.ts' + v);
  const { itemSpec } = await import('/src/catalog/roles.ts' + v);
  const { unitCaps, capsProvide } = await import('/src/catalog/capabilities.ts' + v);
  const at = (code) => SHIPPED_LIBRARY.find((i) => i.code === code);
  const provides = (u, cap) => capsProvide(unitCaps(u), cap);

  /* ארגז דלתות רגיל ששמו הוחלף ל"ארון כיור" */
  const renamedToSink = {
    glyph: 'doors', name: 'ארון כיור', doors: 2,
    widthMm: 600, heightMm: 720, depthMm: 580, socleMm: 0, counterMm: 0,
    zones: [{ id: 'z', heightMm: 720, kind: 'shelves', shelves: 1 }],
  };
  /* עמודה שמצהירה על תנור, ואין בה נישה */
  const fakeOven = {
    glyph: 'open', applianceType: 'oven', name: 'עמודת תנור',
    widthMm: 600, heightMm: 2100, depthMm: 580, socleMm: 0,
    zones: [{ id: 'z', heightMm: 2100, kind: 'empty' }],
  };
  /* ואותה עמודה בשם תמים */
  const renamedAway = { ...fakeOven, name: 'עמודה' };

  return {
    renamedIsSink: provides(renamedToSink, 'sink'),
    fakeIsOven: provides(fakeOven, 'oven'),
    renamedAwayIsOven: provides(renamedAway, 'oven'),
    /* ומה שכן בנוי — כן מספק */
    realSink: provides(itemSpec(at('EC-002')), 'sink'),
    realOven: provides(itemSpec(at('EC-057')), 'oven'),
    offsets: ['EC-047', 'EC-075', 'EC-080'].map((c) => [c, at(c)?.defaultYMm]),
  };
});

ok('שינוי שם ל"ארון כיור" אינו הופך ארגז לארגז כיור', r.renamedIsSink === false);
ok('הצהרה על תנור בלי נישה אינה מספקת תנור', r.fakeIsOven === false);
ok('ושינוי השם בחזרה אינו משנה דבר — המבנה הוא שקובע',
  r.renamedAwayIsOven === r.fakeIsOven);
ok('ארון כיור שבנוי כמו שצריך מספק כיור', r.realSink === true);
ok('וארון תנור עם נישה מספק תנור', r.realOven === true);
ok('גבהי ההתקנה שאושרו נשמרו',
  JSON.stringify(r.offsets) === JSON.stringify([['EC-047', 1500], ['EC-075', 1500], ['EC-080', 600]]),
  JSON.stringify(r.offsets));

/* ------------------------------------------------------------------ */
/* ועל המסך: אין אזהרות בנייה, בשום מקום                              */
/* ------------------------------------------------------------------ */
await page.getByLabel('שם משתמש').waitFor({ state: 'visible', timeout: 15000 });
await page.getByLabel('שם משתמש').fill('admin');
await page.getByLabel('סיסמה').fill('admin2026');
await page.getByRole('button', { name: 'כניסה' }).first().click();
await page.waitForTimeout(1600);
await page.getByRole('button', { name: /ספריית הארגזים/ }).first().click();
await page.waitForTimeout(1200);
await page.getByRole('button', { name: /^מטבח/ }).first().click();
await page.waitForTimeout(1200);

const noise = await page.evaluate(() => {
  const t = document.body.textContent ?? '';
  return {
    gap: (t.match(/חסר מידע לייצור/g) ?? []).length,
    naming: (t.match(/השם מבטיח/g) ?? []).length,
  };
});
ok('אין "חסר מידע לייצור" בספרייה', noise.gap === 0, String(noise.gap));
ok('ואין "השם מבטיח"', noise.naming === 0, String(noise.naming));

ok('בלי שגיאות דף', errs.length === 0, errs.join(' ; '));

console.log(out.join('\n'));
await browser.close();
process.exit(out.some((l) => l.startsWith('FAIL')) ? 1 : 0);

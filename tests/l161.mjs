import './_exit.mjs';
/*
 * שכבה 161 — מסך יצירת ארגז: שקט, ובונה נכון.
 *
 * כאן נבדקו קודם אזהרות הייצור שהמסך הדליק. הן ירדו לבקשת
 * הבעלים, ומה שנבדק עכשיו הוא שהן באמת אינן — ושמה שהיה מועיל
 * בהן נשאר: `BoxSpec` נושא אזורים וסוג מכשיר, ובחירת "כיור" או
 * "כיריים" מביאה איתה משטח, כי בלי משטח אין מה לחתוך בו.
 *
 * `fitCapability` נשאר גם הוא, כחשבון ולא כהטפה: הוא בונה נישה
 * או חלל לקערה במידות התקן, ואינו מוחק את הארגז שכבר נבנה.
 */
import { chromium } from 'playwright';
import { pickGlyph, setup } from './mk.mjs';

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + String(e).slice(0, 200)));
const out = [];
const ok = (name, cond, extra = '') => out.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' | ' + extra : ''}`);

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);

const r = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const { fitCapability } = await import('/src/catalog/fit.ts' + v);
  const { unitCaps, capsProvide } = await import('/src/catalog/capabilities.ts' + v);
  const { APPLIANCES, NICHE_SLACK_MM } = await import('/src/catalog/appliances.ts' + v);

  /* בדיוק המפרט שהטופס מחזיק בארגז חדש */
  const blank = (glyph = 'doors', over = {}) => ({
    name: '', glyph, doors: 1, drawers: 0, drawerCols: 1, shelves: 0, drawerStyle: 'outer',
    widthMm: 600, heightMm: 880, depthMm: 580, yMm: 0, socleMm: 100, counterMm: 0, ...over,
  });

  const built = {};
  for (const cap of ['sink', 'hob', 'oven', 'micro', 'ovenMicro', 'fridge', 'dishwasher', 'hood']) {
    const u = blank(cap === 'sink' ? 'sink' : cap === 'hob' ? 'hob' : 'doors');
    const after = { ...u, ...fitCapability(u, cap) };
    built[cap] = {
      provides: capsProvide(unitCaps(after), cap),
      grew: after.widthMm >= u.widthMm && after.heightMm >= u.heightMm && after.depthMm >= u.depthMm,
    };
  }

  /* הנישה שנבנתה היא מידת התקן, ולא משהו שסתם עובר */
  const oven = { ...blank(), ...fitCapability(blank(), 'oven') };
  const need = APPLIANCES.oven.niches[0];
  const exact = unitCaps(oven).cavities.some(
    (c) => c.heightMm >= need.heightMm && c.heightMm <= need.heightMm + NICHE_SLACK_MM,
  );

  /* ארגז כיור על גוף שיש בו מגירות — המגירות שורדות */
  const withDrawers = blank('drawers', { drawers: 3, doors: 0 });
  const sunk = { ...withDrawers, ...fitCapability(withDrawers, 'sink') };

  /* מכשיר שנקנה שלם אינו מקבל נישה */
  const standalone = fitCapability(blank('fridge'), 'fridge');

  return {
    built, exact,
    drawersKept: unitCaps(sunk).drawers,
    sinkOverDrawers: capsProvide(unitCaps(sunk), 'sink'),
    standaloneNull: standalone === null,
  };
});

for (const [cap, v] of Object.entries(r.built)) {
  ok(`${cap} — נבנה במידות התקן`, v.provides, '');
  ok(`${cap} — המידות גדלו ולא הצטמצמו`, v.grew, '');
}
ok('הנישה היא מידת התקן', r.exact);
ok('חלל לקערה אינו מוחק את המגירות', r.drawersKept === 3, String(r.drawersKept));
ok('והכיור עדיין נכנס', r.sinkOverDrawers);
ok('מכשיר שנקנה שלם אינו מקבל נישה', r.standaloneNull);

/* ------------------------------------------------------------------ */
/* ובמסך עצמו                                                          */
/* ------------------------------------------------------------------ */
await setup(page, { name: 'יצירה' });
const dlg = () => page.getByRole('dialog').last();
await page.getByRole('button', { name: /הוספת ארגז/ }).first().click();
await page.waitForTimeout(800);
await dlg().getByRole('button', { name: /ארגז משלי/ }).first().click();
await page.waitForTimeout(800);

const warn = () => page.locator('text=חסר מידע לייצור').count();
const named = () => page.locator('text=השם מבטיח').count();

ok('טופס ארגז חדש נפתח בלי אזהרה', (await warn()) === 0);

await pickGlyph(page, dlg(), 'כיור');
await page.waitForTimeout(400);
ok('בחירת "כיור" — בלי אזהרה', (await warn()) === 0);

await pickGlyph(page, dlg(), 'כיריים');
await page.waitForTimeout(400);
ok('וגם "כיריים"', (await warn()) === 0);

/* שם שפעם הדליק אזהרה — עכשיו שקט */
await pickGlyph(page, dlg(), 'דלתות');
await page.waitForTimeout(300);
await dlg().getByLabel('שם הארגז').fill('ארון תנור');
await page.waitForTimeout(600);
ok('שם שמבטיח נישה אינו מדליק דבר', (await named()) === 0 && (await warn()) === 0);

/* וגם פינת L, שהייתה האזהרה האחרונה שנשארה */
await pickGlyph(page, dlg(), 'פינתי במפגש');
await page.waitForTimeout(500);
ok('גם פינת L שקטה', (await warn()) === 0);

ok('בלי שגיאות דף', errs.length === 0, errs.join(' ; '));

console.log(out.join('\n'));
await browser.close();
process.exit(out.some((l) => l.startsWith('FAIL')) ? 1 : 0);

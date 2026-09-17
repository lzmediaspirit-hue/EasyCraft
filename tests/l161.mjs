import './_exit.mjs';
/*
 * שכבה 161 — אזהרה ביצירת ארגז חדש היא פעולה, לא מבוי סתום.
 *
 * מסך יצירת הארגז נשא `BoxSpec` בלי אזורים ובלי סוג מכשיר, ולכן
 * מודל היכולות ראה כל ארגז שנפתח בו כארגז בלי נישה: מי שבחר את
 * איור הכיור קיבל מיד "המבנה אינו מפנה משטח", ומי שהקליד "ארון
 * תנור" קיבל "השם מבטיח נישת תנור" — ובטופס לא היה אף פקד שמסיר
 * את זה.
 *
 * מה שנבדק כאן: איור שמבטיח משטח מביא אותו איתו, כל תפקיד שהשם
 * או האיור מבטיחים ניתן לבנייה במידות התקן, והאזהרה היחידה שאין
 * ממנה כפתור — פינת L — נשארת, כי אין מידת תקן לגוף שאינו קיים.
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
  const { productionGap, nameMismatch, fitCapability } = await import('/src/catalog/production.ts' + v);
  const { unitCaps, capsProvide } = await import('/src/catalog/capabilities.ts' + v);
  const { promisedRole } = await import('/src/catalog/roles.ts' + v);
  const { GLYPH_FAMILIES, glyphsOf } = await import('/src/catalog/glyphList.ts' + v);
  const { APPLIANCES, NICHE_SLACK_MM } = await import('/src/catalog/appliances.ts' + v);
  const { MATERIAL } = await import('/src/catalog/standards.ts' + v);

  /* בדיוק המפרט שהטופס מחזיק בארגז חדש */
  const blank = (glyph = 'doors') => ({
    name: '', glyph, doors: 1, drawers: 0, drawerCols: 1, shelves: 0, drawerStyle: 'outer',
    widthMm: 600, heightMm: 880, depthMm: 580, yMm: 0, socleMm: 100, counterMm: 0,
  });

  /* אותה בחירה שהטופס עושה כשלוחצים על איור */
  const pick = (glyph) => {
    const next = { ...blank(glyph) };
    return (glyph === 'sink' || glyph === 'hob')
      ? { ...next, ...fitCapability(next, glyph) }
      : next;
  };

  const glyphs = [...new Set(GLYPH_FAMILIES.flatMap((f) => glyphsOf(f.key).map((g) => g.key)))];
  const warned = glyphs.filter((g) => productionGap(pick(g)));

  /* כל תפקיד שהשם יכול להבטיח — נבנה, ואז נקי */
  const names = ['ארון כיור', 'ארגז תנור', 'ארון מיקרוגל', 'ארון מקרר',
    'ארון מדיח', 'ארון כיריים', 'ארון קולט אדים', 'עמודת תנור ומיקרוגל'];
  const byName = names.map((name) => {
    const before = { ...blank(), name };
    const said = nameMismatch(before);
    const cap = promisedRole(name)?.cap;
    const after = { ...before, ...fitCapability(before, cap) };
    return {
      name, said: !!said, cap,
      clean: !nameMismatch(after) && !productionGap(after),
      provides: capsProvide(unitCaps(after), cap),
      grew: after.heightMm >= before.heightMm && after.widthMm >= before.widthMm,
    };
  });

  /* הנישה שנבנתה היא באמת מידת התקן, ולא משהו שסתם עובר */
  const oven = { ...blank(), ...fitCapability(blank(), 'oven') };
  const cav = unitCaps(oven).cavities;
  const need = APPLIANCES.oven.niches[0];
  const fitsExactly = cav.some(
    (c) => c.heightMm >= need.heightMm && c.heightMm <= need.heightMm + NICHE_SLACK_MM,
  );

  /* השם לבדו עדיין אינו מעניק יכולת — זו הייתה הדרישה של A09/A10 */
  const renamed = { ...blank('doors'), name: 'ארון תנור', shelves: 2 };
  const nameGrants = capsProvide(unitCaps(renamed), 'oven');

  /* ומכשיר עצמאי אינו מקבל נישה, כי הוא עצמו המכשיר */
  const standalone = fitCapability(blank('fridge'), 'fridge');

  return {
    warned,
    byName,
    fitsExactly,
    nameGrants,
    standaloneNull: standalone === null,
    carcass: MATERIAL.carcassMm,
    ovenZones: oven.zones.map((z) => `${z.kind}:${z.heightMm}`),
  };
});

ok(
  'איור של ארגז חדש אינו מדליק אזהרה — למעט פינת L',
  r.warned.length === 1 && r.warned[0] === 'lShape',
  JSON.stringify(r.warned),
);
ok('כיור בוחר משטח יחד עם האיור', !r.warned.includes('sink'));
ok('וכיריים כך גם', !r.warned.includes('hob'));

for (const n of r.byName) {
  ok(`"${n.name}" — נאמר`, n.said);
  ok(`"${n.name}" — ניתן לבנייה ונקי`, n.clean && n.provides, `${n.cap}`);
  ok(`"${n.name}" — המידות גדלו ולא הצטמצמו`, n.grew);
}

ok('הנישה שנבנתה היא מידת התקן', r.fitsExactly, r.ovenZones.join(','));
ok('שם לבדו עדיין אינו מעניק יכולת', !r.nameGrants);
ok('מכשיר עצמאי אינו מקבל נישה', r.standaloneNull);

/* ועכשיו במסך עצמו, ולא רק במודל */
await setup(page, { name: 'אזהרות' });

const dlg = () => page.getByRole('dialog').last();
/* לשונית הספרייה נפתחת מ"הוספת ארגז", ובתוכה השורה של ארגז חדש */
await page.getByRole('button', { name: /הוספת ארגז/ }).first().click();
await page.waitForTimeout(800);
await dlg().getByRole('button', { name: /ארגז משלי/ }).first().click();
await page.waitForTimeout(800);

const warn = () => page.locator('text=חסר מידע לייצור').count();
const named = () => page.locator('text=השם מבטיח').count();
const fixBtn = () => page.getByRole('button', { name: 'התאמה למידות התקן' });

ok('טופס ארגז חדש נפתח בלי אזהרה', (await warn()) === 0);

await pickGlyph(page, dlg(), 'כיור');
await page.waitForTimeout(400);
ok('בחירת "כיור" מביאה משטח, ולא אזהרה', (await warn()) === 0);

await pickGlyph(page, dlg(), 'כיריים');
await page.waitForTimeout(400);
ok('וגם "כיריים"', (await warn()) === 0);

/* שם שמבטיח נישה על מבנה שאין בו — נאמר, ויש ממנו דרך החוצה */
await pickGlyph(page, dlg(), 'דלתות');
await page.waitForTimeout(300);
await dlg().getByLabel('שם הארגז').fill('ארון תנור');
await page.waitForTimeout(500);
ok('שם שמבטיח נישה נאמר', (await named()) === 1);
ok('ויש כפתור שבונה אותה', (await fixBtn().count()) === 1);

await fixBtn().first().click();
await page.waitForTimeout(500);
ok('ואחרי לחיצה — המבנה מספק, והאזהרה ירדה', (await named()) === 0 && (await warn()) === 0);

ok('בלי שגיאות דף', errs.length === 0, errs.join(' ; '));

console.log(out.join('\n'));
await browser.close();
process.exit(out.some((l) => l.startsWith('FAIL')) ? 1 : 0);

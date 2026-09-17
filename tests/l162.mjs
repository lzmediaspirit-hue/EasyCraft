import './_exit.mjs';
/*
 * שכבה 162 — מכשירי החשמל בקטגוריה משלהם בספרייה.
 *
 * תנור, מקרר ומדיח ישבו ב"תחתונים" וב"עמודות", מעורבבים בין
 * ארגזים שנבנים. הם אינם נבנים: אין להם דפנות שנחתכות, אין להם
 * מדפים וגב, והם אינם נספרים בייצור — מה שנקבע להם הוא המידה
 * והמקום. ומה שהיה חסר לגמרי: מיקרוגל, קולט אדים וכיריים.
 *
 * `groups` של חדר הוא גם סדר וגם *סינון*, ולכן קטגוריה שאינה
 * כתובה בחדר אינה מוצגת בו גם כשיש בה פריטים — וזו ההגירה שרצה
 * על התקנה קיימת.
 */
import { chromium } from 'playwright';
import { setup } from './mk.mjs';

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

const model = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const { SHIPPED_PRODUCTS, PRODUCTS_GENERATION } = await import('/src/catalog/products.ts' + v);
  const { SEED_ROOMS, GROUP_LABELS, GLYPH_GROUPS_FALLBACK } = await import('/src/catalog/rooms.ts' + v);
  const { glyphDef } = await import('/src/catalog/glyphList.ts' + v);
  const { applianceOf, APPLIANCES } = await import('/src/catalog/appliances.ts' + v);
  const { unitCaps } = await import('/src/catalog/capabilities.ts' + v);

  const appliances = SHIPPED_PRODUCTS.filter((p) => p.group === 'appliance');
  return {
    generation: PRODUCTS_GENERATION,
    label: GROUP_LABELS.appliance,
    inFallback: GLYPH_GROUPS_FALLBACK.includes('appliance'),
    roomsMissing: SEED_ROOMS.filter((r) => !r.groups.includes('appliance')).map((r) => r.id),
    names: appliances.map((p) => p.name),
    codes: appliances.map((p) => p.code),
    /* כל אחד מהם נקנה שלם: הוא אינו גוף שנחתך */
    allStandalone: appliances.every((p) => glyphDef(p.glyph).standalone === true),
    /* ולכן אין לו חלל פנימי שהתכנון יכול להכניס אליו משהו */
    noCavities: appliances.every((p) => unitCaps({
      glyph: p.glyph, widthMm: p.defaultWidthMm, heightMm: p.defaultHeightMm,
      depthMm: p.defaultDepthMm, socleMm: p.socleMm,
    }).cavities.length === 0),
    /* המידה שלו היא מידת התקן של אותו מכשיר */
    typed: appliances.map((p) => applianceOf({ glyph: p.glyph })?.type ?? null),
    stdWidths: Object.fromEntries(Object.entries(APPLIANCES).map(([k, s]) => [k, s.widthMm])),
    /* שלושת הוותיקים שמרו על המזהה שלהם, כדי שלא ישתכפלו */
    keptIds: ['k-base-oven', 'k-base-dw', 'k-tall-fridge']
      .every((id) => appliances.some((p) => p.id === id)),
  };
});

ok('לקטגוריה יש שם', model.label === 'מכשירי חשמל', model.label);
ok('והיא בסדר ברירת המחדל', model.inFallback);
ok('כל חדר מובנה מציג אותה', model.roomsMissing.length === 0, model.roomsMissing.join());
ok('שישה מכשירים', model.names.length === 6, model.names.join());
/* הכיריים ירדו לבקשת הבעלים: `hob` שנשאר הוא ארגז הכיריים, לא המכשיר */
for (const want of ['תנור', 'מיקרוגל', 'תנור ומיקרוגל', 'מקרר', 'מדיח', 'קולט אדים']) {
  ok(`"${want}" בקטגוריה`, model.names.includes(want));
}
ok('כולם מכשיר שנקנה שלם ולא גוף שנחתך', model.allStandalone);
ok('ולכן אין בהם חלל פנימי', model.noCavities);
ok('לכל אחד יש מידת תקן', model.typed.every((t) => t !== null), JSON.stringify(model.typed));
ok('מק״ט לכל אחד', model.codes.every((c) => !!c), model.codes.join());
ok('שלושת הוותיקים שמרו על המזהה', model.keptIds);
ok('דור המוצרים עלה', model.generation >= 3, String(model.generation));

/* ועכשיו במסך: הקטגוריה מוצגת, ובה שבעת המכשירים */
await setup(page, { name: 'מכשירים' });
const dlg = () => page.getByRole('dialog').last();
await page.getByRole('button', { name: /הוספת ארגז/ }).first().click();
await page.waitForTimeout(900);

const tab = dlg().getByRole('button', { name: 'מכשירי חשמל', exact: true });
ok('הלשונית מוצגת בספרייה', (await tab.count()) === 1);
await tab.first().click();
await page.waitForTimeout(600);

const shown = (await dlg().getByRole('button').allTextContents()).map((t) => t.trim());
for (const want of ['תנור', 'מיקרוגל', 'קולט אדים', 'מקרר', 'מדיח']) {
  ok(`"${want}" מוצג`, shown.some((t) => t.startsWith(want)), '');
}
/* והם אינם כפולים בקטגוריות הישנות */
await dlg().getByRole('button', { name: 'תחתונים', exact: true }).first().click();
await page.waitForTimeout(500);
const base = (await dlg().getByRole('button').allTextContents()).map((t) => t.trim());
ok('תנור אינו מופיע עוד ב"תחתונים"', !base.some((t) => t.startsWith('תנור')), '');
ok('ומדיח כך גם', !base.some((t) => t.startsWith('מדיח')), '');

ok('בלי שגיאות דף', errs.length === 0, errs.join(' ; '));

console.log(out.join('\n'));
await browser.close();
process.exit(out.some((l) => l.startsWith('FAIL')) ? 1 : 0);

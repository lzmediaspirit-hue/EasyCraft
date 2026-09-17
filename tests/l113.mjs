import './_exit.mjs';
/*
 * שכבה 113 — מכשיר חשמלי הוא מוצר ולא ארגז.
 *
 * תנור, מקרר ומדיח נכנסים למטבח מוכנים: אין להם דפנות שנחתכות, אין
 * להם מדפים וגב, ואין להם מגירות שמזמינים. מה שנקבע להם הוא המידה
 * והמקום. ארגז שנבנה סביב מכשיר — "ארון תנור עם מגירה" — הוא ארגז
 * לכל דבר, ונספר.
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

const r = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const B = await import('/src/costing/boards.ts' + v);
  const G = await import('/src/catalog/glyphList.ts' + v);
  const S = await import('/src/features/design/isoScene.ts' + v);
  const M = await import('/src/materials/materialsRepo.ts' + v);
  const settings = await M.settingsRepo.get();

  const mat = { id: 'm1', name: 'סנדוויץ׳', core: 'sandwich', thicknessMm: 17,
                sheetWidthMm: 1220, sheetHeightMm: 2440, sortOrder: 0, createdAt: 0, updatedAt: 0 };
  const base = (over = {}) => ({
    id: 'u1', projectId: 'p1', wallId: 'w1', catalogItemId: 'c1', name: 'פריט',
    glyph: 'doors', level: 'floor', xMm: 0, yMm: 0,
    widthMm: 600, heightMm: 880, depthMm: 580,
    carcassMaterialId: 'm1', frontMaterialId: 'm1', backMaterialId: 'm1',
    createdAt: 0, updatedAt: 0, ...over,
  });

  /*
   * אותו מכשיר בדיוק, עם כל מה שאפשר להדליק עליו בטעות: מגירות,
   * ידיות, לד ומדפים. שום אחד מהם אינו אמיתי בתנור.
   */
  const loaded = { drawers: 2, shelves: 3, handles: true, led: ['top'], doors: 1 };
  const oven = B.projectCosting([base({ glyph: 'oven', ...loaded })], [mat], settings);
  const fridge = B.projectCosting([base({ glyph: 'fridge', ...loaded })], [mat], settings);
  const dish = B.projectCosting([base({ glyph: 'dishwasher', ...loaded })], [mat], settings);
  /* ארגז אמיתי באותן הגדרות — בקרה חיובית */
  const cab = B.projectCosting([base({ glyph: 'drawers', ...loaded })], [mat], settings);

  const scene = (glyph) => {
    const walls = [{ id: 'w1', projectId: 'p1', index: 0, lengthMm: 3000, heightMm: 2600, features: [] }];
    const sc = S.buildScene({
      walls,
      units: [base({ glyph, ...loaded })],
      activeWallId: 'w1',
      selectedId: null,
      inside: false,
      finishHex: {},
      present: false,
      view: { yawDeg: 0, rise: 0.6 },
    });
    return sc.solids.filter((q) => q.unitId === 'u1').map((q) => String(q.key).replace('u1-', ''));
  };

  return {
    flags: G.GLYPHS.filter((g) => ['oven', 'fridge', 'dishwasher'].includes(g.key))
      .map((g) => `${g.key}:${g.standalone ? 'standalone' : '-'}`),
    oven: { sheets: oven.totalSheets, drawers: oven.drawers, handles: oven.handles, led: oven.ledMeters },
    fridge: { sheets: fridge.totalSheets, drawers: fridge.drawers },
    dish: { sheets: dish.totalSheets, drawers: dish.drawers },
    cab: { sheets: cab.totalSheets, drawers: cab.drawers },
    ovenSolids: scene('oven'),
    cabSolids: scene('drawers'),
  };
});

ok('שלושתם מסומנים כמוצר שנקנה', r.flags.every((f) => f.endsWith('standalone')), JSON.stringify(r.flags));
ok('תנור אינו נחתך מפלטות', r.oven.sheets === 0, JSON.stringify(r.oven));
ok('ואין לו מגירות, ידיות או לד', r.oven.drawers === 0 && r.oven.handles === 0 && r.oven.led === 0, JSON.stringify(r.oven));
ok('מקרר אינו נחתך', r.fridge.sheets === 0 && r.fridge.drawers === 0, JSON.stringify(r.fridge));
ok('מדיח אינו נחתך', r.dish.sheets === 0 && r.dish.drawers === 0, JSON.stringify(r.dish));
ok('ארגז באותן הגדרות כן נחתך ונספר', r.cab.sheets > 0 && r.cab.drawers > 0, JSON.stringify(r.cab));

/*
 * בתלת־ממד: המכשיר מצויר כמכשיר — גוף, חזית, וחלק אחד לפחות
 * שמזהה אותו — ובלי דפנות, מדפים וגב.
 */
ok('המכשיר מצויר כמוצר',
  r.ovenSolids.includes('appliance') && r.ovenSolids.some((id) => id.startsWith('glass')),
  JSON.stringify(r.ovenSolids));
ok(
  'ואין לו גוף ארון',
  !r.ovenSolids.some((id) => ['l', 'r', 'b', 't', 'bk'].includes(id)),
  JSON.stringify(r.ovenSolids),
);
ok(
  'לארגז רגיל כן יש גוף',
  r.cabSolids.some((id) => ['l', 'r', 'b', 't'].includes(id)),
  JSON.stringify(r.cabSolids.slice(0, 10)),
);

/*
 * המכשיר בשמו, והארגז בשמו.
 *
 * המכשיר אינו יושב בספרייה אלא במוצרי המערכת: הספרייה היא של
 * הנגרייה ומוחלפת כשהיא מוחלפת, והמכשירים נוסעים לצידה. הארגז
 * שנבנה סביב המכשיר הוא ארגז של הספרייה, ושם הוא נבדק.
 */
const lib = await page.evaluate(async () => {
  const bust = '?v=' + Date.now();
  const { SHIPPED_LIBRARY } = await import('/src/catalog/shipped.ts' + bust);
  const { SHIPPED_PRODUCTS } = await import('/src/catalog/products.ts' + bust);
  const names = [...SHIPPED_LIBRARY, ...SHIPPED_PRODUCTS].map((i) => i.name);
  const dup = names.filter((n, i) => names.indexOf(n) !== i);
  return { names, products: SHIPPED_PRODUCTS.map((i) => i.name), dup: [...new Set(dup)] };
});
for (const n of ['תנור', 'מקרר', 'מדיח']) {
  ok(`"${n}" הוא מוצר של המערכת`, lib.products.includes(n), lib.products.join(' · '));
}
for (const n of ['ארון תנור עם מגירה', 'ארון תנור תחתון']) {
  ok(`"${n}" קיים בספרייה`, lib.names.includes(n));
}
/*
 * שני ארגזים באותו שם הם ארגז אחד שאי אפשר לבחור בו: ברשימה הם
 * נראים זהים, וההבדל — רגליים, מפלס, מידה — מתגלה רק אחרי ההנחה.
 */
ok('אין שני פריטים באותו שם', lib.dup.length === 0, JSON.stringify(lib.dup));

await browser.close();
for (const e of errs) out.push(e);
console.log(out.join('\n'));
const fail = out.filter((l) => l.startsWith('FAIL') || l.startsWith('pageerror')).length;
console.log(`${out.length - fail} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);

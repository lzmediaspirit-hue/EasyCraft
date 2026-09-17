import './_exit.mjs';
/*
 * שכבה 141 — B01: החלפת איור אינה נוגעת בפנים ובניסור.
 *
 * הבדיקה משווה את האזורים ואת רשימת החיתוך לפני ואחרי, ולא רק את
 * מה שהמסך אומר: המרה שקרתה בשקט נראית זהה עד שמסתכלים על מה
 * שייחתך בנגרייה.
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
await page.getByLabel('שם משתמש').fill('admin');
await page.getByLabel('סיסמה').fill('admin2026');
await page.getByRole('button', { name: 'כניסה' }).first().click();
await page.waitForTimeout(1800);

/*
 * כל מעבר בין איורים של גוף ארון, על ארגז המגירות שבספרייה עצמה.
 * מה שנבדק הוא האזורים ורשימת החיתוך — התוצאה בנגרייה.
 */
const sweep = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const { catalogRepo } = await import('/src/catalog/catalogRepo.ts' + v);
  const { convertZones } = await import('/src/catalog/saveGate.ts' + v);
  const { unitParts } = await import('/src/costing/boards.ts' + v);
  const { settingsRepo } = await import('/src/materials/materialsRepo.ts' + v);

  const item = (await catalogRepo.all()).find((i) => i.name === 'ארון תחתון מגירות');
  const settings = await settingsRepo.get();
  const asUnit = (glyph) => ({
    id: 'u', projectId: 'p', wallId: 'w', catalogItemId: item.id, name: item.name,
    glyph, level: item.level, xMm: 0, yMm: 0,
    widthMm: item.defaultWidthMm, heightMm: item.defaultHeightMm, depthMm: item.defaultDepthMm,
    socleMm: item.socleMm, zones: item.zones, doors: item.doors, drawers: item.drawers,
    drawerCols: item.drawerCols, drawerStyle: item.drawerStyle, backKind: item.backKind,
    createdAt: 0, updatedAt: 0,
  });
  const cut = (u) =>
    unitParts(u, settings)
      .map((p) => `${p.label}:${p.qty}:${Math.round(p.widthMm)}x${Math.round(p.heightMm)}`)
      .sort()
      .join('|');

  const base = asUnit(item.glyph);
  const baseCut = cut(base);
  const baseKinds = (item.zones ?? []).map((z) => z.kind).join();

  /* איורים של גוף ארון — כולם אמורים להשאיר הכול כפי שהוא */
  const carcass = ['doors', 'open', 'shelves', 'hang', 'glass', 'lift', 'mirror'];
  const moved = [];
  for (const g of carcass) {
    const c = convertZones(base, g);
    const after = { ...base, glyph: g, ...(c.zones ? { zones: c.zones } : {}) };
    if (c.note !== null || (c.zones && c.zones.map((z) => z.kind).join() !== baseKinds)) {
      moved.push(`${g}: ${c.note ?? 'zones changed'}`);
    }
    if (cut(after) !== baseCut) moved.push(`${g}: cutlist`);
  }

  /* ומוצר אחר — לוח בודד ומכשיר — כן מרוקן, ואומר זאת */
  const toBoard = convertZones(base, 'slab');
  const toAppliance = convertZones(base, 'fridge');

  return {
    item: item.name,
    baseKinds,
    drawerParts: unitParts(base, settings).filter((p) => /מגיר/.test(p.label ?? '')).length,
    moved,
    board: { zones: toBoard.zones?.length, note: toBoard.note },
    appliance: { zones: toAppliance.zones?.length, note: toAppliance.note },
  };
});

ok('נבחר ארגז מגירות מהספרייה', /מגירות/.test(sweep.item), sweep.item);
ok('ויש לו מגירות בניסור', sweep.drawerParts > 0, String(sweep.drawerParts));
ok('אף איור של גוף ארון אינו נוגע בפנים ובניסור',
  sweep.moved.length === 0, sweep.moved.join(' · '));
ok('מעבר ללוח בודד כן מרוקן, ואומר זאת',
  sweep.board.zones === 0 && /פנים/.test(sweep.board.note ?? ''), JSON.stringify(sweep.board));
ok('וכך גם מעבר למכשיר קנוי',
  sweep.appliance.zones === 0 && !!sweep.appliance.note, JSON.stringify(sweep.appliance));

/* והעורך המהיר שואל את אותה שאלה: מה אפשר לבנות, לא מה מצויר */
const quick = await page.evaluate(async () => {
  const { constructionCaps } = await import('/src/catalog/construction.ts?v=' + Date.now());
  const of = (g) => {
    const c = constructionCaps(g);
    return [!!c.doors, !!c.drawers, !!c.shelves].join();
  };
  return { doors: of('doors'), shelves: of('shelves'), slab: of('slab'), fridge: of('fridge') };
});
ok('גוף ארון יודע הכול, בכל איור',
  quick.doors === 'true,true,true' && quick.shelves === 'true,true,true', JSON.stringify(quick));
ok('ולוח ומכשיר אינם יודעים דבר',
  quick.slab === 'false,false,false' && quick.fridge === 'false,false,false', JSON.stringify(quick));

await browser.close();
for (const e of errs) out.push('FAIL ' + e);
console.log(out.join('\n'));
const fail = out.filter((l) => l.startsWith('FAIL')).length;
console.log(`${out.length - fail} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);

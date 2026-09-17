import { chromium } from 'playwright';
const EXE = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const b = await chromium.launch({ executablePath: EXE });
const page = await b.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
const out = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const { SHIPPED_LIBRARY } = await import('/src/catalog/shipped.ts' + v);
  const { productionGap } = await import('/src/catalog/construction.ts' + v);
  const { itemSpec } = await import('/src/catalog/roles.ts' + v);
  const { unitCaps } = await import('/src/catalog/capabilities.ts' + v);
  const rows = [];
  for (const it of SHIPPED_LIBRARY) {
    const spec = itemSpec(it);
    const why = productionGap(spec);
    if (why) rows.push({ code: it.code, name: it.name, glyph: it.glyph, why, caps: unitCaps(spec) });
  }
  return { total: SHIPPED_LIBRARY.length, flagged: rows.length, rows };
});
console.log(JSON.stringify(out, null, 1));
await b.close();

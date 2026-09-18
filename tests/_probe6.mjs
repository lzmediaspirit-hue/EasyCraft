import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await b.newPage();
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
const r = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const { SHIPPED_LIBRARY } = await import('/src/catalog/shipped.ts' + v);
  const { SHIPPED_PRODUCTS } = await import('/src/catalog/products.ts' + v);
  const { itemSpec } = await import('/src/catalog/roles.ts' + v);
  const { unitCaps, capsProvide, CAPABILITY_LABELS } = await import('/src/catalog/capabilities.ts' + v);
  const libIds = new Set(SHIPPED_LIBRARY.map((i) => i.id));
  const all = [...SHIPPED_LIBRARY, ...SHIPPED_PRODUCTS.filter((p) => !libIds.has(p.id))];
  const caps = Object.keys(CAPABILITY_LABELS);
  const out = {};
  for (const c of caps) {
    out[c] = all.filter((i) => { try { return capsProvide(unitCaps(itemSpec(i)), c); } catch { return false; } }).map((i) => i.code);
  }
  return { caps: out, ec57: capsProvide(unitCaps(itemSpec(SHIPPED_LIBRARY.find((i) => i.code === 'EC-057'))), 'oven') };
});
console.log(JSON.stringify(r, null, 1));
await b.close();

import './_exit.mjs';
/*
 * שכבה 144 — B04: הייבוא כפוף לאותו חוזה זהות כמו השמירה.
 *
 * הייבוא כותב ב-bulkPut ולכן אינו עובר דרך `saveCustom`, ושני
 * הכללים שנאכפים שם לא נאכפו כאן: קובץ עם שני שמות שנבדלים ברווח
 * נכנס כשניים, וארגז אחר שנשא מק״ט קיים נכתב על הארגז שהחזיק בו.
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

const res = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const { catalogRepo } = await import('/src/catalog/catalogRepo.ts' + v);
  const { exportCabinets, importCabinets } = await import('/src/db/cabinetPack.ts' + v);
  const { cabinetNameKey } = await import('/src/catalog/names.ts' + v);

  const base = (await catalogRepo.all()).find((i) => i.code === 'EC-056');
  const before = (await catalogRepo.all()).length;

  /* --- שם שנבדל רק ברווח --- */
  const pack = await exportCabinets();
  pack.tables.catalog.push({
    ...base,
    id: crypto.randomUUID(),
    code: 'QA-771',
    /* אותו שם בדיוק, רק עם רווח כפול ורווח בקצה */
    name: `  ${base.name.replace(' ', '  ')} `,
  });
  const r1 = await importCabinets(pack, 'merge');
  const all1 = await catalogRepo.all();
  const keys = all1.map((i) => cabinetNameKey(i.name));

  /* --- מק״ט של ארגז אחר --- */
  const pack2 = await exportCabinets();
  pack2.tables.catalog = [
    {
      ...base,
      id: crypto.randomUUID(),
      name: 'QA ארגז אחר לגמרי',
      code: 'EC-056',
      defaultWidthMm: 777,
      widthOptionsMm: [777],
    },
  ];
  const r2 = await importCabinets(pack2, 'merge');
  const owner = (await catalogRepo.all()).find((i) => i.code === 'EC-056');
  const intruder = (await catalogRepo.all()).find((i) => i.name === 'QA ארגז אחר לגמרי');

  /* --- וייבוא חוזר של אותה ספרייה עדיין אינו משכפל --- */
  const pack3 = await exportCabinets();
  const n3 = (await catalogRepo.all()).length;
  pack3.tables.catalog = pack3.tables.catalog.map((i) => ({ ...i, id: crypto.randomUUID() }));
  const r3 = await importCabinets(pack3, 'merge');

  return {
    before,
    r1: { added: r1.added, renamed: r1.renamed },
    dupNames: keys.length - new Set(keys).size,
    r2: { added: r2.added, replaced: r2.replaced, recoded: r2.recoded },
    owner: { name: owner?.name, w: owner?.defaultWidthMm },
    intruder: { code: intruder?.code, w: intruder?.defaultWidthMm },
    repeat: { added: r3.added, total: (await catalogRepo.all()).length, was: n3 },
  };
});

ok('שם שנבדל ברווח אינו נכנס כשם שני', res.dupNames === 0, String(res.dupNames));
ok('והוא קיבל שם פנוי, ונאמר כמה', res.r1.renamed === 1, JSON.stringify(res.r1));

ok('ארגז אחר במק״ט קיים אינו דורס את בעל המק״ט',
  res.owner.w !== 777, JSON.stringify(res.owner));
ok('והוא נכנס כארגז נפרד במק״ט פנוי',
  res.intruder.w === 777 && res.intruder.code !== 'EC-056', JSON.stringify(res.intruder));
ok('ונאמר שהמק״ט הוחלף', res.r2.recoded === 1, JSON.stringify(res.r2));

ok('ייבוא חוזר במזהים אחרים עדיין אינו משכפל',
  res.repeat.total === res.repeat.was && res.repeat.added === 0, JSON.stringify(res.repeat));

await browser.close();
for (const e of errs) out.push('FAIL ' + e);
console.log(out.join('\n'));
const fail = out.filter((l) => l.startsWith('FAIL')).length;
console.log(`${out.length - fail} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);

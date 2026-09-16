import './_exit.mjs';
/*
 * שכבה 131 — R09/R13: מוצרים חדשים למי שכבר התקין, ומחיר מכירה חסר.
 *
 * R09 — שדרוג אמיתי השאיר 61 פריטים בלי האי והמדף: הזריעה רצה פעם
 *       אחת, הסימון "הספרייה נזרעה" חסם אותה לתמיד, ומי שהתקין לפני
 *       שהמוצרים נוספו נשאר בלעדיהם — בזמן שהתקנה חדשה קיבלה אותם.
 * R13 — פרזול בכמות 2, עלות 100 ומחיר לקוח ריק נתן מחיר לקוח 0 עם
 *       `noPrice=false`: שורה שאיש לא תמחר נראתה מתומחרת, ובסיכום
 *       הופיע מקף במקום אזהרה.
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
const ok = (name, cond, extra = '') => {
  const line = `${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' | ' + extra : ''}`;
  out.push(line);
  console.log(line);
};

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });

/* ------------------------------------------------------------------ */
/* R13 — שני חוסרים שונים                                              */
/* ------------------------------------------------------------------ */

const money = await page.evaluate(async () => {
  const B = await import('/src/costing/boards.ts');
  const settings = {
    sheetWidthMm: 2440, sheetHeightMm: 1220, kerfMm: 4, carcassThicknessMm: 18,
    yieldPct: 85, backGrooveMm: 8, frontGapMm: 3,
    accessories: { drawerFactory: 10, drawerConsumer: 40, ledFactory: 0, ledConsumer: 0, liftFactory: 20, liftConsumer: 80 },
    extras: [], glassFactoryPerM2: 0, glassConsumerPerM2: 0, vatPct: 18,
    edgeFactoryPerM: 0, edgeConsumerPerM: 0,
    defaults: { socleMm: 100, counterTopMm: 30, baseDepthMm: 580, upperDepthMm: 320, upperBottomMm: 1500, wallLengthMm: 3000, wallHeightMm: 2600, backKind: 'thin', drawerBox: 'metal' },
    updatedAt: 0, id: 'app',
  };
  const unit = (hardware) => ({
    id: 'u1', projectId: 'p1', wallId: 'w1', catalogItemId: 'c1',
    name: 'ארגז', glyph: 'doors', level: 'floor',
    xMm: 0, yMm: 0, widthMm: 600, heightMm: 880, depthMm: 580, doors: 2,
    hardware, createdAt: 0, updatedAt: 0,
  });
  const row = (over) => ({ id: 'h1', name: 'מנגנון', qty: 2, unit: 'יח׳', ...over });
  const line = (hardware) =>
    B.projectCosting([unit(hardware)], [], settings, [], []).accessories.find(
      (a) => a.label === 'מנגנון',
    );

  return {
    costOnly: line([row({ factoryPrice: 100 })]),
    sellOnly: line([row({ consumerPrice: 150 })]),
    neither: line([row({})]),
    both: line([row({ factoryPrice: 100, consumerPrice: 150 })]),
    explicitZero: line([row({ factoryPrice: 0, consumerPrice: 0 })]),
    notANumber: line([row({ factoryPrice: 100, consumerPrice: Number.NaN })]),
  };
});

const m = money;
ok('cost without a selling price is flagged', m.costOnly?.noPrice === true, JSON.stringify(m.costOnly));
ok('and its cost is not flagged', m.costOnly?.noCost === false, JSON.stringify(m.costOnly));
ok('a selling price without a cost is flagged the other way', m.sellOnly?.noPrice === false && m.sellOnly?.noCost === true, JSON.stringify(m.sellOnly));
ok('and it still charges the customer', m.sellOnly?.consumerTotal === 300, String(m.sellOnly?.consumerTotal));
ok('neither price flags both', m.neither?.noPrice === true && m.neither?.noCost === true, JSON.stringify(m.neither));
ok('both prices flag nothing', m.both?.noPrice === false && m.both?.noCost === false, JSON.stringify(m.both));
ok('and it charges what it should', m.both?.consumerTotal === 300 && m.both?.factoryTotal === 200, JSON.stringify(m.both));
ok('a deliberate zero is a real price', m.explicitZero?.noPrice === false && m.explicitZero?.noCost === false, JSON.stringify(m.explicitZero));
ok('a number that is not a number counts as missing', m.notANumber?.noPrice === true, JSON.stringify(m.notANumber));
ok('and never leaks NaN into the total', Number.isFinite(m.notANumber?.consumerTotal), String(m.notANumber?.consumerTotal));

/* ------------------------------------------------------------------ */
/* R09 — שדרוג ממוקד                                                   */
/* ------------------------------------------------------------------ */

await setup(page, { name: 'שדרוג בע״מ' });
await page.waitForTimeout(900);

const upgrade = await page.evaluate(async () => {
  const { db } = await import('/src/db/db.ts');
  const { addSystemProducts } = await import('/src/catalog/catalogRepo.ts');
  const { settingsRepo } = await import('/src/materials/materialsRepo.ts');
  const { eraseIds } = await import('/src/db/rows.ts');

  const fresh = (await db.catalog.toArray()).filter((i) => i.id.startsWith('product-'));

  /*
   * התקנה ישנה: הספרייה סומנה כנזרעה, המוצרים החדשים אינם בה,
   * והדור שנרשם הוא 0 — בדיוק המצב שהביקורת שחזרה משדרוג 23→27.
   */
  await db.catalog.bulkDelete(fresh.map((i) => i.id));
  await settingsRepo.save({ productsGeneration: 0 });
  const missing = (await db.catalog.toArray()).filter((i) => i.id.startsWith('product-')).length;

  const added = await addSystemProducts();
  const now = (await db.catalog.toArray()).filter((i) => i.id.startsWith('product-'));
  const libraryTotal = (await db.catalog.toArray()).length;

  /* הרצה שנייה אינה מוסיפה שוב */
  const again = await addSystemProducts();

  /* מה שנמחק בכוונה אינו חוזר */
  await eraseIds(db.catalog, ['product-shelf']);
  await settingsRepo.save({ productsGeneration: 0 });
  const afterErase = await addSystemProducts();
  const shelfBack = !!(await db.catalog.get('product-shelf'));

  await db.tombstones.clear();
  return {
    missing,
    added,
    have: now.map((i) => i.id).sort(),
    owned: now.every((i) => i.workshopId === 'workshop-local' && i.rev === 1),
    libraryTotal,
    again,
    afterErase,
    shelfBack,
  };
});

ok('an old install starts without the new products', upgrade.missing === 0, String(upgrade.missing));
ok('the targeted upgrade adds them', upgrade.added === 2, String(upgrade.added));
ok('and they are the island and the shelf', upgrade.have.join() === 'product-island,product-shelf', upgrade.have.join());
ok('owned and versioned like any row', upgrade.owned, String(upgrade.owned));
ok('running it again adds nothing', upgrade.again === 0, String(upgrade.again));
ok('what was deliberately deleted does not come back', upgrade.afterErase === 0 && !upgrade.shelfBack, `${upgrade.afterErase} / ${upgrade.shelfBack}`);

ok('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
const bad = out.filter((l) => l.startsWith('FAIL'));
console.log(bad.length ? `\n${bad.length} נפלו` : '\nהכול עבר');
if (bad.length) process.exitCode = 1;
await browser.close();

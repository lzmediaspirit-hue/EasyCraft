import './_exit.mjs';
/*
 * שכבה 123 — פרזול לארגז.
 *
 * רשימת הזמנה ולא רשימת קטלוג: כל שורה נושאת את המחיר שהיה
 * כשנבחרה. "מנגנון מיקרו" הוא השם שנמסר, ואין לו ספק, דגם או
 * מידת התקנה — מה שחסר נאמר ולא מומצא.
 */
import { chromium } from 'playwright';
import { setup, addNamed } from './mk.mjs';

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
const btn = (re) => page.getByRole('button', { name: re }).first();

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });

/* ------------------------------------------------------------------ */
/* החשבון: כפל חיוב, מחיר חסר, ותמונת מצב                              */
/* ------------------------------------------------------------------ */

const math = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const H = await import('/src/catalog/hardware.ts' + v);
  const B = await import('/src/costing/boards.ts' + v);

  const micro = H.SHIPPED_HARDWARE.find((s) => s.name === 'מנגנון מיקרו');
  const blind = H.SHIPPED_HARDWARE.find((s) => s.name === 'מנגנון מגירות לפינה מתה');
  const row = H.fromSpec(micro, 2);

  const unit = (over) => ({
    id: 'u1', projectId: 'p1', wallId: 'w1', catalogItemId: 'c1',
    name: 'ארגז', glyph: 'doors', level: 'floor',
    xMm: 0, yMm: 0, widthMm: 600, heightMm: 880, depthMm: 580,
    doors: 2, createdAt: 0, updatedAt: 0, ...over,
  });

  const settings = {
    sheetWidthMm: 2440, sheetHeightMm: 1220, kerfMm: 4, carcassThicknessMm: 18,
    yieldPct: 85, backGrooveMm: 8, frontGapMm: 3,
    accessories: { drawerFactory: 10, drawerConsumer: 40, ledFactory: 0, ledConsumer: 0, liftFactory: 20, liftConsumer: 80 },
    extras: [], glassFactoryPerM2: 0, glassConsumerPerM2: 0, vatPct: 18,
    edgeFactoryPerM: 0, edgeConsumerPerM: 0,
    defaults: { socleMm: 100, counterTopMm: 30, baseDepthMm: 580, upperDepthMm: 320, upperBottomMm: 1500, wallLengthMm: 3000, wallHeightMm: 2600, backKind: 'thin', drawerBox: 'metal' },
    updatedAt: 0, id: 'app',
  };
  const cost = (units) => B.projectCosting(units, [], settings, [], []);

  /* מנגנון קלאפה אמיתי, ולצדו פרזול ביד שבא במקומו */
  const lift = unit({ opening: 'lift' });
  const auto = cost([lift]).accessories.find((a) => a.label === 'מנגנוני קלאפה');
  const replaced = cost([
    { ...lift, hardware: [{ id: 'h1', name: 'מנגנון מיקרו', qty: 1, unit: 'יח׳', replaces: 'lift', consumerPrice: 120 }] },
  ]);
  const both = cost([{ ...lift, hardware: [{ id: 'h2', name: 'תוספת', qty: 1, unit: 'יח׳', consumerPrice: 50 }] }]);

  /* מחיר חסר אינו אפס */
  const noPrice = cost([unit({ hardware: [H.fromSpec(blind, 1)] })]);
  const priced = cost([unit({ hardware: [{ ...H.fromSpec(blind, 1), consumerPrice: 0 }] })]);

  return {
    rowFromSpec: { name: row.name, qty: row.qty, unit: row.unit, price: row.consumerPrice ?? null },
    missing: H.missingFacts(row),
    autoLift: auto?.qty ?? 0,
    replacedLift: replaced.accessories.find((a) => a.label === 'מנגנוני קלאפה')?.qty ?? 0,
    replacedOwn: replaced.accessories.find((a) => a.label === 'מנגנון מיקרו')?.consumerTotal ?? 0,
    bothLift: both.accessories.find((a) => a.label === 'מנגנוני קלאפה')?.qty ?? 0,
    noPriceFlag: noPrice.accessories.find((a) => a.label.includes('פינה מתה'))?.noPrice ?? null,
    zeroFlag: priced.accessories.find((a) => a.label.includes('פינה מתה'))?.noPrice ?? null,
  };
});

ok('the shipped list carries the name as given', math.rowFromSpec.name === 'מנגנון מיקרו', math.rowFromSpec.name);
ok('a new row takes the quantity asked for', math.rowFromSpec.qty === 2, String(math.rowFromSpec.qty));
ok('and it has no invented price', math.rowFromSpec.price === null, String(math.rowFromSpec.price));
ok('what is missing is named', math.missing.join() === 'ספק,דגם,מחיר', math.missing.join());

/* שתי דלתות קלאפה — שני מנגנונים, אחד לכל דלת */
ok('a lift cabinet counts a mechanism per door', math.autoLift === 2, String(math.autoLift));
ok('hardware that replaces it removes the automatic row', math.replacedLift === 0, String(math.replacedLift));
ok('and charges its own price once', math.replacedOwn === 120, String(math.replacedOwn));
ok('hardware that replaces nothing leaves the automatic count', math.bothLift === math.autoLift, `${math.bothLift} / ${math.autoLift}`);

ok('a row with no price is flagged, not counted as free', math.noPriceFlag === true, String(math.noPriceFlag));
ok('and a deliberate zero is not flagged', math.zeroFlag === false, String(math.zeroFlag));

/* ------------------------------------------------------------------ */
/* המסך                                                                */
/* ------------------------------------------------------------------ */

await setup(page, { name: 'פרזול בע״מ' });
await addNamed(page, /^ארגז/);
await page.waitForTimeout(800);

await btn(/עריכה מתקדמת/).click();
await page.waitForTimeout(700);
const panel = await page.innerText('body');
ok('advanced editing has a hardware section', /פרזול/.test(panel));

await btn(/הוספת פרזול/).click();
await page.waitForTimeout(500);
ok('the shop list is offered', (await page.getByRole('button', { name: 'מנגנון מיקרו' }).count()) > 0);
ok('and a custom item too', (await page.getByRole('button', { name: 'פריט משלי' }).count()) > 0);
await page.getByRole('button', { name: 'מנגנון מיקרו' }).first().click();
await page.waitForTimeout(800);

const saved = await page.evaluate(async () => {
  const { db } = await import('/src/db/db.ts?v=' + Date.now());
  const u = (await db.units.toArray())[0];
  return u.hardware ?? [];
});
ok('the row is stored on the cabinet', saved.length === 1 && saved[0].name === 'מנגנון מיקרו', JSON.stringify(saved));
ok('with its unit', saved[0]?.unit === 'יח׳', String(saved[0]?.unit));

const shown = await page.innerText('body');
ok('the screen says what is missing', /חסרים נתוני התאמה/.test(shown));

/* מחיר ברשימת העסק משתנה — ההצעה שכבר נשמרה אינה משתנה איתו */
await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const { settingsRepo } = await import('/src/materials/materialsRepo.ts' + v);
  const { db } = await import('/src/db/db.ts' + v);
  const u = (await db.units.toArray())[0];
  await db.units.update(u.id, { hardware: [{ ...u.hardware[0], consumerPrice: 90 }] });
  await settingsRepo.save({
    hardware: [{ id: 'hw-micro', name: 'מנגנון מיקרו', unit: 'יח׳', consumerPrice: 250 }],
  });
});
await page.waitForTimeout(700);
const afterCatalog = await page.evaluate(async () => {
  const { db } = await import('/src/db/db.ts?v=' + Date.now());
  return (await db.units.toArray())[0].hardware[0].consumerPrice;
});
ok('a catalog price change does not touch a saved row', afterCatalog === 90, String(afterCatalog));

ok('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
const bad = out.filter((l) => l.startsWith('FAIL'));
console.log(bad.length ? `\n${bad.length} נפלו` : '\nהכול עבר');
await browser.close();

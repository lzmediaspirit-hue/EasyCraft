/* שכבה 100 — כסף: מע״מ, יתרה לגבייה, תשלום שהתקבל, ומחירי פרויקט בשכפול */
import { chromium } from 'playwright';
import { setup } from './mk.mjs';
const SP = new URL('shots/', import.meta.url).pathname;

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage({ viewport: { width: 400, height: 840 } });
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + String(e).slice(0, 200)));
const btn = (re) => page.getByRole('button', { name: re }).first();
const dlg = () => page.getByRole('dialog').last();

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });

/* --- N5 + N6: המחיר, המע״מ והיתרה, על מספרים --- */
const pure = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const P = await import('/src/costing/pricing.ts' + v);
  const out = [];
  const ok = (name, cond, extra = '') => out.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' | ' + extra : ''}`);

  const costing = { consumerTotal: 700, vatPct: 10, vatAmount: 70, consumerWithVat: 770 };
  const base = { id: 'p', customerId: 'c', name: 'בדיקה', roomKind: 'kitchen', createdAt: 0, updatedAt: 0 };

  const byMaterials = P.projectQuote({ ...base, pricingMode: 'materials' }, [], costing);
  ok('לפי חומרים — לתשלום כולל מע״מ', byMaterials.amount === 770, String(byMaterials.amount));
  ok('ולפניו 700', byMaterials.beforeVat === 700 && byMaterials.vatAmount === 70, `${byMaterials.beforeVat}+${byMaterials.vatAmount}`);

  const incl = P.projectQuote({ ...base, pricingMode: 'manual', manualPrice: 1100 }, [], costing);
  ok('מחיר קבוע נחשב ככולל מע״מ כברירת מחדל', incl.amount === 1100, String(incl.amount));
  ok('והפירוק שלו נכון', incl.beforeVat === 1000 && incl.vatAmount === 100, `${incl.beforeVat}+${incl.vatAmount}`);

  const excl = P.projectQuote(
    { ...base, pricingMode: 'manual', manualPrice: 1000, priceIncludesVat: false },
    [], costing,
  );
  ok('ומי שמקליד לפני מע״מ מקבל תוספת', excl.amount === 1100, String(excl.amount));

  /* N6 — פרויקט מכור בלי פריסת תשלומים */
  const sold = { ...base, soldAt: 1 };
  const none = P.paymentStatus(sold, 1000);
  ok('מכור בלי פריסה — נותר מלוא המחיר', none.due === 1000, String(none.due));
  ok('ואינו נחשב משולם', none.fullyPaid === false);
  const half = P.paymentStatus({ ...sold, payments: [{ id: 'a', amount: 400, paidAt: 2 }] }, 1000);
  ok('תשלום חלקי מוריד מהיתרה', half.due === 600 && half.paid === 400, `${half.due}/${half.paid}`);
  ok('ומה שנפרס נספר בנפרד', half.scheduled === 400, String(half.scheduled));
  const full = P.paymentStatus({ ...sold, payments: [{ id: 'a', amount: 1000, paidAt: 2 }] }, 1000);
  ok('תשלום מלא סוגר את החוב', full.due === 0 && full.fullyPaid === true);
  const draft = P.paymentStatus({ ...base }, 1000);
  ok('פרויקט שלא נמכר אינו חייב כלום', draft.total === 0 && draft.due === 0);
  return out;
});

/* --- N4: בחירה חוזרת בתוכנית התשלומים אינה מוחקת תשלום שהתקבל --- */
await setup(page, { name: 'כסף' });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
const projectId = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const { db } = await import('/src/db/db.ts' + v);
  const { projectsRepo } = await import('/src/features/projects/projectsRepo.ts' + v);
  const id = (await db.projects.toArray())[0].id;
  /* מחיר קבוע, כדי שהמכירה תהיה מספר ידוע ולא תלויה בגוונים */
  await projectsRepo.update(id, { pricingMode: 'manual', manualPrice: 1000 });
  return id;
});

const ui = [];
const okUi = (name, cond, extra = '') => ui.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' | ' + extra : ''}`);

await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1600);
await btn(/כסף/).click(); await page.waitForTimeout(900);
await btn(/^מכירה$/).click(); await page.waitForTimeout(900);
const sale = dlg();
await sale.getByRole('button', { name: 'תשלום אחד' }).click(); await page.waitForTimeout(500);
const mark = () => sale.getByRole('button', { name: /סימון .* כשולם/ }).first();
await mark().click(); await page.waitForTimeout(500);
okUi('התשלום סומן כשולם', (await mark().getAttribute('aria-pressed')) === 'true');
await sale.getByRole('button', { name: 'תשלום אחד' }).click(); await page.waitForTimeout(600);
okUi(
  'בחירה חוזרת באותה תוכנית אינה מוחקת אותו',
  (await mark().getAttribute('aria-pressed')) === 'true',
  await sale.innerText().then((t) => t.slice(0, 0)),
);
await sale.getByRole('button', { name: 'בתשלומים' }).click(); await page.waitForTimeout(600);
okUi('ומעבר לתוכנית אחרת שומר את מה שכבר שולם',
  (await mark().getAttribute('aria-pressed')) === 'true');
okUi('והמחיר מוצג כולל מע״מ', /כולל מע/.test(await sale.innerText()));
await page.screenshot({ path: SP + 'L100-1-payments.png' });
await page.keyboard.press('Escape'); await page.waitForTimeout(500);

/* --- מחירי פרויקט עוברים בשכפול --- */
const dup = await page.evaluate(async (id) => {
  const v = '?v=' + Date.now();
  const { projectPricesRepo } = await import('/src/materials/materialsRepo.ts' + v);
  const { projectsRepo } = await import('/src/features/projects/projectsRepo.ts' + v);
  const { db } = await import('/src/db/db.ts' + v);
  await projectPricesRepo.set(id, 'finish:material', { factoryPrice: 111, consumerPrice: 222 });
  const copy = await projectsRepo.duplicate(id, 'עותק');
  const rows = await db.projectPrices.where('projectId').equals(copy.id).toArray();
  return { n: rows.length, consumer: rows[0]?.consumerPrice, key: rows[0]?.lineKey, sameId: rows[0]?.id };
}, projectId);
okUi('שכפול פרויקט מעתיק את המחירים המיוחדים', dup.n === 1 && dup.consumer === 222, JSON.stringify(dup));
okUi('ומפתח השורה נשמר', dup.key === 'finish:material', String(dup.key));

const all = [...pure, ...ui, ...errs.map((e) => 'FAIL ' + e)];
for (const l of all) console.log(l);
const bad = all.filter((l) => l.startsWith('FAIL')).length;
console.log(bad ? `${bad} fail of ${all.length}` : `all ${all.length} pass`);
await browser.close();
process.exit(bad ? 1 : 0);

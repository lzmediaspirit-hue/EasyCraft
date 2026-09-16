import './_exit.mjs';
import { chromium } from 'playwright';
import { setup, addUnit } from './mk.mjs';
const SP = new URL('shots/', import.meta.url).pathname;
const fail = [];
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail.push(m); };
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await b.newPage({ viewport: { width: 400, height: 840 } });
const errs = [];
page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
page.on('pageerror', (e) => errs.push(String(e)));
const btn = (re) => page.getByRole('button', { name: re }).first();

await setup(page, { name: 'קושרות' });
await addUnit(page, 0);
await page.waitForTimeout(600);
// ארבע דלתות -> קושרת אחת אוטומטית
await page.getByRole('button', { name: '4', exact: true }).first().click();
await page.waitForTimeout(500);
const grp = () => page.locator('svg [data-unit-id]').first();
const verticals = () => grp().evaluate((g) =>
  [...g.querySelectorAll('line')].filter((l) => l.x1.baseVal.value === l.x2.baseVal.value).length);
const vFront = await verticals();
await btn(/הסתרת חזיתות/).click(); await page.waitForTimeout(700);
const vInside = await verticals();
ok(vInside >= 1, `קושרת אנכית נראית בתצוגת פנים (חזית ${vFront}, פנים ${vInside})`);
await page.screenshot({ path: SP + '/L31-4-dividers.png' });

// ביטול הצמדה לרצפה מאפס את גובה הרגליים
await btn(/הצגת חזיתות/).click(); await page.waitForTimeout(500);
const legs = page.getByLabel(/רגליים|סוקל/).first();
const hadLegs = await legs.count();
const legBefore = hadLegs ? await legs.inputValue() : null;
await page.getByRole('button', { name: /הצמדה לרצפה/ }).click();
await page.waitForTimeout(600);
const after = await page.evaluate(async () => {
  const db = await new Promise((res, rej) => { const r = indexedDB.open('easycraft'); r.onsuccess = () => res(r.result); r.onerror = rej; });
  return await new Promise((res) => {
    const tx = db.transaction('units').objectStore('units').getAll();
    tx.onsuccess = () => res(tx.result.map((u) => ({ socle: u.socleMm, locked: u.floorLocked })));
  });
});
console.log('units after unlock:', JSON.stringify(after), 'legs before:', legBefore);
ok(after.every((u) => !u.locked && (u.socle ?? 0) === 0), 'ביטול הצמדה לרצפה מאפס את גובה הרגליים');

console.log('errors:', errs.length, errs.slice(0, 5));
await b.close();
console.log(fail.length ? 'FAILURES: ' + fail.join(' | ') : 'ALL PASS');

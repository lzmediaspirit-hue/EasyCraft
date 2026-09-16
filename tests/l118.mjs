/*
 * שכבה 118 — מיקום: קבוצה, פינה בגבול הקיר, מספר בטופס, וצעד אחד לביטול.
 *
 * B05 — קבוצה זזה כגוף אחד, והמרווחים נשמרים גם בקצה הקיר.
 * B06 — פינה שמוציאה ארגז מהקיר אינה נבחרת.
 * B07 — מיקום מספרי מעבר לגבול אינו נשמר.
 * B08 — מחווה אחת, ושמירה אחת, הן צעד אחד לביטול.
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
const ok = (name, cond, extra = '') =>
  out.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' | ' + extra : ''}`);

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });

const r = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const S = await import('/src/features/design/stacking.ts' + v);
  const H = await import('/src/features/design/history.ts' + v);
  const { db } = await import('/src/db/db.ts' + v);

  const unit = (over) => ({
    id: 'u', projectId: 'p-118', wallId: 'w1', catalogItemId: 'c1',
    name: 'ארגז', glyph: 'doors', level: 'wall',
    xMm: 0, yMm: 0, widthMm: 600, heightMm: 700, depthMm: 320,
    createdAt: 0, updatedAt: 0, ...over,
  });

  /* --- B06: פינה שמוציאה מהקיר --- */
  const lower = unit({ id: 'low', level: 'floor', xMm: 0, yMm: 0, widthMm: 550, heightMm: 880 });
  const upper = unit({ id: 'up', widthMm: 600 });
  const tol = 120;
  /*
   * יישור לסוף: 0 + 550 − 600 = −50, כלומר מחוץ לקיר. האצבע קרובה
   * דווקא אליו (10 מ״מ) ורחוקה מפינת ההתחלה (40 מ״מ), ולכן בלי
   * הגבול הוא זה שהיה נבחר — וזה הבאג.
   */
  const outside = S.stackSnap({ ...upper }, -40, 880, [lower], tol, undefined, 3000);
  /* ואין פינה תקפה בכלל כשההתחלה רחוקה מדי: תוצאה ריקה, ולא −50 */
  const noneNear = S.stackSnap({ ...upper }, -40, 880, [lower], 20, undefined, 3000);
  /* פינת ההתחלה של אותו תחתון נכנסת, ולכן היא כן נבחרת */
  const inside = S.stackSnap({ ...upper }, 20, 880, [lower], tol, undefined, 3000);
  /* ובקצה השני: תחתון בסוף קיר קצר, ועליון רחב שאינו נכנס */
  const nearEnd = unit({ id: 'end', level: 'floor', xMm: 2400, widthMm: 550, heightMm: 880 });
  const overflow = S.stackSnap({ ...upper }, 2400, 880, [nearEnd], tol, undefined, 2600);

  /* --- B08: מחווה אחת היא צעד אחד --- */
  const pid = 'p-118';
  await db.units.where('projectId').equals(pid).delete();
  const a = { ...unit({ id: 'a', xMm: 500 }), projectId: pid };
  const b = { ...unit({ id: 'b', xMm: 2200 }), projectId: pid };
  await db.units.bulkPut([a, b]);

  const depth = () => H.history.state(pid).canUndo;
  /* גרירת קבוצה: תגיות מתחלפות, כמו בתנועה אמיתית */
  await H.history.begin(pid, 'drag:test');
  for (let i = 0; i < 12; i++) {
    await H.history.capture(pid, `edit:${i % 2 ? 'a' : 'b'}`);
    await db.units.update(i % 2 ? 'a' : 'b', { xMm: 600 + i * 10 });
  }
  H.history.end(pid);
  const afterDrag = (await db.units.where('projectId').equals(pid).toArray()).map((u) => u.xMm).sort((x, y) => x - y);
  await H.history.undo(pid);
  const back = (await db.units.where('projectId').equals(pid).toArray()).map((u) => u.xMm).sort((x, y) => x - y);
  const stillMore = depth();

  /* אותו רצף בלי הכרזת מחווה — כך זה היה, וכך זה נראה */
  await db.units.bulkPut([a, b]);
  let pushes = 0;
  const before = H.history.state(pid);
  for (let i = 0; i < 12; i++) await H.history.capture(pid, `loose:${i % 2 ? 'a' : 'b'}`);
  while (H.history.state(pid).canUndo) {
    await H.history.undo(pid);
    pushes++;
    if (pushes > 30) break;
  }

  /*
   * הארגזים של הבדיקה הזאת יורדים מהמכשיר לפני המשך העבודה:
   * החלק הבא בודק ממשק, והוא קורא מה שיש בטבלה.
   */
  await db.units.where('projectId').equals(pid).delete();

  return {
    outside: outside ? { x: outside.xMm, edge: outside.edge } : null,
    noneNear: noneNear === null,
    inside: inside ? inside.xMm : null,
    overflow: overflow === null,
    afterDrag,
    back,
    stillMore,
    looseSteps: pushes,
    hadUndoBefore: before.canUndo,
  };
});

ok('the corner at −50 mm is never chosen', r.outside?.x === 0, JSON.stringify(r.outside));
ok('the cabinet lands on the start corner instead', r.outside?.edge === 'start', JSON.stringify(r.outside));
ok('and when no corner fits, nothing is offered', r.noneNear);
ok('the start corner of the same neighbour still snaps', r.inside === 0, String(r.inside));
ok('and a corner past the far end is refused too', r.overflow);

ok('a group drag moved both cabinets', r.afterDrag.length === 2 && r.afterDrag[0] !== 500, JSON.stringify(r.afterDrag));
ok('one undo returns the whole group', r.back[0] === 500 && r.back[1] === 2200, JSON.stringify(r.back));
ok('and it was a single step', r.stillMore === false);
ok('the same writes without a declared gesture are many steps', r.looseSteps > 1, String(r.looseSteps));

/* ------------------------------------------------------------------ */
/* B07 — המספר בטופס, מול הקיר שבו הארגז יושב                          */
/* ------------------------------------------------------------------ */

const btn = (re) => page.getByRole('button', { name: re }).first();
const dlg = () => page.getByRole('dialog').last();
const xOf = () =>
  page.evaluate(async () => {
    const req = indexedDB.open('easycraft');
    const dbh = await new Promise((res) => (req.onsuccess = () => res(req.result)));
    const tx = dbh.transaction('units', 'readonly');
    const all = await new Promise((res) => {
      const g = tx.objectStore('units').getAll();
      g.onsuccess = () => res(g.result);
    });
    dbh.close();
    const mine = all.filter((u) => !u.hidden);
    return mine.length ? mine[mine.length - 1].xMm : null;
  });

await setup(page, { name: 'מיקום בע״מ' });
await addNamed(page, /^ארגז/);
await page.waitForTimeout(700);
await btn(/סיום עריכה/).click().catch(() => {});
await page.waitForTimeout(400);

await page.locator('[data-unit-id]').first().click({ force: true });
await page.waitForTimeout(600);
await btn(/^תלת־ממד/).click();
await page.waitForTimeout(1200);
await page.locator('[data-unit]').first().click({ force: true });
await page.waitForTimeout(800);
await page.getByRole('button', { name: 'עריכה מהירה' }).first().click();
await page.waitForTimeout(900);

const startX = await xOf();
const field = dlg().getByLabel('מתחילת הקיר');
ok('the quick edit sheet has the numeric position', (await field.count()) > 0);
await field.fill('500');
await page.waitForTimeout(500);
const sheet = await dlg().innerText();
ok('a position past the wall is called out', /אינו נכנס בקיר/.test(sheet), JSON.stringify(sheet.slice(-220)));
const saveBtn = dlg().getByRole('button', { name: 'עדכון הארגז' });
ok('and the save button is closed', !(await saveBtn.isEnabled()));
await saveBtn.click({ force: true }).catch(() => {});
await page.waitForTimeout(700);
ok('nothing was written', (await xOf()) === startX, `${startX} → ${await xOf()}`);

/* מספר שנכנס — נשמר, והוא צעד אחד לביטול */
await field.fill('120');
await page.waitForTimeout(400);
ok('a position that fits reopens the save', await saveBtn.isEnabled());
await saveBtn.click();
await page.waitForTimeout(900);
ok('and it is written', (await xOf()) === 1200, String(await xOf()));
await btn(/^דו־ממד/).click().catch(() => {});
await page.waitForTimeout(600);
await btn(/^ביטול פעולה|בטל/).first().click().catch(() => {});
await page.waitForTimeout(900);
ok('one undo returns the cabinet to where it was', (await xOf()) === startX, `${startX} ← ${await xOf()}`);

ok('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
console.log(out.join('\n'));
const bad = out.filter((l) => l.startsWith('FAIL'));
console.log(bad.length ? `\n${bad.length} נפלו` : '\nהכול עבר');
await browser.close();

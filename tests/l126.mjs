import './_exit.mjs';
/*
 * שכבה 126 — R01: מחווה אחת, עד השחרור.
 *
 * הביקורת שחזרה סיבוב מצלמה שהפך לגרירת ארגז: תנועה של 25 פיקסלים,
 * המתנה של חצי שנייה, והארון נסע מ-0 ל-2,200 מ״מ מתחת ליד שסובבה
 * את החדר. מדידת הלחיצה הארוכה בוטלה רק במסלול הגרירה, ולכן היא
 * המשיכה לרוץ בזמן שהמחווה כבר הייתה סיבוב.
 *
 * מה שנבדק כאן הוא הכלל ולא רק המקרה: תנועה מבטלת את המדידה, ומחווה
 * שהוכרזה כסיבוב נשארת סיבוב עד ההרפיה — בשני מצבי המצלמה.
 */
import { chromium } from 'playwright';
import { BOX, addNamed, setup } from './mk.mjs';

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

/* ------------------------------------------------------------------ */
/* המדידה עצמה: תנועה מבטלת, עצירה אינה מבטלת                          */
/* ------------------------------------------------------------------ */

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
const timer = await page.evaluate(async () => {
  const A = await import('/src/features/design/axisLock.ts');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  /* תנועה מעבר לסבילות — המדידה מתבטלת ואינה נדלקת */
  let moved = 0;
  const p1 = A.longPress(60, 10);
  p1.start(100, 100, () => moved++);
  const stillIn = p1.move(125, 100);
  await wait(120);

  /* תנועה קטנה ואז עצירה ארוכה — כן נדלקת */
  let held = 0;
  const p2 = A.longPress(60, 10);
  p2.start(100, 100, () => held++);
  p2.move(104, 102);
  await wait(120);

  /* תנועה קטנה, ואז חריגה מאוחרת — מתבטלת גם אז */
  let late = 0;
  const p3 = A.longPress(200, 10);
  p3.start(100, 100, () => late++);
  p3.move(103, 103);
  await wait(60);
  p3.move(160, 100);
  await wait(260);

  return { movedOut: !stillIn, moved, held, late };
});

ok('movement past tolerance reports itself as out', timer.movedOut, String(timer.movedOut));
ok('and the long press never fires after it', timer.moved === 0, String(timer.moved));
ok('a still finger does fire', timer.held === 1, String(timer.held));
ok('movement later in the wait cancels it too', timer.late === 0, String(timer.late));

/* ------------------------------------------------------------------ */
/* המסך: סיבוב שנשאר סיבוב                                             */
/* ------------------------------------------------------------------ */

await setup(page, { name: 'סיבוב בע״מ' });
await addNamed(page, BOX.any);
await page.waitForTimeout(900);

const state = () =>
  page.evaluate(async () => {
    const { db } = await import('/src/db/db.ts');
    const u = (await db.units.toArray())[0];
    return { id: u.id, x: u.xMm, y: u.yMm };
  });

const seed = await state();
await page.evaluate(async (id) => {
  const { unitsRepo } = await import('/src/features/projects/projectsRepo.ts');
  await unitsRepo.update(id, { xMm: 0, yMm: 0, floorLocked: false });
}, seed.id);
await page.waitForTimeout(700);

await btn(/^תלת־ממד/).click();
await page.waitForTimeout(1400);

/*
 * "האם החדר הסתובב" נמדד על הארגז ולא על ה-viewBox: המסגרת מותאמת
 * לתוכן ויכולה להישאר זהה בסיבוב, והמקום של הארון על המסך לא.
 */
const onScreen = async () => {
  const b = await page.locator('svg [data-unit]').first().boundingBox();
  return b ? `${Math.round(b.x)},${Math.round(b.y)}` : '';
};
const solid = page.locator('svg [data-unit]').first();
const sb = await solid.boundingBox();
ok('the cabinet is drawn in 3D', !!sb, JSON.stringify(sb));

/*
 * בדיוק השחזור של הביקורת: לחיצה על הארגז, תנועה מיידית של 25
 * פיקסלים, ואז המתנה ארוכה — ורק אחריה המשך התנועה.
 */
const before = await state();
const cx = sb.x + sb.width / 2;
const cy = sb.y + sb.height / 2;
await page.mouse.move(cx, cy);
await page.mouse.down();
await page.mouse.move(cx + 25, cy, { steps: 3 });
await page.waitForTimeout(750);
const badge = await page.innerText('body');
ok('no axis lock is armed after the finger already moved', !/נעילת ציר|נעול ל/.test(badge));

await page.mouse.move(cx + 160, cy + 10, { steps: 10 });
await page.waitForTimeout(300);
await page.mouse.up();
await page.waitForTimeout(900);

const after = await state();
ok('the orbit never moved the cabinet', after.x === before.x && after.y === before.y, `${JSON.stringify(before)} → ${JSON.stringify(after)}`);

/* ------------------------------------------------------------------ */
/* וסיבוב איטי רציף — אותו כלל, בלי הפסקה חדה                          */
/* ------------------------------------------------------------------ */

const seenBefore = await onScreen();
const slow = await state();
await page.mouse.move(cx, cy);
await page.mouse.down();
for (let i = 1; i <= 14; i++) {
  await page.mouse.move(cx + i * 12, cy, { steps: 2 });
  await page.waitForTimeout(70);
}
await page.mouse.up();
await page.waitForTimeout(900);
const slowAfter = await state();
ok('a slow continuous orbit leaves the cabinet alone', slowAfter.x === slow.x && slowAfter.y === slow.y, `${JSON.stringify(slow)} → ${JSON.stringify(slowAfter)}`);
ok('and it really did orbit the room', (await onScreen()) !== seenBefore, `${seenBefore} → ${await onScreen()}`);

/* ------------------------------------------------------------------ */
/* חדר נעול: שם הגרירה היא הכוונה, והנעילה עדיין עובדת                 */
/* ------------------------------------------------------------------ */

await btn(/נעילת סיבוב החדר/).click();
await page.waitForTimeout(600);
const lockedFrom = await state();
const sb2 = await page.locator('svg [data-unit]').first().boundingBox();
await page.mouse.move(sb2.x + sb2.width / 2, sb2.y + sb2.height / 2);
await page.mouse.down();
await page.waitForTimeout(700);
const lockBadge = await page.innerText('body');
ok('a still press in a locked room still arms the axis lock', /נעילת ציר|נעול ל/.test(lockBadge));
await page.mouse.move(sb2.x + sb2.width / 2 - 70, sb2.y + sb2.height / 2 - 24, { steps: 10 });
await page.waitForTimeout(300);
await page.mouse.up();
await page.waitForTimeout(900);
const lockedAfter = await state();
/*
 * איזה ציר ננעל תלוי בזווית המבט אחרי הסיבובים שקדמו, ולכן נבדק
 * שהארגז זז — ולא באיזה ציר. הציר עצמו נבדק ב-l124.
 */
ok(
  'and that gesture does move the cabinet',
  lockedAfter.x !== lockedFrom.x || lockedAfter.y !== lockedFrom.y,
  `${JSON.stringify(lockedFrom)} → ${JSON.stringify(lockedAfter)}`,
);

ok('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
const bad = out.filter((l) => l.startsWith('FAIL'));
console.log(bad.length ? `\n${bad.length} נפלו` : '\nהכול עבר');
if (bad.length) process.exitCode = 1;
await browser.close();

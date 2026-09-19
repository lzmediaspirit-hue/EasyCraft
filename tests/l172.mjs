import './_exit.mjs';
/**
 * שכבה 172 — הגרירה מול פתח, והמסך שבין טלפון למחשב.
 *
 * שני ממצאים מאותה ביקורת:
 *
 * ההחלקה עצרה על ארגז שכן בלבד. ארגז שנגרר לעבר דלת לא זז כלל —
 * המקום שביקשו היה תפוס, לא היה את מי לדחוף, ואף יעד קרוב לא היה
 * חוקי. בשטח דוחפים עד המשקוף ומשאירים שם.
 *
 * ו-`landOnWall` קיבלה את אורך הקיר ולא השתמשה בו: המקום שביקשו
 * הוחזר כפי שהוא, ולכן ארגז יכול היה לנחות עם חלק ממנו באוויר.
 * שני המסכים חתכו את המידה בעצמם לפני הקריאה — וזו הכפילות
 * שהפונקציה הזאת באה לבטל.
 *
 * ובנוסף: רוחב הביניים. הגרסה הרחבה נכנסה ב-1024, ולכן אייפד
 * לאורך — 820 — קיבל את מסך הטלפון עם 154 פיקסל אפור מכל צד.
 */
import { chromium } from 'playwright';
import { setup, addBox, BOX } from './mk.mjs';

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const out = [];
const ok = (name, cond, extra = '') =>
  out.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' | ' + extra : ''}`);

/* ------------------------------------------------------------------ */
/* החשבון, על מספרים                                                   */
/* ------------------------------------------------------------------ */
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + String(e).slice(0, 180)));
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(700);

const calc = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const { landOnWall } = await import('/src/features/design/rowShift.ts' + v);
  const { buildPlan } = await import('/src/features/design/plan.ts' + v);

  const mkWall = (features) => ({
    id: 'w1', projectId: 'p', index: 0, lengthMm: 4000, heightMm: 2600,
    features, createdAt: 0, updatedAt: 0, workshopId: '', rev: 1,
  });
  const box = (id, xMm, over = {}) => ({
    id, projectId: 'p', catalogItemId: 'c', wallId: 'w1', name: id,
    glyph: 'doors', level: 'floor', xMm, yMm: 0,
    widthMm: 800, heightMm: 880, depthMm: 580, socleMm: 100, counterMm: 20,
    doors: 2, createdAt: 0, updatedAt: 0, workshopId: '', rev: 1, ...over,
  });

  /* דלת 1,500–2,400 באמצע קיר של 4,000, וארגז אחד בתחילתו */
  const door = { id: 'd', kind: 'door', xMm: 1500, widthMm: 900, yMm: 0, heightMm: 2100 };
  const a = box('a', 0);
  const withDoor = mkWall([door]);
  const planD = buildPlan([withDoor], [a]);
  const at = (x) =>
    landOnWall({ unit: a, wallId: 'w1', wallLengthMm: 4000, xMm: x, yMm: 0,
      mates: [a], all: [a], plan: planD });

  /* חלון גבוה אינו דופן לארגז תחתון */
  const win = { id: 'n', kind: 'window', xMm: 1500, widthMm: 900, yMm: 1200, heightMm: 1000 };
  const planW = buildPlan([mkWall([win])], [a]);
  const underWindow = landOnWall({
    unit: a, wallId: 'w1', wallLengthMm: 4000, xMm: 1600, yMm: 0,
    mates: [a], all: [a], plan: planW,
  });

  /* וקיר חלק: הגבול הוא הקיר */
  const planC = buildPlan([mkWall([])], [a]);
  const offWall = landOnWall({
    unit: a, wallId: 'w1', wallLengthMm: 4000, xMm: 3500, yMm: 0,
    mates: [a], all: [a], plan: planC,
  });

  return {
    toDoor: at(1000), inDoor: at(1500), past: at(2600), far: at(3500),
    underWindow, offWall,
  };
});

ok('גרירה לעבר דלת מחליקה עד המשקוף',
  calc.toDoor?.xMm === 700, JSON.stringify(calc.toDoor));
ok('וגם גרירה אל תוך הפתח עצמו נעצרת עליו',
  calc.inDoor?.xMm === 700, JSON.stringify(calc.inDoor));
ok('ומעבר לפתח עוברים', calc.past?.xMm === 2600, JSON.stringify(calc.past));
ok('חלון גבוה אינו דופן לארגז תחתון',
  calc.underWindow?.xMm === 1600, JSON.stringify(calc.underWindow));
/* 4,000 פחות רוחב הארגז — הרחוק ביותר שכולו על הקיר */
ok('ארגז אינו נוחת עם חלק ממנו מעבר לקצה הקיר',
  calc.far?.xMm === 3200 && calc.offWall?.xMm === 3200,
  `${calc.far?.xMm} / ${calc.offWall?.xMm}`);

/* ------------------------------------------------------------------ */
/* ובאצבע, על הציור                                                    */
/* ------------------------------------------------------------------ */
await setup(page, { name: 'פתח', walls: 'קיר יחיד', room: 'מטבח' });
await page.evaluate(async () => {
  const { db } = await import('/src/db/db.ts?v=' + Date.now());
  const w = (await db.walls.toArray())[0];
  await db.walls.update(w.id, {
    features: [{
      id: 'dd', kind: 'door', xMm: 1500, widthMm: 900, yMm: 0, heightMm: 2100,
      fromSide: 'start', heightRef: 'floor',
    }],
    rev: (w.rev ?? 0) + 1, updatedAt: Date.now(),
  });
});
await page.waitForTimeout(700);
await addBox(page, BOX.doors2);
await page.getByRole('button', { name: 'דו־ממד' }).first().click();
await page.waitForTimeout(900);

const read = () => page.evaluate(async () => {
  const { db } = await import('/src/db/db.ts');
  return (await db.units.toArray()).map((u) => u.xMm);
});
const perPx = () => page.evaluate(() => {
  const s = [...document.querySelectorAll('svg')]
    .sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0];
  return 1 / s.getScreenCTM().a;
});
const rect = () => page.evaluate(() => {
  const g = document.querySelector('[data-unit-id]');
  const r = g.getBoundingClientRect();
  return { cx: Math.round(r.x + r.width / 2), cy: Math.round(r.y + r.height / 2) };
});

const mm = await perPx();
const r = await rect();
const dx = 1200 / mm;
await page.mouse.move(r.cx, r.cy);
await page.mouse.down();
for (let i = 1; i <= 12; i++) {
  await page.mouse.move(r.cx + (dx * i) / 12, r.cy);
  await page.waitForTimeout(18);
}
await page.mouse.up();
await page.waitForTimeout(500);
const after = await read();
/*
 * הקיר של האשף הוא 3,000, ולכן מעבר לדלת אין מקום לארגז 800 —
 * מה שנכון לעשות הוא לעצור עליה, ולא לא לזוז.
 */
ok('באצבע: הארגז נעצר על המשקוף ולא נשאר במקום',
  after.length === 1 && after[0] === 700, JSON.stringify(after));
ok('בלי שגיאות בדפדפן', errs.length === 0, errs.slice(0, 2).join(' | '));
await page.close();

/* ------------------------------------------------------------------ */
/* רוחב הביניים                                                        */
/* ------------------------------------------------------------------ */
const widths = [];
for (const [label, w] of [['טלפון', 390], ['טאבלט', 820], ['מחשב', 1440]]) {
  const p = await browser.newPage({ viewport: { width: w, height: 900 } });
  await p.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(900);
  const m = await p.evaluate(() => {
    const el = document.querySelector('.app-page, .planner-workspace');
    return {
      used: el ? Math.round(el.getBoundingClientRect().width) : 0,
      over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  widths.push({ label, w, ...m });
  await p.close();
}
const by = Object.fromEntries(widths.map((x) => [x.label, x]));
ok('בטלפון העמוד הוא כל המסך', by['טלפון'].used === 390, JSON.stringify(by['טלפון']));
/* 48rem = 768 — מה שנלקח מ-820 במקום 512 */
ok('בטאבלט העמוד רחב מרוחב הטלפון', by['טאבלט'].used === 768, JSON.stringify(by['טאבלט']));
ok('ובמחשב הוא רחב עוד יותר', by['מחשב'].used === 1024, JSON.stringify(by['מחשב']));
ok('ואין גלילה לרוחב באף אחד מהם',
  widths.every((x) => x.over === 0), JSON.stringify(widths));

await browser.close();
console.log(out.join('\n'));
const fail = out.filter((l) => l.startsWith('FAIL')).length;
console.log(`${out.length - fail}/${out.length} עברו`);
process.exit(fail ? 1 : 0);

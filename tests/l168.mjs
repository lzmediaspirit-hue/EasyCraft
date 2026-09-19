import './_exit.mjs';
/*
 * שכבה 168 — ארגז בשורה זז.
 *
 * "אני לא יכול להזיז ארגזים כשיש ארגזים אחד ליד השני." הבדיקה
 * הייתה נכונה פיזיקלית: כל מקום שהאצבע לקחה את הארגז אליו היה
 * תפוס, ולכן ההנחה נדחתה והוא נשאר. בקיר מלא — שזה רוב הקירות —
 * שום דבר לא זז, ולא היה שום סימן למה.
 *
 * מה שחסר היה השאלה השנייה: לא "האם המקום פנוי" אלא "מה צריך
 * לזוז כדי שיהיה". נגר שמזיז ארון בשורה דוחף את מה שלידו.
 *
 * וחוץ מזה: אותה גרירה בדיוק הצליחה בתלת־ממד ונכשלה בחזית, כי
 * ההחלקה עד המגע נכתבה שם ולא כאן. `landOnWall` היא עכשיו
 * התשובה היחידה לשני המסכים.
 */
import { chromium } from 'playwright';
import { setup, addBox, BOX } from './mk.mjs';

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + String(e).slice(0, 200)));
const out = [];
const ok = (name, cond, extra = '') => out.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' | ' + extra : ''}`);

/* ------------------------------------------------------------------ */
/* החשבון עצמו, על מספרים                                              */
/* ------------------------------------------------------------------ */
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(700);

const calc = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const { shiftRow, landOnWall } = await import('/src/features/design/rowShift.ts' + v);
  const { buildPlan } = await import('/src/features/design/plan.ts' + v);

  const wall = {
    id: 'w1', projectId: 'p', index: 0, lengthMm: 3000, heightMm: 2600,
    features: [], createdAt: 0, updatedAt: 0, workshopId: '', rev: 1,
  };
  const box = (id, xMm, over = {}) => ({
    id, projectId: 'p', catalogItemId: 'c', wallId: 'w1', name: id,
    glyph: 'doors', level: 'floor', xMm, yMm: 0,
    widthMm: 800, heightMm: 880, depthMm: 580, socleMm: 100, counterMm: 30,
    doors: 2, createdAt: 0, updatedAt: 0, workshopId: '', rev: 1, ...over,
  });
  const a = box('a', 0);
  const b = box('b', 800);
  const c = box('c', 1600);
  const units = [a, b, c];
  const plan = buildPlan([wall], units);
  const call = (unit, xMm) =>
    shiftRow({ unit, xMm, mates: units, wallLengthMm: 3000 });

  return {
    /* האמצעי ימינה 200: הימני נדחף בדיוק כרוחב הדחיפה */
    push: call(b, 1000),
    /* ימינה עד הקצה: השורה נעצרת, ולא מסרבת */
    capped: call(b, 2200),
    /*
     * שמאלה: השמאלי כבר צמוד לקצה הקיר, ולכן אין לשורה לאן
     * להידחף — והאמצעי נשאר בדיוק במקומו.
     */
    left: call(b, 400),
    /* ולמי שאין שכן בכיוון הנסיעה אין את מי לדחוף */
    none: call(c, 1800),
    /* פינה מתה מעוגנת לקצה הקיר, ולכן היא אינה נדחפת */
    corner: shiftRow({
      unit: b, xMm: 1000, wallLengthMm: 3000,
      mates: [a, { ...c, corner: 'blindEnd' }],
    }),
    /* מפלס אחר אינו באותה שורה */
    otherLevel: shiftRow({
      unit: b, xMm: 1000, wallLengthMm: 3000,
      mates: [a, { ...c, level: 'wall', yMm: 1500 }],
    }),
    /* והנחיתה השלמה: המקום שביקשו פנוי, ולכן איש לא זז */
    free: landOnWall({
      unit: b, wallId: 'w1', wallLengthMm: 3000, xMm: 800, yMm: 0,
      mates: units, all: units, plan,
    }),
    /* תפוס — והשורה נותנת מקום */
    gives: landOnWall({
      unit: b, wallId: 'w1', wallLengthMm: 3000, xMm: 1000, yMm: 0,
      mates: units, all: units, plan,
    }),
    /* ובנעילת ציר אין דחיפה: מי שנעל ביקש ארגז אחד */
    locked: landOnWall({
      unit: b, wallId: 'w1', wallLengthMm: 3000, xMm: 1000, yMm: 0,
      mates: units, all: units, plan, locked: true,
    }),
  };
});

ok('השורה נדחפת בדיוק כרוחב התנועה',
  calc.push?.xMm === 1000 && calc.push?.shifts.length === 1 && calc.push.shifts[0].xMm === 1800,
  JSON.stringify(calc.push));
/*
 * שורה שנדחקת אל מעבר לקצה הקיר אינה נפסלת אלא נעצרת. סירוב שם
 * החזיר את הגרירה למה שהייתה — ארגז שלא זז בלי סיבה נראית.
 */
ok('ושורה שאין לה לאן נעצרת במקום לסרב',
  calc.capped?.xMm === 1400 && calc.capped?.shifts[0]?.xMm === 2200,
  JSON.stringify(calc.capped));
ok('ושורה שצמודה כבר לקצה אינה זזה בכלל',
  calc.left?.xMm === 800 && calc.left?.shifts.length === 0, JSON.stringify(calc.left));
ok('ומי שאין לו שכן בכיוון הנסיעה אינו מזיז איש',
  calc.none?.xMm === 1800 && calc.none?.shifts.length === 0, JSON.stringify(calc.none));
ok('פינה מתה אינה נדחפת ממקומה', calc.corner?.shifts.length === 0,
  JSON.stringify(calc.corner));
ok('וארגז במפלס אחר אינו באותה שורה', calc.otherLevel?.shifts.length === 0,
  JSON.stringify(calc.otherLevel));
ok('מקום פנוי אינו מזיז איש',
  calc.free?.xMm === 800 && calc.free?.shifts.length === 0, JSON.stringify(calc.free));
ok('מקום תפוס — והשורה נותנת מקום',
  calc.gives?.xMm === 1000 && calc.gives?.shifts.length === 1, JSON.stringify(calc.gives));
ok('ובנעילת ציר הארגז נשאר, ואיש אינו נדחף',
  calc.locked?.xMm === 800 && calc.locked?.shifts.length === 0, JSON.stringify(calc.locked));

/* ------------------------------------------------------------------ */
/* ובאצבע, על הציור עצמו                                               */
/* ------------------------------------------------------------------ */
await setup(page);
await addBox(page, BOX.doors2);
await addBox(page, BOX.doors2);
await addBox(page, BOX.doors2);
await page.getByRole('button', { name: 'דו־ממד' }).first().click();
await page.waitForTimeout(900);

const read = () => page.evaluate(async () => {
  const { db } = await import('/src/db/db.ts');
  return (await db.units.toArray()).map((u) => u.xMm).sort((a, b) => a - b);
});
const rects = () => page.evaluate(() =>
  [...document.querySelectorAll('[data-unit-id]')].map((g) => {
    const r = g.getBoundingClientRect();
    return { id: g.getAttribute('data-unit-id'), cx: Math.round(r.x + r.width / 2), cy: Math.round(r.y + r.height / 2) };
  }).sort((a, b) => a.cx - b.cx));
/* מ"מ לפיקסל, מהטרנספורם האמיתי של הציור — כמו שהגרירה עצמה מודדת */
const perPx = () => page.evaluate(() => {
  const s = [...document.querySelectorAll('svg')]
    .sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0];
  return 1 / s.getScreenCTM().a;
});

async function drag(index, dxMm, back = 0) {
  const mm = await perPx();
  const r = (await rects())[index];
  const dx = dxMm / mm;
  await page.mouse.move(r.cx, r.cy);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) { await page.mouse.move(r.cx + (dx * i) / 12, r.cy); await page.waitForTimeout(18); }
  /* חזרה בתוך אותה מחווה — בלי להרפות */
  if (back) {
    const bx = back / mm;
    for (let i = 1; i <= 8; i++) { await page.mouse.move(r.cx + dx + (bx * i) / 8, r.cy); await page.waitForTimeout(18); }
  }
  await page.mouse.up();
  await page.waitForTimeout(450);
  return read();
}

const first = await read();
ok('שלושה ארגזים עומדים צמודים', JSON.stringify(first) === '[0,800,1600]', JSON.stringify(first));

const pushed = await drag(1, 200);
ok('גרירת האמצעי ימינה מזיזה אותו ודוחפת את השכן',
  JSON.stringify(pushed) === '[0,1000,1800]', JSON.stringify(pushed));

/*
 * הלוך ושוב בתוך מחווה אחת חוזר למה שהיה — גם למי שנדחף.
 * בלי ההחזרה שכן שנדחף בדרך החוצה נשאר דחוף, והמחווה שהמשתמש
 * ביטל בעצמו השאירה אחריה חצי תנועה.
 */
const back = await drag(1, 600, -600);
ok('והלוך ושוב במחווה אחת מחזיר את כולם',
  JSON.stringify(back) === '[0,1000,1800]', JSON.stringify(back));

const far = await drag(2, -4000);
ok('וגרירה של האחרון עד הקצה דוחסת את השורה שמאלה',
  JSON.stringify(far) === '[0,800,1600]', JSON.stringify(far));

ok('בלי שגיאות בדפדפן', errs.length === 0, errs.slice(0, 2).join(' | '));

await browser.close();
console.log(out.join('\n'));
const fail = out.filter((l) => l.startsWith('FAIL')).length;
console.log(`${out.length - fail} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);

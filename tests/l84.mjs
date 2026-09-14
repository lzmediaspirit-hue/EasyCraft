/** משימות 84–92: גובה תקן, עמוד עד התקרה, חסימת מפתחים, דלת מדומה, סרגל, ספרייה, שכפול. */
import { chromium } from 'playwright';
import { setup, addUnit } from './mk.mjs';

const SP = new URL('shots/', import.meta.url).pathname;
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));

const btn = (re) => page.getByRole('button', { name: re }).first();
const dlg = () => page.getByRole('dialog').last();
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  (cond ? pass++ : fail++);
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' | ' + extra : ''}`);
};
const esc = async () => {
  while (await page.getByRole('dialog').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(250); }
};
const units = () => page.evaluate(async () => {
  const { db } = await import('/src/db/db.ts?v=' + Date.now());
  return db.units.toArray();
});
const walls = () => page.evaluate(async () => {
  const { db } = await import('/src/db/db.ts?v=' + Date.now());
  return (await db.walls.toArray()).sort((a, b) => a.index - b.index);
});

await setup(page, { name: 'שכבה 84', walls: 'קיר יחיד' });
await page.waitForTimeout(700);

/* ---------- 84: גובה ארגז תחתון 88 ס"מ כולל רגליים ---------- */
await addUnit(page, 0);
await page.waitForTimeout(700);
let us = await units();
ok('ארגז תחתון בגובה 880 כולל רגליים', us[0]?.heightMm === 880, `${us[0]?.name} ${us[0]?.heightMm}`);
ok('הרגליים בתוך הגובה', us[0]?.socleMm === 100, String(us[0]?.socleMm));

/* ---------- 87: ארגז ללא דלתות לא מצויר עם דלת ---------- */
/*
  ידית הדלת היא קו אנכי ליד קצה הארגז, והיא הסימן היחיד שנשאר
  מהחזית כשהיא מצוירת. ארגז בלי דלתות לא אמור להחזיק אף אחד כזה.
*/
const doorLines = async () =>
  page.evaluate(() => {
    const g = document.querySelector('[data-unit-id] g[fill="none"]');
    if (!g) return -1;
    return [...g.querySelectorAll('line')].filter(
      (l) => l.getAttribute('x1') === l.getAttribute('x2'),
    ).length;
  });
const withDoors = await doorLines();
await page.locator('[data-unit-id]').first().click();
await page.waitForTimeout(600);
/* מורידים את הדלתות ל-0 */
const zero = page.getByRole('button', { name: '0', exact: true }).first();
if (await zero.count()) { await zero.click(); await page.waitForTimeout(700); }
const noDoors = await doorLines();
us = await units();
ok('דלתות ירדו ל-0', us[0]?.doors === 0, String(us[0]?.doors));
ok('חזית עם דלת מציירת ידית', withDoors === 1, String(withDoors));
ok('ארגז ללא דלתות מצויר בלי חזית', noDoors === 0, `${withDoors} → ${noDoors}`);
await page.screenshot({ path: SP + 'L87-nodoors.png' });

/* ---------- 88: אין "בלי עליונים" ---------- */
await esc();
await btn(/סיום עריכה/).click();
await page.waitForTimeout(600);
ok('הכפתור "בלי עליונים" הוסר', (await page.getByRole('button', { name: /בלי עליונים/ }).count()) === 0);

/* ---------- 89: הסרגל בשורת החזית ---------- */
const rowOf = async (name) =>
  page.evaluate((n) => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').trim() === n);
    if (!b) return -1;
    const row = b.closest('div.flex');
    const rows = [...document.querySelectorAll('div.flex.items-center.gap-1\\.5.overflow-x-auto')];
    return rows.indexOf(row);
  }, name);
ok('סרגל וחזית באותה שורה', (await rowOf('סרגל')) === (await rowOf('חזית')) && (await rowOf('סרגל')) >= 0,
  `סרגל=${await rowOf('סרגל')} חזית=${await rowOf('חזית')}`);

/* ---------- 85: עמוד נולד בגובה החדר ---------- */
await btn(/הגדרות הקיר/).click();
await page.waitForTimeout(700);
ok('נפתחו הגדרות הקיר', await dlg().getByText('מידות הקיר').isVisible());
await dlg().getByRole('button', { name: 'עמוד / פינוי', exact: true }).click();
await page.waitForTimeout(600);
let ws = await walls();
const pillar = () => (ws[0].features ?? []).find((f) => f.kind === 'pillar');
ok('העמוד נולד בגובה הקיר', pillar()?.heightMm === ws[0].heightMm, `${pillar()?.heightMm} / ${ws[0].heightMm}`);

/* גובה הקיר משתנה — העמוד עולה איתו */
const hInput = dlg().getByRole('spinbutton', { name: 'גובה הקיר' });
await hInput.fill('280');
await hInput.blur();
await page.waitForTimeout(900);
ws = await walls();
ok('הקיר עלה ל-2800', ws[0].heightMm === 2800, String(ws[0].heightMm));
ok('העמוד עלה עם הקיר', pillar()?.heightMm === 2800, String(pillar()?.heightMm));

/* ---------- 86: חלון חוסם, שקע לא ---------- */
await dlg().getByRole('button', { name: 'חלון', exact: true }).click();
await page.waitForTimeout(500);
await dlg().getByRole('button', { name: 'שקע חשמל', exact: true }).click();
await page.waitForTimeout(500);
await esc();

/*
  קיר סינתטי לכל סימון בנפרד: שלושה סימונים על אותו קיר נוחתים
  באותו מרכז, ואז "מותר מאחורי שקע" נבדק במקום שיש בו גם חלון.
*/
const rules = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const { db } = await import('/src/db/db.ts' + v);
  const P = await import('/src/features/design/plan.ts' + v);
  const PL = await import('/src/features/design/placement.ts' + v);
  const C = await import('/src/features/design/collision.ts' + v);
  const all = await db.units.toArray();
  const base = (await db.walls.toArray()).sort((a, b) => a.index - b.index)[0];
  const u = { ...all[0], xMm: 1000, yMm: 0 };

  const at = (kind, extra) => {
    const wall = {
      ...base,
      features: [
        {
          id: 'f1',
          kind,
          xMm: 1000,
          yMm: 0,
          widthMm: 400,
          heightMm: 2000,
          ...extra,
        },
      ],
    };
    const plan = P.buildPlan([wall], [u]);
    const box = PL.unitBox(u, plan);
    return box ? C.blocked(u, box, [], plan) : null;
  };
  /*
    עמוד על הקיר השכן: הוא בולט אל החדר, ולכן הוא חוסם גם ארגז
    שעומד על הקיר שלצידו — עמוד בפינת מטבח הוא בדיוק המקרה.
  */
  const neighbour = (kind) => {
    const w1 = { ...base, id: 'nw1', index: 0, features: [] };
    const w2 = {
      ...base, id: 'nw2', index: 1, turnDeg: 90,
      features: [{ id: 'f2', kind, xMm: 0, yMm: 0, widthMm: 400, heightMm: 2000, depthMm: 300 }],
    };
    const plan = P.buildPlan([w1, w2], []);
    /* הארגז בקצה הקיר הראשון, בדיוק בפינה שהעמוד יושב בה */
    const probe = { ...all[0], wallId: 'nw1', xMm: base.lengthMm - 600, yMm: 0, widthMm: 600 };
    const box = PL.unitBox(probe, plan);
    return box ? C.blocked(probe, box, [], plan) : null;
  };

  const clean = P.buildPlan([{ ...base, features: [] }], [u]);
  const cleanBox = PL.unitBox(u, clean);
  return {
    onWindow: at('window'),
    onDoor: at('door'),
    onPillar: at('pillar'),
    onSocket: at('socket'),
    onWater: at('water'),
    onStep: at('step'),
    beside: at('window', { xMm: 2500 }),
    onClear: cleanBox ? C.blocked(u, cleanBox, [], clean) : null,
    neighbourPillar: neighbour('pillar'),
    neighbourSocket: neighbour('socket'),
  };
});
ok('ארגז נחסם על חלון', rules.onWindow === true);
ok('ארגז נחסם על דלת', rules.onDoor === true);
ok('ארגז נחסם על עמוד', rules.onPillar === true);
ok('ארגז מותר מאחורי שקע', rules.onSocket === false);
ok('ארגז מותר מאחורי נקודת מים', rules.onWater === false);
ok('מדרגה גונבת עומק ואינה חוסמת', rules.onStep === false);
ok('חלון רחוק אינו חוסם', rules.beside === false);
ok('מקום פנוי אינו חסום', rules.onClear === false);
ok('עמוד בקיר השכן חוסם בפינה', rules.neighbourPillar === true);
ok('שקע בקיר השכן אינו חוסם', rules.neighbourSocket === false);

/* ---------- 90: הסרגל מודד חלון ---------- */
await esc();
await btn(/^סרגל — /).click();
await page.waitForTimeout(600);
const targets = await page.locator('[data-feature-id]').count();
ok('לכל סימון יש יעד סרגל', targets === 3, String(targets));
/*
  מודדים בין שני סימונים — בדיוק מה שלא היה אפשרי קודם. הלחיצה
  נשלחת ישירות לאלמנט: הסימונים חופפים על המסך, ולחיצה במרכז אחד
  נופלת על השני.
*/
for (const i of [0, 1]) {
  await page.evaluate((n) => {
    const el = document.querySelectorAll('[data-feature-id]')[n];
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  }, i);
  await page.waitForTimeout(400);
}
await page.screenshot({ path: SP + 'L90-ruler.png' });
const picked = await page.evaluate(() =>
  [...document.querySelectorAll('[data-feature-id]')].filter(
    (r) => r.getAttribute('fill-opacity') === '0.35',
  ).length,
);
ok('שני סימונים נבחרו כקצוות מדידה', picked === 2, String(picked));
await btn(/^סרגל — /).click();
await page.waitForTimeout(400);

/* ---------- 91: מחיקה מהספרייה והחזרה ---------- */
await esc();
await btn(/הוספת ארגז/).click();
await page.waitForTimeout(700);
const before = await dlg().locator('button[aria-label^="הסרת"]').count();
ok('יש כפתור הסרה לכל ארגז', before > 0, String(before));
const firstName = await dlg().locator('button[aria-label^="הסרת"]').first().getAttribute('aria-label');
await dlg().locator('button[aria-label^="הסרת"]').first().click();
await page.waitForTimeout(800);
const after = await dlg().locator('button[aria-label^="הסרת"]').count();
ok('הארגז ירד מהספרייה', after === before - 1, `${before} → ${after} (${firstName})`);
ok('שורת ההחזרה הופיעה', await dlg().getByText(/הוסרו מהספרייה/).isVisible());
await dlg().getByRole('button', { name: 'החזרה' }).click();
await page.waitForTimeout(800);
ok('ההחזרה עובדת', (await dlg().locator('button[aria-label^="הסרת"]').count()) === before);
await page.screenshot({ path: SP + 'L91-library.png' });
await esc();

/* ---------- 92: שכפול פרויקט ---------- */
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
await btn(/שכבה 84/).click();
await page.waitForTimeout(900);
const projectsBefore = await page.locator('li').filter({ hasText: /מטבח/ }).count();
await page.getByRole('button', { name: /^שכפול הפרויקט/ }).first().click();
await page.waitForTimeout(1200);
ok('נוצר עותק', await page.getByText(/— עותק/).first().isVisible());
await page.screenshot({ path: SP + 'L92-duplicate.png' });

const copy = await page.evaluate(async () => {
  const { db } = await import('/src/db/db.ts?v=' + Date.now());
  const ps = await db.projects.toArray();
  const src = ps.find((p) => !p.name.includes('עותק'));
  const dup = ps.find((p) => p.name.includes('עותק'));
  const at = async (id) => ({
    walls: (await db.walls.where('projectId').equals(id).toArray()).length,
    units: (await db.units.where('projectId').equals(id).toArray()).length,
    features: (await db.walls.where('projectId').equals(id).toArray()).flatMap((w) => w.features).length,
  });
  return { src: await at(src.id), dup: await at(dup.id), sold: dup.soldAt ?? null, count: ps.length };
});
ok('העותק הוא פרויקט נוסף', copy.count === projectsBefore + 1, `${projectsBefore} → ${copy.count}`);
ok('הקירות הועתקו', copy.dup.walls === copy.src.walls, JSON.stringify(copy));
ok('הארגזים הועתקו', copy.dup.units === copy.src.units, JSON.stringify(copy));
ok('הסימונים הועתקו', copy.dup.features === copy.src.features, JSON.stringify(copy));
ok('העותק אינו מכור', copy.sold === null);

console.log(`\n${pass} pass, ${fail} fail`);
if (errs.length) console.log('PAGEERROR ' + errs.slice(0, 4).join(' | '));
await browser.close();

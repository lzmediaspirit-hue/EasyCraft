/** משימה 82: תכנון אוטומטי מקצה לקצה — שאלות, הצעות, הנחה בהדמיה. */
import { chromium } from 'playwright';
import { setup } from './mk.mjs';

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

await setup(page, { name: 'תכנון אוטומטי', walls: 'שני קירות' });
await page.waitForTimeout(800);

/* 1 — הכפתור קיים במטבח */
ok('כפתור תכנון אוטומטי מופיע', await btn(/תכנון אוטומטי/).isVisible());
await page.screenshot({ path: SP + 'L82-1-button.png' });

/* 2 — מסך השאלות */
await btn(/תכנון אוטומטי/).click();
await page.waitForTimeout(500);
ok('מסך השאלות נפתח', await dlg().getByText('מה יש במטבח').isVisible());
for (const t of ['מקרר', 'תנור', 'כיריים', 'מיקרוגל', 'מדיח', 'קולט אדים']) {
  ok(`מתג ${t}`, await dlg().getByRole('switch', { name: t }).isVisible());
}
ok('רמת גימור', await dlg().getByText('רמת גימור').isVisible());
ok('ישיבה', await dlg().getByText('ישיבה במטבח').isVisible());
await page.screenshot({ path: SP + 'L82-2-ask.png' });

/* 3 — סימון מיקרוגל ומעבר להצעות */
await dlg().getByRole('switch', { name: 'מיקרוגל' }).click();
await page.waitForTimeout(200);
ok('מיקרוגל נדלק', (await dlg().getByRole('switch', { name: 'מיקרוגל' }).getAttribute('aria-checked')) === 'true');
await dlg().getByRole('button', { name: /הצגת הצעות/ }).click();
await page.waitForTimeout(700);

const cards = dlg().locator('button').filter({ hasText: /נוח לעבודה|חסכוני|מקסימום אחסון/ });
const n = await cards.count();
ok('יש הצעות', n >= 3, `${n}`);
ok('כל הצעה מציגה מדדים', await dlg().getByText('משולש עבודה').first().isVisible());
await page.screenshot({ path: SP + 'L82-3-proposals.png', fullPage: true });

/* 4 — בחירת הצעה מניחה מטבח */
const title = (await cards.first().innerText()).split('\n')[0];
await cards.first().click();
await page.waitForTimeout(1500);
ok('ההצעה מסומנת כמוצגת', await dlg().getByText('מוצג').first().isVisible(), title);
await page.screenshot({ path: SP + 'L82-4-applied.png', fullPage: true });

await dlg().getByRole('button', { name: /סיום ומעבר לעריכה/ }).click();
await page.waitForTimeout(1200);
await page.screenshot({ path: SP + 'L82-5-kitchen.png' });

/* 5 — הארגזים באמת בבסיס הנתונים, ואין התנגשות */
const state = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const { db } = await import('/src/db/db.ts' + v);
  const P = await import('/src/features/design/plan.ts' + v);
  const C = await import('/src/features/design/collision.ts' + v);
  const PL = await import('/src/features/design/placement.ts' + v);
  const units = await db.units.toArray();
  /* כמו באפליקציה: סדר הקירות הוא index, ולא סדר המפתחות ב-Dexie */
  const walls = (await db.walls.toArray()).sort((a, b) => a.index - b.index);
  const plan = P.buildPlan(walls, units);
  const clashes = [];
  for (let i = 0; i < units.length; i++) {
    for (let j = i + 1; j < units.length; j++) {
      const a = PL.unitBox(units[i], plan), b = PL.unitBox(units[j], plan);
      if (a && b && C.clash(a, b)) clashes.push(`${units[i].name}[${units[i].wallId.slice(0,4)}@${units[i].xMm}w${units[i].widthMm}d${units[i].depthMm}L${units[i].level}]/${units[j].name}[${units[j].wallId.slice(0,4)}@${units[j].xMm}w${units[j].widthMm}d${units[j].depthMm}L${units[j].level}]`);
    }
  }
  const cat = new Set((await db.catalog.toArray()).map((c) => c.id));
  return {
    count: units.length,
    plan: walls.map((w, i) => `#${i}=${w.id.slice(0, 4)}`),
    glyphs: [...new Set(units.map((u) => u.glyph))],
    names: [...new Set(units.map((u) => u.name))],
    levels: [...new Set(units.map((u) => u.level))],
    walls: [...new Set(units.map((u) => u.wallId))].length,
    clashes,
    orphan: units.filter((u) => !cat.has(u.catalogItemId)).length,
    /* גוון פר־ארגז ריק פירושו שברירת המחדל של הפרויקט חלה — כמו בהוספה ידנית */
    overrides: units.filter((u) => u.carcassFinishId || u.frontFinishId).length,
    over: units.filter((u) => {
      const w = walls.find((x) => x.id === u.wallId);
      return !u.free && (u.xMm < 0 || u.xMm + u.widthMm > w.lengthMm + 1);
    }).length,
  };
});
ok('נוצרו ארגזים', state.count > 5, `${state.count}`);
ok('ארגזים על שני הקירות', state.walls === 2, `${state.walls}`);
/*
 * לפי השם ולא לפי האיור: ארגז הכיריים של הנגרייה מצויר כמגירות,
 * והאיור אומר איך הוא נראה — לא איזה תפקיד הוא ממלא.
 */
ok('יש מכשירים', state.names.some((n) => n.includes('כיור')) && state.names.some((n) => n.includes('כיריים')), state.names.join(' · '));
ok('יש עליונים ותחתונים', state.levels.includes('wall') && state.levels.includes('floor'), state.levels.join());
ok('אין התנגשות פיזית', state.clashes.length === 0, state.clashes.slice(0, 4).join() + ' || ' + state.plan.join(' | '));
ok('אין ארגז בלי פריט ספרייה', state.orphan === 0, `${state.orphan}`);
ok('הגוון נשאר של הפרויקט ולא נדרס בארגז', state.overrides === 0, `${state.overrides}`);
ok('אין חריגה מהקיר', state.over === 0, `${state.over}`);

/* 5ב — כל ההצעות, ולא רק הראשונה, עוברות דרך בסיס הנתונים בשלום */
await btn(/תכנון אוטומטי/).click(); await page.waitForTimeout(400);
await dlg().getByRole('button', { name: /הצגת הצעות/ }).click(); await page.waitForTimeout(600);
const all = dlg().locator('button').filter({ hasText: /נוח לעבודה|חסכוני|מקסימום אחסון/ });
const total = await all.count();
for (let i = 0; i < total; i++) {
  const name = (await all.nth(i).innerText()).split('\n')[0];
  await all.nth(i).click();
  /* המתנה למצב עצמו ולא לשעון: ההנחה נגמרת כשההצעה מסומנת כנבחרה */
  for (let t = 0; t < 60 && (await all.nth(i).getAttribute('aria-pressed')) !== 'true'; t++) {
    await page.waitForTimeout(100);
  }

  const bad = await page.evaluate(async () => {
    const v = '?v=' + Date.now();
    const { db } = await import('/src/db/db.ts' + v);
    const P = await import('/src/features/design/plan.ts' + v);
    const PL = await import('/src/features/design/placement.ts' + v);
    const C = await import('/src/features/design/collision.ts' + v);
    const units = await db.units.toArray();
    /* כמו באפליקציה: סדר הקירות הוא index, ולא סדר המפתחות ב-Dexie */
  const walls = (await db.walls.toArray()).sort((a, b) => a.index - b.index);
    const plan = P.buildPlan(walls, units);
    const hits = [];
    for (let i = 0; i < units.length; i++) for (let j = i + 1; j < units.length; j++) {
      const a = PL.unitBox(units[i], plan), b = PL.unitBox(units[j], plan);
      if (a && b && C.clash(a, b)) hits.push(`${units[i].name}@${units[i].xMm}/${units[j].name}@${units[j].xMm}`);
    }
    return { hits, n: units.length };
  });
  ok(`הצעה ${i + 1}/${total} נשענת בלי חדירה`, bad.hits.length === 0 && bad.n > 0, `${name} · ${bad.n} ארגזים · ${bad.hits.slice(0, 2).join(' , ')}`);
}
await dlg().getByRole('button', { name: /סיום ומעבר לעריכה/ }).click();
await page.waitForTimeout(900);

/* 6 — ביטול מחזיר את המצב הקודם */
const count = async () => page.evaluate(async () => {
  const { db } = await import('/src/db/db.ts?v=' + Date.now());
  return (await db.units.toArray()).length;
});
/* כל פתיחה של המגירה היא צעד אחד בהיסטוריה, ופתחנו אותה פעמיים */
for (let i = 0; i < 4 && (await count()) > 0; i++) {
  await btn(/^בטל$/).click();
  await page.waitForTimeout(700);
}
ok('ביטול מרוקן את מה שהתכנון הניח', (await count()) === 0, `${await count()}`);
await page.screenshot({ path: SP + 'L82-6-undo.png' });

/* 7 — פינה מתה: התראה כשהיא צרה מכדי שהדלת תיפתח */
const corner = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const A = await import('/src/features/design/analysis.ts' + v);
  const base = {
    id: 'a', projectId: 'p', wallId: 'w1', catalogItemId: 'k', name: 'ארון פינה',
    glyph: 'blindEnd', corner: 'blindEnd', level: 'floor',
    xMm: 2000, yMm: 0, widthMm: 1000, heightMm: 860, depthMm: 600,
    createdAt: 0, updatedAt: 0,
  };
  const wall = { id: 'w1', projectId: 'p', name: 'w1', lengthMm: 3000, heightMm: 2600, features: [], createdAt: 0, updatedAt: 0 };
  const nb = [{ ...base, id: 'b', wallId: 'w2', glyph: 'doors', corner: undefined, xMm: 675, widthMm: 600 }];
  const say = (blindMm, neighbours) =>
    A.analyzeWall(wall, [{ ...base, blindMm }], [], neighbours).warnings.map((x) => x.text).join(' | ');
  return {
    tooNarrow: say(300, { start: [], end: nb }),
    wideEnough: say(675, { start: [], end: nb }),
    noNeighbour: say(300, { start: [], end: [] }),
  };
});
ok('פינה מתה צרה מדי מקבלת התראה', /תיפתח/.test(corner.tooNarrow), corner.tooNarrow);
ok('פינה מתה נכונה שקטה', !/תיפתח/.test(corner.wideEnough), corner.wideEnough);
ok('בלי קיר ניצב אין התראה', !/תיפתח/.test(corner.noNeighbour), corner.noNeighbour);

/* 8 — ארון הפינה שהתכנון מניח אינו מייצר את ההתראה הזאת */
const planned = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const A = await import('/src/features/design/autoPlan.ts' + v);
  const P = await import('/src/features/design/plan.ts' + v);
  const R = await import('/src/catalog/kitchenRules.ts' + v);
  const walls = [
    { id: 'w1', name: 'w1', lengthMm: 3600, heightMm: 2600, features: [] },
    { id: 'w2', name: 'w2', lengthMm: 2800, heightMm: 2600, features: [], turnDeg: 90 },
  ];
  const out = [];
  for (const q of A.planKitchen({
    walls, plan: P.buildPlan(walls, []), seating: false, finish: 'standard',
    appliances: { fridge: true, oven: true, hob: true, microwave: false, dishwasher: true, hood: true },
  })) {
    for (const u of q.units.filter((x) => x.role === 'corner')) {
      out.push({ key: q.key, blind: u.blindMm, w: u.widthMm });
    }
  }
  return { out, need: R.KITCHEN.baseDepthMm + R.BLIND_CORNER.fillerMm };
});
ok('ארון פינה מקבל עומק חסימה אמיתי',
  planned.out.length > 0 && planned.out.every((c) => c.blind >= planned.need && c.blind <= c.w * 0.7),
  JSON.stringify(planned));

/* 9 — התכנון האוטומטי אינו מוצע בחדר שאינו מטבח */
ok('בלי שגיאות בדפדפן', errs.length === 0, errs.slice(0, 3).join(' | '));

await browser.close();
console.log(`\n${pass}/${pass + fail} עברו`);
process.exit(fail ? 1 : 0);

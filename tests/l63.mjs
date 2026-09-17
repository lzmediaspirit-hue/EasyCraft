import './_exit.mjs';
/* שכבה 22 — חוקי הפיזיקה: נגיעה והכלה מותרות, חדירה חלקית לא */
import { chromium } from 'playwright';
import { setup, addUnit } from './mk.mjs';
const SP = new URL('shots/', import.meta.url).pathname;

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage({ viewport: { width: 400, height: 840 } });
const errs = [];
page.on('console', (m) => {
  if (m.type() !== 'error') return;
  if (/404/.test(m.text()) && /favicon/.test(m.location()?.url ?? '')) return;
  errs.push(m.text());
});
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
const ok = (name, cond, extra = '') =>
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
const btn = (re) => page.getByRole('button', { name: re }).first();

/**
 * מעמיד שני ארגזים במידות שנתנו, ומחזיר אם הם חודרים זה לזה.
 *
 * קודם זה נבדק דרך הטקסט "חודר לתוך ארון אחר" שהופיע על המסך.
 * אזהרות התכנון ירדו מהממשק לבקשת הבעלים, והבדיקה הזאת מעולם לא
 * הייתה על האזהרה אלא על החוזה שמתחתיה — ולכן היא שואלת אותו
 * ישירות. זו גם בדיקה טובה יותר: היא אינה תלויה בניסוח.
 *
 * מה שנבדק הוא בדיוק מה שחוסם הנחה בגרירה ובשמירה: חפיפה שאינה
 * הכלה. ארגז שנכנס *כולו* לתוך שני — מכשיר בתוך עמודה — הוא
 * הנחה לגיטימית, ושניים שנוגעים בדיוק אינם חופפים.
 */
async function place(a, b) {
  return page.evaluate(async ([pa, pb]) => {
    const v = '?v=' + Date.now();
    const { unitsClash } = await import('/src/features/design/collision.ts' + v);
    const { solidBox } = await import('/src/features/design/placement.ts' + v);
    const { buildPlan } = await import('/src/features/design/plan.ts' + v);
    const wall = { id: 'w1', name: 'קיר', lengthMm: 4000, heightMm: 2600, features: [] };
    const plan = buildPlan([wall], []);
    const mk = (p, id) => ({
      id, wallId: 'w1', projectId: 'p', name: id, glyph: 'doors', doors: 2,
      level: 'floor', socleMm: 0, counterMm: 0, rotationDeg: 0, ...p,
    });
    const one = mk(pa, 'a');
    const two = mk(pb, 'b');
    const ba = solidBox(one, plan);
    const bb = solidBox(two, plan);
    if (!ba || !bb) return false;
    return unitsClash({ unit: one, box: ba }, { unit: two, box: bb });
  }, [a, b]);
}

await setup(page);
await addUnit(page, 0);
await page.waitForTimeout(700);

/* --- מונחים זה לצד זה, נוגעים בדיוק --- */
const side = { xMm: 0, yMm: 0, widthMm: 600, heightMm: 800, depthMm: 580 };
ok('two cabinets that just touch are fine', !(await place(side, { ...side, xMm: 600 })));

/* --- מונחים זה על זה --- */
ok(
  'one standing on top of another is fine',
  !(await place(side, { ...side, yMm: 800 })),
);
await page.screenshot({ path: SP + 'L63-1-stacked.png' });

/* --- ארגז שנכנס כולו לתוך השני: מכשיר בתוך עמודה --- */
/*
 * הכלה דורשת חלל מוצהר, ולא רק "נכנס במידות": זו הדרישה שנקבעה
 * ב-A06 — עמודה שמצהירה על נישה מכילה מכשיר, וארון מדפים מלא לא.
 */
const tall = {
  xMm: 0, yMm: 0, widthMm: 600, heightMm: 2000, depthMm: 580,
  zones: [{ id: 'z', heightMm: 2000, kind: 'empty' }],
};
const oven = { xMm: 20, yMm: 800, widthMm: 560, heightMm: 590, depthMm: 560 };
ok('an appliance inside a tall unit is fine', !(await place(tall, oven)));
await page.screenshot({ path: SP + 'L63-2-nested.png' });

/* --- חזית שבולטת קדימה עדיין בפנים --- */
ok(
  'a proud front still counts as inside',
  !(await place(tall, { ...oven, depthMm: 620 })),
);

/* --- חדירה חלקית: דופן באמצע תחתית --- */
ok(
  'half in and half out is blocked',
  await place(side, { ...side, xMm: 300 }),
);
await page.screenshot({ path: SP + 'L63-3-clash.png' });

/* --- חדירה חלקית לגובה --- */
ok('sinking into the one below is blocked', await place(side, { ...side, yMm: 400 }));

/* --- חדירה חלקית בעומק בלבד --- */
ok(
  'a deeper cabinet poking through the back is fine when it only touches',
  !(await place(side, { ...side, xMm: 600, depthMm: 700 })),
);

ok('no console errors', errs.length === 0, errs.slice(0, 3).join(' | '));
await browser.close();

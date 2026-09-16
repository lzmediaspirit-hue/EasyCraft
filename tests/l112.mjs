import './_exit.mjs';
/*
 * שכבה 112 — הנחת ארגז על ארגז: הצמדה לפינה.
 *
 * החשבון נבדק על מספרים, ואחריו נבדקת הגרירה עצמה על הקיר. דוגמת
 * הקבלה של המבקר היא הראשונה ברשימה: תחתון ב-500 ברוחב 800 וגובה
 * 880, עליון ברוחב 600 — התחלה נותנת 500/880, סוף נותן 700/880.
 */
import { chromium } from 'playwright';
import { setup, addNamed } from './mk.mjs';

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + String(e).slice(0, 200)));
const btn = (re) => page.getByRole('button', { name: re }).first();
const out = [];
const ok = (name, cond, extra = '') => out.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' | ' + extra : ''}`);

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });

/* ------------------------------------------------------------------ */
/* החשבון                                                              */
/* ------------------------------------------------------------------ */

const math = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const S = await import('/src/features/design/stacking.ts' + v);
  const unit = (over) => ({
    id: 'u', wallId: 'w', level: 'wall', xMm: 0, yMm: 0,
    widthMm: 600, heightMm: 700, depthMm: 320, ...over,
  });
  const lower = unit({ id: 'low', level: 'floor', xMm: 500, yMm: 0, widthMm: 800, heightMm: 880 });
  const upper = unit({ id: 'up', widthMm: 600 });
  const tol = 120;

  const near = (x, y, hold) => S.stackSnap({ ...upper }, x, y, [lower], tol, hold);

  return {
    /* פינת ההתחלה */
    start: near(520, 900),
    /* פינת הסוף — 500 + 800 − 600 */
    end: near(690, 870),
    /* רחוק מדי לרוחב: אין הצמדה, גם כשהגובה מדויק */
    farX: near(1200, 880),
    /* רחוק מדי לגובה: ארגז באותו רוחב אבל בגובה אחר */
    farY: near(500, 1400),
    /* רוחב זהה — שתי הפינות נופלות על אותו מקום */
    same: S.stackSnap(unit({ widthMm: 800 }), 520, 900, [lower], tol),
    /* משטח עבודה: הוא שנושא, ולא ראש הגוף */
    counter: S.stackSnap({ ...upper }, 520, 920, [{ ...lower, counterMm: 40 }], tol),
    /*
     * יציבות היעד: שני שכנים ששתי הפינות שלהם באותו מרחק מהאצבע.
     * בלי זיכרון היעד קופץ ביניהם בכל תזוזה קטנה.
     */
    hold: (() => {
      const a = { ...lower, id: 'A', xMm: 250, widthMm: 600 };
      const b = { ...lower, id: 'B', xMm: 370, widthMm: 600 };
      return [
        S.stackSnap({ ...upper }, 310, 880, [a, b], tol)?.onId,
        S.stackSnap({ ...upper }, 310, 880, [a, b], tol, 'B')?.onId,
      ];
    })(),
    /* אי אינו נצמד לפינה על קיר */
    island: S.stackSnap(unit({ free: { xMm: 100, zMm: 100, headingDeg: 0 } }), 520, 900, [lower], tol),
    /* רצפה אינה יעד הנחה */
    floor: S.stackSnap({ ...upper }, 500, 0, [{ ...lower, heightMm: 0 }], tol),
    top: S.supportTopMm({ ...lower, counterMm: 30 }),
  };
});

ok('פינת התחלה — 500/880', math.start?.xMm === 500 && math.start?.yMm === 880 && math.start?.edge === 'start', JSON.stringify(math.start));
ok('פינת סוף — 700/880', math.end?.xMm === 700 && math.end?.yMm === 880 && math.end?.edge === 'end', JSON.stringify(math.end));
ok('רחוק לרוחב אינו נצמד', math.farX === null, JSON.stringify(math.farX));
ok('רחוק לגובה אינו נצמד', math.farY === null, JSON.stringify(math.farY));
ok('רוחב זהה נוחת על 500', math.same?.xMm === 500, JSON.stringify(math.same));
ok('משטח עבודה נושא — 920', math.counter?.yMm === 920, JSON.stringify(math.counter));
ok('היעד לא קופץ בין שכנים', math.hold[1] === 'B', JSON.stringify(math.hold));
ok('אי אינו נצמד לפינה על קיר', math.island === null, JSON.stringify(math.island));
ok('רצפה אינה יעד הנחה', math.floor === null, JSON.stringify(math.floor));
ok('משטח התמיכה כולל את השיש', math.top === 910, String(math.top));

/* ------------------------------------------------------------------ */
/* הגרירה עצמה                                                         */
/* ------------------------------------------------------------------ */

await setup(page, { name: 'הנחה', walls: 'קיר יחיד' });
await page.waitForTimeout(600);
await addNamed(page, /ארגז 3 מגירות|ארגז כיריים|ארגז תנור/);
await page.waitForTimeout(700);

/** קורא ישירות מ-IndexedDB, כמו שאר חבילות הגרירה */
const units = () =>
  page.evaluate(async () => {
    const dbh = await new Promise((res, rej) => {
      const r = indexedDB.open('easycraft');
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    return await new Promise((res) => {
      const g = dbh.transaction('units').objectStore('units').getAll();
      g.onsuccess = () =>
        res(g.result.map((u) => ({ id: u.id, x: u.xMm, y: u.yMm, w: u.widthMm, h: u.heightMm, lvl: u.level })));
    });
  });

/*
 * המצב של דוגמת הקבלה, בדיוק: תחתון ב-500 ברוחב 800 וגובה 880,
 * ומעליו עליון ברוחב 600 שעומד רחוק ממנו.
 */
const first = (await units())[0];
await page.evaluate(async (id) => {
  const dbh = await new Promise((res, rej) => {
    const r = indexedDB.open('easycraft');
    r.onsuccess = () => res(r.result);
    r.onerror = rej;
  });
  const tx = dbh.transaction('units', 'readwrite');
  const st = tx.objectStore('units');
  const row = await new Promise((res) => {
    const g = st.get(id);
    g.onsuccess = () => res(g.result);
  });
  st.put({ ...row, xMm: 500, yMm: 0, widthMm: 800, heightMm: 880, level: 'floor', floorLocked: true });
  st.put({
    ...row,
    id: 'qa-upper',
    xMm: 1800,
    yMm: 1500,
    widthMm: 600,
    heightMm: 700,
    depthMm: 320,
    level: 'wall',
    floorLocked: false,
    socleMm: 0,
    counterMm: 0,
  });
  /* הכתיבה נגמרת לפני הרענון — אחרת העסקה נקטעת ושום דבר לא נשמר */
  await new Promise((res) => (tx.oncomplete = res));
  dbh.close();
}, first.id);
/*
 * כתיבה ישירה ל-IndexedDB אינה מודיעה לשאילתה החיה, ולכן צריך
 * רענון — והרענון מחזיר למסך הבית, ומשם חוזרים אל הקיר.
 */
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await btn(/הנחה/).click();
await page.waitForTimeout(900);
await page.getByRole('button', { name: /מטבח/ }).first().click();
await page.waitForTimeout(1500);

const before = await units();
ok('שני ארגזים במצב ההתחלה', before.length === 2, JSON.stringify(before));

/* גרירה אמיתית: העליון אל פינת ההתחלה של התחתון */
const bb = await page.locator('svg g[data-unit-id="qa-upper"]').boundingBox();
ok('העליון מצויר על הקיר', !!bb, JSON.stringify(bb));
if (bb) {
  const pxPerMm = bb.width / 600;
  await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
  await page.mouse.down();
  /* יעד: x=520 (קרוב ל-500), y=900 (קרוב ל-880) — בתוך סף ההצמדה */
  await page.mouse.move(
    bb.x + bb.width / 2 - (1800 - 520) * pxPerMm,
    bb.y + bb.height / 2 + (1500 - 900) * pxPerMm,
    { steps: 16 },
  );
  await page.waitForTimeout(400);
  /* טקסט ב-SVG נקרא דרך textContent; ל-innerText אין משמעות שם */
  const hint = await page.locator('svg text').allTextContents();
  ok('קו העזר אומר על מי נוחתים', hint.some((t) => /^על .*פינת/.test(t)), JSON.stringify(hint.filter((t) => /פינת/.test(t))));
  await page.mouse.up();
  await page.waitForTimeout(800);
}

const after = (await units()).find((u) => u.id === 'qa-upper');
ok('נחת על פינת ההתחלה — 500/880', after?.x === 500 && after?.y === 880, JSON.stringify(after));

await browser.close();
for (const e of errs) out.push(e);
console.log(out.join('\n'));
const fail = out.filter((l) => l.startsWith('FAIL') || l.startsWith('pageerror')).length;
console.log(`${out.length - fail} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);

/*
 * ארון סגור לא מראה את מה שבתוכו — בשום זווית.
 *
 * זו בדיקה על התמונה ולא על סדר הרשימה: לכל נקודה על הארון נבדק
 * מי נצבע שם אחרון, ולא איפה הוא יושב במערך. סדר בין שני לוחות
 * שאינם נפגשים על המסך אינו אומר דבר, ובדיקה שהסתכלה על מספרים
 * סידוריים נכשלה בדיוק שם — בלי שאף פיקסל היה שגוי.
 *
 * הסדר המלא, כולל ארגז מסובב, נבדק ב-_paint.mjs במבחן קרן.
 */
import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });

const bad = await page.evaluate(async () => {
  const iso = await import('/src/features/design/isoScene.ts?v=' + Date.now());
  const wall = { id: 'w1', projectId: 'p', index: 0, lengthMm: 4000, heightMm: 2400, features: [], createdAt: 0, updatedAt: 0 };
  const base = {
    id: 'u', projectId: 'p', wallId: 'w1', catalogItemId: 'c', name: 'x', glyph: 'base',
    level: 'base', xMm: 1000, yMm: 0, widthMm: 800, heightMm: 900, depthMm: 580,
    createdAt: 0, updatedAt: 0, backKind: 'thin',
  };
  /* כל אחד מהם ארון שדלת מכסה את כולו — ולכן אין ממנו מה לראות פנימה */
  const cases = [
    ['shelves', { doors: 2, shelves: 3 }],
    ['inner drawers', { drawers: 3, drawerStyle: 'inner', doors: 1 }],
    ['rod', { doors: 2, heightMm: 2000, zones: [{ id: 'z1', kind: 'rod', heightMm: 2000 }] }],
    ['columns', { doors: 2, widthMm: 1200, zones: [{ id: 'z1', kind: 'shelves', shelves: 2, heightMm: 900, columns: [
      { id: 'c1', kind: 'shelves', shelves: 2, widthShare: 0.5 },
      { id: 'c2', kind: 'shelves', shelves: 3, widthShare: 0.5 }] }] }],
    ['no back', { doors: 1, shelves: 3, backKind: 'none' }],
    ['socle and counter', { doors: 2, shelves: 2, socleMm: 100, counterMm: 40 }],
    ['handles and led', { doors: 2, shelves: 2, handles: true, led: ['top', 'shelf'] }],
    ['glass doors', { doors: 2, shelves: 2, glassDoors: true }],
  ];
  const INSIDE = /-sh-|-rod-|-div-|-sep|-bk-/;
  const inside = (pts, px, py) => {
    let on = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) on = !on;
    }
    return on;
  };
  const fails = [];
  for (const [name, spec] of cases) {
    for (let yaw = -120; yaw <= 30; yaw += 10) {
      for (const rise of [0.15, 0.5, 0.9]) {
        const s = iso.buildScene({
          walls: [wall], units: [{ ...base, ...spec }], activeWallId: 'w1', selectedId: null,
          inside: false, finishHex: {}, present: false, view: { yawDeg: yaw, rise },
        });
        const mine = s.faces
          .filter((f) => f.unitId === 'u')
          .map((f) => ({ key: f.key, glass: f.glass, pts: f.points.split(' ').map((q) => q.split(',').map(Number)) }));
        if (!mine.length) continue;
        const all = mine.flatMap((f) => f.pts);
        const x0 = Math.min(...all.map((q) => q[0])), x1 = Math.max(...all.map((q) => q[0]));
        const y0 = Math.min(...all.map((q) => q[1])), y1 = Math.max(...all.map((q) => q[1]));
        for (let a = 1; a < 24; a++) {
          for (let b = 1; b < 24; b++) {
            const px = x0 + ((x1 - x0) * a) / 24 + 0.13;
            const py = y0 + ((y1 - y0) * b) / 24 + 0.21;
            let last = null;
            for (const f of mine) if (inside(f.pts, px, py)) last = f;
            /* דלת זכוכית שקופה בכוונה — דרכה מותר לראות פנימה */
            if (last && INSIDE.test(last.key) && !spec.glassDoors) {
              fails.push({ name, yaw: s.view.yawDeg, rise, seen: last.key });
            }
          }
        }
      }
    }
  }
  return fails;
});
await browser.close();
const kinds = new Map();
for (const f of bad) kinds.set(`${f.name}: ${f.seen}`, (kinds.get(`${f.name}: ${f.seen}`) ?? 0) + 1);
for (const [k, n] of [...kinds].slice(0, 10)) console.log('FAIL ', k, n);
console.log(bad.length ? `${bad.length} points show the inside of a closed box` : 'a closed box shows nothing inside, at every angle');

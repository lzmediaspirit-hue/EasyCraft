import './_exit.mjs';
/*
 * מבחן ההדמיה, בכל זווית ובכל תוכן.
 *
 * ארבעת הארגזים שנגר באמת בונה — דלתות, פתוח, מגירות ופינה מתה —
 * וכל מה שיכול לשבת בתוך תא: מדפים, מדפי זכוכית, מוט, מגירות
 * חיצוניות ופנימיות, קושרות, אזור בגובה קבוע, אזור רדוד, חזית
 * לתא וחזית שמכסה כמה תאים.
 *
 * הסריקה עוברת גם על הקיר הפעיל וגם על הזווית. `buildScene` מגביל
 * את הזווית לטווח של הקיר שעובדים עליו, ולכן סריקה על קיר אחד
 * בודקת 150 מעלות בלבד; שלושת הקירות יחד מכסים כמעט את המעגל.
 *
 * שלוש שאלות על כל תמונה:
 *   1. כל נקודה סופית — NaN אחד הופך מצולע לחור שחור.
 *   2. מבחן קרן: מה שנצבע אחרון בנקודה הוא מה שהקרן פוגשת ראשון.
 *   3. ארון סגור אינו מראה את מה שבתוכו.
 */
import { chromium } from 'playwright';

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });

const out = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const iso = await import('/src/features/design/isoScene.ts' + v);
  const math = await import('/src/features/design/isoMath.ts' + v);

  const wall = (id, index, lengthMm, turnDeg) => ({
    id, projectId: 'p', index, lengthMm, heightMm: 2400,
    features: [], turnDeg, createdAt: 0, updatedAt: 0,
  });
  /* שלושה קירות: ככה מגיעים לכל הזוויות */
  const walls = [wall('w1', 0, 4000), wall('w2', 1, 3000, 90), wall('w3', 2, 4000, 90)];

  const base = {
    projectId: 'p', catalogItemId: 'c', name: 'x',
    level: 'floor', yMm: 0, widthMm: 800, heightMm: 880, depthMm: 580,
    socleMm: 100, createdAt: 0, updatedAt: 0, backKind: 'thin',
  };

  const z = (id, kind, heightMm, extra = {}) => ({ id, kind, heightMm, ...extra });

  /* ארבעת הארגזים, וכל מה שיכול לשבת בתוך תא */
  const kinds = [
    ['דלתות · מדפים', { glyph: 'doors', doors: 2, shelves: 3 }],
    ['דלתות · מדפי זכוכית', { glyph: 'doors', doors: 2, glassDoors: true,
      zones: [z('a', 'shelves', 880, { shelves: 3, glassShelves: true })] }],
    ['דלתות · מוט תלייה', { glyph: 'doors', doors: 2, heightMm: 2000,
      zones: [z('a', 'rod', 2000)] }],
    ['דלתות · מגירות פנימיות', { glyph: 'doors', doors: 1, drawers: 3, drawerStyle: 'inner' }],
    ['דלתות · קושרות ועמודות', { glyph: 'doors', doors: 2, widthMm: 1400,
      zones: [z('a', 'shelves', 880, { columns: [
        { id: 'c1', kind: 'shelves', shelves: 2, widthShare: 0.4 },
        { id: 'c2', kind: 'drawers', drawers: 3, widthShare: 0.6 },
      ] })] }],
    ['דלתות · אזור קבוע ואזור רדוד', { glyph: 'doors', doors: 2, heightMm: 2100,
      zones: [
        z('a', 'drawers', 900, { drawers: 3, fixedHeight: true }),
        z('b', 'shelves', 1200, { shelves: 2, depthMm: 320, frontSplit: true, doors: 1 }),
      ] }],
    ['דלתות · תא פתוח בתוך ארון', { glyph: 'doors', doors: 2, heightMm: 2100,
      zones: [
        z('a', 'shelves', 700, { shelves: 1 }),
        z('b', 'empty', 700, { frontSplit: true, doors: 0 }),
        z('c', 'shelves', 700, { shelves: 1, frontSplit: true, doors: 2 }),
      ] }],
    ['ארגז פתוח', { glyph: 'open', shelves: 3 }],
    ['ארגז מגירות', { glyph: 'drawers', drawers: 4 }],
    ['ארגז מגירות · שתי עמודות', { glyph: 'drawers', drawers: 3, drawerCols: 2, widthMm: 900 }],
    ['פינה מתה שמאל', { glyph: 'blindStart', corner: 'blindStart', doors: 1, widthMm: 1000, blindMm: 400, shelves: 2 }],
    ['פינה מתה ימין', { glyph: 'blindEnd', corner: 'blindEnd', doors: 1, widthMm: 1000, blindMm: 400, shelves: 2 }],
    ['קושרות במקום תקרה וגב', { glyph: 'doors', doors: 2, shelves: 2, rails: { top: true, back: true } }],
    ['גב בגובה חלקי', { glyph: 'doors', doors: 2, shelves: 2, backHeightMm: 300 }],
    ['בלי גב', { glyph: 'doors', doors: 2, shelves: 2, backKind: 'none' }],
    ['ידיות ולד', { glyph: 'doors', doors: 2, shelves: 2, handles: true, led: ['top', 'shelf', 'start'] }],
    ['משטח ודופן זרה', { glyph: 'doors', doors: 2, shelves: 2, counterMm: 30,
      exposed: { start: true, end: true } }],
  ];

  /** קרן: איזה לוח הקרן פוגשת ראשון בנקודה הזאת */
  const inPoly = (pts, px, py) => {
    let on = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) on = !on;
    }
    return on;
  };
  const parse = (s) => s.split(' ').map((q) => q.split(',').map(Number));

  const bad = [];
  let faceCount = 0;
  let checked = 0;

  for (const [name, spec] of kinds) {
    /* אותו ארגז על כל אחד משלושת הקירות — כל קיר וכיוונו */
    const units = walls.map((w, i) => ({
      ...base, ...spec, id: `u${i}`, wallId: w.id, xMm: 900,
    }));

    for (const activeWallId of ['w1', 'w2', 'w3']) {
    for (let yaw = -300; yaw <= 30; yaw += 15) {
      for (const rise of [0.12, 0.3, 0.5, 0.7, 0.95]) {
        checked++;
        const scene = iso.buildScene({
          walls, units, activeWallId, selectedId: null, inside: false,
          finishHex: {}, present: false, view: { yawDeg: yaw, rise },
        });
        faceCount += scene.faces.length;

        /* 1 — כל נקודה סופית, וכל מצולע הוא מצולע */
        for (const f of scene.faces) {
          const pts = parse(f.points);
          if (pts.length < 3) { bad.push(`${name} yaw=${yaw} rise=${rise}: פאה עם ${pts.length} נקודות`); break; }
          if (pts.some(([a, b]) => !Number.isFinite(a) || !Number.isFinite(b))) {
            bad.push(`${name} yaw=${yaw} rise=${rise}: נקודה לא סופית ב-${f.key}`);
            break;
          }
        }
        for (const b of scene.backdrops) {
          for (const s of [b.wall, ...b.thickness, ...b.onWall.map((o) => o.points)]) {
            if (!s) continue;
            if (parse(s).some(([a, c]) => !Number.isFinite(a) || !Number.isFinite(c))) {
              bad.push(`${name} yaw=${yaw} rise=${rise}: רקע לא סופי`);
              break;
            }
          }
        }
        if (!Number.isFinite(scene.bounds[0]?.[0])) {
          bad.push(`${name} yaw=${yaw} rise=${rise}: מסגרת ריקה`);
        }
      }
    }
    }

    /*
     * 2 — ארון סגור לא מראה את מה שבתוכו, בכל זווית.
     *
     * הדגימה היא רשת על הצללית ולא מרכזי פאות: מרכז מדף נופל
     * בדיוק על התפר שבין שתי הדלתות, ושם באמת רואים פנימה — זה
     * מרווח של 4 מ"מ שקיים גם בארון אמיתי.
     */
    /*
       ארון סגור הוא ארון שאין בו פתח בכוונה: יש לו דלתות אטומות,
       תקרה, גב מלא, ואף תא שלא נפתח בנפרד. ארון עם קושרות או בלי
       גב פתוח מרצון — ורואים דרכו, וזה נכון.
    */
    const openCell = (spec.zones ?? []).some((q) => q.doors === 0 && q.frontSplit);
    const openBack = spec.rails?.top || spec.rails?.back || spec.backKind === 'none'
      || spec.backHeightMm !== undefined;
    const closed = (spec.doors ?? 0) > 0 && !spec.glassDoors && spec.glyph !== 'open'
      && !openCell && !openBack;
    if (closed) {
      /*
         מה שנמצא בתוך הארון בלבד. מגירה חיצונית אינה כאן: היא
         חזית לכל דבר, יושבת באותו מישור של הדלתות ונראית. הגב
         גם לא: מאחורי הארון רואים אותו, וזה נכון.
      */
      const INSIDE = /-sh-|-rod-|-div-|-sep/;
      /*
         הצלע הקדמית של חוצץ בין אזורים אינה "פנים": החוצץ נבנה
         בעומק מלא, וקצהו נראה במרווח שבין מגירה לדלת שמעליה —
         בדיוק כמו בארון אמיתי.
      */
      const REVEAL = /-sep-f$/;
      for (const activeWallId of ['w1', 'w2', 'w3']) {
      for (let yaw = -300; yaw <= 30; yaw += 15) {
        for (const rise of [0.15, 0.5, 0.9]) {
          const scene = iso.buildScene({
            walls, units: [{ ...base, ...spec, id: 'solo', wallId: 'w1', xMm: 900 }],
            activeWallId, selectedId: null, inside: false,
            finishHex: {}, present: false, view: { yawDeg: yaw, rise },
          });
          const mine = scene.faces
            .filter((f) => f.unitId === 'solo')
            .map((f) => ({ key: f.key, pts: parse(f.points) }));
          if (!mine.length) continue;
          const all = mine.flatMap((f) => f.pts);
          const x0 = Math.min(...all.map((q) => q[0]));
          const x1 = Math.max(...all.map((q) => q[0]));
          const y0 = Math.min(...all.map((q) => q[1]));
          const y1 = Math.max(...all.map((q) => q[1]));
          /*
             חור אמיתי ולא תפר: המרווח בין שתי דלתות הוא 4 מ"מ,
             והוא קיים גם בארון אמיתי. לכן נדרש שהפנים ייראה גם
             שמונה יחידות ימינה ושמאלה — תפר לא שורד את זה, וחור
             שנגר יראה כן.
          */
          const topAt = (px, py) => {
            let last = null;
            for (const f of mine) if (inPoly(f.pts, px, py)) last = f.key;
            return last;
          };
          for (let a = 1; a < 20; a++) {
            for (let b = 1; b < 20; b++) {
              const px = x0 + ((x1 - x0) * a) / 20 + 0.13;
              const py = y0 + ((y1 - y0) * b) / 20 + 0.21;
              const last = topAt(px, py);
              if (!last || !INSIDE.test(last) || REVEAL.test(last)) continue;
              const l = topAt(px - 8, py);
              const r = topAt(px + 8, py);
              if (!l || !r || !INSIDE.test(l) || !INSIDE.test(r)) continue;
              bad.push(`${name} yaw=${yaw} rise=${rise}: רואים לתוך ארון סגור (${last})`);
            }
          }
        }
      }
      }
    }
  }

  return { bad: [...new Set(bad)].slice(0, 25), badCount: bad.length, checked, faceCount };
});

console.log(`נבדקו ${out.checked} תמונות, ${out.faceCount} פאות`);
if (out.badCount) {
  console.log(`FAIL ${out.badCount} בעיות`);
  for (const b of out.bad) console.log('  ' + b);
} else {
  console.log('PASS הכול תקין בכל הזוויות');
}
if (errs.length) console.log('PAGEERROR ' + errs.slice(0, 3).join(' | '));
await browser.close();

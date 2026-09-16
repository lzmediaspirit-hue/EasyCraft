import './_exit.mjs';
/*
 * מבחן קרן על החדר האמיתי, במעגל שלם.
 *
 * `_paint.mjs` בודק את מנוע הסדר על לוחות שנבנו ביד; כאן נבדק מה
 * שהאפליקציה באמת מציירת — ארבעת הארגזים, קיר עם חלון ועמוד,
 * שלושה קירות — ובכל זווית שהמשתמש יכול להגיע אליה.
 *
 * לכל נקודה על המסך נשאלת שאלה שאינה תלויה בקוד המיון: איזה לוח
 * הקרן פוגשת ראשון. מה שנצבע שם אחרון חייב להיות אותו לוח.
 */
import { chromium } from 'playwright';

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });

const res = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const iso = await import('/src/features/design/isoScene.ts' + v);
  const math = await import('/src/features/design/isoMath.ts' + v);
  const { COS30 } = math;

  const wall = (id, index, lengthMm, turnDeg, features = []) => ({
    id, projectId: 'p', index, lengthMm, heightMm: 2400, features, turnDeg,
    createdAt: 0, updatedAt: 0,
  });
  const walls = [
    wall('w1', 0, 4200, undefined, [
      { id: 'win', kind: 'window', xMm: 1600, yMm: 900, widthMm: 1000, heightMm: 1200 },
      { id: 'col', kind: 'pillar', xMm: 3000, yMm: 0, widthMm: 300, heightMm: 2400, depthMm: 250 },
    ]),
    wall('w2', 1, 3000, 90),
    wall('w3', 2, 4200, 90),
  ];
  const base = {
    projectId: 'p', catalogItemId: 'c', name: 'x', glyph: 'doors',
    level: 'floor', yMm: 0, heightMm: 880, depthMm: 580, socleMm: 100,
    counterMm: 30, createdAt: 0, updatedAt: 0, backKind: 'thin',
  };
  const units = [
    { ...base, id: 'a', wallId: 'w1', xMm: 0, widthMm: 900, doors: 2, shelves: 3, handles: true },
    { ...base, id: 'b', wallId: 'w1', xMm: 900, widthMm: 600, glyph: 'drawers', drawers: 4 },
    { ...base, id: 'c', wallId: 'w1', xMm: 1500, widthMm: 700, glyph: 'open', shelves: 2 },
    { ...base, id: 'd', wallId: 'w2', xMm: 0, widthMm: 1000, glyph: 'blindStart',
      corner: 'blindStart', doors: 1, blindMm: 400, shelves: 2 },
    { ...base, id: 'e', wallId: 'w2', xMm: 1000, widthMm: 800, doors: 2, shelves: 3,
      level: 'wall', yMm: 1500, heightMm: 700, depthMm: 320, socleMm: 0, counterMm: 0 },
    { ...base, id: 'f', wallId: 'w3', xMm: 400, widthMm: 600, doors: 1,
      level: 'tall', heightMm: 2100, counterMm: 0, shelves: 5 },
  ];

  /** חיתוך קרן עם לוח, בצירים המקומיים שלו */
  const hit = (s, o, dir) => {
    const f = s.frame;
    const rel = { x: o.x - f.origin.x, y: o.y - f.origin.y, z: o.z - f.origin.z };
    const oL = [rel.x * f.ax.x + rel.z * f.ax.z, rel.y, rel.x * f.az.x + rel.z * f.az.z];
    const dL = [dir.x * f.ax.x + dir.z * f.ax.z, dir.y, dir.x * f.az.x + dir.z * f.az.z];
    let lo = -Infinity, hi = Infinity;
    for (let i = 0; i < 3; i++) {
      if (Math.abs(dL[i]) < 1e-9) {
        if (oL[i] < s.lo[i] || oL[i] > s.hi[i]) return null;
        continue;
      }
      let t0 = (s.lo[i] - oL[i]) / dL[i];
      let t1 = (s.hi[i] - oL[i]) / dL[i];
      if (t0 > t1) [t0, t1] = [t1, t0];
      lo = Math.max(lo, t0);
      hi = Math.min(hi, t1);
      if (lo > hi) return null;
    }
    return hi;
  };
  const inPoly = (pts, px, py) => {
    let on = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) on = !on;
    }
    return on;
  };

  const fails = [];
  let probes = 0;
  /*
   * גם הקיר הפעיל משתנה: `buildScene` מגביל את הזווית לטווח של
   * הקיר שעובדים עליו, ולכן סריקה על קיר אחד בודקת 150 מעלות
   * בלבד. שלושת הקירות יחד מכסים כמעט את המעגל.
   */
  for (const activeWallId of ['w1', 'w2', 'w3']) {
  for (let yaw = -300; yaw <= 30; yaw += 15) {
    for (const rise of [0.15, 0.35, 0.5, 0.75, 0.95]) {
      const s = iso.buildScene({
        walls, units, activeWallId, selectedId: null, inside: false,
        finishHex: {}, present: false, view: { yawDeg: yaw, rise },
      });
      const solids = s.solids;
      const poly = s.faces.map((f) => ({
        owner: f.points && f.key.slice(0, f.key.lastIndexOf('-')),
        pts: f.points.split(' ').map((q) => q.split(',').map(Number)),
      }));
      if (!poly.length) continue;
      const all = poly.flatMap((p) => p.pts);
      const x0 = Math.min(...all.map((q) => q[0])), x1 = Math.max(...all.map((q) => q[0]));
      const y0 = Math.min(...all.map((q) => q[1])), y1 = Math.max(...all.map((q) => q[1]));
      const rad = (s.view.yawDeg * Math.PI) / 180;
      const cos = Math.cos(rad), sin = Math.sin(rad);
      const dir = { x: cos + sin, y: 2 * rise, z: cos - sin };
      for (let a = 1; a < 30; a++) {
        for (let b = 1; b < 30; b++) {
          const px = x0 + ((x1 - x0) * a) / 30 + 0.137;
          const py = y0 + ((y1 - y0) * b) / 30 + 0.211;
          const rx = px / COS30;
          const o = { x: rx * cos, y: rx * rise - py, z: -rx * sin };
          let bestT = -Infinity, truth = null;
          for (const q of solids) {
            const t = hit(q, o, dir);
            if (t !== null && t > bestT) { bestT = t; truth = q.key; }
          }
          let painted = null;
          for (const p of poly) if (inPoly(p.pts, px, py)) painted = p.owner;
          /* נקודה על קו המתאר אינה אומרת דבר: שם ההפרש הוא רוחב הקו */
          let onEdge = false;
          for (const p of poly) {
            for (let k = 0; k < p.pts.length && !onEdge; k++) {
              const [ax, ay] = p.pts[k];
              const [bx, by] = p.pts[(k + 1) % p.pts.length];
              const dx = bx - ax, dy = by - ay;
              const L2 = dx * dx + dy * dy;
              if (!L2) continue;
              let t = ((px - ax) * dx + (py - ay) * dy) / L2;
              t = Math.max(0, Math.min(1, t));
              const qx = ax + dx * t, qy = ay + dy * t;
              if (Math.hypot(px - qx, py - qy) < 3) onEdge = true;
            }
            if (onEdge) break;
          }
          if (onEdge) continue;
          probes++;
          if (painted !== truth) {
            fails.push(`yaw=${yaw} rise=${rise}: נצבע ${painted ?? '—'} אבל הקרן פוגשת ${truth ?? '—'}`);
          }
        }
      }
    }
  }
  }
  return { fails: [...new Set(fails)].slice(0, 20), n: fails.length, probes };
});

console.log(`${res.n} wrong of ${res.probes} probes (${((res.n / Math.max(res.probes, 1)) * 100).toFixed(2)}%)`);
for (const f of res.fails) console.log('  ' + f);
await browser.close();

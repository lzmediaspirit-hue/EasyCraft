/*
 * האם התמונה נכונה: מבחן קרן.
 *
 * לכל נקודה על המסך נשאלת שאלה שאינה תלויה בקוד המיון — איזה לוח
 * הקרן פוגשת ראשון — ומשווים אותה ללוח שצויר אחרון באותה נקודה.
 * זה האורים של ההדמיה: מה שהעין רואה חייב להיות מה שבאמת שם.
 */
import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });

const res = await page.evaluate(async () => {
  const m = await import('/src/features/design/isoMath.ts?v=' + Date.now());
  const { projector, frameOf, slab, solidFaces, orderSolids, COS30 } = m;

  /** מסגרת של ארון שעומד ב-(px,pz) ופונה בזווית a */
  const frameAt = (px, pz, aDeg) => {
    const a = (aDeg * Math.PI) / 180;
    const f = { x: Math.cos(a), z: Math.sin(a) };
    const side = { x: Math.sin(a), z: -Math.cos(a) };
    return frameOf((lx, lz) => [px + side.x * lx + f.x * lz, pz + side.z * lx + f.z * lz]);
  };

  /** ארון מלא: גוף, גב, מדפים, קושרת, דלת, משטח ודופן זרה */
  const cabinet = (fr, tag, { w = 800, h = 900, d = 580, t = 18, bt = 4, shelves = 3 } = {}) => {
    const out = [
      slab(fr, 0, 0, 0, t, h, d, '#e8dcc8', `${tag}-l`),
      slab(fr, w - t, 0, 0, t, h, d, '#e8dcc8', `${tag}-r`),
      slab(fr, t, 0, 0, w - 2 * t, t, d, '#e8dcc8', `${tag}-b`),
      slab(fr, t, h - t, 0, w - 2 * t, t, d, '#e8dcc8', `${tag}-t`),
      slab(fr, t, t, 0, w - 2 * t, h - 2 * t, bt, '#d8ccb8', `${tag}-bk`),
      slab(fr, t, 0, d, w - 2 * t, h, 18, '#d9c3a5', `${tag}-door`),
      slab(fr, -20, h, 0, w + 40, 40, d + 20, '#78716c', `${tag}-cnt`),
      slab(fr, -40, 0, 0, 18, h, d + 22, '#c8935a', `${tag}-ep`),
    ];
    for (let i = 1; i <= shelves; i++) {
      const y = (h * i) / (shelves + 1);
      out.push(slab(fr, t, y, bt, w - 2 * t, t, d - 20 - bt, '#e8dcc8', `${tag}-sh${i}`));
      out.push(slab(fr, t, y - 16, d - 56, w - 2 * t, 16, 16, '#f59e0b', `${tag}-ledsh${i}`));
    }
    out.push(slab(fr, w / 2 - t / 2, t, bt, t, h - 2 * t, d - 20 - bt, '#e8dcc8', `${tag}-div`));
    /* רגליים נסוגות, פסי לד מסביב, ידית, לוח סתימה, מגירות ומוט */
    out.push(slab(fr, 0, -100, 0, w, 100, d - 50, '#a8a29e', `${tag}-soc`));
    out.push(slab(fr, 0, h, d - 16, w, 16, 16, '#f59e0b', `${tag}-ledtop`));
    out.push(slab(fr, -16, 0, d - 16, 16, h, 16, '#f59e0b', `${tag}-ledside`));
    out.push(slab(fr, w * 0.4, h * 0.36, d + 18, 30, h * 0.28, 30, '#57534e', `${tag}-hdl`));
    out.push(slab(fr, t, h * 0.1, d - 60, w * 0.3, h * 0.16, 20, '#d9c3a5', `${tag}-drin`));
    out.push(slab(fr, t, h * 0.32, d, w * 0.3, h * 0.16, 18, '#d9c3a5', `${tag}-drout`));
    out.push(slab(fr, t, h * 0.8, d / 2 - 15, w - 2 * t, 30, 30, '#a8a29e', `${tag}-rod`));
    return out;
  };

  /*
   * שלושה ארונות צמודים על קיר, אי מסובב בחדר, ומכשיר שמונח בתוך
   * עמודה — כי הנחה זה בתוך זה מותרת עכשיו, וגם היא חייבת להיראות.
   */
  const colFrame = frameAt(1900, 0, 90);
  const solids = [
    ...cabinet(frameAt(0, 0, 90), 'a'),
    ...cabinet(frameAt(950, 0, 90), 'b', { w: 600, h: 2000 }),
    ...cabinet(colFrame, 'col', { w: 700, h: 2100, shelves: 1 }),
    ...cabinet(frameAt(3400, 1600, 20), 'isle', { w: 700 }),
    // מכשיר שמונח בתוך העמודה — הנחה זה בתוך זה מותרת, וגם היא חייבת להיראות
    slab(colFrame, 30, 100, 30, 300, 500, 500, '#d6d3d1', 'oven'),
    // עמוד שעומד בחדר, במסגרת של הקיר
    slab(frameOf((lx, lz) => [lx, lz]), -900, 0, -200, 300, 2400, 260, '#cbd5e1', 'pillar'),
  ];

  /** חיתוך קרן עם לוח, בקואורדינטות המקומיות שלו */
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
    return hi; // הקצה שקרוב לצופה: t גדול = קרוב
  };

  const inside = (pts, px, py) => {
    let on = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) on = !on;
    }
    return on;
  };

  const fails = [];
  let probes = 0;
  for (let yaw = -120; yaw <= 30; yaw += 15) {
    for (const rise of [0.15, 0.35, 0.5, 0.75, 0.95]) {
      const v = projector({ yawDeg: yaw, rise });
      const ordered = orderSolids(solids, v);
      const faces = ordered.flatMap((s) => solidFaces(s, v).map((f) => ({ ...f, owner: s.key })));
      const poly = faces.map((f) => ({
        owner: f.owner,
        pts: f.points.split(' ').map((q) => q.split(',').map(Number)),
      }));
      const all = poly.flatMap((p) => p.pts);
      const x0 = Math.min(...all.map((q) => q[0])), x1 = Math.max(...all.map((q) => q[0]));
      const y0 = Math.min(...all.map((q) => q[1])), y1 = Math.max(...all.map((q) => q[1]));
      const cos = Math.cos((yaw * Math.PI) / 180), sin = Math.sin((yaw * Math.PI) / 180);
      const dir = { x: cos + sin, y: 2 * rise, z: cos - sin };
      for (let a = 1; a < 40; a++) {
        for (let b = 1; b < 40; b++) {
          const px = x0 + ((x1 - x0) * a) / 40 + 0.137;
          const py = y0 + ((y1 - y0) * b) / 40 + 0.211;
          // נקודה על הקרן שעוברת דרך (px,py)
          const rx = px / COS30;
          const o = { x: rx * cos, y: rx * rise - py, z: -rx * sin };
          let bestT = -Infinity, truth = null;
          for (const s of solids) {
            const t = hit(s, o, dir);
            if (t !== null && t > bestT) { bestT = t; truth = s.key; }
          }
          let painted = null;
          for (const p of poly) if (inside(p.pts, px, py)) painted = p.owner;
          /*
           * נקודה שנופלת על קו המתאר עצמו אינה אומרת דבר על הסדר:
           * שם ההפרש בין "פוגע" ל"לא פוגע" הוא רוחב הקו. נבדקות רק
           * נקודות שיושבות בבירור בתוך פאה.
           */
          let onEdge = false;
          for (const p of poly) {
            for (let k = 0; k < p.pts.length && !onEdge; k++) {
              const [ax, ay] = p.pts[k];
              const [bx, by] = p.pts[(k + 1) % p.pts.length];
              const vx = bx - ax, vy = by - ay;
              const len2 = vx * vx + vy * vy;
              if (!len2) continue;
              let tt = ((px - ax) * vx + (py - ay) * vy) / len2;
              tt = Math.max(0, Math.min(1, tt));
              const dx = px - (ax + vx * tt), dy = py - (ay + vy * tt);
              if (dx * dx + dy * dy < 4) onEdge = true;
            }
            if (onEdge) break;
          }
          if (onEdge) continue;
          probes++;
          if (truth !== painted) {
            fails.push({ yaw, rise, truth, painted });
          }
        }
      }
    }
  }
  return { fails, probes };
});
await browser.close();
const seen = new Map();
for (const f of res.fails) {
  const k = `${f.truth} -> ${f.painted}`;
  seen.set(k, (seen.get(k) ?? 0) + 1);
}
for (const [k, n] of [...seen].sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log('  ', k, n);
console.log(`${res.fails.length} wrong of ${res.probes} probes (${((res.fails.length / res.probes) * 100).toFixed(2)}%)`);

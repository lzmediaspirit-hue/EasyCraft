/*
 * מבקר ההדמיה: מריץ את buildScene ואת ציור החזית ישירות דרך שרת
 * הפיתוח, וסופר פאות במקום להסתכל בתמונות. מה שאי אפשר לספור
 * אי אפשר לתקן.
 */
import { chromium } from 'playwright';

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });

const out = await page.evaluate(async () => {
  const iso = await import('/src/features/design/isoScene.ts?v=' + Date.now());
  const zones = await import('/src/catalog/zones.ts');
  const placement = await import('/src/features/design/placement.ts');
  const collision = await import('/src/features/design/collision.ts');
  const plan = await import('/src/features/design/plan.ts');

  const wall = {
    id: 'w1', projectId: 'p', index: 0, lengthMm: 6000, heightMm: 2400,
    features: [], createdAt: 0, updatedAt: 0,
  };
  const base = {
    projectId: 'p', wallId: 'w1', catalogItemId: 'c', name: 'x', glyph: 'base',
    level: 'base', xMm: 0, yMm: 0, widthMm: 600, heightMm: 820, depthMm: 580,
    createdAt: 0, updatedAt: 0, backKind: 'thin',
  };

  const scene = (units, opts = {}) =>
    iso.buildScene({
      walls: [wall], units, activeWallId: 'w1', selectedId: null,
      inside: false, finishHex: {}, present: false,
      view: { yawDeg: 0, rise: 0.5 }, ...opts,
    });

  const keysOf = (s, id) =>
    s.faces.filter((f) => f.unitId === id).map((f) => f.key.replace(/-[stf]$/, ''));
  const uniq = (a) => [...new Set(a)];

  const report = [];
  const check = (name, got, want) =>
    report.push({ name, ok: JSON.stringify(got) === JSON.stringify(want), got, want });

  /* --- 1. חזיתות: מספר דלתות לכל תא --- */
  const splitDoors = {
    ...base, id: 'u1', doors: 2, heightMm: 1600,
    zones: [
      { id: 'z1', kind: 'drawers', drawers: 2, drawerStyle: 'outer', heightMm: 600 },
      { id: 'z2', kind: 'shelves', shelves: 2, heightMm: 1000, frontSplit: true, doors: 1 },
    ],
  };
  check(
    'front-split zone keeps its own door count',
    zones.unitFronts(splitDoors, 1600).map((f) => f.doors),
    [1],
  );
  check(
    'single plain front takes the unit door count',
    zones.unitFronts({ ...base, id: 'u', doors: 3, shelves: 2 }, 820).map((f) => f.doors),
    [3],
  );

  /* --- 2. זכוכית: דלת ודופן חייבות להיות מסומנות בתלת־ממד --- */
  const glassDoor = { ...base, id: 'g1', doors: 1, glassDoors: true };
  const solidDoor = { ...base, id: 'g2', doors: 1 };
  const sg = scene([glassDoor, solidDoor]);
  const glassFace = sg.faces.find((f) => f.key === 'g1-door-0-0-f');
  const solidFace = sg.faces.find((f) => f.key === 'g2-door-0-0-f');
  check('glass door is marked as glass', !!glassFace?.glass, true);
  check('solid door is not marked as glass', !solidFace?.glass, true);

  const glassSide = { ...base, id: 'gs', doors: 1, glassSides: { start: true } };
  const ks = uniq(keysOf(scene([glassSide]), 'gs'));
  check('glass side is drawn, not omitted', ks.includes('gs-l'), true);

  /* --- 3. לד: נראה גם בתלת־ממד --- */
  const led = { ...base, id: 'ld', doors: 1, shelves: 2, led: ['top', 'bottom', 'shelf'] };
  const kl = uniq(keysOf(scene([led]), 'ld'));
  check('led strips exist in 3d', kl.filter((k) => k.includes('-led-')).length > 0, true);

  /* --- 4. מגירות: שורות ועמודות --- */
  const grid = { ...base, id: 'dg', drawers: 3, drawerCols: 2, widthMm: 900 };
  const kd = uniq(keysOf(scene([grid]), 'dg')).filter((k) => k.includes('-dr-'));
  check('drawer grid is rows x cols', kd.length, 6);

  /* --- 5. מגירה פנימית מוסתרת בחזית, נראית בפנים --- */
  const inner = { ...base, id: 'di', drawers: 2, drawerStyle: 'inner', doors: 1 };
  check(
    'inner drawers hidden when looking at fronts',
    uniq(keysOf(scene([inner]), 'di')).filter((k) => k.includes('-dr-')).length,
    0,
  );
  check(
    'inner drawers shown when looking inside',
    uniq(keysOf(scene([inner], { inside: true }), 'di')).filter((k) => k.includes('-dr-')).length,
    2,
  );

  /* --- 6. פינה מתה: לוח סתימה + דלת מצומצמת --- */
  const bl = { ...base, id: 'bs', doors: 1, corner: 'blindStart', blindMm: 300, widthMm: 1000 };
  const kb = uniq(keysOf(scene([bl]), 'bs'));
  check('blind filler drawn', kb.some((k) => k.includes('-blind-')), true);

  /* --- 7. אי: מצויר גם בלי קיר תואם --- */
  const island = { ...base, id: 'is', doors: 1, free: { xMm: 2000, zMm: 1500, headingDeg: 45 } };
  check('island is drawn', keysOf(scene([island]), 'is').length > 0, true);

  /* --- 8. ארגז מוסתר לא מצויר --- */
  check('hidden unit is not drawn', keysOf(scene([{ ...base, id: 'hd', hidden: true, doors: 1 }]), 'hd').length, 0);

  /* --- 9. פיזיקה: דופן לא עוברת באמצע תחתית --- */
  const p = plan.buildPlan([wall], []);
  const boxAt = (o) => placement.unitBox({ ...base, ...o }, p);
  check(
    'half-overlapping boxes clash',
    collision.clash(boxAt({ id: 'a', xMm: 0 }), boxAt({ id: 'b', xMm: 300 })),
    true,
  );
  check(
    'abutting boxes do not clash',
    collision.clash(boxAt({ id: 'a', xMm: 0 }), boxAt({ id: 'b', xMm: 600 })),
    false,
  );
  check(
    'stacked boxes do not clash',
    collision.clash(boxAt({ id: 'a', xMm: 0 }), boxAt({ id: 'b', xMm: 0, yMm: 820 })),
    false,
  );
  check(
    'a small box fully inside a big one does not clash',
    collision.clash(
      boxAt({ id: 'a', xMm: 0, widthMm: 900, heightMm: 2000 }),
      boxAt({ id: 'b', xMm: 100, widthMm: 500, heightMm: 400, yMm: 300 }),
    ),
    false,
  );
  check(
    'two identical boxes clash',
    collision.clash(boxAt({ id: 'a', xMm: 0 }), boxAt({ id: 'b', xMm: 0 })),
    true,
  );

  /* --- 10. סדר הציור: חזית אחרי הגוף של אותו ארון --- */
  const s10 = scene([{ ...base, id: 'or', doors: 2, shelves: 2 }]);
  const mine = s10.faces.filter((f) => f.unitId === 'or');
  const lastBody = mine.map((f, i) => [f, i]).filter(([f]) => f.key.startsWith('or-l')).pop();
  const firstDoor = mine.findIndex((f) => f.key.startsWith('or-door'));
  check('door drawn after carcass', firstDoor > (lastBody?.[1] ?? -1), true);

  /* --- 11. מסובב: התיבה מחליפה רוחב ועומק בחדר --- */
  const turned = { ...base, id: 'rt', doors: 1, rotationDeg: 90, widthMm: 600, depthMm: 580 };
  const bt = placement.unitBox(turned, p);
  const straight = placement.unitBox({ ...base, id: 'st', doors: 1 }, p);
  check('rotation only turns the frame, not the box size', [bt.w, bt.d], [600, 580]);
  check('rotation turns the facing by 90', Math.round(((bt.facing - straight.facing) * 180) / Math.PI), 90);

  /* --- 12. מכשיר בלי דלת מקבל חזית --- */
  const oven = { ...base, id: 'ov', glyph: 'oven', doors: 0 };
  check(
    'appliance without doors gets a front',
    uniq(keysOf(scene([oven]), 'ov')).some((k) => k.endsWith('-app')),
    true,
  );

  /* --- 13. לוח בודד: אין לו גוף --- */
  const panel = { ...base, id: 'pn', glyph: 'plain' };
  const kp = uniq(keysOf(scene([panel]), 'pn'));
  check('a single panel has no carcass', kp.filter((k) => /-(l|r|b|t|bk)$/.test(k)).length, 0);

  /* --- 14. רגליים, משטח ודופן זרה --- */
  const trim = {
    ...base, id: 'tm', doors: 1, socleMm: 100, counterMm: 40,
    exposed: { start: true, end: true, top: true },
  };
  const kt = uniq(keysOf(scene([trim]), 'tm'));
  check('socle drawn', kt.includes('tm-soc'), true);
  check('counter drawn', kt.includes('tm-cnt'), true);
  check('three exposed panels drawn', kt.filter((k) => k.startsWith('tm-ep-')).length, 3);

  /* --- 15. עמודות בתא: קושרת בין עמודה לעמודה --- */
  const colsUnit = {
    ...base, id: 'cl', doors: 2, widthMm: 1200,
    zones: [{ id: 'z1', kind: 'shelves', shelves: 1, heightMm: 820, columns: [
      { id: 'c1', kind: 'shelves', shelves: 2, widthShare: 0.34 },
      { id: 'c2', kind: 'shelves', shelves: 1, widthShare: 0.33 },
      { id: 'c3', kind: 'drawers', drawers: 2, drawerStyle: 'inner', widthShare: 0.33 },
    ] }],
  };
  const kc = uniq(keysOf(scene([colsUnit], { inside: true }), 'cl'));
  check('two dividers for three columns', kc.filter((k) => k.includes('-div-')).length, 2);

  /* --- 16. חוצץ בין אזורים --- */
  const twoZones = {
    ...base, id: 'tz', doors: 1, heightMm: 1600,
    zones: [
      { id: 'z1', kind: 'shelves', shelves: 1, heightMm: 800 },
      { id: 'z2', kind: 'shelves', shelves: 1, heightMm: 800 },
    ],
  };
  check(
    'one separator between two zones',
    uniq(keysOf(scene([twoZones]), 'tz')).filter((k) => k.includes('-sep')).length,
    1,
  );

  /* --- 17. הסתרת ארגז בודד --- */
  const upper = { ...base, id: 'up', level: 'wall', yMm: 1500, doors: 1 };
  check('hidden unit is not drawn', keysOf(scene([{ ...upper, hidden: true }]), 'up').length, 0);
  check('uppers shown by default', keysOf(scene([upper]), 'up').length > 0, true);

  /* --- 18. פינה מתה: הדלת יושבת רק על החלק הנגיש --- */
  const bw = 1000, bm = 300;
  const blindUnit = { ...base, id: 'bw', doors: 2, corner: 'blindEnd', blindMm: bm, widthMm: bw };
  const sB = scene([blindUnit]);
  const doorXs = sB.faces
    .filter((f) => f.unitId === 'bw' && /-door-\d+-\d+-f$/.test(f.key))
    .map((f) => f.points.split(' ')[0].split(',').map(Number)[0]);
  check('two doors on the accessible part only', doorXs.length, 2);

  /* --- 19. אי בחזית הקיר: צל ולא מיקום על הקיר --- */
  const isl = { ...base, id: 'i2', doors: 1, free: { xMm: 1500, zMm: 900, headingDeg: 0 } };
  const shadow = placement.wallShadow(placement.unitBox(isl, p), p[0]);
  check('island shadow keeps its distance from the wall', Math.round(shadow.awayMm), 600);

  /* --- 20. מצב הצגה מצייר את אותם ארגזים --- */
  check(
    'present mode draws the same boxes',
    keysOf(scene([{ ...base, id: 'pr', doors: 2 }], { present: true }), 'pr').length,
    keysOf(scene([{ ...base, id: 'pr', doors: 2 }]), 'pr').length,
  );

  /* --- 21. חזית ופנים: אותו מספר מדפים --- */
  const shelfUnit = { ...base, id: 'sh', doors: 1, shelves: 3 };
  const shOut = uniq(keysOf(scene([shelfUnit]), 'sh')).filter((k) => k.includes('-sh-'));
  const shIn = uniq(keysOf(scene([shelfUnit], { inside: true }), 'sh')).filter((k) => k.includes('-sh-'));
  check('same shelves inside and out', [shOut.length, shIn.length], [3, 3]);

  /* --- 22. ידיות: מצוירות רק כשהן קיימות --- */
  const withH = { ...base, id: 'hn', doors: 2, handles: true };
  const noH = { ...base, id: 'nh', doors: 2 };
  check(
    'handles drawn in 3d only when asked',
    [
      uniq(keysOf(scene([withH]), 'hn')).filter((k) => k.includes('-hdl-')).length,
      uniq(keysOf(scene([noH]), 'nh')).filter((k) => k.includes('-hdl-')).length,
    ],
    [2, 0],
  );

  /* --- 23. מדף זכוכית מסומן גם בתלת־ממד --- */
  const gsh = {
    ...base, id: 'gh', doors: 1,
    zones: [{ id: 'z1', kind: 'shelves', shelves: 2, glassShelves: true, heightMm: 820 }],
  };
  check(
    'glass shelves are marked as glass',
    scene([gsh]).faces.filter((f) => f.unitId === 'gh' && f.key.includes('-sh-')).every((f) => f.glass),
    true,
  );

  /* --- 24. דופן זרה תחתונה --- */
  check(
    'exposed bottom panel drawn',
    uniq(keysOf(scene([{ ...base, id: 'eb', doors: 1, exposed: { bottom: true } }]), 'eb'))
      .filter((k) => k.startsWith('eb-ep-')).length,
    1,
  );

  /* --- 25. אזור רדוד נכנס פחות לחדר --- */
  const shallow = {
    ...base, id: 'sd', doors: 1, depthMm: 600,
    zones: [{ id: 'z1', kind: 'shelves', shelves: 1, heightMm: 820, depthMm: 300 }],
  };
  const deep = { ...base, id: 'dp', doors: 1, depthMm: 600, shelves: 1 };
  /* מוטת המדף על המסך גדלה עם העומק — מדף רדוד תופס פחות */
  const shelfSpan = (id, s) => {
    const xs = s.faces.filter((f) => f.unitId === id && f.key.includes('-sh-'))
      .flatMap((f) => f.points.split(' ').map((q) => Number(q.split(',')[0])));
    return Math.max(...xs) - Math.min(...xs);
  };
  check(
    'a shallow zone does not reach as far as a deep one',
    shelfSpan('sd', scene([shallow])) < shelfSpan('dp', scene([deep])),
    true,
  );

  /* --- 26. גב בעובי גוף עבה מגב דק --- */
  const backDepth = (kind) => {
    const s = scene([{ ...base, id: 'bk', doors: 1, backKind: kind }]);
    const f = s.faces.filter((q) => q.key.startsWith('bk-bk'));
    const xs = f.flatMap((q) => q.points.split(' ').map((r) => Number(r.split(',')[0])));
    return Math.max(...xs) - Math.min(...xs);
  };
  check('a carcass back is thicker than a thin one', backDepth('carcass') > backDepth('thin'), true);
  check('no back means no back face', keysOf(scene([{ ...base, id: 'nb', doors: 1, backKind: 'none' }]), 'nb').filter((k) => k.startsWith('nb-bk')).length, 0);

  return report;
});

await browser.close();
let bad = 0;
for (const r of out) {
  if (!r.ok) bad++;
  console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.name}${r.ok ? '' : `  got=${JSON.stringify(r.got)} want=${JSON.stringify(r.want)}`}`);
}
console.log(`\n${out.length - bad}/${out.length} passed`);

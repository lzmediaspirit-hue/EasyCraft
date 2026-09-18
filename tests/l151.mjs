import './_exit.mjs';
/*
 * שכבה 151 — N02–N09: פתירה אחת, ומה שאי אפשר אינו מוצע.
 *
 * ההצעה תורגמה לספרייה פעמיים — פעם לתמונה ופעם לשמירה — ובלי
 * בדיקה מלאה: חלון נמוך לא חסם, תקרה נמוכה לא נבדקה, ארגז דלתות
 * רגיל מילא תפקיד של ארגז כיור, ומיקרוגל נעלם מההצעה החסכונית
 * בלי מילה. וניקוד 99 הוצג למטבח שחסרות בו תחנות.
 */
import { chromium } from 'playwright';

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + String(e).slice(0, 200)));
const out = [];
const ok = (name, cond, extra = '') => out.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' | ' + extra : ''}`);

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);

/* ------------------------------------------------------------------ */
/* N02/N04/N05 — מה שהפתירה עוצרת                                      */
/* ------------------------------------------------------------------ */
const res = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const { resolvePlan } = await import('/src/features/design/planResolve.ts' + v);
  const { SHIPPED_LIBRARY } = await import('/src/catalog/shipped.ts' + v);

  const defaults = { drawerBox: 'wood', backKind: 'thin', socleMm: 100 };
  const item = (over) => ({
    id: 'i-' + Math.random(), name: 'ארגז', glyph: 'doors',
    rooms: ['kitchen'], group: 'base', level: 'floor',
    defaultWidthMm: 600, defaultHeightMm: 880, defaultDepthMm: 580, defaultYMm: 0,
    widthOptionsMm: [600], socleMm: 100, counterMm: 30,
    isBuiltin: false, sortOrder: 1, createdAt: 0, updatedAt: 0, workshopId: '', rev: 1,
    ...over,
  });
  const wall = (over = {}) => ({
    id: 'w1', projectId: 'p', index: 0, lengthMm: 4000, heightMm: 2600,
    features: [], createdAt: 0, updatedAt: 0, workshopId: '', rev: 1, ...over,
  });
  const place = (over = {}) => ({
    catalogKey: 'k-base-door2', wallId: 'w1', xMm: 0, widthMm: 600,
    level: 'floor', role: 'prep', ...over,
  });
  const run = (placements, items, walls) =>
    resolvePlan({ placements, items, walls, defaults, room: 'kitchen' });

  /* חלון נמוך שחוצה את הארגז */
  const lowWindow = wall({
    features: [{ id: 'f1', kind: 'window', xMm: 1200, yMm: 300, widthMm: 1400, heightMm: 1500 }],
  });
  const under = run([place({ xMm: 1300 })], [item({ name: 'ארגז דלתות' })], [lowWindow]);

  /* אותו חלון, גבוה — ארון תחתון עובר תחתיו */
  const highWindow = wall({
    features: [{ id: 'f1', kind: 'window', xMm: 1200, yMm: 1200, widthMm: 1400, heightMm: 900 }],
  });
  const clear = run([place({ xMm: 1300 })], [item({ name: 'ארגז דלתות' })], [highWindow]);

  /* תקרה נמוכה מול עמודה */
  const low = run(
    [place({ catalogKey: 'k-tall-door', level: 'tall' })],
    [item({
      name: 'עמודת דלתות', group: 'tall', level: 'tall',
      defaultHeightMm: 2200, defaultYMm: 0,
    })],
    [wall({ heightMm: 1800 })],
  );

  /* ספרייה שאין בה ארגז כיור — התפקיד אינו מתמלא בארגז דלתות */
  const noSink = run(
    [place({ catalogKey: 'k-base-sink', role: 'sink' })],
    [item({ name: 'ארגז דלתות' })],
    [wall()],
  );
  /* ואם יש ארגז כיור אמיתי — הוא נבחר */
  const withSink = run(
    [place({ catalogKey: 'k-base-sink', role: 'sink' })],
    [item({ name: 'ארגז כיור', glyph: 'sink' }), item({ name: 'ארגז דלתות' })],
    [wall()],
  );

  /* N06: הארגז שנפתר הוא פריט מהספרייה, עם המידות שלו */
  const tallItem = item({ name: 'ארגז דלתות', defaultHeightMm: 900, defaultDepthMm: 620 });
  const spec = run([place()], [tallItem], [wall()]);

  return {
    under: under.issues.map((i) => i.kind),
    underText: under.issues[0]?.text ?? '',
    clear: clear.issues.length,
    low: low.issues.map((i) => i.kind),
    lowText: low.issues[0]?.text ?? '',
    noSink: noSink.issues.map((i) => i.kind),
    noSinkText: noSink.issues[0]?.text ?? '',
    withSink: { issues: withSink.issues.length, name: withSink.units[0]?.item.name },
    spec: spec.units[0]
      ? { h: spec.units[0].unit.heightMm, d: spec.units[0].unit.depthMm, id: spec.units[0].item.id }
      : null,
    specId: tallItem.id,
    shipped: SHIPPED_LIBRARY.length,
  };
});

ok('ארגז שנכנס לחלון נמוך נעצר', res.under.includes('window'), res.underText);
ok('וחלון גבוה אינו מפריע לתחתון', res.clear === 0, String(res.clear));
ok('עמודה שעוברת את התקרה נעצרת', res.low.includes('ceiling'), res.lowText);
ok('בלי ארגז כיור התפקיד אינו מתמלא', res.noSink.includes('capability'), res.noSinkText);
ok('ועם ארגז כיור הוא נבחר',
  res.withSink.issues === 0 && res.withSink.name === 'ארגז כיור', JSON.stringify(res.withSink));
ok('הארגז שנפתר הוא הפריט מהספרייה, במידות שלו',
  res.spec?.h === 900 && res.spec?.d === 620 && res.spec?.id === res.specId,
  JSON.stringify(res.spec));

/* ------------------------------------------------------------------ */
/* N08/N09 — בקשה שלא נענתה, וניקוד שאינו מבטיח יותר מדי             */
/* ------------------------------------------------------------------ */
const plans = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const { planKitchen } = await import('/src/features/design/autoPlan.ts' + v);
  const wall = {
    id: 'w1', projectId: 'p', index: 0, lengthMm: 5200, heightMm: 2600,
    features: [], createdAt: 0, updatedAt: 0, workshopId: '', rev: 1,
  };
  const plan = [{ wall, start: { x: 0, y: 0 }, end: { x: 5200, y: 0 }, headingDeg: 0, depthMm: 600, inward: 1 }];
  const at = (appliances) =>
    planKitchen({
      walls: [wall], plan, appliances, seating: false, finish: 'standard',
    });

  /* מיקרוגל בלי תנור — הוא חייב להופיע או להיאמר */
  const micro = at({
    fridge: true, oven: false, hob: true, microwave: true, dishwasher: true, hood: true,
  });
  const cheap = micro.find((p) => p.priority === 'economical');
  const rich = micro.find((p) => p.priority !== 'economical');

  /* וקיר קצר מדי לכל התחנות — הציון אינו מתעלם ממה שחסר */
  const tiny = { ...wall, lengthMm: 1600 };
  const tinyPlan = [{ wall: tiny, start: { x: 0, y: 0 }, end: { x: 1600, y: 0 }, headingDeg: 0, depthMm: 600, inward: 1 }];
  const cramped = planKitchen({
    walls: [tiny], plan: tinyPlan,
    appliances: { fridge: true, oven: true, hob: true, microwave: false, dishwasher: true, hood: true },
    seating: false, finish: 'standard',
  });

  return {
    cheapHasMicro: !!cheap?.units.some((u) => u.catalogKey === 'appliance-micro'),
    cheapSaid: (cheap?.dropped ?? []).filter((d) => d.includes('מיקרוגל')).length,
    richHasMicro: !!rich?.units.some((u) => u.catalogKey === 'appliance-micro'),
    cramped: (cramped ?? []).map((p) => ({
      missing: p.score.missing,
      triangle: p.score.triangle,
      total: p.score.total,
    })),
  };
});

ok('מיקרוגל שנבחר נכנס בגרסה הרגילה', plans.richHasMicro, String(plans.richHasMicro));
ok('ובחסכונית נאמר למה לא',
  !plans.cheapHasMicro && plans.cheapSaid > 0, `נכנס=${plans.cheapHasMicro}, נאמר=${plans.cheapSaid}`);
const worst = plans.cramped.filter((c) => c.missing > 0);
ok('הצעה שחסרות בה תחנות מדווחת על כך', worst.length > 0,
  JSON.stringify(plans.cramped));
ok('ומשולש העבודה אינו 100% כשחסרה תחנה',
  worst.every((c) => c.triangle === 0), JSON.stringify(worst));
ok('והציון אינו 99', worst.every((c) => c.total < 90), JSON.stringify(worst.map((c) => c.total)));

await browser.close();
for (const e of errs) out.push('FAIL ' + e);
console.log(out.join('\n'));
const fail = out.filter((l) => l.startsWith('FAIL')).length;
console.log(`${out.length - fail} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);

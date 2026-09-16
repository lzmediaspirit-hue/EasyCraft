import './_exit.mjs';
/*
 * שכבה 119 — מה שעומד בדרך, ומה שנאמר עליו.
 *
 * E03 — עמוד שנבלע כולו בתוך ארגז חופשי הוא התנגשות, לא הכלה.
 * E04 — ארגז חופשי שעומד בפתח חוסם אותו.
 * E05 — חריגה משני קצות הקיר ומגובהו נאמרת, ולכל תפקיד.
 */
import { chromium } from 'playwright';
import { setup, addNamed } from './mk.mjs';

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + String(e).slice(0, 200)));
const out = [];
const ok = (name, cond, extra = '') =>
  out.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' | ' + extra : ''}`);

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });

const r = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const C = await import('/src/features/design/collision.ts' + v);
  const P = await import('/src/features/design/placement.ts' + v);
  const PL = await import('/src/features/design/plan.ts' + v);
  const A = await import('/src/features/design/analysis.ts' + v);

  const wallWith = (features) => ({
    id: 'w1', projectId: 'p1', index: 0, lengthMm: 3000, heightMm: 2600,
    features, createdAt: 0, updatedAt: 0,
  });
  const unit = (over) => ({
    id: 'u1', projectId: 'p1', wallId: 'w1', catalogItemId: 'c1',
    name: 'ארגז', glyph: 'doors', level: 'floor',
    xMm: 0, yMm: 0, widthMm: 600, heightMm: 880, depthMm: 600,
    createdAt: 0, updatedAt: 0, ...over,
  });

  const hits = (u, wall, others = []) => {
    const plan = PL.buildPlan([wall], [u, ...others]);
    const box = P.unitBox(u, plan);
    return box ? C.blocked(u, box, others, plan) : null;
  };

  /* --- E03: עמוד --- */
  const pillar = {
    id: 'f-pillar', kind: 'pillar', xMm: 1000, yMm: 0,
    widthMm: 300, heightMm: 2600, depthMm: 250,
  };
  const pillarWall = wallWith([pillar]);
  /*
   * אי שרגליו סביב העמוד: רחב וגם עמוק ממנו, ומרכזו על מרכזו.
   * העמוד יושב 125 מ״מ מהקיר פנימה, ולכן מרכז האי הוא שם.
   */
  const swallow = unit({
    id: 'free-1', free: { xMm: 1150, zMm: 125, headingDeg: 90 },
    widthMm: 1200, depthMm: 800, heightMm: 900,
  });
  const partial = unit({
    id: 'free-2', free: { xMm: 900, zMm: 125, headingDeg: 90 },
    widthMm: 400, depthMm: 400, heightMm: 900,
  });
  const clear = unit({
    id: 'free-3', free: { xMm: 2400, zMm: 900, headingDeg: 90 },
    widthMm: 600, depthMm: 600, heightMm: 900,
  });
  /* עמוד נמוך, וארגז שתלוי מעליו */
  const lowPillar = { ...pillar, id: 'f-low', heightMm: 400 };
  const above = unit({
    id: 'free-4', free: { xMm: 1150, zMm: 125, headingDeg: 90 },
    widthMm: 1200, depthMm: 800, heightMm: 700, yMm: 1500,
  });

  /* --- E04: פתח --- */
  const window = {
    id: 'f-win', kind: 'window', xMm: 800, yMm: 900,
    widthMm: 1200, heightMm: 1200,
  };
  const winWall = wallWith([window]);
  /* אי צמוד לקיר, בדיוק מול החלון, ובגובה שנכנס אליו */
  const inFront = unit({
    id: 'free-5', free: { xMm: 1400, zMm: 300, headingDeg: 90 },
    widthMm: 900, depthMm: 600, heightMm: 2000, yMm: 500,
  });
  /* אותו אי, אבל נמוך מהסף — זה מותר */
  const belowSill = unit({ ...inFront, id: 'free-6', heightMm: 880, yMm: 0 });
  /* וארגז רגיל על אותו קיר, מול החלון — נחסם כבר קודם */
  const onWall = unit({ id: 'wall-1', xMm: 900, yMm: 1000, heightMm: 700, level: 'wall', depthMm: 320 });

  /* --- E05: אזהרות --- */
  const plain = wallWith([]);
  const outStart = A.analyzeWall(plain, [unit({ xMm: -50 })]);
  const outEnd = A.analyzeWall(plain, [unit({ xMm: 2800, widthMm: 600 })]);
  const tooTall = A.analyzeWall(plain, [unit({ xMm: 0, yMm: 2300, heightMm: 700, level: 'wall' })]);
  const belowFloor = A.analyzeWall(plain, [unit({ xMm: 0, yMm: -40 })]);
  const fine = A.analyzeWall(plain, [unit({ xMm: 100 })]);

  const texts = (a) => a.warnings.map((w) => w.text);
  return {
    swallow: hits(swallow, pillarWall),
    partial: hits(partial, pillarWall),
    clear: hits(clear, pillarWall),
    above: hits(above, wallWith([lowPillar])),
    inFront: hits(inFront, winWall),
    belowSill: hits(belowSill, winWall),
    onWall: hits(onWall, winWall),
    outStart: texts(outStart),
    outStartIds: outStart.warnings.flatMap((w) => w.unitIds),
    outEnd: texts(outEnd),
    tooTall: texts(tooTall),
    belowFloor: texts(belowFloor),
    fine: texts(fine),
  };
});

ok('a free cabinet that swallows a pillar is blocked', r.swallow === true, String(r.swallow));
ok('partial overlap with a pillar is still blocked', r.partial === true, String(r.partial));
ok('standing clear of it is allowed', r.clear === false, String(r.clear));
ok('and so is hanging above a low pillar', r.above === false, String(r.above));

ok('a free cabinet standing in a window is blocked', r.inFront === true, String(r.inFront));
ok('below the sill is still allowed', r.belowSill === false, String(r.belowSill));
ok('an attached cabinet over the same window is blocked', r.onWall === true, String(r.onWall));

ok('a cabinet starting before the wall is warned about', r.outStart.some((t) => /מתחילת הקיר/.test(t)), JSON.stringify(r.outStart));
ok('and the warning points at it', r.outStartIds.includes('u1'), JSON.stringify(r.outStartIds));
ok('the far end still warns', r.outEnd.some((t) => /חורגים מהקיר/.test(t)), JSON.stringify(r.outEnd));
ok('a cabinet above the ceiling is warned about', r.tooTall.some((t) => /גובה הקיר/.test(t)), JSON.stringify(r.tooTall));
ok('and one below the floor', r.belowFloor.some((t) => /מתחת לרצפה/.test(t)), JSON.stringify(r.belowFloor));
ok('a cabinet inside the room says nothing', r.fine.length === 0, JSON.stringify(r.fine));

/* ------------------------------------------------------------------ */
/* E05 — מי רואה את ההתראה                                             */
/* ------------------------------------------------------------------ */

const btn = (re) => page.getByRole('button', { name: re }).first();

await setup(page, { name: 'התראות בע״מ' });
await addNamed(page, /^ארגז/);
await page.waitForTimeout(700);
await btn(/סיום עריכה/).click().catch(() => {});
await page.waitForTimeout(400);

/* הארגז נדחף אל מחוץ לקיר — זו העובדה שההתראה מדברת עליה */
await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const { db } = await import('/src/db/db.ts' + v);
  const u = (await db.units.toArray())[0];
  const w = (await db.walls.toArray()).find((q) => q.id === u.wallId);
  await db.units.update(u.id, { xMm: w.lengthMm - 100 });
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1600);
/* מהבית אל הפרויקט: הלקוח, ואז הקיר */
await btn(/התראות/).click();
await page.waitForTimeout(900);
await btn(/^מטבח/).click();
await page.waitForTimeout(1600);
const asManager = await page.innerText('body');
ok('the manager sees the overflow warning', /חורגים מהקיר/.test(asManager), JSON.stringify(asManager.slice(-200)));

/* אותו קיר בדיוק, אצל נגר */
await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const { db } = await import('/src/db/db.ts' + v);
  const me = (await db.team.toArray())[0];
  await db.team.update(me.id, { role: 'carpenter' });
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1800);
await btn(/התראות/).click();
await page.waitForTimeout(900);
await btn(/^מטבח/).click();
await page.waitForTimeout(1600);
const asCarpenter = await page.innerText('body');
ok('and so does the carpenter', /חורגים מהקיר/.test(asCarpenter), JSON.stringify(asCarpenter.slice(-260)));
ok('who still cannot add a cabinet', !/הוספת ארגז/.test(asCarpenter));

ok('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
console.log(out.join('\n'));
const bad = out.filter((l) => l.startsWith('FAIL'));
console.log(bad.length ? `\n${bad.length} נפלו` : '\nהכול עבר');
await browser.close();

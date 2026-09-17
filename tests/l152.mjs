import './_exit.mjs';
/*
 * שכבה 152 — N07+R01: מעטפת פתיחה מול עמוד, והחלפה שהיא צעד אחד.
 *
 * המעטפת נבדקה מול ארגזים בלבד, ולכן מגירה שנפתחת אל תוך עמוד
 * בטון עברה בשקט: גוף הארגז פנוי והמגירה אינה. וההחלפה האוטומטית
 * מחקה קודם וכתבה אחר כך — כישלון באמצע השאיר פרויקט חצי־מוחלף.
 */
import { chromium } from 'playwright';
import { setup } from './mk.mjs';

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
/* N07 — עמוד חוסם מגירה                                              */
/* ------------------------------------------------------------------ */
const env = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const { roomEnvelopes, envelopeClashes } = await import('/src/features/design/envelope.ts' + v);
  const { boxesMeet } = await import('/src/features/design/collision.ts' + v);
  const { featureBox, unitBox } = await import('/src/features/design/placement.ts' + v);

  const pillar = {
    id: 'f-pillar', kind: 'pillar', xMm: 700, yMm: 0,
    widthMm: 600, heightMm: 2600, depthMm: 900,
  };
  const wall = {
    id: 'w1', projectId: 'p', index: 0, lengthMm: 4000, heightMm: 2600,
    features: [pillar], createdAt: 0, updatedAt: 0, workshopId: '', rev: 1,
  };
  const plan = [{ wall, start: { x: 0, y: 0 }, end: { x: 4000, y: 0 }, headingDeg: 0, depthMm: 600 }];

  /* ארגז מגירות חופשי, פונה אל העמוד */
  const unit = {
    id: 'u1', projectId: 'p', wallId: 'w1', catalogItemId: 'c',
    name: 'ארגז מגירות', glyph: 'drawers', drawers: 3, level: 'floor',
    xMm: 0, yMm: 0, widthMm: 600, heightMm: 880, depthMm: 600, socleMm: 100,
    free: { xMm: 1000, zMm: 1500, headingDeg: -90 },
    createdAt: 0, updatedAt: 0, workshopId: '', rev: 1,
  };

  const envs = roomEnvelopes([unit], plan);
  const clashes = envelopeClashes(envs, [unit], plan);
  const drawer = envs.find((e) => e.kind === 'drawer');

  /* ומול אותה שאלה פיזית, בלי המעטפת */
  const physical = drawer?.box
    ? boxesMeet(drawer.box, featureBox(pillar, plan[0], pillar.depthMm))
    : null;
  /* גוף הארגז עצמו פנוי — זו בדיוק הנקודה */
  const body = boxesMeet(unitBox(unit, plan), featureBox(pillar, plan[0], pillar.depthMm));

  /* ובלי עמוד אין התרעה */
  const clean = envelopeClashes(
    roomEnvelopes([unit], [{ ...plan[0], wall: { ...wall, features: [] } }]),
    [unit],
    [{ ...plan[0], wall: { ...wall, features: [] } }],
  );

  return {
    physical,
    body,
    blocked: clashes.map((c) => c.blockerName),
    clean: clean.length,
  };
});

ok('המגירה באמת נכנסת לעמוד', env.physical === true, String(env.physical));
ok('וגוף הארגז עצמו פנוי', env.body === false, String(env.body));
ok('והמעטפת מדווחת על העמוד', env.blocked.includes('עמוד'), JSON.stringify(env.blocked));
ok('בלי עמוד אין התרעה', env.clean === 0, String(env.clean));

/* ------------------------------------------------------------------ */
/* R01 — החלפה שנכשלת אינה משאירה פרויקט חצי                          */
/* ------------------------------------------------------------------ */
await setup(page, { name: 'החלפה בע״מ' });
await page.waitForTimeout(700);

const apply = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const { unitsRepo, wallsRepo } = await import('/src/features/projects/projectsRepo.ts' + v);
  const { catalogRepo } = await import('/src/catalog/catalogRepo.ts' + v);
  const { db } = await import('/src/db/db.ts' + v);
  const proj = (await db.projects.toArray())[0];
  const wall = (await wallsRepo.listForProject(proj.id))[0];
  /* פריט שבאמת שייך לחדר של הפרויקט — אחרת הפתירה לא תמצא אותו */
  const item = (await catalogRepo.all()).find(
    (i) => i.level === 'floor' && i.rooms.includes(proj.roomKind),
  );

  /* מטבח קיים על הקיר */
  await unitsRepo.add(proj.id, wall.id, item, 0);
  await unitsRepo.add(proj.id, wall.id, item, 900);
  const before = (await unitsRepo.listForProject(proj.id)).map((u) => u.id).sort();

  /* הצעה שיש בה ארגז שאי אפשר להניח — רוחב שאי אפשר לבנות ממנו */
  const bad = await unitsRepo.applyPlan(proj.id, [
    { catalogKey: item.id, wallId: wall.id, xMm: 0, widthMm: 600, level: 'floor', role: 'prep' },
    { catalogKey: item.id, wallId: wall.id, xMm: 700, widthMm: 40, level: 'floor', role: 'prep' },
  ]);
  const after = (await unitsRepo.listForProject(proj.id)).map((u) => u.id).sort();

  /* והצעה תקינה מחליפה הכול */
  const good = await unitsRepo.applyPlan(proj.id, [
    { catalogKey: item.id, wallId: wall.id, xMm: 0, widthMm: 600, level: 'floor', role: 'prep' },
  ]);
  const end = await unitsRepo.listForProject(proj.id);

  return {
    refused: bad.ok === false,
    why: bad.ok === false ? bad.issues.map((i) => i.kind) : [],
    kept: before.join() === after.join(),
    beforeN: before.length,
    afterN: after.length,
    good: good.ok === true,
    endN: end.length,
    endFresh: !end.some((u) => before.includes(u.id)),
  };
});

ok('הצעה שאי אפשר להניח נדחית', apply.refused, JSON.stringify(apply.why));
ok('והפרויקט נשאר בדיוק כפי שהיה', apply.kept, `${apply.beforeN} → ${apply.afterN}`);
ok('הצעה תקינה מוחלת', apply.good, String(apply.good));
ok('והיא מחליפה את מה שהיה', apply.endN === 1 && apply.endFresh,
  `${apply.endN} ארגזים, חדשים=${apply.endFresh}`);

await browser.close();
for (const e of errs) out.push('FAIL ' + e);
console.log(out.join('\n'));
const fail = out.filter((l) => l.startsWith('FAIL')).length;
console.log(`${out.length - fail} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);

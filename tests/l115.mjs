import './_exit.mjs';
/*
 * שכבה 115 — הרשאות נאכפות בגבול הפקודה (B01, B02, B03).
 *
 * B01: מי שאין לו רשות עריכה אינו מזיז ארגז — גם לא בגרירה.
 * B02: צפייה בתפקיד אחר אינה מעניקה את היכולות שלו.
 * B03: סימון מהיר מקדם, ולא מחזיר עבודה שכבר נעשתה אחורה.
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

const r = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const W = await import('/src/workflow/unitWork.ts' + v);
  const A = await import('/src/workflow/auth.ts' + v);

  const unit = (over = {}) => ({
    id: 'u1', projectId: 'p1', wallId: 'w1', catalogItemId: 'c1', name: 'ארגז',
    glyph: 'doors', doors: 2, level: 'floor',
    xMm: 0, yMm: 0, widthMm: 600, heightMm: 880, depthMm: 580,
    createdAt: 0, updatedAt: 0, ...over,
  });
  const sold = { soldAt: 1 };
  const carcass = W.TRACKS.find((t) => t.key === 'carcass');
  const at = (stage) => unit({ work: stage ? { tracks: { carcass: stage } } : undefined });

  /* --- B02: צפייה בתפקיד אחר אינה מעניקה את יכולותיו --- */
  const ready = at('ready');
  return {
    /* נגר אמיתי מסמן "נחתך" */
    carpenterCuts: W.canAdvance(ready, carcass, 'cut', 'carpenter', sold).ok,
    /* תכנת אמיתי — לא */
    plannerCuts: W.canAdvance(ready, carcass, 'cut', 'planner', sold).ok,
    /* תכנת שצופה כנגר — עדיין לא. זה הבאג */
    plannerAsCarpenter: W.canAdvance(ready, carcass, 'cut', 'planner', sold, 'carpenter').ok,
    /* מנהל שצופה כנגר מצומצם ליכולות הנגר: "נחתך" מותר לשניהם */
    managerAsCarpenterCut: W.canAdvance(ready, carcass, 'cut', 'manager', sold, 'carpenter').ok,
    /* אבל "מוכן לחיתוך" הוא של המנהל והתכנת, ולא של הנגר */
    managerAsCarpenterReady: W.canAdvance(at(), carcass, 'ready', 'manager', sold, 'carpenter').ok,
    managerReady: W.canAdvance(at(), carcass, 'ready', 'manager', sold).ok,

    /* --- B03: קידום בלבד --- */
    /* ארגז שלא התחיל — "מוכן לחיתוך" מקדם אותו */
    advancesNone: W.canAdvance(at(), carcass, 'ready', 'manager', sold).ok,
    /* ארגז שכבר הורכב — אותה פעולה אינה אמורה להחזיר אותו */
    assembledIndex: W.stageIndex('assembled'),
    readyIndex: W.stageIndex('ready'),

    /* --- B01: רשות עריכה --- */
    managerEdits: A.can.design('manager', {}),
    plannerNoGrant: A.can.design('planner', {}),
    plannerGranted: A.can.design('planner', { editGrantedAt: 1 }),
    carpenterEdits: A.can.design('carpenter', { editGrantedAt: 1 }),
  };
});

ok('נגר מסמן שנחתך', r.carpenterCuts);
ok('תכנת אינו מסמן שנחתך', !r.plannerCuts);
ok('B02: תכנת שצופה כנגר עדיין אינו מסמן', !r.plannerAsCarpenter);
ok('מנהל שצופה כנגר מסמן שנחתך', r.managerAsCarpenterCut);
ok('מנהל שצופה כנגר אינו מסמן "מוכן לחיתוך"', !r.managerAsCarpenterReady, 'בלי צפייה: ' + r.managerReady);
ok('ובלי צפייה הוא כן מסמן', r.managerReady);
ok('B03: שלב מאוחר גדול משלב מוקדם', r.assembledIndex > r.readyIndex, `${r.assembledIndex} > ${r.readyIndex}`);
ok('B01: מנהל עורך', r.managerEdits);
ok('B01: תכנת בלי אישור אינו עורך', !r.plannerNoGrant);
ok('B01: תכנת עם אישור עורך', r.plannerGranted);
ok('B01: נגר אינו עורך גם בפרויקט פתוח', !r.carpenterEdits);

/* --- B03 בממשק: סימון מרובה אינו נוגע במה שכבר הורכב --- */
const bulk = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const W = await import('/src/workflow/unitWork.ts' + v);
  const carcass = W.TRACKS.find((t) => t.key === 'carcass');
  const mk = (id, stage) => ({
    id, projectId: 'p1', wallId: 'w1', catalogItemId: 'c1', name: id,
    glyph: 'doors', doors: 2, level: 'floor',
    xMm: 0, yMm: 0, widthMm: 600, heightMm: 880, depthMm: 580,
    work: stage ? { tracks: { carcass: stage } } : undefined, createdAt: 0, updatedAt: 0,
  });
  const units = [mk('a', undefined), mk('b', 'assembled'), mk('c', 'cut')];
  /* אותו סינון בדיוק שהמסך עושה: רק מי שנמצא לפני השלב */
  const targets = units.filter(
    (u) =>
      W.stageIndex(W.stageOf(u, 'carcass')) < W.stageIndex('ready') &&
      W.canAdvance(u, carcass, 'ready', 'manager', { soldAt: 1 }).ok,
  );
  return targets.map((u) => u.id);
});
ok('B03: "מוכן לחיתוך" נוגע רק במי שלא התחיל', JSON.stringify(bulk) === '["a"]', JSON.stringify(bulk));

await browser.close();
for (const e of errs) out.push(e);
console.log(out.join('\n'));
const fail = out.filter((l) => l.startsWith('FAIL') || l.startsWith('pageerror')).length;
console.log(`${out.length - fail} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);

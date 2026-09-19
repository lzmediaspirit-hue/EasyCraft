import './_exit.mjs';
/*
 * שכבה 134 — מנה 20.
 *
 *   • מדף נספר בייצור: "אין הרכבת ארגז" אינו "אין עבודה לבצע".
 *     הוא נחתך, מקונט ומותקן — ורק "הורכב" אינו קיים בו.
 *   • פרזול: ספק, דגם, יחידה, מטבע ובחירת "במקום הספירה של".
 *   • בורר האיורים מסודר לפי משפחות.
 *   • תנועה בניצב לקיר, בלי להפוך את הארגז לאי.
 */
import { chromium } from 'playwright';
import { BOX, addNamed, setup } from './mk.mjs';

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + String(e).slice(0, 200)));
const out = [];
const ok = (name, cond, extra = '') => {
  const line = `${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' | ' + extra : ''}`;
  out.push(line);
  console.log(line);
};
const btn = (re) => page.getByRole('button', { name: re }).first();
const dlg = () => page.getByRole('dialog').last();

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });

/* ------------------------------------------------------------------ */
/* מדף בייצור                                                          */
/* ------------------------------------------------------------------ */

const work = await page.evaluate(async () => {
  const W = await import('/src/workflow/unitWork.ts');
  const unit = (glyph, over = {}) => ({
    id: 'u', projectId: 'p', wallId: 'w', catalogItemId: 'c',
    name: 'פריט', glyph, level: 'floor',
    xMm: 0, yMm: 0, widthMm: 600, heightMm: 300, depthMm: 300,
    createdAt: 0, updatedAt: 0, ...over,
  });
  const chain = (glyph) => {
    const t = W.tracksOf(unit(glyph))[0];
    return t ? W.stagesOf(t).map((s) => s.key) : [];
  };
  const box = unit('doors', { doors: 2, heightMm: 880 });
  return {
    shelfTracks: W.tracksWork(unit('slab')),
    ovenTracks: W.tracksWork(unit('oven')),
    shelfChain: chain('slab'),
    boxChain: W.stagesOf(W.tracksOf(box)[0]).map((s) => s.key),
    shelfProgress: W.workProgress([unit('slab')]),
    ovenProgress: W.workProgress([unit('oven')]),
    /* ביטול "הותקן" במדף חוזר לשלב שקיים בו, ולא ל"הורכב" */
    back: W.withStage(
      { tracks: { carcass: 'installed' } },
      W.tracksOf(unit('slab'))[0],
      'installed',
    ).tracks.carcass,
    /* ואי אפשר לסמן בו שלב שאינו קיים */
    assembled: W.canAdvance(
      unit('slab', { work: { tracks: { carcass: 'edged' } } }),
      W.tracksOf(unit('slab'))[0],
      'assembled',
      'manager',
      { soldAt: 1 },
    ),
    /* ממדף מקונט אפשר להמשיך ישר להתקנה */
    install: W.canAdvance(
      unit('slab', { work: { tracks: { carcass: 'edged' } } }),
      W.tracksOf(unit('slab'))[0],
      'installed',
      'manager',
      { soldAt: 1 },
    ),
  };
});

ok('a shelf is counted in production', work.shelfTracks === true, String(work.shelfTracks));
ok('an appliance still is not', work.ovenTracks === false, String(work.ovenTracks));
ok('the shelf is cut, edged and installed', work.shelfChain.join(',') === 'ready,cut,edged,installed', work.shelfChain.join(','));
ok('a real cabinet still gets assembled', work.boxChain.includes('assembled'), work.boxChain.join(','));
ok('the shelf counts toward progress', work.shelfProgress === 0, String(work.shelfProgress));
ok('an appliance is left out of it entirely', Number.isFinite(work.ovenProgress), String(work.ovenProgress));
ok('undoing "installed" goes back to "edged"', work.back === 'edged', String(work.back));
ok('a shelf cannot be marked assembled', work.assembled.ok === false, work.assembled.why ?? '');
ok('but it can be marked installed', work.install.ok === true, work.install.why ?? '');

/* ------------------------------------------------------------------ */
/* משפחות האיורים                                                      */
/* ------------------------------------------------------------------ */

const fams = await page.evaluate(async () => {
  const G = await import('/src/catalog/glyphList.ts');
  return {
    families: G.GLYPH_FAMILIES.map((f) => f.label),
    counts: G.GLYPH_FAMILIES.map((f) => G.glyphsOf(f.key).length),
    total: G.GLYPHS.length,
    sum: G.GLYPH_FAMILIES.reduce((n, f) => n + G.glyphsOf(f.key).length, 0),
    sink: G.glyphDef('sink').family,
    doors: G.glyphDef('doors').family ?? 'cabinet',
  };
});

ok('the picker has families', fams.families.length === 4, fams.families.join(','));
ok('and every glyph belongs to exactly one', fams.sum === fams.total, `${fams.sum}/${fams.total}`);
ok('a sink is a kitchen appliance', fams.sink === 'appliance', String(fams.sink));
ok('and a plain cabinet is a cabinet', fams.doors === 'cabinet', String(fams.doors));

/* ------------------------------------------------------------------ */
/* מרחק מהקיר                                                          */
/* ------------------------------------------------------------------ */

const off = await page.evaluate(async () => {
  const { unitBox } = await import('/src/features/design/placement.ts');
  const wall = {
    id: 'w', projectId: 'p', index: 0, lengthMm: 4000, heightMm: 2600,
    features: [], createdAt: 0, updatedAt: 0,
  };
  const plan = [
    { wall, start: { x: 0, y: 0 }, end: { x: 4000, y: 0 }, headingDeg: 0, depthMm: 600, inward: 1 },
  ];
  const unit = (over = {}) => ({
    id: 'u', projectId: 'p', wallId: 'w', catalogItemId: 'c',
    name: 'ארגז', glyph: 'doors', level: 'floor',
    xMm: 0, yMm: 0, widthMm: 600, heightMm: 880, depthMm: 580,
    createdAt: 0, updatedAt: 0, ...over,
  });
  const at = unitBox(unit(), plan);
  const moved = unitBox(unit({ offWallMm: 120 }), plan);
  return {
    baseZ: at.cz,
    movedZ: moved.cz,
    sameX: at.cx === moved.cx,
    stillOnWall: !unit({ offWallMm: 120 }).free,
    negative: unitBox(unit({ offWallMm: -50 }), plan).cz,
  };
});

ok('the cabinet moves away from the wall', Math.round(off.movedZ - off.baseZ) === 120, `${off.baseZ} → ${off.movedZ}`);
ok('and does not slide along it', off.sameX, String(off.sameX));
ok('and is still a wall cabinet, not an island', off.stillOnWall, String(off.stillOnWall));
ok('a negative distance is clamped, not applied', off.negative === off.baseZ, String(off.negative));

/* ------------------------------------------------------------------ */
/* במסך: פרזול ומרחק מהקיר                                             */
/* ------------------------------------------------------------------ */

await setup(page, { name: 'פרזול בע״מ' });
await page.waitForTimeout(900);
await addNamed(page, BOX.any);
await page.waitForTimeout(900);
await btn(/עריכה מתקדמת/).click();
await page.waitForTimeout(800);

ok('the advanced editor offers a distance from the wall',
  (await page.getByLabel('מרחק הארגז מהקיר').count()) === 1);

await page.getByLabel('מרחק הארגז מהקיר').fill('12');
await page.keyboard.press('Tab');
await page.waitForTimeout(900);
const saved = await page.evaluate(async () => {
  const { db } = await import('/src/db/db.ts');
  return (await db.units.toArray())[0].offWallMm;
});
ok('and it is saved in millimetres', saved === 120, String(saved));

/* פרזול: הוספה, ואז פרטי ההזמנה */
await btn(/הוספת פרזול/).click();
await page.waitForTimeout(500);
await btn(/פריט משלי/).click();
await page.waitForTimeout(700);
await btn(/פרטי הזמנה/).first().click();
await page.waitForTimeout(500);

ok('a hardware row asks for a supplier', (await page.getByLabel('ספק').count()) >= 1);
ok('and a model', (await page.getByLabel('דגם').count()) >= 1);
ok('and a currency', (await page.getByLabel(/מטבע של/).count()) >= 1);
ok('and lets the user pick what it replaces',
  (await page.getByRole('button', { name: 'מנגנוני קלאפה', exact: true }).count()) >= 1);

/*
 * הקלדה מהירה בשני שדות ברצף, בלי המתנה ביניהם.
 *
 * זה בדיוק מה שנפל קודם: כל תו נכתב למסד וחזר דרך השאילתה החיה,
 * וההקלדה עקפה את החזרה. השדות שומרים מעכשיו טיוטה מקומית
 * וכותבים ביציאה מהם, ולכן שניהם שורדים.
 */
await page.getByLabel('ספק').first().fill('בלום');
await page.getByLabel('דגם').first().fill('X-12');
await page.keyboard.press('Tab');
await page.waitForTimeout(600);
await page.getByRole('button', { name: 'מנגנוני קלאפה', exact: true }).first().click();
await page.waitForTimeout(900);

const hw = await page.evaluate(async () => {
  const { db } = await import('/src/db/db.ts');
  const u = (await db.units.toArray())[0];
  const row = (u.hardware ?? [])[0] ?? {};
  return { supplier: row.supplier, model: row.model, replaces: row.replaces, unit: row.unit };
});
ok('the supplier is stored', hw.supplier === 'בלום', String(hw.supplier));
ok('the model too', hw.model === 'X-12', String(hw.model));

/*
 * ושוב, על שדות שכבר יש בהם ערך.
 *
 * הסבב הראשון עבר גם כשהיה באג, כי שני השדות היו ריקים והרינדור
 * הספיק להיכנס ביניהם. מדידה של עשרה סבבים מצאה שמונה כשלונות:
 * `patch` נשען על צילום שנלכד ברינדור, ולכן שתי עריכות שקרו
 * לפני הרינדור הבא נשענו שתיהן על אותו צילום — הדגם נשמר והספק
 * חזר לערכו הקודם. שלושה סבבים כאן הם מה שתופס את זה.
 */
const rounds = [];
for (let i = 2; i <= 4; i++) {
  await page.getByLabel('ספק').first().fill('ספק' + i);
  await page.getByLabel('דגם').first().fill('דגם' + i);
  await page.keyboard.press('Tab');
  await page.waitForTimeout(700);
  rounds.push(await page.evaluate(async () => {
    const { db } = await import('/src/db/db.ts');
    const r = ((await db.units.toArray())[0].hardware ?? [])[0] ?? {};
    return `${r.supplier}/${r.model}`;
  }));
}
ok('שתי עריכות ברצף — שתיהן נשמרות, בכל סבב',
  rounds.every((v, i) => v === `ספק${i + 2}/דגם${i + 2}`), rounds.join(' , '));
ok('and the replacement it prevents', hw.replaces === 'lift', String(hw.replaces));

/*
 * בורר האיורים על המסך.
 *
 * מה שנפתח הוא הרשימה הקצרה של החדר; "כל האיורים" פותח את השאר,
 * ושם — כותרת לכל משפחה, ולא רשת אחת ארוכה.
 */
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
await btn(/^עריכה$|עריכת הארגז/).first().click().catch(() => {});
await page.waitForTimeout(800);
await dlg().getByRole('button', { name: 'כל האיורים', exact: true }).first().click().catch(() => {});
await page.waitForTimeout(400);
const form = await dlg().innerText().catch(() => '');
const heads = ['ארונות', 'פינות', 'מטבח ומכשירים', 'לוחות ומשטחים'].filter((h) =>
  form.includes(h),
);
ok('the glyph picker is grouped on screen', heads.length === 4, heads.join(','));

ok('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
const bad = out.filter((l) => l.startsWith('FAIL'));
console.log(bad.length ? `\n${bad.length} נפלו` : '\nהכול עבר');
if (bad.length) process.exitCode = 1;
await browser.close();

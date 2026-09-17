import './_exit.mjs';
/*
 * שכבה 127 — R02/R03/R04: שער שמירה אחד.
 *
 * שלושה ממצאים שהם למעשה אותו ממצא: הכלל ישב בשער אחד, והשערים
 * האחרים כתבו מסביבו.
 *
 * R02 — עריכה מהירה שמרה גובה 50 מ״מ עם רגליים של 100, ורשימת
 *       החיתוך שיצאה מזה הכילה חלקים בגובה אפס.
 * R03 — הטופס החיל מינימום של ארגז (50 מ״מ) על עובי של מדף, ולכן
 *       מדף תקין של 30 מ״מ "תוקן" ל-50 בלי לומר מילה.
 * R04 — החלפת סוג מ"מגירות" ל"דלתות" עדכנה את האיור והשאירה את
 *       האזורים מגירות: הארון נחתך כמגירות והטופס הראה דלתות.
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
/* הכלל עצמו                                                           */
/* ------------------------------------------------------------------ */

const rules = await page.evaluate(async () => {
  const G = await import('/src/catalog/saveGate.ts');

  const base = {
    glyph: 'doors', widthMm: 600, heightMm: 880, depthMm: 580, socleMm: 100,
  };
  const shelf = { glyph: 'slab', widthMm: 800, heightMm: 30, depthMm: 250 };

  /* המרה: שלוש מגירות שהופכות לדלתות */
  const drawersUnit = {
    glyph: 'drawers',
    zones: [
      { id: 'z1', heightMm: 400, kind: 'drawers', drawers: 3, drawerStyle: 'outer' },
      { id: 'z2', heightMm: 400, kind: 'shelves', shelves: 2 },
    ],
  };
  const toDoors = G.convertZones(drawersUnit, 'doors');
  const toOpen = G.convertZones(drawersUnit, 'open');
  const same = G.convertZones(drawersUnit, 'drawers');
  const toBoard = G.convertZones(drawersUnit, 'slab');

  /* המרה בתוך עמודות, ולא רק באזור עצמו */
  const columned = {
    glyph: 'drawers',
    zones: [
      {
        id: 'z1', heightMm: 800, kind: 'drawers', drawers: 2,
        columns: [
          { id: 'c1', widthShare: 0.5, kind: 'drawers', drawers: 2 },
          { id: 'c2', widthShare: 0.5, kind: 'shelves', shelves: 1 },
        ],
      },
    ],
  };
  const cols = G.convertZones(columned, 'doors');

  return {
    tooShort: G.checkUnit({ ...base, heightMm: 50 }),
    socleTaller: G.checkUnit({ ...base, heightMm: 50, socleMm: 100 }),
    fine: G.checkUnit(base),
    thinShelfOk: G.checkUnit(shelf),
    itemBad: G.checkItem({
      glyph: 'doors', defaultWidthMm: 600, defaultHeightMm: 50, defaultDepthMm: 580, socleMm: 100,
    }),
    itemFine: G.checkItem({
      glyph: 'doors', defaultWidthMm: 600, defaultHeightMm: 880, defaultDepthMm: 580, socleMm: 100,
    }),
    cabinetLimits: G.limitsFor('doors'),
    shelfLimits: G.limitsFor('slab'),
    toDoors: { kinds: toDoors.zones?.map((z) => z.kind), note: toDoors.note },
    toOpen: { kinds: toOpen.zones?.map((z) => z.kind), note: toOpen.note },
    sameNote: same.note,
    toBoard: { zones: toBoard.zones?.length, note: toBoard.note },
    colKinds: cols.zones?.[0]?.columns?.map((c) => c.kind),
  };
});

ok('a 50 mm cabinet on a 100 mm plinth is refused', !!rules.tooShort, String(rules.tooShort));
ok('and the message names the minimum', /\d/.test(rules.tooShort ?? ''), String(rules.tooShort));
ok('an ordinary cabinet still passes', rules.fine === null, String(rules.fine));
ok('a 30 mm shelf is not a broken cabinet', rules.thinShelfOk === null, String(rules.thinShelfOk));
ok('a library item is checked at the size it lands', !!rules.itemBad, String(rules.itemBad));
ok('and a sound one passes', rules.itemFine === null, String(rules.itemFine));

ok('a cabinet measures height in centimetres', rules.cabinetLimits.heightLabel === 'גובה' && !rules.cabinetLimits.heightInMm, JSON.stringify(rules.cabinetLimits));
ok('a board measures thickness in millimetres', /עובי/.test(rules.shelfLimits.heightLabel) && rules.shelfLimits.heightInMm, JSON.stringify(rules.shelfLimits));
ok('and it may be thinner than a cabinet', rules.shelfLimits.minHeightMm < 50, String(rules.shelfLimits.minHeightMm));

/*
 * החלפת איור אינה המרה.
 *
 * גוף ארון הוא גוף ארון, והאיור הוא תמונה קטנה ברשימה: ארגז
 * מגירות שקיבל איור של דלתות שומר את המגירות שלו. מה שבאמת מרוקן
 * את הפנים הוא מעבר למוצר אחר — לוח בודד או מכשיר קנוי.
 */
ok('an icon change keeps the drawers', rules.toDoors.kinds === undefined, JSON.stringify(rules.toDoors));
ok('and says nothing, because nothing changed', rules.toDoors.note === null, String(rules.toDoors.note));
ok('an open icon keeps them too', rules.toOpen.kinds === undefined, JSON.stringify(rules.toOpen));
ok('the same type converts nothing', rules.sameNote === null, String(rules.sameNote));
ok('a single board has no inside at all', rules.toBoard.zones === 0, JSON.stringify(rules.toBoard));
ok('and it is stated, not silent', /פנים/.test(rules.toBoard.note ?? ''), String(rules.toBoard.note));
ok('columns inside a zone are kept as well', rules.colKinds === undefined, JSON.stringify(rules.colKinds));

/* ------------------------------------------------------------------ */
/* המסך: R02 — עריכה מהירה                                             */
/* ------------------------------------------------------------------ */

await setup(page, { name: 'שער בע״מ' });
await addNamed(page, BOX.doors2);
await page.waitForTimeout(900);

const unit = () =>
  page.evaluate(async () => {
    const { db } = await import('/src/db/db.ts');
    const u = (await db.units.toArray())[0];
    return { id: u.id, h: u.heightMm, socle: u.socleMm ?? 0, glyph: u.glyph, zones: u.zones ?? null };
  });

const before = await unit();
await btn(/עריכת הארגז|^עריכה$/).click();
await page.waitForTimeout(700);
const heightField = dlg().getByLabel('גובה').first();
await heightField.fill('5');
await heightField.blur();
await page.waitForTimeout(500);
const warn = await dlg().innerText();
ok('the quick editor says it cannot be built', /אינו מספיק|גבוהות מהארגז/.test(warn), warn.split('\n').find((l) => /מספיק|גבוה/.test(l)) ?? '');

const saveBtn = dlg().getByRole('button', { name: /עדכון הארגז/ });
ok('and the save button is closed', await saveBtn.isDisabled());
await page.keyboard.press('Escape');
await page.waitForTimeout(500);
const afterTry = await unit();
ok('nothing was saved', afterTry.h === before.h, `${before.h} → ${afterTry.h}`);

/* והמאגר עצמו מסרב, גם מחוץ למסך */
const repo = await page.evaluate(async (id) => {
  const { unitsRepo } = await import('/src/features/projects/projectsRepo.ts');
  const { db } = await import('/src/db/db.ts');
  let refused = null;
  try {
    await unitsRepo.update(id, { heightMm: 50 });
  } catch (e) {
    refused = String(e.message ?? e);
  }
  const still = (await db.units.get(id)).heightMm;
  /* ובקרה חיובית: שינוי תקין עובר */
  await unitsRepo.update(id, { heightMm: 900 });
  const moved = (await db.units.get(id)).heightMm;
  await unitsRepo.update(id, { heightMm: 880 });
  return { refused, still, moved };
}, before.id);
ok('the repository refuses it too', !!repo.refused, String(repo.refused));
/*
 * שני השערים חייבים לומר את אותו מינימום.
 *
 * הם אמרו 194 ו-196: המסך פתר את עובי הלוח שנבחר בפועל, והמאגר
 * נפל לעובי ברירת המחדל. אותו ארגז, שתי תשובות — וזה בדיוק מה
 * ש"מפרט אחד" אמור למנוע.
 */
const minOf = (t) => t?.match(/המינימום כאן (\d+)/)?.[1] ?? null;
ok(
  'and both gates resolve the same board thickness',
  minOf(repo.refused) !== null && minOf(repo.refused) === minOf(warn),
  `${minOf(repo.refused)} מול ${minOf(warn)}`,
);
ok('and the row is untouched', repo.still === before.h, String(repo.still));
ok('while a sound height goes through', repo.moved === 900, String(repo.moved));

/* ------------------------------------------------------------------ */
/* R04 — החלפת סוג                                                     */
/* ------------------------------------------------------------------ */

const conv = await page.evaluate(async (id) => {
  const { db } = await import('/src/db/db.ts');
  const { unitsRepo } = await import('/src/features/projects/projectsRepo.ts');
  await unitsRepo.update(id, {
    glyph: 'drawers',
    zones: [
      { id: 'z1', heightMm: 440, kind: 'drawers', drawers: 3, drawerStyle: 'outer' },
      { id: 'z2', heightMm: 440, kind: 'drawers', drawers: 2, drawerStyle: 'outer' },
    ],
  });
  return (await db.units.get(id)).zones.map((z) => z.kind);
}, before.id);
ok('the cabinet starts as drawers', conv.join() === 'drawers,drawers', JSON.stringify(conv));

/* השאילתה חיה — הכתיבה דרך המאגר כבר על המסך, בלי רענון */
await page.waitForTimeout(900);
await page.locator('svg g[data-unit-id]').first().click();
await page.waitForTimeout(600);
await btn(/עריכת הארגז|^עריכה$/).click();
await page.waitForTimeout(700);
await dlg().getByRole('button', { name: 'דלתות', exact: true }).first().click();
await page.waitForTimeout(500);
const convText = await dlg().innerText();
/* אין מה להודיע עליו: האיור הוא תמונה, והפנים נשאר */
ok('the form promises no conversion', !/הומר|הומרו/.test(convText),
  convText.split('\n').find((l) => /הומר/.test(l)) ?? '');
await dlg().getByRole('button', { name: /עדכון הארגז/ }).click();
await page.waitForTimeout(1100);

const afterGlyph = await unit();
ok('the icon really changed', afterGlyph.glyph === 'doors', afterGlyph.glyph);
ok('and the drawer zones survived it', afterGlyph.zones?.every((z) => z.kind === 'drawers'), JSON.stringify(afterGlyph.zones?.map((z) => z.kind)));

const parts = await page.evaluate(async (id) => {
  const { db } = await import('/src/db/db.ts');
  const { unitParts } = await import('/src/costing/boards.ts');
  const { settingsRepo } = await import('/src/materials/materialsRepo.ts');
  const u = await db.units.get(id);
  const settings = await settingsRepo.get();
  const list = unitParts(u, settings);
  return {
    drawerParts: list.filter((p) => /מגיר/.test(p.label ?? '')).length,
    zero: list.filter((p) => p.widthMm <= 0 || p.heightMm <= 0).length,
  };
}, before.id);
ok('and the cut list still holds them', parts.drawerParts > 0, String(parts.drawerParts));
ok('and no part of zero size', parts.zero === 0, String(parts.zero));

ok('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
const bad = out.filter((l) => l.startsWith('FAIL'));
console.log(bad.length ? `\n${bad.length} נפלו` : '\nהכול עבר');
if (bad.length) process.exitCode = 1;
await browser.close();

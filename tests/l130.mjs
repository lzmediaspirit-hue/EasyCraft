import './_exit.mjs';
/*
 * שכבה 130 — R06/R07/R08: בעלות בכתיבה, זהות בייבוא, וגרסאות.
 *
 * R06 — הקריאה הייתה מוגבלת לנגרייה והכתיבה לא: שאילתה על ארגז של
 *       נגרייה אחרת החזירה ריק כמצופה, ו-`update` ו-`remove` על
 *       אותו מזהה בדיוק הצליחו. גבול שנאכף בקריאה בלבד הוא הסתרה.
 * R07 — ייבוא אותו ארגז לנגרייה שנייה דרס את השורה של הראשונה ולקח
 *       לה את הבעלות: המפתח גלובלי, והכתיבה נשאה מזהה מקורי ובעלות
 *       חדשה.
 * R08 — "בטל" החזיר גרסה מ-2 ל-1, וייבוא אִפֵּס אותה ל-1. שורה
 *       שנמחקה במכוון וחזרה השאירה אחריה סימון מחיקה.
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

await setup(page, { name: 'בעלות בע״מ' });
await addNamed(page, BOX.any);
await page.waitForTimeout(900);

/* ------------------------------------------------------------------ */
/* R06 — כתיבה חוצה נגרייה                                             */
/* ------------------------------------------------------------------ */

const cross = await page.evaluate(async () => {
  const { db } = await import('/src/db/db.ts');
  const W = await import('/src/db/workshop.ts');
  const R = await import('/src/db/rows.ts');
  const { unitsRepo } = await import('/src/features/projects/projectsRepo.ts');
  const { catalogRepo } = await import('/src/catalog/catalogRepo.ts');

  const home = W.workshopId();
  const unit = (await db.units.toArray())[0];
  const item = (await db.catalog.toArray())[0];
  const before = { x: unit.xMm, rev: unit.rev, name: item.name };

  W.useWorkshop('workshop-b');
  await R.ensureWorkshop();

  /* קריאה — ריק, כמצופה */
  const read = await unitsRepo.listForProject(unit.projectId);

  /* כתיבה ומחיקה על מזהה של נגרייה אחרת */
  let updateThrew = null;
  try {
    await unitsRepo.update(unit.id, { xMm: 2500 });
  } catch (e) {
    updateThrew = String(e.message ?? e);
  }
  await unitsRepo.remove(unit.id);
  await catalogRepo.setFavorite(item.id, true);
  await catalogRepo.remove(item.id);

  const afterUnit = await db.units.get(unit.id);
  const afterItem = await db.catalog.get(item.id);
  const marks = await db.tombstones.toArray();

  /* ובקרה חיובית: בנגרייה שלה, הכתיבה כן עובדת */
  const own = await db.customers.toArray();

  W.useWorkshop(home);
  return {
    readEmpty: read.length === 0,
    updateThrew,
    unitAlive: !!afterUnit,
    unitX: afterUnit?.xMm ?? null,
    unitRev: afterUnit?.rev ?? null,
    itemAlive: !!afterItem,
    itemFavorite: afterItem?.favorite ?? null,
    marks: marks.length,
    before,
    strangers: own.filter((c) => c.workshopId === 'workshop-b').length,
  };
});

ok('a stranger reads nothing', cross.readEmpty, String(cross.readEmpty));
ok("a stranger's update leaves the row alone", cross.unitX === cross.before.x, `${cross.before.x} → ${cross.unitX}`);
ok('and does not move its revision', cross.unitRev === cross.before.rev, `${cross.before.rev} → ${cross.unitRev}`);
ok("a stranger's delete does not delete", cross.unitAlive, String(cross.unitAlive));
ok('nor does it leave a tombstone', cross.marks === 0, String(cross.marks));
ok("a stranger cannot flag another shop's library item", !cross.itemFavorite, String(cross.itemFavorite));
ok('nor remove it', cross.itemAlive, String(cross.itemAlive));

/* זהות ובעלות אינן שדות שמעדכנים בדרך */
const identity = await page.evaluate(async () => {
  const { db } = await import('/src/db/db.ts');
  const { unitsRepo } = await import('/src/features/projects/projectsRepo.ts');
  const u = (await db.units.toArray())[0];
  await unitsRepo.update(u.id, { workshopId: 'workshop-b', rev: 99 });
  const after = await db.units.get(u.id);
  return { owner: after.workshopId, rev: after.rev, was: u.rev };
});
ok('a plain patch cannot hand the row to another shop', identity.owner === 'workshop-local', identity.owner);
ok('nor set its revision by hand', identity.rev === identity.was + 1, `${identity.was} → ${identity.rev}`);

/* ------------------------------------------------------------------ */
/* R07 — ייבוא אינו גונב מזהה                                          */
/* ------------------------------------------------------------------ */

const imported = await page.evaluate(async () => {
  const { db } = await import('/src/db/db.ts');
  const P = await import('/src/db/cabinetPack.ts');
  const W = await import('/src/db/workshop.ts');
  const R = await import('/src/db/rows.ts');

  const home = W.workshopId();
  const pack = await P.exportCabinets();
  const sourceId = pack.tables.catalog[0].id;
  const mineBefore = await db.catalog.get(sourceId);
  /* הנגרייה הראשונה מסמנת את הפריט שלה, כדי שנראה אם הוא נדרס */
  await db.catalog.update(sourceId, { name: 'של הראשונה' });

  W.useWorkshop('workshop-c');
  await R.ensureWorkshop();
  const first = await P.importCabinets(pack, 'merge');
  const afterFirst = await db.catalog.get(sourceId);
  const copies = (await db.catalog.toArray()).filter(
    (i) => i.workshopId === 'workshop-c' && i.sourceId === sourceId,
  );

  /* ייבוא חוזר של אותה חבילה — לא עותק שלישי */
  await P.importCabinets(pack, 'merge');
  const copiesAgain = (await db.catalog.toArray()).filter(
    (i) => i.workshopId === 'workshop-c' && i.sourceId === sourceId,
  );
  const mineCount = (await db.catalog.toArray()).filter((i) => i.workshopId === 'workshop-c').length;

  W.useWorkshop(home);
  const stillMine = await db.catalog.get(sourceId);
  return {
    firstOk: !first.error,
    originalOwner: afterFirst?.workshopId ?? null,
    originalName: stillMine?.name ?? null,
    copies: copies.length,
    copiesAgain: copiesAgain.length,
    copyOwner: copies[0]?.workshopId ?? null,
    copySource: copies[0]?.sourceId ?? null,
    hadName: mineBefore?.name ?? null,
    mineCount,
  };
});

ok('the import into a second shop succeeds', imported.firstOk, String(imported.firstOk));
ok("the first shop's row keeps its owner", imported.originalOwner === 'workshop-local', String(imported.originalOwner));
ok('and keeps what the first shop wrote in it', imported.originalName === 'של הראשונה', String(imported.originalName));
ok('the second shop gets a copy of its own', imported.copies === 1, String(imported.copies));
ok('owned by it', imported.copyOwner === 'workshop-c', String(imported.copyOwner));
ok('and it remembers where it came from', imported.copySource === imported.copySource, String(imported.copySource));
ok('importing the same pack again makes no third copy', imported.copiesAgain === 1, String(imported.copiesAgain));

/* ------------------------------------------------------------------ */
/* R08 — גרסאות וסימוני מחיקה                                          */
/* ------------------------------------------------------------------ */

const revs = await page.evaluate(async () => {
  const { db } = await import('/src/db/db.ts');
  const { unitsRepo } = await import('/src/features/projects/projectsRepo.ts');
  const { history } = await import('/src/features/design/history.ts');

  const u = (await db.units.toArray())[0];
  await unitsRepo.update(u.id, { xMm: 400 });
  const atTwo = await db.units.get(u.id);

  await history.capture(u.projectId, 'test-rev');
  await unitsRepo.update(u.id, { xMm: 900 });
  const atThree = await db.units.get(u.id);
  await history.undo(u.projectId);
  const afterUndo = await db.units.get(u.id);

  /* מחיקה, ואז ביטול שמחזיר — הסימון חייב לרדת */
  await history.capture(u.projectId, 'test-del');
  await unitsRepo.remove(u.id);
  const markAfterDelete = await db.tombstones.get(`units:${u.id}`);
  await history.undo(u.projectId);
  const back = await db.units.get(u.id);
  const markAfterUndo = await db.tombstones.get(`units:${u.id}`);

  await db.tombstones.clear();
  return {
    two: atTwo.rev,
    three: atThree.rev,
    undoRev: afterUndo.rev,
    undoX: afterUndo.xMm,
    marked: !!markAfterDelete,
    back: !!back,
    backRev: back?.rev ?? null,
    markGone: !markAfterUndo,
  };
});

ok('an edit moves the revision forward', revs.three === revs.two + 1, `${revs.two} → ${revs.three}`);
ok('undo brings the measurement back', revs.undoX === 400, String(revs.undoX));
ok('but the revision keeps going forward', revs.undoRev > revs.three, `${revs.three} → ${revs.undoRev}`);
ok('deleting leaves a mark', revs.marked, String(revs.marked));
ok('undo brings the cabinet back', revs.back, String(revs.back));
ok('with a newer revision still', revs.backRev > revs.undoRev, `${revs.undoRev} → ${revs.backRev}`);
ok('and the mark is gone with it', revs.markGone, String(revs.markGone));

/* ייבוא של שורה קיימת מקדם גרסה, ולא מאפס אותה */
const reimport = await page.evaluate(async () => {
  const { db } = await import('/src/db/db.ts');
  const P = await import('/src/db/cabinetPack.ts');
  const pack = await P.exportCabinets();
  const id = pack.tables.catalog[0].id;
  await db.catalog.update(id, { rev: 7 });
  await P.importCabinets(pack, 'merge');
  const after = await db.catalog.get(id);
  await db.tombstones.clear();
  return { rev: after.rev };
});
ok('re-importing an existing row advances its revision', reimport.rev === 8, String(reimport.rev));

ok('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
const bad = out.filter((l) => l.startsWith('FAIL'));
console.log(bad.length ? `\n${bad.length} נפלו` : '\nהכול עבר');
if (bad.length) process.exitCode = 1;
await browser.close();

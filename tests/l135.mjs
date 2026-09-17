import './_exit.mjs';
/*
 * שכבה 135 — מטריצת מעברים.
 *
 * הביקורת: "בדיקת מסלול מוצלח בלבד פספסה את רוב הבעיות כאן."
 * וזה נכון — כמעט כל באג שנמצא כאן ישב במעבר בין שני מצבים ולא
 * בתוך מצב אחד: מה שהותקן פעם ומה שמותקן היום, ספרייה שנוסעת
 * לפרויקט וחוזרת, נגרייה שמחליפה נגרייה, גרירה שבוטלה, וסוג ארגז
 * שהוחלף באחר.
 *
 * חמישה מעברים, וכל אחד נבדק כמעבר: המצב לפני, הפעולה, והמצב
 * אחרי — ולא רק "הגענו לאן שרצינו".
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

await setup(page, { name: 'מעברים בע״מ' });
await addNamed(page, BOX.any);
await page.waitForTimeout(900);

/* ------------------------------------------------------------------ */
/* 1 — התקנה ישנה ← חדשה                                               */
/* ------------------------------------------------------------------ */

const upgrade = await page.evaluate(async () => {
  const { db } = await import('/src/db/db.ts');
  const L = await import('/src/db/legacy.ts');

  /* שורה כפי שנשמרה בגרסה ישנה: עובי לוח כשדה נפרד */
  const old = {
    catalog: [
      { id: 'old-1', glyph: 'slab', name: 'מדף ישן', panelThicknessMm: 30, defaultHeightMm: 300 },
    ],
    units: [{ id: 'old-u', glyph: 'plain', panelThicknessMm: 18, heightMm: 800 }],
  };
  /*
   * החבילה נושאת פריטי ספרייה בלבד, ולכן `normalizeTables` נוגעת
   * בקטלוג. הארגז המונח עובר את אותה המרה עצמה במעבר במסד —
   * `normalizeRow`, אותה פונקציה בדיוק — וזה מה שנבדק כאן.
   */
  const fixed = L.normalizeTables(structuredClone(old));
  const item = fixed.catalog[0];
  const unit = L.normalizeRow(structuredClone(old.units[0]), 'unit');

  return {
    version: db.verno,
    itemHadField: 'panelThicknessMm' in old.catalog[0],
    itemKeeps: item.panelThicknessMm,
    itemHeight: item.defaultHeightMm,
    unitKeeps: unit.panelThicknessMm,
    /* לוח עומד: העובי הישן הוא העומק שלו, לא גובהו */
    unitDepth: unit.depthMm,
    unitHeight: unit.heightMm,
  };
});

ok('the database is at the current version', upgrade.version >= 29, String(upgrade.version));
ok('an old row really carried the separate thickness', upgrade.itemHadField);
ok('and after the upgrade it no longer does', upgrade.itemKeeps === undefined, String(upgrade.itemKeeps));
ok('the shelf keeps its real height, not its thickness', upgrade.itemHeight === 30, String(upgrade.itemHeight));
ok('and a placed board is converted too', upgrade.unitKeeps === undefined, String(upgrade.unitKeeps));
ok('a standing board takes it as depth, not height', upgrade.unitDepth === 18, String(upgrade.unitDepth));
ok('and keeps the height it really had', upgrade.unitHeight === 800, String(upgrade.unitHeight));

/* ------------------------------------------------------------------ */
/* 2 — ספרייה ← פרויקט ← עריכה ← ייצוא ← ייבוא                          */
/* ------------------------------------------------------------------ */

const round = await page.evaluate(async () => {
  const { db } = await import('/src/db/db.ts');
  const P = await import('/src/db/cabinetPack.ts');
  const { catalogRepo } = await import('/src/catalog/catalogRepo.ts');
  const { unitsRepo, wallsRepo, projectsRepo } = await import(
    '/src/features/projects/projectsRepo.ts'
  );

  const project = (await projectsRepo.all())[0];
  const wall = (await wallsRepo.listForProject(project.id))[0];

  /* ספרייה → פרויקט */
  const source = (await catalogRepo.all()).find((i) => i.glyph === 'doors');
  const placed = await unitsRepo.add(project.id, wall.id, source, 1500, 600);

  /* עריכה בפרויקט — והספרייה לא זזה */
  await unitsRepo.update(placed.id, { heightMm: 940, doors: 1, hingeSide: 'end' });
  const edited = await db.units.get(placed.id);
  const untouched = await db.catalog.get(source.id);

  /* עריכה → ספרייה, כארגז חדש */
  const savedId = await catalogRepo.saveCustom({
    ...source,
    id: undefined,
    code: 'TRIP-1',
    name: 'ארגז שנסע',
    defaultHeightMm: edited.heightMm,
    doors: edited.doors,
    hingeSide: edited.hingeSide,
  });

  /* ייצוא → ייבוא, לאותה נגרייה */
  const file = await P.exportCabinets();
  const before = (await catalogRepo.all()).length;
  const again = await P.importCabinets({ ...file, manifest: undefined }, 'merge');
  const after = (await catalogRepo.all()).length;
  const back = (await db.catalog.toArray()).filter((i) => i.code === 'TRIP-1');

  await db.tombstones.clear();
  return {
    placedHeight: placed.heightMm,
    editedHeight: edited.heightMm,
    sourceHeight: untouched.defaultHeightMm,
    savedHinge: (await db.catalog.get(savedId)).hingeSide,
    before,
    after,
    copies: back.length,
    keptHeight: back[0]?.defaultHeightMm,
    unresolved: again.unresolved,
  };
});

ok('a library item lands in the project at its own size', round.placedHeight > 0, String(round.placedHeight));
ok('editing it in the project changes the placed cabinet', round.editedHeight === 940, String(round.editedHeight));
ok('and leaves the library item alone', round.sourceHeight !== 940, String(round.sourceHeight));
ok('saving back keeps the hinge side that was chosen', round.savedHinge === 'end', String(round.savedHinge));
ok('re-importing the same pack does not duplicate it', round.copies === 1, String(round.copies));
ok('nor does it grow the library', round.after === round.before, `${round.before} → ${round.after}`);
ok('and the edited size survives the round trip', round.keptHeight === 940, String(round.keptHeight));
ok('with nothing left unresolved', round.unresolved === 0, String(round.unresolved));

/* ------------------------------------------------------------------ */
/* 3 — נגרייה א ← נגרייה ב                                             */
/* ------------------------------------------------------------------ */

const swap = await page.evaluate(async () => {
  const { db } = await import('/src/db/db.ts');
  const W = await import('/src/db/workshop.ts');
  const R = await import('/src/db/rows.ts');
  const P = await import('/src/db/cabinetPack.ts');
  const { catalogRepo } = await import('/src/catalog/catalogRepo.ts');

  const home = W.workshopId();
  const mine = (await db.catalog.toArray()).find((i) => i.code === 'TRIP-1');
  const file = await P.exportCabinets();
  const seenAtHome = (await catalogRepo.all()).length;

  /* אותה חבילה, נגרייה אחרת */
  W.useWorkshop('workshop-b');
  await R.ensureWorkshop();
  const emptyThere = (await catalogRepo.all()).length;
  await P.importCabinets({ ...file, manifest: undefined }, 'merge');
  const seenThere = (await catalogRepo.all()).length;
  const theirCopy = (await db.catalog.toArray()).find(
    (i) => i.code === 'TRIP-1' && i.workshopId === 'workshop-b',
  );

  /* ב עורכת את שלה */
  if (theirCopy) await catalogRepo.saveCustom({ ...theirCopy, name: 'שונה אצל ב' });

  /* וחוזרים לא */
  W.useWorkshop(home);
  await R.ensureWorkshop();
  const homeAgain = (await catalogRepo.all()).length;
  const myRow = await db.catalog.get(mine.id);

  return {
    seenAtHome,
    emptyThere,
    seenThere,
    separateIds: !!theirCopy && theirCopy.id !== mine.id,
    sourceId: theirCopy?.sourceId,
    homeAgain,
    myNameKept: myRow?.name,
    myOwner: myRow?.workshopId === home,
  };
});

ok('workshop B starts with nothing', swap.emptyThere === 0, String(swap.emptyThere));
ok('the pack lands there in full', swap.seenThere === swap.seenAtHome, `${swap.seenAtHome} → ${swap.seenThere}`);
ok('as its own copy, with its own id', swap.separateIds, String(swap.separateIds));
ok('that remembers where it came from', !!swap.sourceId, String(swap.sourceId));
ok('workshop A still sees exactly its own', swap.homeAgain === swap.seenAtHome, `${swap.seenAtHome} → ${swap.homeAgain}`);
ok('and B editing its copy did not rename A\'s', swap.myNameKept === 'ארגז שנסע', String(swap.myNameKept));
ok('nor take ownership of it', swap.myOwner, String(swap.myOwner));

/* ------------------------------------------------------------------ */
/* 4 — גרירה ← ביטול                                                   */
/* ------------------------------------------------------------------ */

const cancel = await page.evaluate(async () => {
  const preview = (await import('/src/features/design/preview.ts')).preview;
  const { db } = await import('/src/db/db.ts');
  const unit = (await db.units.toArray())[0];

  const start = unit.xMm;
  /* תנועה שנצברת בזיכרון, כמו בגרירה אמיתית */
  preview.set(unit.id, { xMm: start + 400 });
  const during = preview.active();

  /* ביטול: מה שביד יורד בלי להיכתב */
  preview.discard();
  const afterCancel = (await db.units.get(unit.id)).xMm;
  const leftOver = preview.active();

  /* ואותה תנועה, הפעם עם אישור */
  preview.set(unit.id, { xMm: start + 400 });
  const moves = preview.drain();
  return {
    start,
    during,
    afterCancel,
    leftOver,
    committed: moves.length,
    movedTo: moves[0]?.[1]?.xMm,
    drained: preview.active(),
  };
});

ok('a drag in progress is held before it is written', cancel.during === true, String(cancel.during));
ok('cancelling writes nothing to the database', cancel.afterCancel === cancel.start, `${cancel.start} → ${cancel.afterCancel}`);
ok('and leaves no half-move behind', cancel.leftOver === false, String(cancel.leftOver));
ok('while committing hands over exactly one move', cancel.committed === 1, String(cancel.committed));
ok('carrying the position that was dragged to', cancel.movedTo === cancel.start + 400, String(cancel.movedTo));
ok('and empties the preview after it', cancel.drained === false, String(cancel.drained));

/* ------------------------------------------------------------------ */
/* 5 — סוג ארגז ← סוג אחר                                              */
/* ------------------------------------------------------------------ */

const convert = await page.evaluate(async () => {
  const { convertZones, checkUnit } = await import('/src/catalog/saveGate.ts');
  const drawers = {
    glyph: 'drawers',
    zones: [{ kind: 'drawers', drawers: 3, share: 1 }],
  };
  const withCols = {
    glyph: 'drawers',
    zones: [
      { kind: 'drawers', drawers: 2, share: 1, columns: [{ kind: 'drawers', drawers: 2 }] },
    ],
  };
  const toDoors = convertZones(drawers, 'doors');
  const toBoard = convertZones(drawers, 'slab');
  const same = convertZones(drawers, 'drawers');
  const cols = convertZones(withCols, 'doors');

  return {
    toDoorsKind: toDoors.zones?.[0]?.kind,
    toDoorsNote: toDoors.note,
    toDoorsDrawers: toDoors.zones?.[0]?.drawers,
    toBoard: toBoard.zones?.length,
    toBoardNote: toBoard.note,
    sameNote: same.note,
    colKind: cols.zones?.[0]?.columns?.[0]?.kind,
    /* והמעבר אינו יוצר ארגז שאי אפשר לבנות */
    stillValid: checkUnit({
      glyph: 'doors',
      widthMm: 600,
      heightMm: 880,
      depthMm: 580,
      socleMm: 100,
      zones: toDoors.zones,
    }),
  };
});

ok('changing type converts the inside, not just the label', convert.toDoorsKind === 'shelves', String(convert.toDoorsKind));
ok('and the old drawer count is dropped with it', convert.toDoorsDrawers === undefined, String(convert.toDoorsDrawers));
ok('the change is said out loud, in Hebrew', /הומר|הומרו/.test(convert.toDoorsNote ?? ''), String(convert.toDoorsNote));
ok('columns inside a zone are converted too', convert.colKind === 'shelves', String(convert.colKind));
ok('a single board has no inside at all', convert.toBoard === 0, String(convert.toBoard));
ok('and that is said too', /אין פנים/.test(convert.toBoardNote ?? ''), String(convert.toBoardNote));
ok('converting to the same type changes nothing', convert.sameNote === null, String(convert.sameNote));
ok('and what comes out is still buildable', convert.stillValid === null, String(convert.stillValid));

ok('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
const bad = out.filter((l) => l.startsWith('FAIL'));
console.log(bad.length ? `\n${bad.length} נפלו` : '\nהכול עבר');
await browser.close();

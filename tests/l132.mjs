/*
 * שכבה 132 — F01–F05 מתוספת הביקורת.
 *
 * F01 (P1) — `doorFronts` סינן לפי "מכשיר" בעוד שאר החישוב סינן לפי
 *            "מכשיר עצמאי", ולכן ארגז כיור וסחרחרה עם שתי דלתות
 *            החזירו אפס חזיתות בחיתוך. אותו מניין משמש גם פרזול.
 * F02 — הנחה מהספרייה דרסה את תיבת המגירה של התבנית בברירת המחדל
 *       של הנגרייה: תבנית שנשמרה עם תיבת עץ חזרה עם ברזל.
 * F03 — "בלי גב" הסתיר גם את בקרת קושרת התקרה, שאינה תלויה בו.
 * F04 — קובץ הספרייה נשא מזהי חדרים בלי הגדרות החדרים, והייבוא
 *       דיווח "0 חסרים" כי חדרים לא נספרו בכלל.
 * F05 — שמירה כארגז חדש כשהמקור נמחק שייכה קשיח לשלושה חדרים.
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
const ok = (name, cond, extra = '') => {
  const line = `${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' | ' + extra : ''}`;
  out.push(line);
  console.log(line);
};
const btn = (re) => page.getByRole('button', { name: re }).first();
const dlg = () => page.getByRole('dialog').last();

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });

/* ------------------------------------------------------------------ */
/* F01 — דלתות כיור וסחרחרה                                            */
/* ------------------------------------------------------------------ */

const fronts = await page.evaluate(async () => {
  const B = await import('/src/costing/boards.ts');
  const settings = {
    sheetWidthMm: 2440, sheetHeightMm: 1220, kerfMm: 4, carcassThicknessMm: 18,
    yieldPct: 85, backGrooveMm: 8, frontGapMm: 3,
    accessories: { drawerFactory: 10, drawerConsumer: 40, ledFactory: 0, ledConsumer: 0, liftFactory: 20, liftConsumer: 80 },
    extras: [], glassFactoryPerM2: 0, glassConsumerPerM2: 0, vatPct: 18,
    edgeFactoryPerM: 0, edgeConsumerPerM: 0,
    defaults: { socleMm: 100, counterTopMm: 30, baseDepthMm: 580, upperDepthMm: 320, upperBottomMm: 1500, wallLengthMm: 3000, wallHeightMm: 2600, backKind: 'thin', drawerBox: 'metal' },
    updatedAt: 0, id: 'app',
  };
  const unit = (glyph, over = {}) => ({
    id: 'u', projectId: 'p', wallId: 'w', catalogItemId: 'c',
    name: 'ארגז', glyph, level: 'floor',
    xMm: 0, yMm: 0, widthMm: 600, heightMm: 880, depthMm: 580,
    socleMm: 100, doors: 2, createdAt: 0, updatedAt: 0, ...over,
  });
  /*
   * רצף חזיתות אחד הוא שורת חיתוך אחת עם כמות — שתי דלתות זהות הן
   * `qty: 2` ולא שתי שורות. הספירה כאן היא של לוחות, ולכן היא סוכמת
   * את הכמות; מניין השורות היה מדווח "1" גם על ארגז דו־כנפי תקין.
   */
  const frontsOf = (glyph, over) =>
    B.unitParts(unit(glyph, over), settings)
      .filter((p) => p.role === 'front')
      .reduce((n, p) => n + (p.qty ?? 1), 0);
  const bodyOf = (glyph) =>
    B.unitParts(unit(glyph), settings).filter((p) => p.role === 'carcass').length;

  return {
    doors: frontsOf('doors'),
    sink: frontsOf('sink'),
    carousel: frontsOf('carousel'),
    hob: frontsOf('hob', { doors: 0, drawers: 2 }),
    oven: B.unitParts(unit('oven'), settings).length,
    sinkOneDoor: frontsOf('sink', { doors: 1 }),
    sinkBody: bodyOf('sink'),
    ovenBody: bodyOf('oven'),
  };
});

ok('an ordinary two-door cabinet cuts two fronts', fronts.doors === 2, String(fronts.doors));
ok('a sink cabinet cuts them too', fronts.sink === 2, String(fronts.sink));
ok('and a carousel', fronts.carousel === 2, String(fronts.carousel));
ok('a sink with one door cuts one', fronts.sinkOneDoor === 1, String(fronts.sinkOneDoor));
ok('the sink still has a carcass', fronts.sinkBody > 0, String(fronts.sinkBody));
ok('a standalone oven cuts nothing at all', fronts.oven === 0, String(fronts.oven));
ok('and has no carcass either', fronts.ovenBody === 0, String(fronts.ovenBody));

/* ------------------------------------------------------------------ */
/* F02 — תיבת המגירה של התבנית                                         */
/* ------------------------------------------------------------------ */

await setup(page, { name: 'תוספת בע״מ' });
await page.waitForTimeout(900);

const box = await page.evaluate(async () => {
  const { db } = await import('/src/db/db.ts');
  const { catalogRepo } = await import('/src/catalog/catalogRepo.ts');
  const { unitsRepo, wallsRepo, projectsRepo } = await import(
    '/src/features/projects/projectsRepo.ts'
  );
  const { settingsRepo } = await import('/src/materials/materialsRepo.ts');

  await settingsRepo.save({ defaults: { ...(await settingsRepo.get()).defaults, drawerBox: 'metal' } });
  const project = (await projectsRepo.all())[0];
  const wall = (await wallsRepo.listForProject(project.id))[0];
  const base = (await catalogRepo.all()).find((i) => i.glyph === 'drawers') ?? (await catalogRepo.all())[0];

  /* תבנית שנשמרה במפורש עם תיבת עץ */
  const woodId = await catalogRepo.saveCustom({
    ...base,
    id: undefined,
    code: 'WOOD-1',
    name: 'תבנית עץ',
    drawerBox: 'wood',
  });
  const wood = await db.catalog.get(woodId);
  const placedWood = await unitsRepo.add(project.id, wall.id, wood, 0, 600);

  /* ותבנית בלי העדפה — מקבלת את דרך העבודה של הנגרייה */
  const plainId = await catalogRepo.saveCustom({
    ...base,
    id: undefined,
    code: 'PLAIN-1',
    name: 'תבנית בלי העדפה',
    drawerBox: undefined,
  });
  const plain = await db.catalog.get(plainId);
  const placedPlain = await unitsRepo.add(project.id, wall.id, plain, 700, 600);

  return { template: wood.drawerBox, placed: placedWood.drawerBox, plain: placedPlain.drawerBox };
});

ok('a template saved with wooden boxes keeps them', box.template === 'wood', String(box.template));
ok('and placing it does not turn them to metal', box.placed === 'wood', String(box.placed));
ok('a template with no preference still takes the workshop default', box.plain === 'metal', String(box.plain));

/* ------------------------------------------------------------------ */
/* F04 — חדרים נוסעים עם הארגזים                                       */
/* ------------------------------------------------------------------ */

const pack = await page.evaluate(async () => {
  const { db } = await import('/src/db/db.ts');
  const P = await import('/src/db/cabinetPack.ts');
  const { roomsRepo } = await import('/src/catalog/roomsRepo.ts');
  const { catalogRepo } = await import('/src/catalog/catalogRepo.ts');

  const roomId = await roomsRepo.add({ label: 'חדר מלאכה', groups: ['base'] });
  const base = (await catalogRepo.all())[0];
  await catalogRepo.saveCustom({
    ...base,
    id: undefined,
    code: 'ROOM-1',
    name: 'ארגז בחדר מלאכה',
    rooms: [roomId],
  });

  const file = await P.exportCabinets();
  const carried = (file.tables.rooms ?? []).some((r) => r.id === roomId);
  const manifest = P.packManifest(file);

  /* המקבל שאין לו את החדר: מסירים אותו מהנתונים ומייבאים */
  const withoutRoom = {
    ...file,
    manifest: undefined,
    tables: { ...file.tables, rooms: (file.tables.rooms ?? []).filter((r) => r.id !== roomId) },
  };
  await db.rooms.delete(roomId);
  const blind = await P.importCabinets(withoutRoom, 'merge');

  /* ועם החדר — ההפניה נפתרת */
  /* `code` אינו אינדקס בטבלה, ולכן הסינון כאן הוא בזיכרון ומוחק לפי מזהה */
  const landed = (await db.catalog.toArray()).filter((i) => i.code === 'ROOM-1');
  await db.catalog.bulkDelete(landed.map((i) => i.id));
  const whole = await P.importCabinets({ ...file, manifest: undefined }, 'merge');
  const landedRoom = !!(await db.rooms.get(roomId));

  await db.tombstones.clear();
  return {
    carried,
    manifestRooms: manifest.rooms ?? null,
    blindUnresolved: blind.unresolved,
    wholeUnresolved: whole.unresolved,
    landedRoom,
    format: file.format,
  };
});

ok('the pack carries the room its cabinet points at', pack.carried, String(pack.carried));
ok('and the manifest counts it', pack.manifestRooms >= 1, String(pack.manifestRooms));
ok('the format says it is a newer file', pack.format === 5, String(pack.format));
ok('a missing room is reported as unresolved', pack.blindUnresolved >= 1, String(pack.blindUnresolved));
ok('while the whole pack resolves cleanly', pack.wholeUnresolved === 0, String(pack.wholeUnresolved));
ok('and the room itself lands', pack.landedRoom, String(pack.landedRoom));

/* ------------------------------------------------------------------ */
/* F03 + F05 — במסך                                                    */
/* ------------------------------------------------------------------ */

await addNamed(page, /^ארגז/);
await page.waitForTimeout(900);
/* עורך הארגז הוא לוח במסך ולא חלון — ולכן הכפתורים נמצאים על הדף */
await btn(/עריכה מתקדמת/).click();
await page.waitForTimeout(800);

const railCount = () => page.getByRole('button', { name: 'תקרה', exact: true }).count();
await page.getByRole('button', { name: 'ללא גב', exact: true }).first().click();
await page.waitForTimeout(500);
ok('a cabinet with no back still offers a top rail', (await railCount()) === 1, String(await railCount()));
await page.getByRole('button', { name: 'גב דק', exact: true }).first().click();
await page.waitForTimeout(400);
ok('and it is still there with a back', (await railCount()) === 1, String(await railCount()));

/* F05 — שמירה כארגז חדש כשהמקור נמחק */
const room = await page.evaluate(async () => {
  const { db } = await import('/src/db/db.ts');
  const { roomsRepo } = await import('/src/catalog/roomsRepo.ts');
  const u = (await db.units.toArray())[0];
  await db.catalog.delete(u.catalogItemId);
  /* חדר שהנגר הוסיף בעצמו — בדיוק זה שהשיוך הקשיח השאיר בחוץ */
  const id = await roomsRepo.add({ label: 'חדר מלאכה', groups: ['base'] });
  return (await db.rooms.get(id)).label;
});
await page.waitForTimeout(700);
await page.getByRole('button', { name: 'שמירה לספרייה' }).first().click();
await page.waitForTimeout(900);
const sheet = await dlg().innerText();
ok('the save sheet asks which rooms', /חדרים/.test(sheet), sheet.split('\n').slice(0, 4).join(' | '));
ok('and a room the carpenter added is offered too', sheet.includes(room), room);

await dlg().getByRole('button', { name: room, exact: true }).first().click();
await page.waitForTimeout(300);
await dlg().getByRole('button', { name: /שמירה כארגז חדש|עדכון/ }).first().click();
await page.waitForTimeout(1200);

const saved = await page.evaluate(async () => {
  const { db } = await import('/src/db/db.ts');
  const rows = await db.catalog.toArray();
  const last = rows.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))[0];
  const rooms = await db.rooms.bulkGet(last.rooms ?? []);
  return { rooms: rooms.filter(Boolean).map((r) => r.label) };
});
ok('the cabinet is saved into the room that was picked', saved.rooms.includes(room), saved.rooms.join(','));

ok('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
const bad = out.filter((l) => l.startsWith('FAIL'));
console.log(bad.length ? `\n${bad.length} \u05e0\u05e4\u05dc\u05d5` : '\n\u05d4\u05db\u05d5\u05dc \u05e2\u05d1\u05e8');
if (bad.length) process.exitCode = 1;
await browser.close();

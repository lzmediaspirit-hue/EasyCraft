/*
 * שכבה 125 — של מי השורה, איזו גרסה, ומה נשאר אחרי מחיקה.
 *
 * שלושה דברים שהמודל לא ידע לומר עד כה: מי הבעלים של שורה, כמה
 * פעמים היא נכתבה, ומה קרה לשורה שנמחקה. בלי הראשון אי אפשר להגביל
 * שאילתה; בלי השני אי אפשר להכריע בין שני שינויים; ובלי השלישי
 * מחיקה קמה לתחייה מהמכשיר השני.
 *
 * הבדיקה מפעילה נגרייה שנייה במכשיר — מה שאין לו עדיין מסך — כדי
 * שההפרדה תהיה דבר שנבדק ולא הבטחה.
 */
import { chromium } from 'playwright';
import { setup } from './mk.mjs';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

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

/* ------------------------------------------------------------------ */
/* הגבול: מי מדבר עם המסד                                              */
/* ------------------------------------------------------------------ */

/*
 * כלל שנאכף בגבול אחד ונעקף בעשרים אינו כלל. הבדיקה סורקת את הקוד
 * עצמו: `db` מיובא בשכבת הנתונים בלבד — `src/db` והמאגרים.
 */
const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`],
  );
/* הנתיב נגזר מהקובץ ולא מתיקיית ההרצה: הבדיקות רצות מ-`tests/` */
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const sources = walk(`${ROOT}src`).filter((f) => /\.tsx?$/.test(f));
const outside = sources.filter(
  (f) =>
    !f.startsWith(`${ROOT}src/db/`) &&
    !/Repo\.ts$/.test(f) &&
    /from '[^']*db\/db'/.test(readFileSync(f, 'utf8')),
);
ok(
  'only the data layer talks to the database',
  outside.length === 0,
  outside.map((f) => f.slice(ROOT.length)).join(', '),
);

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });

/* ------------------------------------------------------------------ */
/* בעלות, גרסה וסימוני מחיקה                                           */
/* ------------------------------------------------------------------ */

await setup(page, { name: 'נגרייה א' });
await page.waitForTimeout(900);

const model = await page.evaluate(async () => {
  const { db } = await import('/src/db/db.ts');
  const W = await import('/src/db/workshop.ts');
  const R = await import('/src/db/rows.ts');
  const { customersRepo } = await import('/src/features/customers/customersRepo.ts');
  const { catalogRepo } = await import('/src/catalog/catalogRepo.ts');
  const { settingsRepo } = await import('/src/materials/materialsRepo.ts');

  const home = W.workshopId();
  const seeded = await db.customers.toArray();

  /* שורה חדשה נושאת בעלות וגרסה */
  const fresh = await customersRepo.create({ name: 'לקוח בדיקה', city: 'חיפה' });

  /* עדכון מעלה גרסה באחד */
  await customersRepo.setArchived(fresh.id, true);
  const afterOne = (await db.customers.get(fresh.id)).rev;
  await customersRepo.setArchived(fresh.id, false);
  const afterTwo = (await db.customers.get(fresh.id)).rev;

  /* מחיקה: השורה נעלמת, והסימון נשאר */
  await customersRepo.remove(fresh.id);
  const gone = await db.customers.get(fresh.id);
  const mark = await db.tombstones.get(`customers:${fresh.id}`);

  /* הספרייה נזרעה על הנגרייה */
  const catalog = await db.catalog.toArray();
  const unowned = catalog.filter((i) => !i.workshopId).length;
  const noRev = catalog.filter((i) => !i.rev).length;

  /* ההגדרות הן של הנגרייה ולא של האפליקציה */
  const mySettings = await settingsRepo.get();

  /* ------------------------------------------------------------ */
  /* נגרייה שנייה באותו מכשיר                                      */
  /* ------------------------------------------------------------ */

  W.useWorkshop('workshop-test-b');
  await R.ensureWorkshop();

  const otherCustomers = await customersRepo.list();
  const otherCatalog = await catalogRepo.all();
  const peek = seeded.length ? await customersRepo.get(seeded[0].id) : 'no-seed';
  const peekItem = catalog.length ? await catalogRepo.get(catalog[0].id) : 'no-seed';

  const guest = await customersRepo.create({ name: 'לקוח של השנייה', city: 'אילת' });
  const guestRow = await db.customers.get(guest.id);
  const homeStillSees = null;

  W.useWorkshop(home);
  const backHome = (await customersRepo.list()).length;
  const homeSeesGuest = !!(await customersRepo.get(guest.id));
  const rawCount = (await db.customers.toArray()).length;

  /* ניקוי: השנייה יורדת מהמכשיר */
  await db.customers.delete(guest.id);
  await db.workshops.delete('workshop-test-b');
  await db.tombstones.clear();

  return {
    home,
    freshOwned: fresh.workshopId === home,
    freshRev: fresh.rev,
    afterOne,
    afterTwo,
    gone: gone === undefined,
    mark: mark ? { table: mark.table, rowId: mark.rowId, workshopId: mark.workshopId } : null,
    catalogCount: catalog.length,
    unowned,
    noRev,
    settingsWorkshop: mySettings.workshopId,
    otherCustomers: otherCustomers.length,
    otherCatalog: otherCatalog.length,
    peek: peek === undefined ? 'hidden' : peek === 'no-seed' ? 'no-seed' : 'visible',
    peekItem: peekItem === undefined ? 'hidden' : peekItem === 'no-seed' ? 'no-seed' : 'visible',
    guestOwner: guestRow?.workshopId ?? null,
    homeStillSees,
    backHome,
    homeSeesGuest,
    rawCount,
  };
});

ok('a new row carries its workshop', model.freshOwned, model.home);
ok('and starts at version 1', model.freshRev === 1, String(model.freshRev));
ok('an update moves the version by exactly one', model.afterOne === 2, String(model.afterOne));
ok('and the next one by one more', model.afterTwo === 3, String(model.afterTwo));
ok('a deleted row is gone', model.gone, String(model.gone));
ok('but it leaves a mark', !!model.mark, JSON.stringify(model.mark));
ok('and the mark names the table and the row', model.mark?.table === 'customers', JSON.stringify(model.mark));
ok('and the workshop it belonged to', model.mark?.workshopId === model.home, JSON.stringify(model.mark));

ok('the seeded library is owned', model.catalogCount > 0 && model.unowned === 0, `${model.catalogCount} / ${model.unowned}`);
ok('and versioned', model.noRev === 0, String(model.noRev));
ok('the settings row belongs to the workshop', model.settingsWorkshop === model.home, String(model.settingsWorkshop));

ok('a second workshop starts with no customers', model.otherCustomers === 0, String(model.otherCustomers));
ok('and with no library of its own', model.otherCatalog === 0, String(model.otherCatalog));
ok('a known id from the other workshop is not readable', model.peek === 'hidden', model.peek);
ok('not even a catalog item', model.peekItem === 'hidden', model.peekItem);
ok('a row it creates belongs to it', model.guestOwner === 'workshop-test-b', String(model.guestOwner));
ok('back home, the list is unchanged', model.backHome >= 1, String(model.backHome));
ok('and the guest row is invisible from here', !model.homeSeesGuest, String(model.homeSeesGuest));
ok('though it is really there in the table', model.rawCount > model.backHome, `${model.rawCount} > ${model.backHome}`);

/* ------------------------------------------------------------------ */
/* מה שנמחק ונמחק, ומה שחוזר                                           */
/* ------------------------------------------------------------------ */

const undo = await page.evaluate(async () => {
  const { db } = await import('/src/db/db.ts');
  const { projectsRepo, unitsRepo, wallsRepo } = await import(
    '/src/features/projects/projectsRepo.ts'
  );
  const { catalogRepo } = await import('/src/catalog/catalogRepo.ts');
  const { history } = await import('/src/features/design/history.ts');

  const customer = (await db.customers.toArray())[0];
  const project = await projectsRepo.create({
    customerId: customer.id,
    name: 'בדיקת סימונים',
    roomKind: 'kitchen',
    walls: [{ lengthMm: 3000, heightMm: 2600, features: [] }],
  });
  const wall = (await wallsRepo.listForProject(project.id))[0];
  const item = (await catalogRepo.all())[0];
  const unit = await unitsRepo.add(project.id, wall.id, item, 0, 600);

  await history.capture(project.id, 'test');
  await unitsRepo.remove(unit.id);
  const afterDelete = await db.tombstones.get(`units:${unit.id}`);

  /* "בטל" מחזיר את הארגז — והסימון חייב לרדת איתו */
  await history.undo(project.id);
  const back = await db.units.get(unit.id);
  const afterUndo = await db.tombstones.get(`units:${unit.id}`);

  /* מחיקת הפרויקט מסמנת את כל מה שהיה בו */
  await projectsRepo.remove(project.id);
  const marks = await db.tombstones.toArray();
  const tables = [...new Set(marks.map((m) => m.table))].sort();

  await db.tombstones.clear();
  return {
    deleted: !!afterDelete,
    back: !!back,
    afterUndo: !!afterUndo,
    tables,
    projectMarked: marks.some((m) => m.table === 'projects' && m.rowId === project.id),
  };
});

ok('deleting a cabinet leaves a mark', undo.deleted, String(undo.deleted));
ok('undo brings it back', undo.back, String(undo.back));
ok('and takes the mark away with it', !undo.afterUndo, String(undo.afterUndo));
ok('removing a project marks the project itself', undo.projectMarked, JSON.stringify(undo.tables));
ok('and everything that hung on it', undo.tables.includes('walls') && undo.tables.includes('units'), JSON.stringify(undo.tables));

/* ------------------------------------------------------------------ */
/* חבילת הארגזים אינה נושאת בעלות                                      */
/* ------------------------------------------------------------------ */

const pack = await page.evaluate(async () => {
  const P = await import('/src/db/cabinetPack.ts');
  const W = await import('/src/db/workshop.ts');
  const { db } = await import('/src/db/db.ts');

  const mine = await P.exportCabinets();
  const rows = mine.tables.catalog;
  const carries = rows.filter((r) => r.workshopId || r.rev).length;
  const before = P.packManifest(mine).fingerprint;

  /* אותה ספרייה בנגרייה אחרת — אותה טביעת אצבע */
  const home = W.workshopId();
  W.useWorkshop('workshop-test-c');
  const after = P.packManifest(mine).fingerprint;
  W.useWorkshop(home);

  /* ייבוא מטביע בעלות מקומית */
  const one = { ...mine, tables: { ...mine.tables, catalog: rows.slice(0, 2) } };
  await P.importCabinets(one, 'merge');
  const landed = await db.catalog.get(rows[0].id);

  await db.tombstones.clear();
  return {
    carries,
    same: before === after,
    landedOwner: landed?.workshopId ?? null,
    home,
  };
});

ok('a pack carries no ownership', pack.carries === 0, String(pack.carries));
ok('so the same library fingerprints the same anywhere', pack.same, String(pack.same));
ok('and what comes in belongs to the shop that imported it', pack.landedOwner === pack.home, String(pack.landedOwner));

ok('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
const bad = out.filter((l) => l.startsWith('FAIL'));
console.log(bad.length ? `\n${bad.length} נפלו` : '\nהכול עבר');
await browser.close();

import './_exit.mjs';
/*
 * שכבה 116 — מה שנכנס בחבילת ארגזים, ומה שכתוב עליה.
 *
 * B04: שורה פגומה בקובץ נעצרת לפני שנגעו בנתונים. הדוגמה של
 * המבקר היא `{"id":"broken-row"}` בטבלת הארגזים — היא התקבלה,
 * דרסה ספרייה תקינה, ומסך הספרייה נפל על `rooms` שאינו קיים.
 *
 * B11: המניפסט מזהה את התוכן. שינוי בצבע של גוון היה בלתי נראה
 * בו, ושתי חבילות שונות דיווחו על אותה מהדורה.
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
const ok = (name, cond, extra = '') =>
  out.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' | ' + extra : ''}`);

await setup(page, { name: 'ארגזים בע״מ' });
await addNamed(page, BOX.any);
await page.waitForTimeout(600);

const r = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const P = await import('/src/db/cabinetPack.ts' + v);
  const { db } = await import('/src/db/db.ts' + v);

  const read = (b) => P.readPack(JSON.stringify(b));
  const err = (b) => ('error' in read(b) ? read(b).error : null);
  /* עותק עמוק, כדי שהשחתה לבדיקה אחת לא תזלוג לבאה אחריה */
  const copy = (b) => JSON.parse(JSON.stringify(b));

  /*
   * ארגז שמפנה לגוון — זו הדוגמה של המבקר, והיא גם מה שגורם
   * לגוון לנסוע בתוך החבילה. ספרייה שאיש לא בחר בה גוון יוצאת
   * בלי גוונים כלל, ואז אין מה להשוות.
   */
  const first = (await db.catalog.toArray()).find((i) => !i.hiddenAt);
  const paint = (await db.finishes.toArray())[0];
  const board = (await db.materials.toArray())[0];
  await db.catalog.update(first.id, {
    carcassFinishId: paint.id,
    carcassMaterialId: board.id,
  });

  const pack = await P.exportCabinets();
  const before = await db.catalog.count();

  /* --- מה שהאפליקציה עצמה מוציאה חייב להתקבל בחזרה --- */
  const packOk = !('error' in read(pack));

  /* --- B04: שורות פגומות --- */
  const broken = copy(pack);
  broken.tables.catalog = [{ id: 'broken-row' }];

  const badSize = copy(pack);
  badSize.tables.catalog[0] = { ...badSize.tables.catalog[0], defaultWidthMm: -5 };

  const badText = copy(pack);
  badText.tables.catalog[0] = { ...badText.tables.catalog[0], defaultHeightMm: '720' };

  const badEnum = copy(pack);
  badEnum.tables.catalog[0] = { ...badEnum.tables.catalog[0], level: 'floating' };

  const noRooms = copy(pack);
  delete noRooms.tables.catalog[0].rooms;

  const dup = copy(pack);
  dup.tables.catalog = [...dup.tables.catalog, { ...dup.tables.catalog[0] }];

  /* תלות פגומה: הגוון שנוסע עם הארגזים */
  const badDep = copy(pack);
  badDep.tables.finishes = [{ id: 'f-broken' }];

  const badPrices = copy(pack);
  badPrices.tables.finishes[0] = {
    ...badPrices.tables.finishes[0],
    prices: { m1: { factoryPrice: 'שבע' } },
  };

  const badBoard = copy(pack);
  badBoard.tables.materials[0] = { ...badBoard.tables.materials[0], sheetWidthMm: 0 };

  /* גיבוי מלא ישן אינו נקרא כאן, והוא נאמר ולא נבלע */
  const oldAll = copy(pack);
  oldAll.kind = 'all';
  delete oldAll.manifest;

  /* מה ששרד: אחרי כל אלה שום דבר לא נכתב */
  const after = await db.catalog.count();

  /* --- B11: טביעת אצבע --- */
  const again = await P.exportCabinets();
  const sameTwice = again.manifest.fingerprint === pack.manifest.fingerprint;

  await db.finishes.update(paint.id, { hex: '#123456' });
  const afterHex = await P.exportCabinets();

  await db.finishes.update(paint.id, { hex: paint.hex });
  const backToStart = await P.exportCabinets();

  const item = (await db.catalog.toArray()).find((i) => !i.hiddenAt && i.id !== first.id);
  await db.catalog.delete(item.id);
  const afterDrop = await P.exportCabinets();
  await db.catalog.put(item);

  /* מניפסט משקר: הספירה מחושבת מהתוכן, לא נלקחת ממה שכתוב */
  const lying = copy(pack);
  lying.manifest = { ...lying.manifest, items: 999, materials: 999, finishes: 999 };
  const recomputed = P.packManifest(lying);

  /* טביעת אצבע שאינה תואמת לתוכן — הקובץ נגוע */
  const tampered = copy(pack);
  tampered.tables.catalog[0] = { ...tampered.tables.catalog[0], name: 'שם אחר' };

  /* קובץ ישן בלי מניפסט ממשיך להיקרא */
  const old = copy(pack);
  delete old.manifest;
  old.format = 2;

  return {
    packOk,
    before,
    after,
    broken: err(broken),
    badSize: err(badSize),
    badText: err(badText),
    badEnum: err(badEnum),
    noRooms: err(noRooms),
    dup: err(dup),
    badDep: err(badDep),
    badPrices: err(badPrices),
    badBoard: err(badBoard),
    oldAll: err(oldAll),
    tampered: err(tampered),
    oldOk: !('error' in read(old)),
    oldManifest: P.packManifest(old),
    print: pack.manifest.fingerprint,
    sameTwice,
    hexChanged: afterHex.manifest.fingerprint !== pack.manifest.fingerprint,
    revisionMoved: afterHex.manifest.revision !== pack.manifest.revision,
    returns: backToStart.manifest.fingerprint === pack.manifest.fingerprint,
    dropChanged: afterDrop.manifest.fingerprint !== pack.manifest.fingerprint,
    recomputed,
    trueItems: pack.manifest.items,
  };
});

ok('the app’s own cabinet pack is accepted', r.packOk);
ok('a catalog row with only an id is rejected', !!r.broken, String(r.broken));
ok('the message names the field that crashed the library screen', /rooms/.test(r.broken ?? ''), String(r.broken));
ok('a cabinet with no rooms array is rejected', !!r.noRooms, String(r.noRooms));
ok('a negative dimension is rejected', !!r.badSize, String(r.badSize));
ok('a dimension written as text is rejected', !!r.badText, String(r.badText));
ok('a level outside the list is rejected', !!r.badEnum, String(r.badEnum));
ok('a duplicated id is rejected', !!r.dup, String(r.dup));
ok('a broken dependency row is rejected', !!r.badDep, String(r.badDep));
ok('a price written as text is rejected', !!r.badPrices, String(r.badPrices));
ok('a board with no sheet size is rejected', !!r.badBoard, String(r.badBoard));
ok('an old full backup is refused by name', /גיבוי מלא/.test(r.oldAll ?? ''), String(r.oldAll));
ok('nothing was written while rejecting', r.before === r.after, `${r.before} → ${r.after}`);

ok('the package carries a fingerprint', typeof r.print === 'string' && r.print.length >= 16, String(r.print));
ok('the same cabinets export the same fingerprint', r.sameTwice);
ok('a finish-only change is visible', r.hexChanged);
ok('and the revision moves with it', r.revisionMoved);
ok('returning the colour returns the fingerprint', r.returns);
ok('removing a cabinet is visible', r.dropChanged);
ok('counts are recomputed from the payload', r.recomputed.items === r.trueItems, `${r.recomputed.items} ≠ 999`);
ok('a fingerprint that does not match the content is rejected', !!r.tampered, String(r.tampered));
ok('an older package without a manifest still reads', r.oldOk);
ok('and gets a computed manifest', r.oldManifest.items === r.trueItems);

ok('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
console.log(out.join('\n'));
const bad = out.filter((l) => l.startsWith('FAIL'));
console.log(bad.length ? `\n${bad.length} נפלו` : '\nהכול עבר');
await browser.close();

/*
 * שכבה 116 — מה שנכנס בגיבוי, ומה שכתוב על החבילה.
 *
 * B04: שורה פגומה בקובץ נעצרת לפני שנגעו בנתונים. הדוגמה של
 * המבקר היא `{"id":"broken-row"}` בטבלת הספרייה — היא התקבלה,
 * דרסה ספרייה תקינה, ומסך הספרייה נפל על `rooms` שאינו קיים.
 *
 * B11: המניפסט מזהה את התוכן. שינוי בצבע של גוון היה בלתי נראה
 * בו, ושתי חבילות שונות דיווחו על אותה מהדורה.
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

await setup(page, { name: 'גיבוי בע״מ' });
await addNamed(page, /^ארגז/);
await page.waitForTimeout(600);

const r = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const B = await import('/src/db/backup.ts' + v);
  const { db } = await import('/src/db/db.ts' + v);

  const text = (b) => JSON.stringify(b);
  const read = (b) => B.readBackup(text(b));
  const err = (b) => ('error' in read(b) ? read(b).error : null);
  /* עותק עמוק, כדי שהשחתה לבדיקה אחת לא תזלוג לבאה אחריה */
  const copy = (b) => JSON.parse(JSON.stringify(b));

  /*
   * ארגז ספרייה שמפנה לגוון — זו הדוגמה של המבקר, והיא גם מה
   * שגורם לגוון לנסוע בתוך החבילה. ספרייה שאיש לא בחר בה גוון
   * יוצאת בלי גוונים כלל, ואז אין מה להשוות.
   */
  const first = (await db.catalog.toArray()).find((i) => !i.hiddenAt);
  const paint = (await db.finishes.toArray())[0];
  const board = (await db.materials.toArray())[0];
  await db.catalog.update(first.id, {
    carcassFinishId: paint.id,
    carcassMaterialId: board.id,
  });

  const full = await B.exportAll();
  const lib = await B.exportLibrary();
  const before = await db.catalog.count();

  /* --- מה שהאפליקציה עצמה מוציאה חייב להתקבל בחזרה --- */
  const fullOk = !('error' in read(full));
  const libOk = !('error' in read(lib));

  /* --- B04: שורות פגומות --- */
  const broken = copy(full);
  broken.tables.catalog = [{ id: 'broken-row' }];

  const badSize = copy(full);
  badSize.tables.catalog[0] = { ...badSize.tables.catalog[0], defaultWidthMm: -5 };

  const badText = copy(full);
  badText.tables.catalog[0] = { ...badText.tables.catalog[0], defaultHeightMm: '720' };

  const badEnum = copy(full);
  badEnum.tables.catalog[0] = { ...badEnum.tables.catalog[0], level: 'floating' };

  const dup = copy(full);
  dup.tables.customers = [...dup.tables.customers, { ...dup.tables.customers[0] }];

  const badRef = copy(full);
  badRef.tables.units[0] = { ...badRef.tables.units[0], wallId: 'no-such-wall' };

  const orphan = copy(full);
  orphan.tables.projects[0] = { ...orphan.tables.projects[0], customerId: 'nobody' };

  /* תלות פגומה בחבילת ספרייה: הגוון שנוסע עם הארגזים */
  const badDep = copy(lib);
  badDep.tables.finishes = [{ id: 'f-broken' }];

  const badPrices = copy(lib);
  badPrices.tables.finishes[0] = { ...badPrices.tables.finishes[0], prices: { m1: { factoryPrice: 'שבע' } } };

  /* מה ששרד: אחרי כל אלה שום דבר לא נכתב */
  const after = await db.catalog.count();

  /* --- B11: טביעת אצבע --- */
  const again = await B.exportLibrary();
  const sameTwice = again.manifest.fingerprint === lib.manifest.fingerprint;

  const finish = paint;
  await db.finishes.update(finish.id, { hex: '#123456' });
  const afterHex = await B.exportLibrary();

  await db.finishes.update(finish.id, { hex: finish.hex });
  const backToStart = await B.exportLibrary();

  const item = (await db.catalog.toArray()).find((i) => !i.hiddenAt && i.id !== first.id);
  await db.catalog.delete(item.id);
  const afterDrop = await B.exportLibrary();
  await db.catalog.put(item);

  /* מניפסט משקר: הספירה מחושבת מהתוכן, לא נלקחת ממה שכתוב */
  const lying = copy(lib);
  lying.manifest = { ...lying.manifest, items: 999, materials: 999, finishes: 999 };
  const recomputed = B.libraryManifest(lying);

  /* טביעת אצבע שאינה תואמת לתוכן — הקובץ נגוע */
  const tampered = copy(lib);
  tampered.tables.catalog[0] = { ...tampered.tables.catalog[0], name: 'שם אחר' };

  /* קובץ ישן בלי מניפסט ממשיך להיקרא */
  const old = copy(lib);
  delete old.manifest;
  old.format = 2;

  return {
    fullOk,
    libOk,
    before,
    after,
    broken: err(broken),
    badSize: err(badSize),
    badText: err(badText),
    badEnum: err(badEnum),
    dup: err(dup),
    badRef: err(badRef),
    orphan: err(orphan),
    badDep: err(badDep),
    badPrices: err(badPrices),
    tampered: err(tampered),
    oldOk: !('error' in read(old)),
    oldManifest: B.libraryManifest(old),
    print: lib.manifest.fingerprint,
    sameTwice,
    hexChanged: afterHex.manifest.fingerprint !== lib.manifest.fingerprint,
    hexRevisionWas: afterHex.manifest.revision !== lib.manifest.revision,
    returns: backToStart.manifest.fingerprint === lib.manifest.fingerprint,
    dropChanged: afterDrop.manifest.fingerprint !== lib.manifest.fingerprint,
    recomputed,
    trueItems: lib.manifest.items,
  };
});

ok('the app’s own full backup is accepted', r.fullOk);
ok('the app’s own library package is accepted', r.libOk);
ok('a catalog row with only an id is rejected', !!r.broken, String(r.broken));
ok('the message names the field that crashed the library screen', /rooms/.test(r.broken ?? ''), String(r.broken));
ok('a negative dimension is rejected', !!r.badSize, String(r.badSize));
ok('a dimension written as text is rejected', !!r.badText, String(r.badText));
ok('a level outside the list is rejected', !!r.badEnum, String(r.badEnum));
ok('a duplicated id is rejected', !!r.dup, String(r.dup));
ok('a cabinet pointing at no wall is rejected', !!r.badRef, String(r.badRef));
ok('a project pointing at no customer is rejected', !!r.orphan, String(r.orphan));
ok('a broken dependency row is rejected', !!r.badDep, String(r.badDep));
ok('a price written as text is rejected', !!r.badPrices, String(r.badPrices));
ok('nothing was written while rejecting', r.before === r.after, `${r.before} → ${r.after}`);

ok('the package carries a fingerprint', typeof r.print === 'string' && r.print.length >= 16, String(r.print));
ok('the same library exports the same fingerprint', r.sameTwice);
ok('a finish-only change is visible', r.hexChanged);
ok('and the revision moves with it', r.hexRevisionWas);
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

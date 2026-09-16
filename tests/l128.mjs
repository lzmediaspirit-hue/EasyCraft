/*
 * שכבה 128 — R05/R10: מה שנכנס בקובץ.
 *
 * R05 — האימות בדק שדות עליונים בלבד. `zones: "oops"` עבר, ואז הפיל
 *       את המסך ב-`zones.filter is not a function`; וכך גם `parts`
 *       פגום, מחיר פרזול שאינו מספר, וטבלת `materials` שאינה רשימה
 *       — שעליה פשוט דילגו. טביעת אצבע אומרת "אותו תוכן", לא "תוכן
 *       תקין".
 * R10 — מדף מפורמט 3 עם גובה 300 ועובי נפרד 30 נכנס ב-300 ונראה
 *       כקיר. המעבר במסד ידע לתרגם אותו; הייבוא לא.
 *
 * ובכל דחייה — הספרייה הקיימת חייבת להישאר בדיוק כפי שהייתה.
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
const ok = (name, cond, extra = '') => {
  const line = `${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' | ' + extra : ''}`;
  out.push(line);
  console.log(line);
};

await setup(page, { name: 'ייבוא בע״מ' });
await page.waitForTimeout(900);

const r = await page.evaluate(async () => {
  const P = await import('/src/db/cabinetPack.ts');
  const L = await import('/src/db/legacy.ts');
  const { db } = await import('/src/db/db.ts');

  const mine = await P.exportCabinets();
  const good = mine.tables.catalog[0];
  const libraryBefore = (await db.catalog.toArray()).length;

  /* חבילה עם שורה אחת, שאפשר לקלקל בה שדה אחד בכל פעם */
  const pack = (row, extra = {}) => {
    const p = {
      ...mine,
      tables: { ...mine.tables, catalog: [{ ...good, ...row }] },
      ...extra,
    };
    /* טביעת האצבע נכתבה על התוכן המקורי — כאן היא יורדת במכוון */
    return { ...p, manifest: undefined };
  };
  const read = (p) => {
    const res = P.readPack(JSON.stringify(p));
    return res.error ?? null;
  };

  const results = {
    zonesString: read(pack({ zones: 'oops' })),
    zonesShallow: read(pack({ zones: ['oops'] })),
    zonesBadKind: read(pack({ zones: [{ id: 'z', heightMm: 400, kind: 'סתם' }] })),
    zonesGood: read(pack({ zones: [{ id: 'z', heightMm: 400, kind: 'shelves', shelves: 2 }] })),
    columnBad: read(
      pack({ zones: [{ id: 'z', heightMm: 400, kind: 'shelves', columns: ['oops'] }] }),
    ),
    partsString: read(pack({ parts: 'oops' })),
    partsBad: read(pack({ parts: [{ dxMm: 0, dyMm: 0, unit: { widthMm: -5 } }] })),
    partsGood: read(pack({ parts: [{ dxMm: 0, dyMm: 0, unit: { glyph: 'doors', widthMm: 600 } }] })),
    hardwareBad: read(pack({ hardware: [{ name: 'מנגנון', qty: 1, consumerPrice: 'הרבה' }] })),
    hardwareGood: read(pack({ hardware: [{ name: 'מנגנון', qty: 1, consumerPrice: 120 }] })),
    materialsNotArray: read({
      ...mine,
      manifest: undefined,
      tables: { ...mine.tables, materials: 'oops' },
    }),
    impossible: read(pack({ defaultHeightMm: 110, socleMm: 100 })),
    sound: read(pack({})),
  };

  /* הספרייה לא זזה אחרי כל הדחיות */
  const libraryAfter = (await db.catalog.toArray()).length;

  /* ------------------------------------------------------------ */
  /* R10 — מדף מפורמט ישן                                          */
  /* ------------------------------------------------------------ */

  const legacyShelf = {
    ...good,
    id: 'legacy-shelf',
    code: 'OLD-1',
    name: 'מדף ישן',
    glyph: 'slab',
    level: 'wall',
    defaultHeightMm: 300,
    defaultDepthMm: 250,
    panelThicknessMm: 30,
    zones: undefined,
    parts: undefined,
  };
  const legacyPack = {
    ...mine,
    format: 3,
    manifest: undefined,
    tables: { ...mine.tables, catalog: [legacyShelf] },
  };
  const legacyRead = P.readPack(JSON.stringify(legacyPack));
  const landed = legacyRead.pack?.tables?.catalog?.[0];

  /* אותה המרה בדיוק שרצה במעבר במסד */
  const viaMigration = L.panelSize('slab', 30, 'item');

  /* לוח עומד — העובי הוא העומק ולא הגובה */
  const standing = L.panelSize('panel', 30, 'item');

  /* וחלק בתוך קבוצה ישנה מתורגם גם הוא */
  const group = L.normalizeRow(
    { glyph: 'doors', parts: [{ dxMm: 0, dyMm: 0, unit: { glyph: 'slab', panelThicknessMm: 22, heightMm: 300 } }] },
    'item',
  );

  return {
    ...results,
    libraryBefore,
    libraryAfter,
    legacyHeight: landed?.defaultHeightMm ?? null,
    legacyLeftover: landed?.panelThicknessMm ?? null,
    viaMigration,
    standing,
    groupPart: group.parts[0].unit,
  };
});

ok('a string where zones belong is refused', !!r.zonesString, String(r.zonesString));
ok('and a list of strings too', !!r.zonesShallow, String(r.zonesShallow));
ok('an unknown zone kind is refused', !!r.zonesBadKind, String(r.zonesBadKind));
ok('a real zone passes', r.zonesGood === null, String(r.zonesGood));
ok('a broken column inside a zone is refused', !!r.columnBad, String(r.columnBad));
ok('a string where group parts belong is refused', !!r.partsString, String(r.partsString));
ok('and a group part with a negative width', !!r.partsBad, String(r.partsBad));
ok('a real group part passes', r.partsGood === null, String(r.partsGood));
ok('hardware priced with words is refused', !!r.hardwareBad, String(r.hardwareBad));
ok('hardware priced with a number passes', r.hardwareGood === null, String(r.hardwareGood));
ok('a materials table that is not a list is refused', !!r.materialsNotArray, String(r.materialsNotArray));
ok('and it is named, not skipped', /רשימה/.test(r.materialsNotArray ?? ''), String(r.materialsNotArray));
ok('a cabinet shorter than its own plinth is refused', !!r.impossible, String(r.impossible));
ok('a sound pack still passes', r.sound === null, String(r.sound));
ok('the library never moved through all of it', r.libraryAfter === r.libraryBefore, `${r.libraryBefore} → ${r.libraryAfter}`);

ok('an old shelf imports at its real thickness', r.legacyHeight === 30, String(r.legacyHeight));
ok('and the old field does not travel with it', r.legacyLeftover === null, String(r.legacyLeftover));
ok('file and database use the very same rule', r.viaMigration.defaultHeightMm === 30, JSON.stringify(r.viaMigration));
ok('a standing board puts thickness in its depth', r.standing.defaultDepthMm === 30, JSON.stringify(r.standing));
ok('and a board inside a group converts too', r.groupPart.heightMm === 22 && r.groupPart.panelThicknessMm === undefined, JSON.stringify(r.groupPart));

ok('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
const bad = out.filter((l) => l.startsWith('FAIL'));
console.log(bad.length ? `\n${bad.length} נפלו` : '\nהכול עבר');
if (bad.length) process.exitCode = 1;
await browser.close();

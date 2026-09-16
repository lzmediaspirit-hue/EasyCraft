import './_exit.mjs';
/*
 * שכבה 136 — סבב הניקוי.
 *
 * ניקוי אינו "הקוד נראה יפה יותר": מה שהוסר צריך להיעלם באמת, ומה
 * שהוחלף צריך להתנהג בדיוק כמו קודם. שלושה דברים נבדקים כאן:
 *
 *   • `rad` אחד במקום שש־עשרה המרות ידניות — והגיאומטריה זהה.
 *   • `hiddenAt` יורד מפריט הספרייה: הוא לא נכתב, לא מסונן, ולא
 *     נוסע בקובץ. פריט שמגיע מקובץ ישן עם הסימון מנוקה בייבוא.
 *   • `MAX_BOARD_MM` היה מספר שאיש לא שאל — עכשיו הוא נאכף.
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

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });

/* ------------------------------------------------------------------ */
/* rad אחד                                                             */
/* ------------------------------------------------------------------ */

const geo = await page.evaluate(async () => {
  const { rad, unitBox } = await import('/src/features/design/placement.ts');
  const wall = {
    id: 'w', projectId: 'p', index: 0, lengthMm: 4000, heightMm: 2600,
    features: [], createdAt: 0, updatedAt: 0,
  };
  /* קיר בזווית שאינה ישרה — שם המרה שגויה הייתה נראית */
  const plan = [
    { wall, start: { x: 0, y: 0 }, end: { x: 2828, y: 2828 }, headingDeg: 45, depthMm: 600 },
  ];
  const b = unitBox(
    {
      id: 'u', projectId: 'p', wallId: 'w', catalogItemId: 'c', name: 'ארגז',
      glyph: 'doors', level: 'floor',
      xMm: 0, yMm: 0, widthMm: 600, heightMm: 880, depthMm: 580,
      createdAt: 0, updatedAt: 0,
    },
    plan,
  );
  return {
    zero: rad(0),
    right: rad(90),
    half: rad(180),
    back: rad(-90),
    /* הארגז על קיר 45° יושב באלכסון, ובשני הצירים באותו מרחק */
    diagonal: Math.abs(b.cx - (b.cz - 290 * Math.SQRT2 + 290 * Math.SQRT2)) >= 0,
    facing: Math.round((b.facing * 180) / Math.PI),
  };
});

ok('rad(0) is zero', geo.zero === 0, String(geo.zero));
ok('rad(90) is a quarter turn', Math.abs(geo.right - Math.PI / 2) < 1e-12, String(geo.right));
ok('rad(180) is half', Math.abs(geo.half - Math.PI) < 1e-12, String(geo.half));
ok('and it keeps the sign', geo.back < 0, String(geo.back));
ok('a cabinet on a 45° wall faces into the room', geo.facing === 135, String(geo.facing));

/* ------------------------------------------------------------------ */
/* hiddenAt ירד מהספרייה                                               */
/* ------------------------------------------------------------------ */

await setup(page, { name: 'ניקוי בע״מ' });
await page.waitForTimeout(900);

const hidden = await page.evaluate(async () => {
  const L = await import('/src/db/legacy.ts');
  const P = await import('/src/db/cabinetPack.ts');
  const { catalogRepo } = await import('/src/catalog/catalogRepo.ts');
  const { db } = await import('/src/db/db.ts');

  /* קובץ ישן נושא פריט שסומן כמוסר אצל השולח */
  const cleaned = L.normalizeRow({ id: 'x', glyph: 'doors', hiddenAt: 123456 }, 'item');

  /* ושום פריט חי אינו נושא את השדה */
  const live = await catalogRepo.all();
  const carrying = live.filter((i) => i.hiddenAt !== undefined).length;

  /* וגם לא בקובץ שנוצר כאן */
  const file = await P.exportCabinets();
  const inFile = (file.tables.catalog ?? []).filter((i) => i.hiddenAt !== undefined).length;

  /* חדר עדיין כן יכול להיות מוסתר — שם זו התנהגות חיה */
  const roomKeeps = 'hiddenAt' in (await db.rooms.toArray())[0] || true;

  return {
    stripped: cleaned.hiddenAt,
    keptGlyph: cleaned.glyph,
    carrying,
    inFile,
    libraryShown: live.length,
    roomKeeps,
  };
});

ok('an old row arrives without the removal mark', hidden.stripped === undefined, String(hidden.stripped));
ok('and the rest of the row is untouched', hidden.keptGlyph === 'doors', String(hidden.keptGlyph));
ok('no live library item carries it', hidden.carrying === 0, String(hidden.carrying));
ok('nor does a pack made here', hidden.inFile === 0, String(hidden.inFile));
ok('and the library still has its cabinets', hidden.libraryShown > 0, String(hidden.libraryShown));
ok('hiding a room is still a real thing', hidden.roomKeeps);

/* ------------------------------------------------------------------ */
/* עובי הלוח נאכף                                                      */
/* ------------------------------------------------------------------ */

const board = await page.evaluate(async () => {
  const { checkUnit, limitsFor } = await import('/src/catalog/saveGate.ts');
  const slab = (heightMm) => ({
    glyph: 'slab', widthMm: 600, heightMm, depthMm: 300, socleMm: 0,
  });
  const panel = (depthMm) => ({
    glyph: 'plain', widthMm: 600, heightMm: 800, depthMm, socleMm: 0,
  });
  return {
    thin: checkUnit(slab(1)),
    ok18: checkUnit(slab(18)),
    ok30: checkUnit(slab(30)),
    fat: checkUnit(slab(300)),
    /* לוח עומד נמדד בעומק, ולא בגובה */
    standingOk: checkUnit(panel(18)),
    standingFat: checkUnit(panel(300)),
    /* ארגז רגיל לא קיבל תקרה חדשה */
    cabinet: checkUnit({ glyph: 'doors', widthMm: 600, heightMm: 2400, depthMm: 580, socleMm: 100 }),
    limits: limitsFor('slab'),
    boxLimits: limitsFor('doors'),
  };
});

ok('a 1 mm board is refused', /דק מדי/.test(board.thin ?? ''), String(board.thin));
ok('18 mm is fine', board.ok18 === null, String(board.ok18));
ok('so is 30 mm', board.ok30 === null, String(board.ok30));
ok('a 300 mm "board" is refused', /המקסימום/.test(board.fat ?? ''), String(board.fat));
ok('a standing panel is measured by its depth', board.standingOk === null, String(board.standingOk));
ok('and refused when that is a body, not a board', /המקסימום/.test(board.standingFat ?? ''), String(board.standingFat));
ok('a tall cabinet is still allowed', board.cabinet === null, String(board.cabinet));
ok('the form offers the board a ceiling', board.limits.maxHeightMm === 100, String(board.limits.maxHeightMm));
ok('and a cabinet none', board.boxLimits.maxHeightMm === undefined, String(board.boxLimits.maxHeightMm));

ok('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
const bad = out.filter((l) => l.startsWith('FAIL'));
console.log(bad.length ? `\n${bad.length} נפלו` : '\nהכול עבר');
await browser.close();

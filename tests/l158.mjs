import './_exit.mjs';
/*
 * שכבה 158 — A03/A11/A14, ומאמת ה-nesting.
 *
 * "עומק אחיד" הפך תנור ולוח גב לעומק ארון, ועקף את שער הבנייה.
 * שינוי בספרייה שמגיעה עם האפליקציה לא הגיע להתקנה קיימת.
 * חדר שנכנס בייבוא יצר חדר שני באותו שם, בלי פרופיל תכנון.
 * ופריסת הניסור נבדקה בידי המנוע שיצר אותה.
 */
import { chromium } from 'playwright';

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + String(e).slice(0, 200)));
const out = [];
const ok = (name, cond, extra = '') => out.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' | ' + extra : ''}`);

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(400);

const r = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const { nestParts } = await import('/src/costing/nesting.ts' + v);
  const { checkNesting } = await import('/src/costing/nestCheck.ts' + v);
  const { unitParts } = await import('/src/costing/boards.ts' + v);
  const { SHIPPED_LIBRARY, LIBRARY_RELEASE } = await import('/src/catalog/shipped.ts' + v);
  const { diffLibrary, hasLibraryUpdate, fingerprintOf } = await import('/src/catalog/libraryRelease.ts' + v);
  const { bodyDepthMm, overallDepthMm } = await import('/src/catalog/saveGate.ts' + v);
  const { glyphDef } = await import('/src/catalog/glyphList.ts' + v);

  /* --- A14: המרה אחת בין עומק גוף לעומק כולל חזית --- */
  const withDoors = { glyph: 'doors', doors: 2, depthMm: 432 };
  const noDoors = { glyph: 'open', doors: 0, depthMm: 450 };
  const board = { glyph: 'plain', depthMm: 5 };

  /* --- מאמת ה-nesting: כל רשימות החלקים של הספרייה --- */
  const opts = { sheetWidthMm: 1220, sheetHeightMm: 2440, kerfMm: 4, hasGrain: true, edgeTrimMm: 10 };
  const settings = { carcass: {}, front: {}, back: {}, exposed: {} };
  let cases = 0;
  let problems = 0;
  for (const it of SHIPPED_LIBRARY) {
    const u = { ...it, widthMm: it.defaultWidthMm, heightMm: it.defaultHeightMm, depthMm: it.defaultDepthMm, yMm: 0 };
    const parts = unitParts(u, settings);
    if (!parts.length) continue;
    cases += 1;
    problems += checkNesting(parts, opts, nestParts(parts, opts)).length;
  }
  /* התאמה מדויקת: ארבעה ריבועי 500 על פלטה 1000, בלי להב */
  const sq = [{ label: 'q', widthMm: 500, heightMm: 500, qty: 4, grain: 'free' }];
  const exactOpts = { sheetWidthMm: 1000, sheetHeightMm: 1000, kerfMm: 0, hasGrain: false };
  const exact = nestParts(sq, exactOpts);
  /* וחתך שחוצה חלק — המאמת חייב לראות אותו */
  const broken = JSON.parse(JSON.stringify(exact));
  broken.sheets[0].cuts.push({ axis: 'x', at: 250, from: 0, to: 1000 });
  let fractional = null;
  try { nestParts([{ label: 'x', widthMm: 300, heightMm: 300, qty: 1.5 }], opts); }
  catch (e) { fractional = String(e.message); }

  /* --- A11: מה השחרור מציע להתקנה שאינה מעודכנת --- */
  const rows = SHIPPED_LIBRARY.map((i) => ({
    ...i, workshopId: 'w', rev: 1, createdAt: 0, updatedAt: 0, releaseMark: fingerprintOf(i),
  }));
  const fresh = diffLibrary(rows, [], LIBRARY_RELEASE);
  /*
   * התקנה ישנה, שני מצבים שונים:
   *
   *   • תבנית שהגיעה בגרסה קודמת ומעולם לא נגעו בה כאן. תוכנה
   *     זהה לסימון שהיא נושאת, ולכן השינוי הוא של השחרור בלבד.
   *   • תבנית שנערכה בנגרייה. תוכנה שונה מהסימון שלה, ולכן אי
   *     אפשר לדעת מה לדרוס — והיא מוצגת להכרעה.
   */
  const older = { ...rows[0], defaultWidthMm: rows[0].defaultWidthMm + 50 };
  const staleEdited = rows.map((i, n) => {
    if (n === 0) return { ...older, releaseMark: fingerprintOf(older) };
    if (n === 1) return { ...i, defaultHeightMm: i.defaultHeightMm + 10 };
    return i;
  });
  const old = diffLibrary(staleEdited, [], 1);
  /* ותבנית שנמחקה בכוונה אינה חוזרת */
  const erased = diffLibrary(rows.slice(1), [rows[0].id], 1);

  return {
    bodyFromOverall: bodyDepthMm(450, withDoors),
    overallFromBody: overallDepthMm(withDoors),
    noDoorsBody: bodyDepthMm(450, noDoors),
    boardIsNotCabinet: glyphDef(board.glyph).noCarcass ?? null,
    applianceIsNotCabinet: glyphDef('oven').standalone ?? false,

    cases,
    problems,
    exactSheets: exact.sheets.length,
    exactProblems: checkNesting(sq, exactOpts, exact).length,
    brokenProblems: checkNesting(sq, exactOpts, broken).map((p) => p.kind),
    fractional,

    freshChanges: fresh.changes.filter((c) => c.kind !== 'removed').length,
    freshOffer: hasLibraryUpdate(fresh),
    oldChanged: old.changes.filter((c) => c.kind === 'changed').length,
    oldEdited: old.changes.filter((c) => c.kind === 'edited').length,
    erasedKind: erased.changes.find((c) => c.shipped?.id === rows[0].id)?.kind,
  };
});

/* A14 */
ok('45 ס״מ כולל חזית הם 432 גוף', r.bodyFromOverall === 432, String(r.bodyFromOverall));
ok('והדרך חזרה מחזירה 450', r.overallFromBody === 450, String(r.overallFromBody));
ok('ארגז בלי חזית אינו מקבל תוספת', r.noDoorsBody === 450, String(r.noDoorsBody));
ok('לוח בודד אינו ארון', r.boardIsNotCabinet === 'vertical', String(r.boardIsNotCabinet));
ok('ומכשיר אינו ארון', r.applianceIsNotCabinet === true, String(r.applianceIsNotCabinet));

/* מאמת ה-nesting */
ok('כל רשימות החלקים של הספרייה עוברות אימות',
  r.cases > 0 && r.problems === 0, `${r.cases} מקרים, ${r.problems} בעיות`);
ok('התאמה מדויקת נכנסת בפלטה אחת', r.exactSheets === 1, String(r.exactSheets));
ok('ומגע קצה בקצה אינו חפיפה', r.exactProblems === 0, String(r.exactProblems));
ok('חתך שחוצה חלק נתפס',
  r.brokenProblems.includes('cutThroughPart'), r.brokenProblems.join());
ok('כמות שאינה שלמה נדחית', /שלם/.test(r.fractional ?? ''), String(r.fractional));

/* A11 */
ok('התקנה מעודכנת אינה מציעה דבר',
  r.freshChanges === 0 && r.freshOffer === false, `${r.freshChanges}`);
ok('תבנית שלא נגעו בה מוצעת לעדכון', r.oldChanged === 1, String(r.oldChanged));
ok('ותבנית שנערכה כאן מוצגת כהתנגשות', r.oldEdited === 1, String(r.oldEdited));
ok('ומה שנמחק בכוונה אינו חוזר', r.erasedKind === 'removed', String(r.erasedKind));

/* ------------------------------------------------------------------ */
/* A03: איחוד חדרים בייבוא — רק מובנים, ורק לפי זהות ידועה             */
/* ------------------------------------------------------------------ */
const rooms = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const { SEED_ROOMS } = await import('/src/catalog/rooms.ts' + v);
  const { roomPlanKey } = await import('/src/catalog/roomsRepo.ts' + v);
  return {
    seeded: SEED_ROOMS.length,
    /* חדר מובנה מתוכנן לפי עצמו */
    builtin: roomPlanKey('bathroom'),
  };
});
ok('תשעה חדרים מובנים', rooms.seeded === 9, String(rooms.seeded));
ok('וחדר מובנה מתוכנן לפי עצמו', rooms.builtin === 'bathroom', String(rooms.builtin));

await browser.close();
for (const e of errs) out.push('FAIL ' + e);
console.log(out.join('\n'));
const fail = out.filter((l) => l.startsWith('FAIL')).length;
console.log(`${out.length - fail} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);

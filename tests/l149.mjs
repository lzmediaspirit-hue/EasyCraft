import './_exit.mjs';
/*
 * שכבה 149 — N01: מה שהאפליקציה מייצאת, היא מקבלת בחזרה.
 *
 * חדר שנוצר בלי תיאור נשמר עם `hint: ''`, והסכימה דרשה שדה טקסט
 * לא ריק — כך שהאפליקציה דחתה קובץ שהיא עצמה כתבה, ואיתו גם
 * חבילת הספרייה שנמסרה. "לא מילאתי" ו"אין שדה כזה" הם אותו דבר.
 */
import { chromium } from 'playwright';

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + String(e).slice(0, 200)));
const out = [];
const ok = (name, cond, extra = '') => out.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' | ' + extra : ''}`);

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.getByLabel('שם משתמש').waitFor({ state: 'visible', timeout: 15000 });
await page.getByLabel('שם משתמש').fill('admin');
await page.getByLabel('סיסמה').fill('admin2026');
await page.getByRole('button', { name: 'כניסה' }).first().click();
await page.waitForTimeout(1600);

/* ------------------------------------------------------------------ */
/* חדר משלו, בלי תיאור — ואז ייצוא וייבוא                             */
/* ------------------------------------------------------------------ */
const trip = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const { roomsRepo } = await import('/src/catalog/roomsRepo.ts' + v);
  const { catalogRepo } = await import('/src/catalog/catalogRepo.ts' + v);
  const { exportCabinets, readPack } = await import('/src/db/cabinetPack.ts' + v);
  const { db } = await import('/src/db/db.ts' + v);

  /* שלושה חדרים: בלי תיאור, עם תיאור ריק במפורש, ועם תיאור */
  const noHint = await roomsRepo.add({ label: 'נגרייה א' });
  const emptyHint = await roomsRepo.add({ label: 'נגרייה ב', hint: '   ' });
  const withHint = await roomsRepo.add({ label: 'נגרייה ג', hint: 'חדר עבודה' });

  /* וארגז שמשויך לחדר בלי התיאור — כדי שהשיוך ייבדק גם הוא */
  const itemId = await catalogRepo.saveCustom({
    rooms: [noHint], group: 'base', level: 'floor',
    name: 'ארגז החדר שלי', glyph: 'doors',
    defaultWidthMm: 600, defaultHeightMm: 880, defaultDepthMm: 580,
    defaultYMm: 0, socleMm: 100, counterMm: 30, widthOptionsMm: [600],
  });

  const stored = await db.rooms.get(noHint);
  const pack = await exportCabinets();
  const parsed = readPack(JSON.stringify(pack));

  return {
    /* מה נשמר בפועל: שדה חסר, ולא מחרוזת ריקה */
    storedHint: Object.prototype.hasOwnProperty.call(stored, 'hint') ? stored.hint : '(אין שדה)',
    /* ולחדר שהתיאור שלו היה רווחים בלבד — גם כן */
    emptyStored: (await db.rooms.get(emptyHint)).hint ?? '(אין שדה)',
    withStored: (await db.rooms.get(withHint)).hint,
    error: 'error' in parsed ? parsed.error : null,
    rooms: 'pack' in parsed ? parsed.pack.tables.rooms.length : 0,
    itemRooms: 'pack' in parsed
      ? parsed.pack.tables.catalog.find((i) => i.id === itemId)?.rooms
      : null,
    noHintId: noHint,
  };
});

ok('חדר בלי תיאור אינו שומר מחרוזת ריקה', trip.storedHint === '(אין שדה)', String(trip.storedHint));
ok('וגם תיאור שכולו רווחים', trip.emptyStored === '(אין שדה)', String(trip.emptyStored));
ok('ותיאור אמיתי נשמר', trip.withStored === 'חדר עבודה', String(trip.withStored));
ok('הייצוא של האפליקציה נקרא בחזרה', trip.error === null, String(trip.error));
ok('והשיוך של הארגז לחדר שרד', (trip.itemRooms ?? []).includes(trip.noHintId),
  JSON.stringify(trip.itemRooms));

/* ------------------------------------------------------------------ */
/* וגם קובץ ישן שנכתב עם מחרוזת ריקה — תאימות לאחור                   */
/* ------------------------------------------------------------------ */
const legacy = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const { exportCabinets, readPack } = await import('/src/db/cabinetPack.ts' + v);
  const { packFingerprint } = await import('/src/db/packSchema.ts' + v);
  const pack = await exportCabinets();
  /*
   * קובץ שנוצר בגרסה הקודמת: hint ריק בכל חדר — וטביעת אצבע
   * שמתארת בדיוק את מה שיש בו. שינוי בלי חישוב מחדש הוא קובץ
   * שנערך, וזו שגיאה אחרת לגמרי.
   */
  const restamp = (tables) => ({
    ...pack,
    tables,
    manifest: { ...pack.manifest, fingerprint: packFingerprint(tables) },
  });
  const old = restamp({ ...pack.tables, rooms: pack.tables.rooms.map((r) => ({ ...r, hint: '' })) });
  const parsed = readPack(JSON.stringify(old));
  /* ולעומת זאת שם ריק הוא עדיין שגיאה — הוא לא "לא מולא" */
  const noLabel = restamp({ ...pack.tables, rooms: pack.tables.rooms.map((r) => ({ ...r, label: '' })) });
  return {
    emptyHint: 'error' in parsed ? parsed.error : null,
    emptyLabel: 'error' in readPack(JSON.stringify(noLabel)) ? 'נדחה' : 'התקבל',
  };
});
ok('קובץ ישן עם תיאור ריק נקרא', legacy.emptyHint === null, String(legacy.emptyHint));
ok('אבל חדר בלי שם עדיין נדחה', legacy.emptyLabel === 'נדחה', legacy.emptyLabel);

await browser.close();
for (const e of errs) out.push('FAIL ' + e);
console.log(out.join('\n'));
const fail = out.filter((l) => l.startsWith('FAIL')).length;
console.log(`${out.length - fail} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);

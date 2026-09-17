import './_exit.mjs';
/*
 * שכבה 146 — B07: התאמה מול הגיליון, ולא מול מה שבמקרה נשלח.
 *
 * הבדיקה סופרת מהמקור: 79 שורות בגיליון, שלוש נישות מכשיר שהוסרו
 * במפורש, 76 שנשארו, ותוספת אחת מאושרת. כל ארגז שנוסף או נעלם
 * מעבר לזה הוא שינוי היקף שלא נרשם.
 */
import { chromium } from 'playwright';

/* מה שסוכם על הספרייה — המקום היחיד שבו המספרים כתובים */
const SOURCE_ROWS = 79;
const EXCLUDED = ['EC-039', 'EC-040', 'EC-067'];
/* תוספת מאושרת: אח של EC-055 למטבח, לבקשת הנגרייה */
const APPROVED_EXTRA = ['EC-081'];

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
const out = [];
const ok = (name, cond, extra = '') => out.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' | ' + extra : ''}`);

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);

const lib = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const { SHIPPED_LIBRARY } = await import('/src/catalog/shipped.ts' + v);
  const { SHIPPED_PRODUCTS } = await import('/src/catalog/products.ts' + v);
  return {
    codes: SHIPPED_LIBRARY.map((i) => i.code),
    rooms: [...new Set(SHIPPED_LIBRARY.flatMap((i) => i.rooms))].sort(),
    products: SHIPPED_PRODUCTS.map((i) => i.code),
  };
});

/* שורות הגיליון המקוריות הן EC-002 עד EC-080; כל מק״ט מעבר להן הוא תוספת */
const ORIGINAL = /^EC-0(0[2-9]|[1-7]\d|80)$/;
const extra = lib.codes.filter((c) => !ORIGINAL.test(c));
ok('אף אחת מהשורות שהוסרו אינה בספרייה',
  EXCLUDED.every((c) => !lib.codes.includes(c)), EXCLUDED.join(','));
ok('התוספת היחידה היא זו שאושרה',
  extra.length === APPROVED_EXTRA.length && extra.every((c) => APPROVED_EXTRA.includes(c)),
  extra.join(','));
ok('הסכום מתיישב: 79 שורות = 3 הסרות + 76 + תוספת מאושרת',
  lib.codes.length === SOURCE_ROWS - EXCLUDED.length + APPROVED_EXTRA.length,
  `${lib.codes.length} / ${SOURCE_ROWS - EXCLUDED.length + APPROVED_EXTRA.length}`);
ok('אין מק״ט כפול', new Set(lib.codes).size === lib.codes.length, String(lib.codes.length));
ok('תשעה חדרים', lib.rooms.length === 9, lib.rooms.join(','));
ok('ומוצרי המערכת נספרים בנפרד',
  lib.products.every((c) => !lib.codes.includes(c)), lib.products.join(','));

await browser.close();
console.log(out.join('\n'));
const fail = out.filter((l) => l.startsWith('FAIL')).length;
console.log(`${out.length - fail} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);

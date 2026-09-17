import './_exit.mjs';
/*
 * שכבה 159 — חדר מובנה שנוסף אחרי ההתקנה מגיע גם להתקנה ותיקה.
 *
 * זריעת החדרים רצה פעם אחת, לטבלה ריקה — וזה נכון, כי מי שמחק
 * חדר לא אמור למצוא אותו שוב. אבל המשמעות הייתה שחדר מובנה חדש
 * לא הגיע לאיש: מי שהתקין כשהיו ארבעה חדרים — מטבח, סלון, חדר
 * שינה וחדר שירות — נשאר עם ארבעה, וחמישה חדרים שנוספו מאוחר
 * יותר לא הופיעו אצלו לעולם. הארגזים ששויכו אליהם לא נמחקו,
 * אבל הם לא הופיעו בשום רשימה: הספרייה מציגה ארגזים דרך כרטיס
 * חדר, וחדר שאינו קיים אינו מציג דבר.
 *
 * זו אותה תקלה של A11 בספריית הארגזים, בטבלה שנייה.
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

const login = async () => {
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  const u = page.getByLabel('שם משתמש');
  if (await u.count()) {
    await u.fill('admin');
    await page.getByLabel('סיסמה').fill('admin2026');
    await page.getByRole('button', { name: 'כניסה' }).first().click();
  }
  await page.waitForTimeout(2000);
};

/** החדרים הגלויים, ומספר הארגזים בכל אחד */
const rooms = () => page.evaluate(async () => {
  const req = indexedDB.open('easycraft');
  const dbh = await new Promise((res) => (req.onsuccess = () => res(req.result)));
  const get = (s) => new Promise((res) => {
    const g = dbh.transaction(s, 'readonly').objectStore(s).getAll();
    g.onsuccess = () => res(g.result);
  });
  const rs = await get('rooms');
  const cs = await get('catalog');
  dbh.close();
  const n = (id) => cs.filter((c) => (c.rooms ?? []).includes(id) && c.group !== 'panel').length;
  return rs.filter((r) => !r.hiddenAt).map((r) => ({ id: r.id, cabinets: n(r.id) }));
});

/** מעצב מצב התקנה: אילו חדרים קיימים, ואיזה דור נרשם */
const setState = (keep, generation, hide = []) =>
  page.evaluate(async ([ids, gen, hidden]) => {
    const req = indexedDB.open('easycraft');
    const dbh = await new Promise((res) => (req.onsuccess = () => res(req.result)));
    const tx = dbh.transaction(['rooms', 'settings'], 'readwrite');
    const rs = tx.objectStore('rooms');
    const all = await new Promise((res) => { const g = rs.getAll(); g.onsuccess = () => res(g.result); });
    const set = new Set(ids);
    for (const r of all) {
      if (!set.has(r.id)) rs.delete(r.id);
      else if (hidden.includes(r.id)) rs.put({ ...r, hiddenAt: Date.now() });
    }
    const ss = tx.objectStore('settings');
    const cur = await new Promise((res) => { const g = ss.getAll(); g.onsuccess = () => res(g.result[0]); });
    ss.put({ ...cur, roomsGeneration: gen });
    await new Promise((res) => (tx.oncomplete = res));
    dbh.close();
  }, [keep, generation, hide]);

const OLD = ['kitchen', 'living', 'bedroom', 'utility'];
const LATER = ['bathroom', 'closet', 'children', 'entrance', 'office'];

await login();
const seeded = await rooms();
ok('התקנה חדשה מקבלת תשעה חדרים', seeded.length === 9, String(seeded.length));

/* --- התקנה ותיקה: ארבעה חדרים, בלי סימון דור --- */
await setState(OLD, undefined);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(2200);
const fixed = await rooms();
ok('התקנה ותיקה מקבלת את החדרים שנוספו', fixed.length === 9, String(fixed.length));
ok('וכל החמישה שחסרו חזרו',
  LATER.every((id) => fixed.some((r) => r.id === id)),
  fixed.map((r) => r.id).join(','));
ok('והארגזים שלהם מופיעים בהם',
  LATER.every((id) => (fixed.find((r) => r.id === id)?.cabinets ?? 0) > 0),
  LATER.map((id) => `${id}:${fixed.find((r) => r.id === id)?.cabinets}`).join(' '));

/* --- והחדרים שכבר היו לא שוכפלו --- */
ok('בלי כפילות', new Set(fixed.map((r) => r.id)).size === fixed.length, String(fixed.length));

/* --- חדר מובנה שהמשתמש הסיר נשאר מוסר --- */
await setState(
  [...OLD, ...LATER],
  1,
  ['office'],
);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(2200);
const afterHide = await rooms();
ok('חדר שהמשתמש הסיר אינו חוזר',
  !afterHide.some((r) => r.id === 'office'),
  afterHide.map((r) => r.id).join(','));

/* --- והרצה חוזרת אינה מוסיפה דבר --- */
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
const again = await rooms();
ok('הרצה חוזרת אינה משנה דבר', again.length === afterHide.length,
  `${afterHide.length} → ${again.length}`);

await browser.close();
for (const e of errs) out.push('FAIL ' + e);
console.log(out.join('\n'));
const fail = out.filter((l) => l.startsWith('FAIL')).length;
console.log(`${out.length - fail} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);

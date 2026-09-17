import './_exit.mjs';
/*
 * שכבה 160 — ספריית הארגזים מגיעה גם להתקנה ותיקה.
 *
 * `addBuiltinRooms` החזיר את חמשת החדרים שנוספו אחרי ההתקנה, ואז
 * התברר שהם ריקים: הספרייה שנזרעה בגרסה מוקדמת כיסתה מטבח, סלון
 * וחדר שינה בלבד, ו-`seedCatalog` נעצר על סימון "כבר נזרעה". מנגנון
 * העדכון של A11 היה קיים — ודרש כניסה להגדרות ולחיצה. תבנית חדשה
 * אינה דריסה של דבר, ולכן היא נכנסת לבד.
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
await page.waitForTimeout(600);

const r = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const { diffLibrary, fingerprintOf, mergedRow, hasLibraryUpdate } =
    await import('/src/catalog/libraryRelease.ts' + v);
  const { SHIPPED_LIBRARY, LIBRARY_RELEASE } = await import('/src/catalog/shipped.ts' + v);

  const row = (s) => ({ ...s, workshopId: 'w', rev: 1, createdAt: 1, updatedAt: 1 });
  const all = SHIPPED_LIBRARY.map(row);

  /* התקנה ותיקה: אין כאן אף תבנית מהשחרור, והדור אפס */
  const stale = diffLibrary([], [], 0);
  /* התקנה מעודכנת: הכול כאן, בלי שינוי */
  const marked = all.map((r2) => ({ ...r2, releaseMark: fingerprintOf(r2) }));
  const fresh = diffLibrary(marked, [], LIBRARY_RELEASE);

  /* תבנית שנמחקה בכוונה */
  const erasedId = SHIPPED_LIBRARY[0].id;
  const erased = diffLibrary(marked.filter((i) => i.id !== erasedId), [erasedId], 0);

  /* תבנית שנערכה בנגרייה — שם אחר, וסימון שאינו תואם */
  const editedRows = marked.map((i, n) => (n === 3 ? { ...i, name: i.name + ' שלי' } : i));
  const edited = diffLibrary(editedRows, [], 0);

  /* תבנית שלא נגעו בה, והשחרור משנה אותה */
  const oldMark = { ...marked[5], defaultWidthMm: 1234 };
  const changedRows = marked.map((i, n) =>
    (n === 5 ? { ...oldMark, releaseMark: fingerprintOf(oldMark) } : i));
  const changed = diffLibrary(changedRows, [], 1);

  const kinds = (u) => u.changes.reduce((a, c) => ({ ...a, [c.kind]: (a[c.kind] ?? 0) + 1 }), {});

  /* מיזוג שומר על מה ששייך לנגרייה */
  const local = { ...marked[0], sortOrder: 999, favorite: true, code: 'שלי-1', rev: 4 };
  const merged = mergedRow(local, SHIPPED_LIBRARY[0], 77);

  return {
    staleAdded: kinds(stale).added ?? 0,
    shipped: SHIPPED_LIBRARY.length,
    freshChanges: fresh.changes.length,
    freshOffers: hasLibraryUpdate(fresh),
    erasedKinds: kinds(erased),
    erasedOffersIt: erased.changes.some((c) => c.kind === 'added' && c.shipped.id === erasedId),
    editedKinds: kinds(edited),
    changedKinds: kinds(changed),
    mergedKeeps: merged.sortOrder === 999 && merged.favorite === true && merged.code === 'שלי-1',
    mergedTakes: merged.name === SHIPPED_LIBRARY[0].name && merged.rev === 5,
  };
});

ok('התקנה ותיקה רואה את כל השחרור כתוספת', r.staleAdded === r.shipped, `${r.staleAdded}/${r.shipped}`);
ok('התקנה מעודכנת אינה רואה שינוי', r.freshChanges === 0 && !r.freshOffers);
ok('תבנית שנמחקה בכוונה מסומנת כמוסרת', (r.erasedKinds.removed ?? 0) === 1);
ok('ואינה מוצעת כתוספת', !r.erasedOffersIt);
ok('תבנית שנערכה בנגרייה היא התנגשות', (r.editedKinds.edited ?? 0) === 1, JSON.stringify(r.editedKinds));
ok('תבנית שלא נגעו בה היא עדכון', (r.changedKinds.changed ?? 0) === 1, JSON.stringify(r.changedKinds));
ok('מיזוג שומר סדר, מועדף ומק״ט', r.mergedKeeps);
ok('ולוקח שם וגרסה מהשחרור', r.mergedTakes);

/*
 * ועכשיו על האפליקציה עצמה: התקנה שנזרעה בספרייה מוקדמת, עם
 * ארבעה חדרים ובלי סימוני דור. אחרי טעינה — תשעה חדרים, ובכולם
 * ארגזים.
 */
const OLD_ROOMS = ['kitchen', 'living', 'bedroom', 'utility'];

const stale = () => page.evaluate(async (keep) => {
  const req = indexedDB.open('easycraft');
  const dbh = await new Promise((res) => (req.onsuccess = () => res(req.result)));
  const tx = dbh.transaction(['catalog', 'rooms', 'settings'], 'readwrite');
  const cat = tx.objectStore('catalog'), rm = tx.objectStore('rooms'), se = tx.objectStore('settings');
  const rows = await new Promise((res) => { const g = cat.getAll(); g.onsuccess = () => res(g.result); });
  /* משאיר רק מה ששייך לחדרים שהיו אז — זו בדיוק ספריית אותה גרסה */
  const early = new Set(keep.slice(0, 3));
  for (const r of rows) {
    if (!(r.rooms ?? []).some((x) => early.has(x))) cat.delete(r.id);
  }
  const all = await new Promise((res) => { const g = rm.getAll(); g.onsuccess = () => res(g.result); });
  for (const r of all) if (!keep.includes(r.id)) rm.delete(r.id);
  const st = await new Promise((res) => { const g = se.getAll(); g.onsuccess = () => res(g.result); });
  for (const s of st) se.put({ ...s, libraryRelease: undefined, roomsGeneration: undefined });
  await new Promise((res) => (tx.oncomplete = res));
  dbh.close();
}, OLD_ROOMS);

const seen = () => page.evaluate(async () => {
  const req = indexedDB.open('easycraft');
  const dbh = await new Promise((res) => (req.onsuccess = () => res(req.result)));
  const get = (s) => new Promise((res) => {
    const g = dbh.transaction(s, 'readonly').objectStore(s).getAll();
    g.onsuccess = () => res(g.result);
  });
  const rs = await get('rooms'), cs = await get('catalog');
  dbh.close();
  return rs.filter((r) => !r.hiddenAt).map((r) => ({
    id: r.id,
    n: cs.filter((c) => (c.rooms ?? []).includes(r.id) && c.group !== 'panel').length,
  }));
});

const login = async () => {
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  const u = page.getByLabel('שם משתמש');
  if (await u.count()) {
    await u.fill('admin');
    await page.getByLabel('סיסמה').fill('admin2026');
    await page.getByRole('button', { name: 'כניסה' }).first().click();
  }
  await page.waitForTimeout(2200);
};

await login();
await stale();
const before = await seen();
await login();
const after = await seen();

ok('לפני: ארבעה חדרים בלבד', before.length === 4, JSON.stringify(before));
ok('לפני: חדר שירות ריק', (before.find((r) => r.id === 'utility')?.n ?? -1) === 0);
ok('אחרי: תשעה חדרים', after.length === 9, JSON.stringify(after.map((r) => r.id)));
ok('אחרי: בכל חדר יש ארגזים', after.every((r) => r.n > 0), JSON.stringify(after));

/* הרצה חוזרת אינה משנה דבר, ואינה משכפלת */
await login();
const again = await seen();
ok(
  'טעינה נוספת אינה מוסיפה עוד',
  JSON.stringify(again) === JSON.stringify(after),
  JSON.stringify(again),
);

ok('בלי שגיאות דף', errs.length === 0, errs.join(' ; '));

console.log(out.join('\n'));
await browser.close();
process.exit(out.some((l) => l.startsWith('FAIL')) ? 1 : 0);

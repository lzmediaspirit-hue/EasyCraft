/* שכבה 106 — מק״ט לכל ארגז, קטגוריות, ומועדפים ב"ספרייה שלי" */
import { chromium } from 'playwright';
const SP = new URL('shots/', import.meta.url).pathname;

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage({ viewport: { width: 400, height: 840 } });
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + String(e).slice(0, 200)));
const btn = (re) => page.getByRole('button', { name: re }).first();
const dlg = () => page.getByRole('dialog').last();
const out = [];
const ok = (name, cond, extra = '') => out.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' | ' + extra : ''}`);

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.getByLabel('שם משתמש').fill('admin');
await page.getByLabel('סיסמה').fill('admin2026');
await btn('כניסה').click();
await page.waitForTimeout(1800);

/* ריצה קודמת עלולה להשאיר מועדפים וארגזי QA — מתחילים נקי */
await page.evaluate(async () => {
  const { catalogRepo } = await import('/src/catalog/catalogRepo.ts?v=' + Date.now());
  for (const i of await catalogRepo.all()) {
    if (i.name.startsWith('QA ')) await catalogRepo.remove(i.id);
    else if (i.favorite) await catalogRepo.setFavorite(i.id, false);
  }
});
await page.waitForTimeout(500);

/* --- מק״ט לכל ארגז, גם למה שהגיע עם האפליקציה --- */
const codes = await page.evaluate(async () => {
  const { catalogRepo } = await import('/src/catalog/catalogRepo.ts?v=' + Date.now());
  const all = await catalogRepo.all();
  const list = all.map((i) => i.code);
  return { n: all.length, withCode: list.filter(Boolean).length, unique: new Set(list).size };
});
ok('לכל ארגז בספרייה יש מק״ט', codes.withCode === codes.n, `${codes.withCode}/${codes.n}`);
ok('וכולם שונים זה מזה', codes.unique === codes.n, `${codes.unique}/${codes.n}`);

/* --- בונים ארגז: מק״ט אוטומטי לפי הקטגוריה, שמירה לקטגוריה --- */
await btn(/ספריית הארגזים/).click(); await page.waitForTimeout(900);
await btn(/ארגז משלי/).click(); await page.waitForTimeout(800);
const sheet = dlg();
await sheet.getByLabel('שם הארגז').fill('QA עליון מועדף');
/* המק״ט הוא מזהה פנימי — אין לו שדה, ואין מה לערוך בו */
ok('אין שדה מק״ט במסך', (await sheet.getByRole('textbox', { name: /מק״ט/ }).count()) === 0);
ok('והמילה עצמה אינה על המסך', !(await sheet.innerText()).includes('מק״ט'));
await sheet.getByRole('button', { name: 'עליונים' }).click();
await page.waitForTimeout(500);
await sheet.getByRole('button', { name: 'מועדף', exact: true }).click();
await page.waitForTimeout(250);
/* חדר שינה בלבד — כל שאר החדרים מכובים, יהיו אשר יהיו */
for (const room of ['מטבח', 'סלון', 'חדר שירות']) {
  const chip = sheet.getByRole('button', { name: room, exact: true });
  if ((await chip.count()) && (await chip.getAttribute('aria-pressed')) === 'true') await chip.click();
  await page.waitForTimeout(200);
}
const bed = sheet.getByRole('button', { name: 'חדר שינה', exact: true });
if ((await bed.getAttribute('aria-pressed')) !== 'true') await bed.click();
await page.waitForTimeout(300);
await sheet.getByRole('button', { name: /שמירה|הוספה/ }).last().click();
await page.waitForTimeout(1000);

const saved = await page.evaluate(async () => {
  const { catalogRepo } = await import('/src/catalog/catalogRepo.ts?v=' + Date.now());
  const all = await catalogRepo.all();
  const i = all.find((x) => x.name === 'QA עליון מועדף');
  return i && {
    code: i.code, group: i.group, rooms: i.rooms, favorite: i.favorite, id: i.id,
    unique: new Set(all.map((x) => x.code)).size === all.length,
  };
});
ok('הארגז קיבל מק״ט לבד, לפי הקטגוריה', /^U-\d+$/.test(saved?.code ?? ''), saved?.code);
ok('והוא עדיין ייחודי בספרייה', saved?.unique === true);
ok('בקטגוריה שנבחרה', saved?.group === 'upper', String(saved?.group));
ok('ובחדר שנבחר', JSON.stringify(saved?.rooms) === JSON.stringify(['bedroom']), JSON.stringify(saved?.rooms));
ok('ומסומן כמועדף', saved?.favorite === true, String(saved?.favorite));

/* --- הוא מופיע במסך הקטגוריה של החדר --- */
await page.waitForTimeout(400);
await btn(/חדר שינה/).click(); await page.waitForTimeout(900);
/*
 * הספרייה של החדר נפתחת על הקטגוריה הראשונה, ולכן קודם
 * נבדק שהקטגוריה של הארגז קיימת כאן ורק אחר כך את הארגז עצמו.
 */
const tab = page.getByRole('button', { name: 'עליונים', exact: true });
ok('לחדר השינה יש קטגוריית "עליונים"', (await tab.count()) === 1);
await tab.click();
await page.waitForTimeout(600);
ok('והארגז שנשמר מופיע תחתיה', (await page.innerText('body')).includes('QA עליון מועדף'));
await page.screenshot({ path: SP + 'L106-1-room-category.png' });

/* --- "ארגזים מועדפים" --- */
await btn(/לשלב הקודם/).click(); await page.waitForTimeout(700);
ok('אין יותר תצוגת "הספרייה שלי"', !(await page.innerText('body')).includes('הספרייה שלי'));
/* עוגן לתחילה: כוכב על כרטיס נקרא "הסרת X מהמועדפים" */
await btn(/^ארגזים מועדפים/).click(); await page.waitForTimeout(800);
const mine = await page.innerText('body');
ok('המועדף מופיע בארגזים מועדפים', mine.includes('QA עליון מועדף'), JSON.stringify(mine.slice(0, 160)));
await page.screenshot({ path: SP + 'L106-2-my-library.png' });
/* כוכב מוריד אותו משם */
await page.getByRole('button', { name: /הסרת QA עליון מועדף מהמועדפים/ }).click();
await page.waitForTimeout(800);
ok('והכוכב מוציא אותו', !(await page.innerText('body')).includes('QA עליון מועדף'));
await page.keyboard.press('Escape');
await page.waitForTimeout(500);

/* --- מק״ט תואם אינו משכפל --- */
const dedupe = await page.evaluate(async (code) => {
  const v = '?v=' + Date.now();
  const { catalogRepo } = await import('/src/catalog/catalogRepo.ts' + v);
  const { exportLibrary, importLibrary } = await import('/src/db/backup.ts' + v);
  const res = [];
  const ok2 = (name, cond, extra = '') => res.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' | ' + extra : ''}`);
  const before = (await catalogRepo.all()).length;

  /* שמירה חדשה תחת מק״ט קיים — מעדכנת ולא מוסיפה */
  const again = await catalogRepo.saveCustom({
    rooms: ['bedroom'], group: 'upper', name: 'QA אותו מק״ט', glyph: 'doors',
    level: 'wall', defaultWidthMm: 800, widthOptionsMm: [800],
    defaultHeightMm: 700, defaultDepthMm: 320, defaultYMm: 1500, code,
  });
  const after = await catalogRepo.all();
  ok2('שמירה תחת מק״ט קיים אינה מוסיפה ארגז', after.length === before, `${before} → ${after.length}`);
  ok2('והיא מעדכנת את הארגז שנושא אותו', after.find((i) => i.id === again)?.name === 'QA אותו מק״ט');

  /* ייבוא חוזר של אותה ספרייה במזהים אחרים — גם הוא אינו משכפל */
  const backup = await exportLibrary();
  backup.tables.catalog = backup.tables.catalog.map((i) => ({ ...i, id: crypto.randomUUID() }));
  const r = await importLibrary(backup, 'merge');
  const total = (await catalogRepo.all()).length;
  ok2('ייבוא חוזר במזהים אחרים אינו משכפל', total === before, `${before} → ${total}`);
  ok2('והכול נספר כעדכון', r.added === 0, JSON.stringify(r));
  return res;
}, saved.code);

const all = [...out, ...dedupe, ...errs.map((e) => 'FAIL ' + e)];
for (const l of all) console.log(l);
const bad = all.filter((l) => l.startsWith('FAIL')).length;
console.log(bad ? `${bad} fail of ${all.length}` : `all ${all.length} pass`);
await browser.close();
process.exit(bad ? 1 : 0);

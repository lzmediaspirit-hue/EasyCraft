import './_exit.mjs';
/*
 * שכבה 136 — שער השמירה של הארגז בספרייה.
 *
 * שם הוא מה שמזהה ארגז ברשימה, ומק״ט הוא מה שמזהה אותו בין
 * מכשירים. שניהם היו פתוחים: שני ארגזים באותו שם ישבו זה לצד זה,
 * ושמירה תחת מק״ט תפוס מחקה בשקט ארגז אחר.
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
await page.getByLabel('שם משתמש').fill('admin');
await page.getByLabel('סיסמה').fill('admin2026');
await page.getByRole('button', { name: 'כניסה' }).first().click();
await page.waitForTimeout(1800);

/** שומר ארגז דרך המאגר עצמו, ומחזיר את המזהה או את הסיבה שנדחה. */
const save = (input) =>
  page.evaluate(async (i) => {
    const { catalogRepo } = await import('/src/catalog/catalogRepo.ts');
    try {
      return { id: await catalogRepo.saveCustom(i) };
    } catch (e) {
      return { why: String(e.message ?? e) };
    }
  }, input);

const BOX = {
  rooms: ['kitchen'],
  group: 'base',
  glyph: 'doors',
  doors: 2,
  level: 'floor',
  defaultWidthMm: 800,
  widthOptionsMm: [800],
  defaultHeightMm: 900,
  defaultDepthMm: 580,
  defaultYMm: 0,
  socleMm: 100,
  counterMm: 0,
};

const first = await save({ ...BOX, name: 'QA ארגז ייחודי' });
ok('ארגז חדש נשמר', !!first.id, JSON.stringify(first));

/* --- שם --- */
const same = await save({ ...BOX, name: 'QA ארגז ייחודי' });
ok('שם שכבר קיים נדחה', !!same.why, JSON.stringify(same));

/*
 * רווח כפול ואות גדולה אינם שם אחר. מי שמדביק שם מגיליון מקבל
 * רווחים שלא התכוון להם, ושני ארגזים שנראים זהים ברשימה הם ארגז
 * אחד שאי אפשר לבחור בו.
 */
const spaced = await save({ ...BOX, name: '  QA   ארגז ייחודי  ' });
ok('רווחים אינם עושים שם אחר', !!spaced.why, JSON.stringify(spaced));

const empty = await save({ ...BOX, name: '   ' });
ok('שם ריק נדחה', !!empty.why, JSON.stringify(empty));

/* עדכון הארגז עצמו אינו מתנגש בעצמו */
const self = await save({ id: first.id, name: 'QA ארגז ייחודי', defaultWidthMm: 900 });
ok('עדכון בלי שינוי שם עובר', self.id === first.id, JSON.stringify(self));

const stored = await page.evaluate(async (id) => {
  const { catalogRepo } = await import('/src/catalog/catalogRepo.ts');
  const i = await catalogRepo.get(id);
  return { w: i?.defaultWidthMm, h: i?.defaultHeightMm, doors: i?.doors, name: i?.name };
}, first.id);
ok('ועדכון חלקי אינו מוחק את השאר', stored.h === 900 && stored.doors === 2, JSON.stringify(stored));
ok('והשם נשמר מנוקה', stored.name === 'QA ארגז ייחודי', JSON.stringify(stored.name));

/* --- מק״ט --- */
const codeOwner = await save({ ...BOX, name: 'QA בעל המק״ט', code: 'QA-901' });
ok('ארגז עם מק״ט נשמר', !!codeOwner.id, JSON.stringify(codeOwner));

const stealer = await save({ ...BOX, name: 'QA גנב המק״ט', code: 'qa-901' });
ok('מק״ט תפוס אינו דורס ארגז אחר', !!stealer.why, JSON.stringify(stealer));

const stillThere = await page.evaluate(async (id) => {
  const { catalogRepo } = await import('/src/catalog/catalogRepo.ts');
  return (await catalogRepo.get(id))?.name;
}, codeOwner.id);
ok('והארגז שהחזיק בו נשאר כמו שהוא', stillThere === 'QA בעל המק״ט', String(stillThere));

/* --- מזהה שאינו קיים --- */
const ghost = await save({ ...BOX, id: 'לא-קיים', name: 'QA רוח' });
ok('שמירה למזהה שאינו בספרייה נדחית', !!ghost.why, JSON.stringify(ghost));

/* --- והמסך אומר למה --- */
await page.getByRole('button', { name: /ספריית הארגזים/ }).click();
await page.waitForTimeout(900);
const dlg = () => page.getByRole('dialog').last();
await page.getByRole('button', { name: /ארגז משלי/ }).first().click();
await page.waitForTimeout(900);
await dlg().getByLabel('שם הארגז').fill('QA ארגז ייחודי');
await page.waitForTimeout(300);
await dlg().getByRole('button', { name: /שמירה בספרייה/ }).click();
await page.waitForTimeout(1200);
const said = await dlg().innerText();
ok('המסך אומר שהשם תפוס', /כבר יש בספרייה ארגז בשם/.test(said), said.slice(0, 140).replace(/\n/g, ' · '));
ok('והטופס נשאר פתוח עם מה שהוקלד',
  (await dlg().getByLabel('שם הארגז').inputValue()) === 'QA ארגז ייחודי');

await browser.close();
for (const e of errs) out.push('FAIL ' + e);
console.log(out.join('\n'));
const fail = out.filter((l) => l.startsWith('FAIL')).length;
console.log(`${out.length - fail} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);

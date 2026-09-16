import './_exit.mjs';
/* שכבה 99 — ממצאי הביקורת בממשק: ייבוא שנכשל, והגב של ארגז חדש */
import { chromium } from 'playwright';

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
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
await page.waitForTimeout(1600);
await btn(/הגדרות/).click();
await page.waitForTimeout(900);
await btn(/שמירה והעברה של ארגזים/).scrollIntoViewIfNeeded();
await btn(/שמירה והעברה של ארגזים/).click();
await page.waitForTimeout(700);

/* החבילה נכנסת כקובץ, ולכן גם הקובץ הפגום נבחר מהבורר */
const fs = await import('node:fs');
const TMP = '/tmp/l99c-files';
fs.mkdirSync(TMP, { recursive: true });
const asFile = async (name, body) => {
  const path = `${TMP}/${name}`;
  fs.writeFileSync(path, body);
  await dlg().getByLabel('בחירת קובץ ארגזים').setInputFiles(path);
  await page.waitForTimeout(500);
};

const bad = '{"app":"easycraft","format":1,"kind":"library","tables":{"catalog":[{"name":"invalid missing id"}]}}';
await asFile('bad.json', bad);
await dlg().getByRole('button', { name: 'ייבוא ארגזים' }).click();
await page.waitForTimeout(900);
const body = await dlg().innerText();
/* ההודעה מצביעה על השורה ועל השדה, ולא רק על "משהו פגום" */
ok('ייבוא פגום אומר מה קרה', /פגום|פגומים|נכשל/.test(body), JSON.stringify(body.slice(0, 200)));
ok('ומצביע על החלק שנפל', /הארגזים/.test(body), JSON.stringify(body.slice(0, 200)));
ok('וכפתור הייבוא נשאר פעיל', await dlg().getByRole('button', { name: 'ייבוא ארגזים' }).isEnabled());

/* חבילה בלי ארגזים — נדחית לפני שנגעו בנתונים */
await asFile('partial.json', '{"app":"easycraft","format":3,"kind":"library","tables":{"finishes":[]}}');
await dlg().getByRole('button', { name: 'ייבוא ארגזים' }).click();
await page.waitForTimeout(900);
const body2 = await dlg().innerText();
ok('חבילה בלי ארגזים נדחית', /חסר בקובץ/.test(body2), JSON.stringify(body2.slice(0, 200)));
ok('ולא מדווח שמשהו נוסף', !/נוספו/.test(body2));

/* --- 10. המתג בהגדרות באמת משנה את הגב --- */
await page.keyboard.press('Escape');
await page.waitForTimeout(500);
const backBtn = page.getByRole('button', { name: 'ללא גב' }).first();
await backBtn.scrollIntoViewIfNeeded();
await backBtn.click();
await page.waitForTimeout(700);
const saved = await page.evaluate(async () => {
  const { settingsRepo } = await import('/src/materials/materialsRepo.ts?v=' + Date.now());
  const s = await settingsRepo.get();
  return s.defaults.backKind;
});
ok('בחירת ללא-גב בהגדרות נשמרת במקום הנכון', saved === 'none', String(saved));

const all = [...out, ...errs.map((e) => 'FAIL ' + e)];
for (const l of all) console.log(l);
const nbad = all.filter((l) => l.startsWith('FAIL')).length;
console.log(nbad ? `${nbad} fail of ${all.length}` : `all ${all.length} pass`);
await browser.close();
process.exit(nbad ? 1 : 0);

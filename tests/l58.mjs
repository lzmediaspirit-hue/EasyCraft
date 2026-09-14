/* שכבה 21 — עמוד, מדרגת קיר ונישה: תוספת על הקיר עם עומק */
import { chromium } from 'playwright';
import { setup, addUnit } from './mk.mjs';

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage({ viewport: { width: 400, height: 840 } });
const errs = [];
page.on('console', (m) => {
  if (m.type() !== 'error') return;
  if (/404/.test(m.text()) && /favicon/.test(m.location()?.url ?? '')) return;
  errs.push(m.text());
});
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
const ok = (name, cond, extra = '') =>
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
const btn = (re) => page.getByRole('button', { name: re }).first();
const dlg = () => page.getByRole('dialog').last();

await setup(page);
await addUnit(page, 0);
await page.waitForTimeout(700);
/* רענון סוגר את לוח הארגז ומחזיר מסך הדמיה נקי */
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await btn(/בדיקה/).click();
await page.waitForTimeout(900);
await page.getByRole('button', { name: /מטבח/ }).first().click();
await page.waitForTimeout(1400);

/* --- מדרגת קיר היא סימון שאפשר להוסיף, ויש לה עומק --- */
await btn(/הגדרות הקיר/).click();
await page.waitForTimeout(900);
ok('a wall step can be added', (await dlg().getByRole('button', { name: 'מדרגת קיר' }).count()) === 1);
await dlg().getByRole('button', { name: 'מדרגת קיר' }).click();
await page.waitForTimeout(700);
const depth = dlg().getByLabel('מדרגת קיר — כמה בולטת');
ok('it asks how far it juts out', (await depth.count()) === 1);
ok('with a sensible default', (await depth.inputValue()) === '6', await depth.inputValue());
await depth.fill('12');
await page.waitForTimeout(500);

/* --- עמוד יושב בדיוק במקום שהארגז עומד בו --- */
await dlg().getByRole('button', { name: 'עמוד / פינוי' }).click();
await page.waitForTimeout(700);
await dlg().getByLabel('עמוד / פינוי — מהקיר לקצה').fill('10');
await page.waitForTimeout(500);
await page.screenshot({ path: 'L58-1-designer.png' });
await page.keyboard.press('Escape');
await page.waitForTimeout(800);

/* --- ההתראה אומרת כמה העמוד גונב, ולא שהארגז אשם --- */
const body = await page.innerText('body');
ok(
  'the warning says how deep the pillar bites',
  /בולט \d+ ס״מ אל תוך|בולט \d+ ס"מ אל תוך/.test(body),
  body.split('\n').filter((l) => l.includes('בולט')).join(' / '),
);

/* --- בחזית העומק כתוב ליד השם --- */
const flat = await page.locator('svg:has([data-unit-id])').first().innerHTML();
ok('the elevation labels the depth', /עמוד \/ פינוי 25 ס״מ/.test(flat));
ok('and the step depth as it was typed', /מדרגת קיר 12 ס״מ/.test(flat));
await page.screenshot({ path: 'L58-2-elevation.png' });

/* --- בתלת־ממד עמוד ומדרגה עומדים בחדר, לא על הקיר --- */
await btn(/שטוח/).click();
await page.waitForTimeout(1200);
const iso = await page.locator('svg:has([data-room-floor])').first().innerHTML();
ok('a jutting feature is not painted flat on the wall', !/data-wall-feature="pillar"/.test(iso));
ok(
  'it is drawn as a box among the cabinets',
  (await page.locator('[data-wall-solid="pillar"]').count()) === 3,
  String(await page.locator('[data-wall-solid="pillar"]').count()),
);
ok('so is the step', (await page.locator('[data-wall-solid="step"]').count()) === 3);
await page.screenshot({ path: 'L58-3-iso.png' });

/* --- נישה נשארת על הקיר, כי היא נכנסת לתוכו --- */
await btn(/^תלת/).click();
await page.waitForTimeout(900);
await btn(/הגדרות הקיר/).click();
await page.waitForTimeout(900);
await dlg().getByRole('button', { name: 'נישה' }).click();
await page.waitForTimeout(700);
ok('a niche asks for its depth too', (await dlg().getByLabel('נישה — עומק').count()) === 1);
await page.keyboard.press('Escape');
await page.waitForTimeout(700);
await btn(/שטוח/).click();
await page.waitForTimeout(1200);
ok(
  'and it is drawn recessed into the wall',
  (await page.locator('[data-wall-feature="niche"]').count()) >= 1,
);
await page.screenshot({ path: 'L58-4-niche.png' });

ok('no console errors', errs.length === 0, errs.slice(0, 3).join(' | '));
await browser.close();

import './_exit.mjs';
/*
 * שכבה 170 — עמוד הניסור: צבע שאומר משהו, וחתיכה שאומרת מאיפה.
 *
 * הצבע על הפלטה נגזר מהמקום של סוג החלק *בפלטה הזאת* — רשימת
 * תוויות שנבנתה מחדש לכל פלטה, ואינדקס לתוכה. לכן "צד" יצא כחול
 * בפלטה אחת וירוק בשנייה, ומקרא כל פלטה סתר את זה שלפניו. צבע
 * שמשתנה בין פלטות אינו מידע, והעין לומדת להתעלם ממנו.
 *
 * והשאלה השנייה שנשאלת מול הפלטה: על השולחן מונחות חמש חתיכות
 * באותה מידה ובאותו שם, ומה שצריך לדעת הוא לאיזה ארון כל אחת
 * הולכת. `label` אומר *מה* החלק ולא בשביל מי, ולכן השם של הארגז
 * נוסע איתו מהרגע שהוא מצטרף לשורה.
 */
import { chromium } from 'playwright';
import { setup, addBox, BOX, TAB } from './mk.mjs';

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + String(e).slice(0, 200)));
const out = [];
const ok = (name, cond, extra = '') => out.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' | ' + extra : ''}`);

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(700);

/* ------------------------------------------------------------------ */
/* הצבע עצמו                                                           */
/* ------------------------------------------------------------------ */
const tone = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const { toneOf } = await import('/src/features/design/NestingSheet.tsx' + v);
  const t = (l) => toneOf(l);
  return {
    /* אותו שם נותן אותו צבע, תמיד */
    stable: t('צד') === t('צד') && t('מדף') === t('מדף'),
    /* משפחה אחת, צבע אחד */
    fronts: t('דלת') === t('חזית מגירה') && t('דלת') === t('דופן זרה'),
    carcass: t('צד') === t('תחתית ותקרה'),
    drawers: t('תחתית מגירה') === t('גב מגירה') && t('תחתית מגירה') === t('דופן מגירה'),
    backs: t('גב') === t('גב בעובי גוף'),
    /* ומשפחות שונות נבדלות */
    apart: new Set([t('דלת'), t('צד'), t('מדף'), t('תחתית מגירה'), t('גב'), t('קושרת')]).size === 6,
    /* ושם שאינו ברשימה — לוח בודד — מקבל צבע יציב ולא ריק */
    board: t('לוח אלון 18') === t('לוח אלון 18') && /^#[0-9a-f]{6}$/i.test(t('לוח אלון 18')),
  };
});
ok('אותו סוג מקבל אותו צבע', tone.stable);
ok('חזיתות במשפחה אחת', tone.fronts);
ok('גוף במשפחה אחת', tone.carcass);
ok('מגירות במשפחה אחת', tone.drawers);
ok('וגב במשפחה אחת', tone.backs);
ok('ושש המשפחות נבדלות זו מזו', tone.apart);
ok('לוח בודד מקבל צבע יציב', tone.board);

/* ------------------------------------------------------------------ */
/* ועל הפלטות עצמן, במסך                                               */
/* ------------------------------------------------------------------ */
await setup(page);
for (const b of [BOX.doors2, BOX.drawers, BOX.sink, BOX.doors2]) await addBox(page, b);
await addBox(page, BOX.tall, { tab: TAB.tall });

await page.getByRole('button', { name: 'ניסור' }).first().click();
await page.waitForTimeout(1800);

const seen = await page.evaluate(() => {
  const rows = [];
  document.querySelectorAll('svg').forEach((svg, sheet) => {
    svg.querySelectorAll('g[role="button"]').forEach((g) => {
      rows.push({
        sheet,
        title: g.querySelector('title')?.textContent ?? '',
        fill: g.querySelector('rect')?.getAttribute('fill') ?? '',
      });
    });
  });
  return rows;
});

ok('יש חתיכות על הפלטות', seen.length > 0, String(seen.length));
ok('ויותר מציור אחד, אחרת אין מה להשוות',
  new Set(seen.map((r) => r.sheet)).size > 1, String(new Set(seen.map((r) => r.sheet)).size));

/*
 * זה הלב: אותו סוג חלק, בכל הפלטות, באותו צבע. זו בדיוק הבדיקה
 * שהייתה נכשלת קודם — האינדקס נבנה מחדש לכל פלטה.
 */
const byLabel = new Map();
const clashes = [];
for (const r of seen) {
  const label = r.title.split(' — ')[0];
  const was = byLabel.get(label);
  if (was && was !== r.fill) clashes.push(`${label}: ${was} מול ${r.fill}`);
  byLabel.set(label, r.fill);
}
ok('אותו סוג באותו צבע בכל הפלטות', clashes.length === 0, clashes.slice(0, 3).join(' | '));

/*
 * וכל חתיכה יודעת מאיזה ארגז היא. `label` לבדו אומר "צד", ועל
 * הפלטה יש חמישה צדדים משלושה ארונות שונים.
 */
const named = seen.filter((r) => r.title.includes(' — '));
ok('כל חתיכה נושאת את שם הארגז', named.length === seen.length,
  `${named.length} מתוך ${seen.length}`);

/* ולחיצה אומרת את זה על המסך */
await page.locator('svg g[role="button"]').first().click();
await page.waitForTimeout(500);
const said = await page.evaluate(() => {
  const el = [...document.querySelectorAll('p')]
    .find((p) => p.className.includes('bg-stone-100') && p.className.includes('text-[11px]'));
  return el?.textContent ?? '';
});
const owner = seen[0].title.split(' — ')[1] ?? '';
ok('לחיצה על חתיכה מראה את שם הארגז',
  !!owner && said.includes(owner), `"${said}" מול "${owner}"`);
ok('ולצידו סוג החלק והמידה',
  said.includes(seen[0].title.split(' — ')[0]) && /\d/.test(said), said);

/* ולחיצה שנייה על אותה חתיכה סוגרת */
await page.locator('svg g[role="button"]').first().click();
await page.waitForTimeout(400);
const gone = await page.evaluate(() =>
  ![...document.querySelectorAll('p')]
    .some((p) => p.className.includes('bg-stone-100') && p.className.includes('text-[11px]')));
ok('ולחיצה חוזרת סוגרת', gone);

ok('בלי שגיאות בדפדפן', errs.length === 0, errs.slice(0, 2).join(' | '));

await browser.close();
console.log(out.join('\n'));
const fail = out.filter((l) => l.startsWith('FAIL')).length;
console.log(`${out.length - fail} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);

import { chromium } from 'playwright';
import { pickFinishes, pickWalls } from './mk.mjs';
const SP = new URL('shots/', import.meta.url).pathname;
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await b.newPage({ viewport: { width: 400, height: 840 }, deviceScaleFactor: 2 });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && errs.push(m.text()));
const full = (n) => page.screenshot({ path: `${SP}/L11-${n}.png`, fullPage: true });
const btn = (re) => page.getByRole('button', { name: re }).first();
const dlg = () => page.getByRole('dialog').last();
const ok = (l, c, e = '') => console.log(`${c ? 'PASS' : 'FAIL'}  ${l}${e ? ' — ' + e : ''}`);

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });

/* ---- מנהל + גוונים על שני לוחות MDF ---- */
/* חשבון admin נוצר מראש; יצירת המנהל הראשון נבדקת ב-admin.mjs */
await page.getByLabel('שם משתמש').fill('admin');
await page.getByLabel('סיסמה').fill('admin2026');
await btn('כניסה').click(); await page.waitForTimeout(1400);
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' }); await page.waitForTimeout(500);

await btn('הגדרות').click(); await page.waitForTimeout(700);
/*
  גוון הוא היום פריט עצמאי עם מחיר לכל חומר, ולא "גוון בתוך לוח";
  שני גוונים חדשים, כל אחד עם קוד ספק משלו.
*/
const addFinish = async (name) => {
  await btn('גוון חדש').click(); await page.waitForTimeout(500);
  await dlg().locator('input[placeholder*="אלון"]').fill(name);
  await page.getByRole('button', { name: 'שמירה' }).last().click(); await page.waitForTimeout(600);
};
await addFinish('אלון טבעי');
await addFinish('לבן מט');
await btn('חזרה').click(); await page.waitForTimeout(600);

/* ---- פרויקט עם שני קירות ---- */
await btn(/לקוח חדש|הוספת לקוח/).click(); await page.waitForTimeout(400);
await page.locator('form input').nth(0).fill('משפחת ברק');
await page.locator('form input').nth(1).fill('נתניה');
await btn('שמירה').click(); await page.waitForTimeout(500);
await btn(/משפחת ברק/).click(); await page.waitForTimeout(500);
await btn('פרויקט חדש').click(); await page.waitForTimeout(300);
await btn(/מטבח/).click(); await page.waitForTimeout(250);
await pickWalls(page, 2); await page.waitForTimeout(250);
await btn(/^קיר נקי/).click(); await page.waitForTimeout(250);
const n = dlg().locator('input[type="number"]');
await n.nth(0).fill('260'); await n.nth(1).fill('400'); await n.nth(2).fill('300');
await btn(/יצירת הפרויקט/).click(); await page.waitForTimeout(1000);

// ארגז בקיר א' עם גוון אלון
await btn('הוספת ארגז').click(); await page.waitForTimeout(450);
await btn(/^ארגז שתי דלתות/).click(); await page.waitForTimeout(800);
await btn('סיום עריכה').click(); await page.waitForTimeout(400);
// ארגז נוסף
await btn('הוספת ארגז').click(); await page.waitForTimeout(450);
await btn(/^ארגז 3 מגירות/).click(); await page.waitForTimeout(800);
await btn('סיום עריכה').click(); await page.waitForTimeout(400);
/* הגוונים נבחרים לפרויקט כולו, בסוף — "גוון לכולם" */
await pickFinishes(page);

/* ---- 18. מבט על: רוחב הארגזים והתנגשות ---- */
await btn(/מבט על/).click(); await page.waitForTimeout(900);
const polys = await page.locator('svg polygon').count();
ok('plan view draws each cabinet', polys >= 2, `${polys} polygons`);
await full('1-plan');
await page.keyboard.press('Escape'); await page.waitForTimeout(500);

// ארגז בקיר ב' בתוך אזור הפינה, כדי לייצר התנגשות
await btn(/^קיר ב/).click(); await page.waitForTimeout(600);
await btn('הוספת ארגז').click(); await page.waitForTimeout(450);
await btn(/^ארגז שתי דלתות/).click(); await page.waitForTimeout(800);
await btn('סיום עריכה').click(); await page.waitForTimeout(400);
// דחיפה ידנית של הארגז אל תוך הפינה, דרך בסיס הנתונים
await page.evaluate(
  () =>
    new Promise((res) => {
      const open = indexedDB.open('easycraft');
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction(['units', 'walls'], 'readwrite');
        const w = tx.objectStore('walls').getAll();
        w.onsuccess = () => {
          const wallB = w.result.find((x) => x.index === 1);
          const store = tx.objectStore('units');
          const all = store.getAll();
          all.onsuccess = () => {
            const b = all.result.find((x) => x.wallId === wallB.id);
            if (b) store.put({ ...b, xMm: 0 });
            // ארון בקצה קיר א', בדיוק בפינה שבה קיר ב' מתחיל
            const a = all.result.find((x) => x.wallId !== wallB.id);
            if (a) store.put({ ...a, xMm: 3200 });
          };
        };
        tx.oncomplete = () => res(true);
      };
    }),
);
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(900);
// הטעינה מחדש מחזירה למסך הלקוחות — חוזרים לפרויקט
await btn(/משפחת ברק/).click(); await page.waitForTimeout(600);
await page.locator('main li button').first().click(); await page.waitForTimeout(900);
await btn(/מבט על/).click(); await page.waitForTimeout(900);
const clashText = await dlg().textContent();
ok('plan view flags a cabinet that cuts into another', clashText.includes('חודר לתוך ארון אחר'), clashText.slice(0, 80));
await full('2-plan-clash');
await page.keyboard.press('Escape'); await page.waitForTimeout(500);

/* ---- 5. פירוט לוחות בעמוד הפרויקטים ---- */
await btn('חזרה').click(); await page.waitForTimeout(800);
const cardText = await page.locator('main li').first().textContent();
ok('no box count on project card', !/ארגזים/.test(cardText), cardText.slice(0, 60));
/* קוד הספק ירד מהגוון; מה שמעניין בכרטיס הוא שורות הלוחות */
ok('board rows listed', /פלטה|פלטות/.test(cardText), cardText.slice(0, 80));
await full('3-project-card');

/* ---- 8-11. מכירה, תמחור ותשלומים ---- */
await btn(/^מכירה$/).click(); await page.waitForTimeout(700);
ok('sale sheet opens', await dlg().getByText('מחיר ללקוח').count() > 0);
await dlg().getByRole('button', { name: 'לפי מטר רץ' }).click(); await page.waitForTimeout(300);
await dlg().getByLabel('מחיר למטר רץ').fill('4500'); await page.waitForTimeout(500);
const perMeterText = await dlg().textContent();
ok('per-meter pricing computes', /מ׳ רץ/.test(perMeterText), perMeterText.match(/[\d.]+ מ׳ רץ · \d+₪/)?.[0] ?? '');
await dlg().getByRole('button', { name: 'לפי ארגזים' }).click(); await page.waitForTimeout(300);
await dlg().getByLabel('מחיר למ״ר חזית').fill('1800'); await page.waitForTimeout(500);
ok('per-unit pricing computes', /מ״ר חזית/.test(await dlg().textContent()));
await dlg().getByRole('button', { name: 'מחיר קבוע' }).click(); await page.waitForTimeout(300);
await dlg().getByLabel('מחיר הפרויקט').fill('32000'); await page.waitForTimeout(500);
ok('manual price wins', (await dlg().textContent()).includes('32,000'));
await dlg().getByRole('button', { name: 'בתשלומים' }).click(); await page.waitForTimeout(500);
const amounts = await dlg().locator('input[aria-label="סכום"]').evaluateAll((els) => els.map((e) => e.value));
ok(
  'installments split the price',
  amounts.length === 2 && Number(amounts[0]) + Number(amounts[1]) === 32000,
  amounts.join(' + '),
);
await full('4-sale');
await dlg().getByRole('button', { name: /סימון כנמכר/ }).click(); await page.waitForTimeout(1000);

/* ---- 17. נקודות התהליך אחרי המכירה ---- */
const afterSale = await page.locator('main li').first().textContent();
/* שלבי התהליך שונו: הכרטיס מראה את השלב הנוכחי */
ok('workflow starts after sale', /תכנון|ניסור|הרכבה|התקנה/.test(afterSale), afterSale.slice(-40));
ok('sale button becomes payments', await page.getByRole('button', { name: 'תשלומים' }).count() > 0);
await full('5-after-sale');

/* ---- 16. צפייה בתמונות שהתכנת מעלה ---- */
await btn('תשלומים').click(); await page.waitForTimeout(500);
await page.getByRole('button', { name: 'סימון מקדמה כשולם' }).click(); await page.waitForTimeout(300);
await page.getByRole('button', { name: 'שמירה' }).last().click(); await page.waitForTimeout(800);
const paidText = await page.locator('main li').first().textContent();
ok('payment progress on card', paidText.includes('נותר'), paidText.match(/נותר [^\s]+/)?.[0] ?? '');

await page.getByRole('button', { name: /פתיחת פרויקט|תכנון|קבצים/ }).first().click();
await page.waitForTimeout(900);
await page.setInputFiles('input[aria-label="העלאת הדמיות"]', {
  name: 'render.png',
  mimeType: 'image/png',
  buffer: Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  ),
});
await page.waitForTimeout(700);
await page.getByRole('button', { name: /render\.png/ }).first().click(); await page.waitForTimeout(700);
ok('planner image opens full screen', await page.locator('img[alt="render.png"]').count() > 0);
await full('6-attachment');

console.log('errors:', errs.length ? errs.slice(0, 4) : 'none');
await b.close();

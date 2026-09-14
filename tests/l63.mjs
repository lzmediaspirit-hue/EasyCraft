/* שכבה 22 — חוקי הפיזיקה: נגיעה והכלה מותרות, חדירה חלקית לא */
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

/** מעמיד שני ארגזים במידות שנתנו, ומחזיר כמה מהם סומנו כחודרים */
async function place(a, b) {
  await page.evaluate(async ([pa, pb]) => {
    const req = indexedDB.open('easycraft');
    const dbh = await new Promise((res) => (req.onsuccess = () => res(req.result)));
    const tx = dbh.transaction('units', 'readwrite');
    const st = tx.objectStore('units');
    const all = await new Promise((res) => {
      const g = st.getAll();
      g.onsuccess = () => res(g.result);
    });
    const base = all.find((u) => !u.id.endsWith('-b')) ?? all[0];
    const one = { ...base, ...pa, free: undefined, rotationDeg: 0 };
    const two = { ...base, id: base.id + '-b', ...pb, free: undefined, rotationDeg: 0 };
    for (const u of all) if (u.id !== base.id) st.delete(u.id);
    st.put(one);
    st.put(two);
    await new Promise((res) => (tx.oncomplete = res));
    dbh.close();
  }, [a, b]);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1400);
  await btn(/בדיקה/).click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: /מטבח/ }).first().click();
  await page.waitForTimeout(1300);
  return (await page.innerText('body')).includes('חודר לתוך ארון אחר');
}

await setup(page);
await addUnit(page, 0);
await page.waitForTimeout(700);

/* --- מונחים זה לצד זה, נוגעים בדיוק --- */
const side = { xMm: 0, yMm: 0, widthMm: 600, heightMm: 800, depthMm: 580 };
ok('two cabinets that just touch are fine', !(await place(side, { ...side, xMm: 600 })));

/* --- מונחים זה על זה --- */
ok(
  'one standing on top of another is fine',
  !(await place(side, { ...side, yMm: 800 })),
);
await page.screenshot({ path: 'L63-1-stacked.png' });

/* --- ארגז שנכנס כולו לתוך השני: מכשיר בתוך עמודה --- */
const tall = { xMm: 0, yMm: 0, widthMm: 600, heightMm: 2000, depthMm: 580 };
const oven = { xMm: 20, yMm: 800, widthMm: 560, heightMm: 590, depthMm: 560 };
ok('an appliance inside a tall unit is fine', !(await place(tall, oven)));
await page.screenshot({ path: 'L63-2-nested.png' });

/* --- חזית שבולטת קדימה עדיין בפנים --- */
ok(
  'a proud front still counts as inside',
  !(await place(tall, { ...oven, depthMm: 620 })),
);

/* --- חדירה חלקית: דופן באמצע תחתית --- */
ok(
  'half in and half out is blocked',
  await place(side, { ...side, xMm: 300 }),
);
await page.screenshot({ path: 'L63-3-clash.png' });

/* --- חדירה חלקית לגובה --- */
ok('sinking into the one below is blocked', await place(side, { ...side, yMm: 400 }));

/* --- חדירה חלקית בעומק בלבד --- */
ok(
  'a deeper cabinet poking through the back is fine when it only touches',
  !(await place(side, { ...side, xMm: 600, depthMm: 700 })),
);

ok('no console errors', errs.length === 0, errs.slice(0, 3).join(' | '));
await browser.close();

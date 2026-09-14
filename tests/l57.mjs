/* שכבה 21 — החדר: רצפה אחת, עובי קיר, וסימוני הקיר בתלת־ממד */
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

/** מספר הפינות של מצולע הרצפה */
const floorCorners = async () => {
  const pts = await page.locator('[data-room-floor]').getAttribute('points');
  return pts.trim().split(/\s+/).length;
};

async function toDesign() {
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await btn(/בדיקה/).click();
  await page.waitForTimeout(900);
  await page.getByRole('button', { name: /מטבח/ }).first().click();
  await page.waitForTimeout(1400);
  /* חדר מורכב נפתח כבר בתלת־ממד; חדר פשוט צריך לחיצה */
  if (await page.getByRole('button', { name: /שטוח/ }).count()) {
    await btn(/שטוח/).click();
    await page.waitForTimeout(1100);
  }
}

await setup(page, { walls: 'שלושה קירות' });
await addUnit(page, 0);
await page.waitForTimeout(700);

/* חלון ושקע על הקיר הראשון */
await page.evaluate(async () => {
  const req = indexedDB.open('easycraft');
  const dbh = await new Promise((res) => (req.onsuccess = () => res(req.result)));
  const tx = dbh.transaction('walls', 'readwrite');
  const st = tx.objectStore('walls');
  const all = await new Promise((res) => {
    const g = st.getAll();
    g.onsuccess = () => res(g.result);
  });
  all.sort((a, b) => a.index - b.index);
  all[0].features = [
    { id: 'f1', kind: 'window', xMm: 1400, yMm: 900, widthMm: 1000, heightMm: 1200 },
    { id: 'f2', kind: 'socket', xMm: 800, yMm: 1100, widthMm: 100, heightMm: 100 },
  ];
  st.put(all[0]);
  await new Promise((res) => (tx.oncomplete = res));
  dbh.close();
});
await toDesign();

ok('the room floor is one polygon', (await page.locator('[data-room-floor]').count()) === 1);
ok('three walls close it into a rectangle', (await floorCorners()) === 4, String(await floorCorners()));
ok('the wall is drawn with thickness', (await page.locator('[data-wall-thickness]').count()) >= 3);
ok('the window is on the wall in 3D', (await page.locator('[data-wall-feature="window"]').count()) === 1);
ok('so is the socket', (await page.locator('[data-wall-feature="socket"]').count()) === 1);
await page.screenshot({ path: 'L57-1-room.png' });

/* --- שני קירות: הרצפה מושלמת למלבן שהם מגדירים --- */
await page.evaluate(async () => {
  const req = indexedDB.open('easycraft');
  const dbh = await new Promise((res) => (req.onsuccess = () => res(req.result)));
  const tx = dbh.transaction('walls', 'readwrite');
  const st = tx.objectStore('walls');
  const all = await new Promise((res) => {
    const g = st.getAll();
    g.onsuccess = () => res(g.result);
  });
  all.sort((a, b) => a.index - b.index);
  st.delete(all[2].id);
  await new Promise((res) => (tx.oncomplete = res));
  dbh.close();
});
await toDesign();
ok('two walls still give a four-cornered floor', (await floorCorners()) === 4, String(await floorCorners()));
await page.screenshot({ path: 'L57-2-two-walls.png' });

/* --- קיר בודד: עומק חדר קבוע, ועדיין רצפה אחת --- */
await page.evaluate(async () => {
  const req = indexedDB.open('easycraft');
  const dbh = await new Promise((res) => (req.onsuccess = () => res(req.result)));
  const tx = dbh.transaction('walls', 'readwrite');
  const st = tx.objectStore('walls');
  const all = await new Promise((res) => {
    const g = st.getAll();
    g.onsuccess = () => res(g.result);
  });
  all.sort((a, b) => a.index - b.index);
  st.delete(all[1].id);
  await new Promise((res) => (tx.oncomplete = res));
  dbh.close();
});
await toDesign();
ok('a lone wall still gets a room floor', (await floorCorners()) === 4, String(await floorCorners()));
await page.screenshot({ path: 'L57-3-one-wall.png' });

ok('no console errors', errs.length === 0, errs.slice(0, 3).join(' | '));
await browser.close();

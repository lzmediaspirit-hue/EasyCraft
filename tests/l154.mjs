import './_exit.mjs';
/*
 * שכבה 154 — R03: התכנון האוטומטי עובד בכל חדר.
 *
 * הכפתור היה של המטבח בלבד, והמנוע היה בנוי סביב משולש עבודה
 * ומכשירי חשמל. בחדר ארונות אין משולש עבודה ואין מקרר — יש
 * תלייה, מדפים ומגירות. כל חדר נשאל את השאלות שלו, נבנה מהספרייה
 * שלו, ונמדד לפי מה שנכון בו.
 */
import { chromium } from 'playwright';
import { setup } from './mk.mjs';

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + String(e).slice(0, 200)));
const out = [];
const ok = (name, cond, extra = '') => out.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' | ' + extra : ''}`);
const dlg = () => page.getByRole('dialog').last();

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);

/* ------------------------------------------------------------------ */
/* המנוע: כל חדר מקבל הצעה מהספרייה שלו                               */
/* ------------------------------------------------------------------ */
const engine = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const { planRoom } = await import('/src/features/design/planRoom.ts' + v);
  const { ROOM_PROFILES, autoPlannable } = await import('/src/features/design/roomProfiles.ts' + v);
  const { SHIPPED_LIBRARY } = await import('/src/catalog/shipped.ts' + v);
  const items = SHIPPED_LIBRARY.map((i) => ({ ...i, workshopId: 'w', rev: 1, createdAt: 0, updatedAt: 0 }));

  const room = (len, features = []) => {
    const w = {
      id: 'w1', projectId: 'p', index: 0, lengthMm: len, heightMm: 2600,
      features, createdAt: 0, updatedAt: 0, workshopId: 'w', rev: 1,
    };
    return { walls: [w], plan: [{ wall: w, start: { x: 0, y: 0 }, end: { x: len, y: 0 }, headingDeg: 0, depthMm: 600 }] };
  };
  const at = (prof, len = 4000, features = []) => {
    const { walls, plan } = room(len, features);
    return planRoom({
      room: prof.room, walls, plan,
      items: items.filter((i) => i.rooms.includes(prof.room)),
      options: Object.fromEntries(prof.options.map((o) => [o.key, o.on])),
    });
  };

  const rooms = {};
  for (const prof of ROOM_PROFILES) {
    const props = at(prof);
    const p = props[0];
    rooms[prof.room] = {
      proposals: props.length,
      boxes: p?.units.length ?? 0,
      /* כל יחידה היא פריט אמיתי מהספרייה של החדר */
      fromLibrary: (p?.units ?? []).every((u) =>
        items.some((i) => i.id === u.catalogKey && i.rooms.includes(prof.room)),
      ),
      /* וניקוד המטבח אינו מוצג כאן */
      triangle: p?.score.triangle ?? null,
      prep: p?.score.prepMm ?? null,
      variety: new Set((p?.units ?? []).map((u) => u.catalogKey)).size,
    };
  }

  /* חלון נמוך חוסם תחתונים גם כאן */
  const closet = ROOM_PROFILES.find((p) => p.room === 'closet');
  const win = at(closet, 4000, [
    { id: 'f1', kind: 'window', xMm: 0, yMm: 300, widthMm: 3600, heightMm: 1500 },
  ]);

  return {
    rooms,
    plannable: {
      kitchen: autoPlannable('kitchen'),
      closet: autoPlannable('closet'),
      office: autoPlannable('office'),
      unknown: autoPlannable('שלי'),
    },
    windowBoxes: win[0]?.units.length ?? 0,
  };
});

ok('כל חדר מקבל הצעות', Object.values(engine.rooms).every((r) => r.proposals > 0),
  JSON.stringify(Object.fromEntries(Object.entries(engine.rooms).map(([k, r]) => [k, r.proposals]))));
ok('ובכל אחת יש ארגזים', Object.values(engine.rooms).every((r) => r.boxes >= 3),
  JSON.stringify(Object.fromEntries(Object.entries(engine.rooms).map(([k, r]) => [k, r.boxes]))));
ok('כל יחידה היא פריט מהספרייה של החדר',
  Object.values(engine.rooms).every((r) => r.fromLibrary), 'מזהי פריטים אמיתיים');
ok('ההצעה אינה ארגז אחד שחוזר',
  Object.values(engine.rooms).every((r) => r.variety >= 2),
  JSON.stringify(Object.fromEntries(Object.entries(engine.rooms).map(([k, r]) => [k, r.variety]))));
ok('משולש העבודה אינו נמדד מחוץ למטבח',
  Object.values(engine.rooms).every((r) => r.triangle === 0 && r.prep === 0));
ok('מטבח וחדר מוכר ניתנים לתכנון',
  engine.plannable.kitchen && engine.plannable.closet && engine.plannable.office);
ok('וחדר שהנגר הוסיף בעצמו אינו מציג כפתור', !engine.plannable.unknown);
ok('חלון נמוך חוסם גם בחדר ארונות', engine.windowBoxes === 0, String(engine.windowBoxes));

/* ------------------------------------------------------------------ */
/* ובמסך: חדר ארונות אמיתי, מהכפתור עד הארגזים על הקיר                */
/* ------------------------------------------------------------------ */
await setup(page, { name: 'ארונות בע״מ', room: 'חדר ארונות' });
await page.waitForTimeout(900);

ok('הכפתור מוצג בחדר ארונות',
  (await page.getByRole('button', { name: /תכנון אוטומטי/ }).count()) > 0);

await page.getByRole('button', { name: /תכנון אוטומטי/ }).first().click();
await page.waitForTimeout(900);
const asked = await dlg().innerText();
ok('והשאלות הן של החדר ולא של המטבח',
  asked.includes('תלייה') && !asked.includes('מקרר'),
  asked.replace(/\n/g, ' / ').slice(0, 140));

await dlg().getByRole('button', { name: /הצגת הצעות/ }).click();
await page.waitForTimeout(1600);
const cards = dlg().locator('button').filter({ hasText: /נוח לשימוש|מקסימום אחסון|חסכוני/ });
ok('יש הצעות', (await cards.count()) > 0, String(await cards.count()));

await cards.first().click();
await dlg().getByText('מוצג').first().waitFor({ state: 'visible', timeout: 20000 });
const placed = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const { db } = await import('/src/db/db.ts' + v);
  const { catalogRepo } = await import('/src/catalog/catalogRepo.ts' + v);
  const us = await db.units.toArray();
  const items = await catalogRepo.all();
  return {
    n: us.length,
    names: [...new Set(us.map((u) => u.name))],
    /* כל ארגז מצביע על פריט אמיתי שמשויך לחדר */
    inRoom: us.every((u) => items.find((i) => i.id === u.catalogItemId)?.rooms.includes('closet')),
  };
});
ok('ההצעה הונחה בפועל', placed.n >= 3, `${placed.n} ארגזים`);
ok('והארגזים הם של חדר ארונות', placed.inRoom, placed.names.join(' · '));

await browser.close();
for (const e of errs) out.push('FAIL ' + e);
console.log(out.join('\n'));
const fail = out.filter((l) => l.startsWith('FAIL')).length;
console.log(`${out.length - fail} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);

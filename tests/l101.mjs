import './_exit.mjs';
/* שכבה 101 — הספרייה: מגירה פנימית, אפס שנשמר, "בלי תקרה" שעובר, והעברה עם התלויות */
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
await page.waitForTimeout(1600);

/**
 * פותח ארגז לעריכה: מהתפריט אל הספרייה של המטבח, ומשם אל הארגז.
 * הספרייה נפתחת בתפריט ולא ברשימה שטוחה, ולכן זו הדרך פנימה.
 */
async function openBox(re) {
  if (!(await page.getByRole('dialog').count())) {
    await btn(/ספריית הארגזים/).click();
    await page.waitForTimeout(800);
  }
  if (await dlg().getByRole('button', { name: /^מטבח/ }).count()) {
    await dlg().getByRole('button', { name: /^מטבח/ }).click();
    await page.waitForTimeout(700);
  }
  await dlg().getByRole('button', { name: re }).first().click();
  await page.waitForTimeout(800);
}

/* --- C1 + C2: בונים ארגז עם מגירה פנימית, סוקל ומשטח --- */
await btn(/ספריית הארגזים/).click(); await page.waitForTimeout(900);
await btn(/ארגז משלי/).click(); await page.waitForTimeout(700);
const sheet = dlg();
await sheet.getByLabel('שם הארגז').fill('QA ספרייה אישית');
await sheet.getByRole('button', { name: 'דלת ומגירה' }).click(); await page.waitForTimeout(500);
await sheet.getByRole('button', { name: /פנימית מאחורי דלתות/ }).click(); await page.waitForTimeout(400);
const num = (label) => sheet.getByLabel(label, { exact: true }).or(sheet.locator(`input`).nth(0));
await sheet.getByRole('textbox', { name: 'סוקל' }).fill('12').catch(() => {});
await sheet.getByRole('spinbutton', { name: 'סוקל' }).fill('12').catch(() => {});
await sheet.getByRole('spinbutton', { name: 'משטח עבודה' }).fill('4').catch(() => {});
await page.waitForTimeout(300);
await sheet.getByRole('button', { name: /שמירה|הוספה/ }).last().click();
await page.waitForTimeout(900);

const saved = await page.evaluate(async () => {
  const { catalogRepo } = await import('/src/catalog/catalogRepo.ts?v=' + Date.now());
  const item = (await catalogRepo.all()).find((i) => i.name === 'QA ספרייה אישית');
  return item && { id: item.id, drawerStyle: item.drawerStyle, socleMm: item.socleMm, counterMm: item.counterMm };
});
ok('הארגז נשמר', !!saved, JSON.stringify(saved));
ok('סוג המגירה הפנימית נשמר', saved?.drawerStyle === 'inner', String(saved?.drawerStyle));
ok('הסוקל נשמר', saved?.socleMm === 120, String(saved?.socleMm));
ok('המשטח נשמר', saved?.counterMm === 40, String(saved?.counterMm));
await page.screenshot({ path: SP + 'L101-1-custom.png' });

/* נפתח שוב — המגירה עדיין פנימית */
/* התפריט אינו רשימה: הארגז נמצא דרך הספרייה של החדר */
await openBox(/QA ספרייה אישית/);
const reopened = dlg();
const innerPressed = await reopened
  .getByRole('button', { name: /פנימית מאחורי דלתות/ })
  .getAttribute('aria-pressed');
ok('בפתיחה חוזרת המגירה עדיין פנימית', innerPressed === 'true', String(innerPressed));

/* C2 — איפוס לאפס נשמר */
await reopened.getByRole('spinbutton', { name: 'סוקל' }).fill('0');
await reopened.getByRole('spinbutton', { name: 'משטח עבודה' }).fill('0');
await page.waitForTimeout(300);
await reopened.getByRole('button', { name: /שמירה/ }).last().click();
await page.waitForTimeout(900);
const zeroed = await page.evaluate(async (id) => {
  const { catalogRepo } = await import('/src/catalog/catalogRepo.ts?v=' + Date.now());
  const item = await catalogRepo.get(id);
  return { socleMm: item?.socleMm, counterMm: item?.counterMm };
}, saved.id);
ok('איפוס הסוקל נשמר', zeroed.socleMm === 0, String(zeroed.socleMm));
ok('ואיפוס המשטח', zeroed.counterMm === 0, String(zeroed.counterMm));

/* --- C6: חדר אחד בלבד --- */
/* התפריט אינו רשימה: הארגז נמצא דרך הספרייה של החדר */
await openBox(/QA ספרייה אישית/);
const rooms = dlg();
/* מכבים כל חדר שדלוק, יהיו אשר יהיו — החדרים הם נתונים ולא רשימה קבועה */
for (const room of ['מטבח', 'סלון', 'חדר שירות']) {
  const chip = rooms.getByRole('button', { name: room, exact: true });
  if ((await chip.count()) && (await chip.getAttribute('aria-pressed')) === 'true') await chip.click();
  await page.waitForTimeout(200);
}
const bedroom = rooms.getByRole('button', { name: 'חדר שינה' });
if ((await bedroom.getAttribute('aria-pressed')) !== 'true') await bedroom.click();
await page.waitForTimeout(300);
await rooms.getByRole('button', { name: /שמירה/ }).last().click();
await page.waitForTimeout(900);

const roomCheck = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const { catalogRepo } = await import('/src/catalog/catalogRepo.ts' + v);
  const item = (await catalogRepo.all()).find((i) => i.name === 'QA ספרייה אישית');
  const kitchen = await catalogRepo.forRoom('kitchen');
  const bed = await catalogRepo.forRoom('bedroom');
  return {
    rooms: item?.rooms,
    inKitchen: kitchen.some((i) => i.id === item.id),
    inBedroom: bed.some((i) => i.id === item.id),
  };
});
ok('החדר שנבחר נשמר', JSON.stringify(roomCheck.rooms) === JSON.stringify(['bedroom']), JSON.stringify(roomCheck.rooms));
ok('הארגז אינו מוצע במטבח', roomCheck.inKitchen === false);
ok('והוא כן בחדר שינה', roomCheck.inBedroom === true);
await page.keyboard.press('Escape'); await page.waitForTimeout(400);

/* --- C3 + N10 + C4: מפרט שלם, העברה עם התלויות, ושחזור בלי המקור --- */
const deep = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const { db } = await import('/src/db/db.ts' + v);
  const { catalogRepo } = await import('/src/catalog/catalogRepo.ts' + v);
  const { unitsRepo, projectsRepo, wallsRepo } = await import('/src/features/projects/projectsRepo.ts' + v);
  const { customersRepo } = await import('/src/features/customers/customersRepo.ts' + v);
  const { finishesRepo, materialsRepo } = await import('/src/materials/materialsRepo.ts' + v);
  const { reusableSpec, REUSABLE_FIELDS } = await import('/src/db/types.ts' + v);
  const { exportCabinets, importCabinets, readPack } = await import('/src/db/cabinetPack.ts' + v);
  const res = [];
  const ok2 = (name, cond, extra = '') => res.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' | ' + extra : ''}`);

  /* C3 — ארגז עם "בלי תקרה" וזכוכית בצד, דרך מפרט הבנייה המשותף */
  const item = (await catalogRepo.all()).find((i) => i.level === 'floor');
  const customer = await customersRepo.create({ name: 'QA', city: 'ת"א' });
  const project = await projectsRepo.create({
    customerId: customer.id,
    name: 'QA',
    roomKind: 'kitchen',
    walls: [{ lengthMm: 3000, heightMm: 2600 }],
  });
  const wall = (await wallsRepo.listForProject(project.id))[0];
  const unit = await unitsRepo.add(project.id, wall.id, item, 0);
  await unitsRepo.update(unit.id, {
    omit: { top: true },
    glassSides: { start: true },
    exposedDepthMm: 640,
    doorCells: 2,
  });
  const edited = await db.units.get(unit.id);
  const spec = reusableSpec(edited);
  ok2('מפרט הבנייה כולל את "בלי תקרה"', spec.omit?.top === true, JSON.stringify(spec.omit));
  ok2('ואת הזכוכית בצד', spec.glassSides?.start === true);
  ok2('ואת עומק הדופן הזרה', spec.exposedDepthMm === 640);
  ok2('ואת חלוקת התאים', spec.doorCells === 2);

  const templateId = await catalogRepo.saveCustom({
    ...spec,
    rooms: ['kitchen'],
    group: 'base',
    name: 'QA ללא תקרה',
    level: 'floor',
    defaultWidthMm: 600,
    widthOptionsMm: [600],
    defaultHeightMm: 880,
    defaultDepthMm: 580,
    defaultYMm: 0,
  });
  const template = await catalogRepo.get(templateId);
  ok2('התבנית שמרה את "בלי תקרה"', template.omit?.top === true, JSON.stringify(template.omit));
  const again = await unitsRepo.add(project.id, wall.id, template, 1500);
  ok2('וארגז שהונח ממנה חוזר בלי תקרה', again.omit?.top === true, JSON.stringify(again.omit));
  ok2('והזכוכית בצד חוזרת איתו', again.glassSides?.start === true);
  ok2('כל שדה במפרט המשותף מוכר בשני הצדדים', REUSABLE_FIELDS.length > 30, String(REUSABLE_FIELDS.length));

  /* C4 — ייצוא ספרייה נושא את הגוון והלוח שהארגז מפנה אליהם */
  const material = (await materialsRepo.list())[1];
  const finishId = await finishesRepo.save({
    name: 'QA גוון בעלים',
    hex: '#123456',
    prices: { [material.id]: { consumerPrice: 321 } },
  });
  await catalogRepo.saveCustom({ id: templateId, frontFinishId: finishId, frontMaterialId: material.id });
  const pack = await exportCabinets();
  ok2('הייצוא נושא את הגוון', (pack.tables.finishes ?? []).some((f) => f.id === finishId), String((pack.tables.finishes ?? []).length));
  ok2('ואת הלוח', (pack.tables.materials ?? []).some((m) => m.id === material.id));
  ok2('והוא נקרא בחזרה', !('error' in readPack(JSON.stringify(pack))));

  /* מכשיר נקי: מוחקים את הגוון והלוח, ומייבאים — הם חוזרים */
  await db.finishes.delete(finishId);
  await db.materials.delete(material.id);
  const back = await importCabinets(pack, 'merge');
  ok2('הייבוא מחזיר את התלויות', back.deps >= 2, JSON.stringify(back));
  ok2('ואין הפניות פתוחות', back.unresolved === 0, String(back.unresolved));
  ok2('הגוון קיים אחרי הייבוא', !!(await finishesRepo.get(finishId)));

  /* קובץ ישן, בלי תלויות — מדווח על ההפניות שנשארו פתוחות */
  await db.finishes.delete(finishId);
  const oldStyle = { ...pack, format: 1, tables: { catalog: pack.tables.catalog } };
  const legacy = await importCabinets(oldStyle, 'merge');
  ok2('קובץ ישן מדווח על הפניות חסרות', legacy.unresolved > 0, String(legacy.unresolved));

  /* N10 — שחזור ארגז שהמקור שלו נמחק */
  await catalogRepo.remove(templateId);
  ok2('המקור נמחק', (await catalogRepo.get(templateId)) === undefined);
  const orphan = await db.units.get(again.id);
  ok2('והארגז שעל הקיר עדיין מחזיק את המפרט', reusableSpec(orphan).omit?.top === true);
  return res;
});

const all = [...out, ...deep, ...errs.map((e) => 'FAIL ' + e)];
for (const l of all) console.log(l);
const bad = all.filter((l) => l.startsWith('FAIL')).length;
console.log(bad ? `${bad} fail of ${all.length}` : `all ${all.length} pass`);
await browser.close();
process.exit(bad ? 1 : 0);

/* שכבה 99 — ממצאי הביקורת מול בסיס נתונים אמיתי: מלאי, ביטול, ספרייה, הרשאות */
import { chromium } from 'playwright';
import { setup, addUnit } from './mk.mjs';

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 400, height: 840 } });
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + String(e).slice(0, 200)));

await setup(page, { name: 'ביקורת' });
await addUnit(page, 0);
await page.waitForTimeout(900);

const log = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const { db } = await import('/src/db/db.ts' + v);
  const { unitsRepo, projectsRepo } = await import('/src/features/projects/projectsRepo.ts' + v);
  const { settingsRepo, stockRepo } = await import('/src/materials/materialsRepo.ts' + v);
  const { syncConsumption } = await import('/src/materials/consumption.ts' + v);
  const { history } = await import('/src/features/design/history.ts' + v);
  const { catalogRepo } = await import('/src/catalog/catalogRepo.ts' + v);
  const { importLibrary, readBackup } = await import('/src/db/backup.ts' + v);

  const out = [];
  const ok = (name, cond, extra = '') => out.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' | ' + extra : ''}`);
  const sheets = async () => (await stockRepo.all()).reduce((n, r) => n + r.sheets, 0);

  const project = (await db.projects.toArray())[0];
  const wall = (await db.walls.toArray())[0];
  const unit = (await db.units.toArray())[0];

  /* --- 12. שכפול אינו מעתיק סימוני ייצור --- */
  await unitsRepo.update(unit.id, { work: { tracks: { carcass: 'installed', fronts: 'installed', back: 'cut' } } });
  const copy = await unitsRepo.duplicate(unit.id, 1500);
  ok('שכפול מאפס את סימוני הייצור', !copy.work, JSON.stringify(copy.work));
  await unitsRepo.remove(copy.id);

  /* --- 4. ביטול מחזיר את הפלטות למלאי --- */
  await unitsRepo.update(unit.id, { work: { tracks: {} } });
  await syncConsumption(project.id);
  const lines = (await projectsRepo.costing(project.id)).lines;
  for (const l of lines) if (l.finish) await stockRepo.set(l.finish.id, l.material.id, { sheets: 10 });
  const before = await sheets();
  await history.capture(project.id, 'review');
  await unitsRepo.update(unit.id, { work: { tracks: { carcass: 'installed', fronts: 'installed', back: 'cut', panels: 'installed' } } });
  await syncConsumption(project.id);
  const after = await sheets();
  ok('סימון חיתוך מוריד מהמלאי', after < before, `${before} → ${after}`);
  await history.undo(project.id);
  const back = await sheets();
  const rows = await db.consumption.where('projectId').equals(project.id).toArray();
  ok('ביטול מחזיר את הפלטות', back === before, `${after} → ${back}, ציפייה ${before}`);
  ok('ורישומי הצריכה נמחקים', rows.length === 0, `${rows.length} רישומים`);

  /* --- 5. שני פרויקטים במקביל על אותה שורת מלאי --- */
  const twin = await projectsRepo.duplicate(project.id, 'תאום');
  const twinId = typeof twin === 'string' ? twin : twin.id;
  const twinUnit = (await db.units.where('projectId').equals(twinId).toArray())[0];
  const mark = { tracks: { carcass: 'installed', fronts: 'installed', back: 'cut', panels: 'installed' } };
  await unitsRepo.update(unit.id, { work: mark });
  await unitsRepo.update(twinUnit.id, { work: mark });
  const start = await sheets();
  await Promise.all([syncConsumption(project.id), syncConsumption(twinId)]);
  const both = await db.consumption.toArray();
  const taken = both.reduce((n, c) => n + c.sheets, 0);
  ok('ההפחתה במקביל שומרת על המלאי', start - (await sheets()) === taken, `הופחת ${start - (await sheets())}, נרשם ${taken}`);
  await projectsRepo.remove(twinId);
  await unitsRepo.update(unit.id, { work: { tracks: {} } });
  await syncConsumption(project.id);

  /* --- 10. הגב של ארגז חדש מגיע מההגדרות --- */
  await settingsRepo.save({ defaults: { ...(await settingsRepo.get()).defaults, backKind: 'none' } });
  const item = (await catalogRepo.all()).find((i) => !i.backKind && i.level === 'floor');
  const fresh = await unitsRepo.add(project.id, wall.id, item, 2000);
  ok('ארגז חדש מקבל את הגב שנבחר בהגדרות', fresh.backKind === 'none', String(fresh.backKind));
  await unitsRepo.remove(fresh.id);
  await settingsRepo.save({ defaults: { ...(await settingsRepo.get()).defaults, backKind: 'thin' } });

  /* --- 6. תכנון אוטומטי שמפנה לארגזים שאינם בספרייה --- */
  const unitsBefore = await db.units.where('projectId').equals(project.id).count();
  const res = await unitsRepo.applyPlan(project.id, [
    { catalogKey: 'אין-כזה-בכלל', wallId: wall.id, xMm: 0, widthMm: 600 },
  ]);
  const unitsAfter = await db.units.where('projectId').equals(project.id).count();
  ok('הצעה עם פריט חסר נעצרת', res.ok === false, JSON.stringify(res));
  ok('והארגזים שעל הקיר לא נמחקו', unitsAfter === unitsBefore, `${unitsBefore} → ${unitsAfter}`);

  /* --- 9. החלפת ספרייה שורדת רענון --- */
  const mine = { ...(await catalogRepo.all())[0], id: 'my-only-box', name: 'ארגז הנגרייה', isBuiltin: false, sortOrder: 0 };
  const parsed = readBackup(JSON.stringify({ app: 'easycraft', format: 1, kind: 'library', at: Date.now(), tables: { catalog: [mine] } }));
  ok('קובץ ספרייה תקין מתקבל', !('error' in parsed), JSON.stringify(parsed).slice(0, 120));
  await importLibrary(parsed.backup, 'replace');
  ok('אחרי החלפה נשאר ארגז אחד', (await catalogRepo.all()).length === 1, String((await catalogRepo.all()).length));
  return out;
});

/* רענון — כאן נבדק אם הספרייה חוזרת מהזרעים */
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1600);
const after = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const { catalogRepo } = await import('/src/catalog/catalogRepo.ts' + v);
  const { db } = await import('/src/db/db.ts' + v);
  const out = [];
  const ok = (name, cond, extra = '') => out.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' | ' + extra : ''}`);
  const all = await catalogRepo.all();
  ok('הספרייה שהוחלפה שורדת רענון', all.length === 1, `${all.length} פריטים`);
  /* ואפשר להחזיר את ארגזי התקן במפורש */
  const backCount = await catalogRepo.reseed();
  ok('"החזרת ארגזי הספרייה" מחזירה אותם', backCount > 50 && (await catalogRepo.all()).length > 50, `${backCount} חזרו`);
  await db.catalog.clear();
  return out;
});

/* --- 2. שינוי שם המנהל אינו מייצר חשבון שני --- */
const seed = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const { db } = await import('/src/db/db.ts' + v);
  const me = (await db.team.toArray())[0];
  await db.team.update(me.id, { username: 'boss' });
  return (await db.team.count());
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1800);
const teamNow = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const { db } = await import('/src/db/db.ts' + v);
  const { login } = await import('/src/workflow/auth.ts' + v);
  return { count: await db.team.count(), admin: (await login('admin', 'admin2026')).ok };
});

const tail = [];
const ok2 = (name, cond, extra = '') => tail.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' | ' + extra : ''}`);
ok2('שינוי שם המנהל אינו מייצר חשבון שני', teamNow.count === seed, `${seed} → ${teamNow.count}`);
ok2('וסיסמת ברירת המחדל כבר לא נכנסת', teamNow.admin === false, String(teamNow.admin));

/* --- 1. השבתה מנתקת חיבור קיים --- */
await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const { db } = await import('/src/db/db.ts' + v);
  const me = (await db.team.toArray())[0];
  await db.team.update(me.id, { active: false });
});
await page.waitForTimeout(1500);
const kicked = await page.getByLabel('שם משתמש').count();
ok2('השבתה מחזירה מיד למסך הכניסה', kicked === 1, `שדות כניסה: ${kicked}`);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
ok2('וגם אחרי רענון אין חזרה פנימה', (await page.getByLabel('שם משתמש').count()) === 1);

const all = [...log, ...after, ...tail, ...errs.map((e) => 'FAIL ' + e)];
for (const l of all) console.log(l);
const bad = all.filter((l) => l.startsWith('FAIL')).length;
console.log(bad ? `${bad} fail of ${all.length}` : `all ${all.length} pass`);
await browser.close();
process.exit(bad ? 1 : 0);

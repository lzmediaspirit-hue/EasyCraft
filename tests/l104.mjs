/* שכבה 104 — הרשאות ושחרור לייצור: תכנת עם אישור, ייצור לפני מכירה, ושלבים כפולים */
import { chromium } from 'playwright';
import { setup, addUnit } from './mk.mjs';
const SP = new URL('shots/', import.meta.url).pathname;

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage({ viewport: { width: 400, height: 840 } });
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + String(e).slice(0, 200)));
const btn = (re) => page.getByRole('button', { name: re }).first();
const out = [];
const ok = (name, cond, extra = '') => out.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' | ' + extra : ''}`);

await setup(page, { name: 'הרשאות' });
await addUnit(page, 0);
await page.waitForTimeout(900);

/* --- N3 + N8 על מספרים --- */
const pure = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const W = await import('/src/workflow/unitWork.ts' + v);
  const { stagesRepo } = await import('/src/workflow/workflowRepo.ts' + v);
  const { db } = await import('/src/db/db.ts' + v);
  const res = [];
  const ok2 = (name, cond, extra = '') => res.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' | ' + extra : ''}`);

  const unit = (await db.units.toArray())[0];
  const body = W.TRACKS[0];
  const unsold = W.canAdvance(unit, body, 'ready', 'manager', {});
  ok2('אי אפשר לסמן ייצור בפרויקט שלא נמכר', unsold.ok === false, JSON.stringify(unsold));
  ok2('והסיבה נאמרת', unsold.why === 'הפרויקט עוד לא נמכר', String(unsold.why));
  const sold = W.canAdvance(unit, body, 'ready', 'manager', { soldAt: 1 });
  ok2('ואחרי המכירה אפשר', sold.ok === true, JSON.stringify(sold));
  ok2('בלי פרויקט ההתנהגות אינה משתנה', W.canAdvance(unit, body, 'ready', 'manager').ok === true);
  ok2('ותפקיד שאינו רשאי עדיין חסום',
    W.canAdvance(unit, body, 'ready', 'installer', { soldAt: 1 }).ok === false);

  /* N8 — שתי אתחולים במקביל */
  const projectId = (await db.projects.toArray())[0].id;
  await db.stages.where('projectId').equals(projectId).delete();
  await Promise.all([stagesRepo.ensure(projectId), stagesRepo.ensure(projectId)]);
  const rows = await db.stages.where('projectId').equals(projectId).toArray();
  const keys = new Set(rows.map((s) => s.key));
  ok2('אתחול מקבילי יוצר שורה אחת לכל שלב', rows.length === keys.size, `${rows.length} שורות, ${keys.size} שלבים`);
  ok2('ורק אחת פעילה', rows.filter((s) => s.status === 'active').length <= 1,
    rows.map((s) => s.status).join(','));

  /* ותיקון נתונים שכבר נוצרו כפולים */
  const dup = rows[0];
  await db.stages.add({ ...dup, id: crypto.randomUUID(), status: 'waiting' });
  await stagesRepo.ensure(projectId);
  const after = await db.stages.where('projectId').equals(projectId).toArray();
  ok2('וכפילות שכבר נוצרה מנוקה', after.length === keys.size, `${after.length}`);
  ok2('והשורה שהתקדמה היא שנשארה',
    after.find((s) => s.key === dup.key)?.status === dup.status,
    String(after.find((s) => s.key === dup.key)?.status));
  return res;
});

/* --- N2: תכנת עם אישור עורך, ובלי אישור מבקש --- */
await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const { db } = await import('/src/db/db.ts' + v);
  const me = (await db.team.toArray())[0];
  await db.team.update(me.id, { role: 'planner' });
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1800);
await btn(/הרשאות/).click(); await page.waitForTimeout(800);
await btn(/מטבח/).first().click(); await page.waitForTimeout(1400);
const body1 = await page.innerText('body');
ok('תכנת בלי אישור רואה בקשת אישור לעריכה', /בקשת אישור לעריכה/.test(body1),
  JSON.stringify(body1.slice(-260)));
ok('ואין לו הוספת ארגז', !/הוספת ארגז/.test(body1));
await page.screenshot({ path: SP + 'L104-1-planner-ask.png' });

await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const { db } = await import('/src/db/db.ts' + v);
  const p = (await db.projects.toArray())[0];
  await db.projects.update(p.id, { editGrantedAt: Date.now() });
});
await page.waitForTimeout(1400);
const body2 = await page.innerText('body');
ok('תכנת שקיבל אישור מקבל הוספת ארגז', /הוספת ארגז/.test(body2), JSON.stringify(body2.slice(-260)));
await page.screenshot({ path: SP + 'L104-2-planner-edit.png' });

await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const { db } = await import('/src/db/db.ts' + v);
  const p = (await db.projects.toArray())[0];
  await db.projects.update(p.id, { editGrantedAt: undefined });
});
await page.waitForTimeout(1400);
ok('ושלילת האישור סוגרת אותה שוב', !/הוספת ארגז/.test(await page.innerText('body')));

/* נגר נשאר בתהליך בלבד */
await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const { db } = await import('/src/db/db.ts' + v);
  const me = (await db.team.toArray())[0];
  await db.team.update(me.id, { role: 'carpenter' });
});
await page.waitForTimeout(1500);
const body3 = await page.innerText('body');
ok('נגר אינו מקבל כלי עריכה', !/הוספת ארגז|בקשת אישור לעריכה/.test(body3),
  JSON.stringify(body3.slice(-200)));

const all = [...pure, ...out, ...errs.map((e) => 'FAIL ' + e)];
for (const l of all) console.log(l);
const bad = all.filter((l) => l.startsWith('FAIL')).length;
console.log(bad ? `${bad} fail of ${all.length}` : `all ${all.length} pass`);
await browser.close();
process.exit(bad ? 1 : 0);

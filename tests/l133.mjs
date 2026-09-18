import './_exit.mjs';
/*
 * שכבה 133 — מנה 19: מעטפת פתיחה ואזהרות תפעוליות.
 *
 * מה שנבדק כאן:
 *   • דלת ארון סוחפת שטח בחדר, ומי שעומד בו נקוב בשמו.
 *   • דלת נגררת אינה סוחפת דבר.
 *   • מה שאין עליו נתון מדווח כחסר — ולא מנוחש.
 *   • דלת חדר שנפתחת פנימה חוסמת ארון, ודלת נגררת לא.
 *   • ואין גיליון אזהרות ואין אייקון שפותח אותו — הם ירדו.
 */
import { chromium } from 'playwright';
import { BOX, addNamed, setup } from './mk.mjs';

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + String(e).slice(0, 200)));
const out = [];
const ok = (name, cond, extra = '') => {
  const line = `${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' | ' + extra : ''}`;
  out.push(line);
  console.log(line);
};
const btn = (re) => page.getByRole('button', { name: re }).first();
const dlg = () => page.getByRole('dialog').last();

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });

/* ------------------------------------------------------------------ */
/* המודל עצמו — בלי מסך                                                */
/* ------------------------------------------------------------------ */

const model = await page.evaluate(async () => {
  const E = await import('/src/features/design/envelope.ts');
  const wall = {
    id: 'w', projectId: 'p', index: 0, lengthMm: 4000, heightMm: 2600,
    features: [], createdAt: 0, updatedAt: 0,
  };
  const plan = [
    { wall, start: { x: 0, y: 0 }, end: { x: 4000, y: 0 }, headingDeg: 0, depthMm: 600, inward: 1 },
  ];
  const unit = (over = {}) => ({
    id: 'u', projectId: 'p', wallId: 'w', catalogItemId: 'c',
    name: 'ארגז', glyph: 'doors', level: 'floor',
    xMm: 0, yMm: 0, widthMm: 600, heightMm: 880, depthMm: 580,
    doors: 2, createdAt: 0, updatedAt: 0, ...over,
  });

  const of = (over) => E.unitEnvelopes(unit(over), plan);
  const kinds = (over) => of(over).map((e) => e.kind);
  const reach = (over, kind) => of(over).find((e) => e.kind === kind)?.box?.d ?? null;

  /* דלת חדר בקיר */
  const door = (over) => ({
    id: 'f1', kind: 'door', xMm: 1000, yMm: 0, widthMm: 900, heightMm: 2100, ...over,
  });
  const featEnv = (over) => E.featureEnvelope(door(over), plan[0]);

  return {
    twoDoors: kinds({ doors: 2 }),
    twoDoorReach: reach({ doors: 2 }, 'cabinetDoor'),
    oneDoorReach: reach({ doors: 1 }, 'cabinetDoor'),
    slidingKinds: kinds({ doors: 2, opening: 'sliding' }),
    liftKinds: kinds({ doors: 1, opening: 'lift', hingeSide: 'start' }),
    singleMissing: of({ doors: 1 }).find((e) => e.kind === 'cabinetDoor')?.missing ?? null,
    singleKnown: of({ doors: 1, hingeSide: 'start' }).find((e) => e.kind === 'cabinetDoor')?.missing ?? null,
    drawerKinds: kinds({ doors: 0, glyph: 'drawers', drawers: 3 }),
    drawerMissing:
      of({ doors: 0, glyph: 'drawers', drawers: 3 }).find((e) => e.kind === 'drawer')?.missing ?? null,
    drawerKnown:
      of({ doors: 0, glyph: 'drawers', drawers: 3, openClearanceMm: 500 }).find(
        (e) => e.kind === 'drawer',
      )?.missing ?? null,
    ovenMissing: of({ glyph: 'oven', doors: 0 }).find((e) => e.kind === 'appliance')?.missing ?? null,
    ovenReach: of({ glyph: 'oven', doors: 0 }).find((e) => e.kind === 'appliance')?.box?.d ?? null,
    ovenKnown:
      of({ glyph: 'oven', doors: 0, openClearanceMm: 600 }).find((e) => e.kind === 'appliance')
        ?.box?.d ?? null,
    doorNoData: featEnv({}).missing,
    doorSlide: featEnv({ swing: 'slide' }),
    doorOut: featEnv({ swing: 'out' }),
    doorInReach: featEnv({ swing: 'in', hingeSide: 'start' })?.box?.d ?? null,
    doorInMissing: featEnv({ swing: 'in' })?.missing ?? null,
  };
});

ok('a two-door cabinet sweeps a door envelope', model.twoDoors.includes('cabinetDoor'), model.twoDoors.join(','));
ok('each leaf reaches half the cabinet', model.twoDoorReach === 300, String(model.twoDoorReach));
ok('a single leaf reaches the whole width', model.oneDoorReach === 600, String(model.oneDoorReach));
ok('a sliding door sweeps nothing', !model.slidingKinds.includes('cabinetDoor'), model.slidingKinds.join(','));
ok('a lift door needs the air above it', model.liftKinds.includes('lift'), model.liftKinds.join(','));
/*
 * צד הצירים של דלת ארון ירד מהעורך, ואיתו הדיווח שהוא חסר.
 *
 * המעטפת עצמה לא השתנתה: דלת יחידה שלא ידוע לאן היא נפתחת עדיין
 * מכסה את כל החזית — ההערכה הבטוחה. מה שהשתנה הוא שאין על כך
 * הודעה, כי לא נשאר בממשק פקד שעונה עליה.
 */
ok('a single leaf with no hinge side is silent', model.singleMissing === null, String(model.singleMissing));
ok('and stays silent once it is known', model.singleKnown === null, String(model.singleKnown));
ok('while it still covers the whole front', model.oneDoorReach === 600, String(model.oneDoorReach));
ok('drawers pull out into the room', model.drawerKinds.includes('drawer'), model.drawerKinds.join(','));
ok('and the runner length is reported missing', /מסילה/.test(model.drawerMissing ?? ''), String(model.drawerMissing));
ok('until the carpenter enters it', model.drawerKnown === null, String(model.drawerKnown));
/*
 * מרווח הפתיחה של מכשיר אינו "נתון חסר" אלא מידת תקן.
 *
 * עד כאן הוא דווח כחסר, כי איש לא ידע כמה סוחפת דלת תנור. מכשירי
 * בילד־אין מיוצרים לפי תקן אחד, והמידות יושבות ב-`appliances.ts`;
 * מי שמזין מידה משלו מקבל אותה. שאלה שיש לה תשובה אינה מוצגת
 * כחוסר.
 */
ok('an oven uses the standard clearance', model.ovenMissing === null, String(model.ovenMissing));
ok('and it is the standard 600', model.ovenReach === 600, String(model.ovenReach));
ok('and takes the one from the maker', model.ovenKnown === 600, String(model.ovenKnown));
ok('a room door with no data says which data', /נפתחת/.test(model.doorNoData ?? ''), String(model.doorNoData));
ok('a sliding room door sweeps nothing', model.doorSlide === null, String(model.doorSlide));
ok('nor does one opening outwards', model.doorOut === null, String(model.doorOut));
ok('one opening inwards sweeps its own width', model.doorInReach === 900, String(model.doorInReach));
ok('and asks for the hinge side', /צירים/.test(model.doorInMissing ?? ''), String(model.doorInMissing));

/* ------------------------------------------------------------------ */
/* התנגשות אמיתית: דלת החדר מול ארון                                   */
/* ------------------------------------------------------------------ */

const clash = await page.evaluate(async () => {
  const E = await import('/src/features/design/envelope.ts');
  const feature = (swing) => ({
    id: 'f1', kind: 'door', xMm: 0, yMm: 0, widthMm: 900, heightMm: 2100, swing, hingeSide: 'start',
  });
  const wallOf = (swing) => ({
    id: 'w', projectId: 'p', index: 0, lengthMm: 4000, heightMm: 2600,
    features: [feature(swing)], createdAt: 0, updatedAt: 0,
  });
  const planOf = (swing) => [
    { wall: wallOf(swing), start: { x: 0, y: 0 }, end: { x: 4000, y: 0 }, headingDeg: 0, depthMm: 600, inward: 1 },
  ];
  /* ארון על הקיר הניצב, בדיוק בתוך הקשת של הדלת */
  const island = {
    id: 'u1', projectId: 'p', wallId: 'w', catalogItemId: 'c', name: 'ארון גבוה',
    glyph: 'doors', level: 'tall', doors: 2,
    xMm: 0, yMm: 0, widthMm: 600, heightMm: 2200, depthMm: 600,
    free: { xMm: 400, zMm: 700, headingDeg: 0 },
    createdAt: 0, updatedAt: 0,
  };
  const run = (swing) => {
    const plan = planOf(swing);
    return E.envelopeClashes(E.roomEnvelopes([island], plan), [island], plan);
  };
  const doorClash = (swing) =>
    run(swing).filter((c) => c.envelope.kind === 'roomDoor');
  return {
    inward: doorClash('in').map((c) => ({
      owner: E.envelopeOwnerLabel(c.envelope),
      ownerId: c.envelope.ownerId,
      blockerId: c.blockerId,
      blockerName: c.blockerName,
    })),
    slide: doorClash('slide').length,
  };
});

const blockRow = clash.inward[0];
ok('an inward room door reports the cabinet in its way', !!blockRow, JSON.stringify(clash.inward.slice(0, 2)));
ok('and names both objects', !!blockRow && !!blockRow.ownerId && blockRow.blockerId === 'u1',
  blockRow ? `${blockRow.owner} ← ${blockRow.blockerName}` : '');
ok('a sliding room door reports nothing', clash.slide === 0, String(clash.slide));

/* ------------------------------------------------------------------ */
/* במסך                                                                */
/* ------------------------------------------------------------------ */

await setup(page, { name: 'מעטפת בע״מ' });
await page.waitForTimeout(900);
/* ארגז רגיל על הקיר */
await addNamed(page, BOX.doors1);
await page.waitForTimeout(900);

/* ואז נדחף אל מחוץ לקיר, ישר במסד */
await page.evaluate(async () => {
  const { db } = await import('/src/db/db.ts');
  const u = (await db.units.toArray())[0];
  await db.units.update(u.id, { xMm: 9000 });
});
await page.waitForTimeout(900);

/*
 * ומה שירד: אין יותר גיליון בדיקת תכנון ואין אייקון שפותח אותו.
 *
 * הבעלים ביקש שלא יראה שום התראה, ולכן מה שנבדק כאן הוא ההיעדר:
 * ארגז שנדחף אל מחוץ לקיר אינו מעלה שלט. הבדיקה הגאומטרית עצמה
 * לא ירדה — `planResolve` פוסל שמירה כזאת, וזה נבדק ב-l156.
 */
ok('the plan-check button is gone',
  (await page.getByRole('button', { name: /בדיקת התכנון/ }).count()) === 0);
ok('and nothing on screen warns about the overflow',
  !/חורגים מהקיר/.test(await page.innerText('body')), '');

/* והמתג הישן ירד מ"מה מוצג" */
const toggles = await page.evaluate(async () => {
  const V = await import('/src/features/design/viewOptions.ts');
  return V.VIEW_OPTION_LABELS.map((t) => t.key);
});
ok('warnings are no longer a display preference', !toggles.includes('warnings'), toggles.join(','));

ok('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
const bad = out.filter((l) => l.startsWith('FAIL'));
console.log(bad.length ? `\n${bad.length} נפלו` : '\nהכול עבר');
if (bad.length) process.exitCode = 1;
await browser.close();

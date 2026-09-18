import './_exit.mjs';
/*
 * שכבה 153 — יכולת נגזרת מהמבנה, ולא מהשם.
 *
 * כאן ישבו גם אזהרות הייצור — "חסר מידע לייצור", "השם מבטיח נישת
 * תנור" — והן ירדו לבקשת הבעלים. מה שלא ירד הוא הכלל שמאחוריהן,
 * וזה מה שנבדק כאן: שם אינו בונה נישה ואינו הורס אותה, ולכן הוא
 * גם אינו מעניק יכולת. התכנון האוטומטי נשען על זה כשהוא בוחר
 * לאיזה ארגז מכניסים כיור או תנור.
 *
 * ובנוסף: גבהי ההתקנה שאושרו במפורש בספרייה, שלא ישתנו בשקט
 * בייצוא הבא של הכלי שכותב אותה.
 */
import { chromium } from 'playwright';

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + String(e).slice(0, 200)));
const out = [];
const ok = (name, cond, extra = '') => out.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' | ' + extra : ''}`);

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);

const r = await page.evaluate(async () => {
  const v = '?v=' + Date.now();
  const { SHIPPED_LIBRARY } = await import('/src/catalog/shipped.ts' + v);
  const { itemSpec } = await import('/src/catalog/roles.ts' + v);
  const { unitCaps, capsProvide } = await import('/src/catalog/capabilities.ts' + v);
  const { APPLIANCES, applianceInCavity } = await import('/src/catalog/appliances.ts' + v);
  const at = (code) => SHIPPED_LIBRARY.find((i) => i.code === code);
  const provides = (u, cap) => capsProvide(unitCaps(u), cap);

  /* ארגז דלתות רגיל ששמו הוחלף ל"ארון כיור" */
  const renamedToSink = {
    glyph: 'doors', name: 'ארון כיור', doors: 2,
    widthMm: 600, heightMm: 720, depthMm: 580, socleMm: 0, counterMm: 0,
    zones: [{ id: 'z', heightMm: 720, kind: 'shelves', shelves: 1 }],
  };
  /* עמודה שמצהירה על תנור, ואין בה נישה */
  const fakeOven = {
    glyph: 'open', applianceType: 'oven', name: 'עמודת תנור',
    widthMm: 600, heightMm: 2100, depthMm: 580, socleMm: 0,
    zones: [{ id: 'z', heightMm: 2100, kind: 'empty' }],
  };
  /* ואותה עמודה בשם תמים */
  const renamedAway = { ...fakeOven, name: 'עמודה' };

  return {
    renamedIsSink: provides(renamedToSink, 'sink'),
    fakeIsOven: provides(fakeOven, 'oven'),
    renamedAwayIsOven: provides(renamedAway, 'oven'),
    /* ומה שכן בנוי — כן מספק */
    realSink: provides(itemSpec(at('EC-002')), 'sink'),
    /*
     * כיריים אינן נישה אלא חיתוך במשטח, ולכן מגירות מתחתיהן אינן
     * פוסלות: כך בנוי כל ארגז כיריים אמיתי, והמגירה העליונה בו
     * רדודה. הדרישה לחלל פנוי מתחת פסלה את "ארגז כיריים" עצמו.
     */
    hobBox: at('B-137')?.name,
    hobFromDrawers: provides(itemSpec(at('B-137')), 'hob'),
    hobCaps: unitCaps(itemSpec(at('B-137'))),
    /* הכיור כן דורש מקום מתחת — הקערה יורדת לתוך הארון */
    sinkFromDrawers: provides(itemSpec(at('EC-056')), 'sink'),
    /*
     * תנור ומדיח עומדים על הרצפה בגובה הארגזים, ואינם נכנסים
     * לארון. לכן שום ארגז אינו "מארח" אותם — הם מוצבים בעצמם.
     */
    cabinetHostsOven: provides(itemSpec(at('EC-053')), 'oven'),
    cabinetHostsDw: provides(itemSpec(at('EC-053')), 'dishwasher'),
    ovenIsFreestanding: APPLIANCES.oven.freestanding === true,
    dwIsFreestanding: APPLIANCES.dishwasher.freestanding === true,
    /*
     * המקרר עומד בתוך ארגז מקרר, ומידתו נגזרת ממנו: הדרישה היא
     * מינימום ולא מידת תקן, ולכן ארגז מקרר של 170 ס״מ הוא ארגז
     * מקרר לכל דבר.
     */
    fridgeBox: at('B-138')?.name,
    fridgeFromBox: provides(itemSpec(at('B-138')), 'fridge'),
    fridgeInside: applianceInCavity(unitCaps(itemSpec(at('B-138'))).cavities[0] ?? {
      widthMm: 0, heightMm: 0, depthMm: 0,
    }),
    fridgeCavity: unitCaps(itemSpec(at('B-138'))).cavities[0],
    /* ומכשיר שכן נכנס לנישה — מיקרוגל */
    realMicro: provides(itemSpec(at('EC-048')), 'micro'),
    /* ארון תלוי שנוחת על הרצפה הוא באג שנראה מיד */
    onFloor: SHIPPED_LIBRARY.filter((i) => i.level === 'wall' && !i.defaultYMm)
      .map((i) => i.code),
  };
});

ok('שינוי שם ל"ארון כיור" אינו הופך ארגז לארגז כיור', r.renamedIsSink === false);
ok('הצהרה על תנור בלי נישה אינה מספקת תנור', r.fakeIsOven === false);
ok('ושינוי השם בחזרה אינו משנה דבר — המבנה הוא שקובע',
  r.renamedAwayIsOven === r.fakeIsOven);
ok('ארון כיור שבנוי כמו שצריך מספק כיור', r.realSink === true);
ok('ארגז כיריים עם מגירות מספק כיריים — החיתוך במשטח, לא מתחתיו',
  r.hobFromDrawers === true,
  `${r.hobBox}: חיתוך ${r.hobCaps.cutWidthMm}×${r.hobCaps.cutDepthMm}, חלל מתחת ${r.hobCaps.bowlRoom}`);
ok('ואותן מגירות בלי חלל אינן מספקות כיור', r.sinkFromDrawers === false);
ok('תנור ומדיח מוגדרים כמכשיר עומד',
  r.ovenIsFreestanding && r.dwIsFreestanding);
ok('ולכן שום ארגז אינו מארח אותם',
  r.cabinetHostsOven === false && r.cabinetHostsDw === false,
  `${r.cabinetHostsOven} / ${r.cabinetHostsDw}`);
ok('ארגז מקרר מספק מקרר, גם כשאינו במידת התקן', r.fridgeFromBox === true, r.fridgeBox);
ok('והמקרר שבתוכו קטן ממנו', !!r.fridgeCavity &&
  r.fridgeInside.heightMm < r.fridgeCavity.heightMm &&
  r.fridgeInside.widthMm < r.fridgeCavity.widthMm,
  `חלל ${r.fridgeCavity?.widthMm}×${r.fridgeCavity?.heightMm} → מקרר ${r.fridgeInside.widthMm}×${r.fridgeInside.heightMm}`);
ok('ומכשיר שכן נכנס לנישה שלו מסופק', r.realMicro === true);
/*
 * גובה ההתקנה נבדק ככלל ולא בשלושה מספרים כתובים. קודם היו כאן
 * EC-047, EC-075 ו-EC-080 — שלושה שתוקנו ביד אחרי שהגיליון לא
 * נשא עמודת גובה כלל, ואפס בו נקרא "על הרצפה". הספרייה כבר אינה
 * מגיעה מגיליון, והכלל הוא מה שנשאר נכון: ארון תלוי נתלה.
 */
ok('אף ארון תלוי אינו נוחת על הרצפה', r.onFloor.length === 0, r.onFloor.join(','));

/* ------------------------------------------------------------------ */
/* ועל המסך: אין אזהרות בנייה, בשום מקום                              */
/* ------------------------------------------------------------------ */
await page.getByLabel('שם משתמש').waitFor({ state: 'visible', timeout: 15000 });
await page.getByLabel('שם משתמש').fill('admin');
await page.getByLabel('סיסמה').fill('admin2026');
await page.getByRole('button', { name: 'כניסה' }).first().click();
await page.waitForTimeout(1600);
await page.getByRole('button', { name: /ספריית הארגזים/ }).first().click();
await page.waitForTimeout(1200);
await page.getByRole('button', { name: /^מטבח/ }).first().click();
await page.waitForTimeout(1200);

const noise = await page.evaluate(() => {
  const t = document.body.textContent ?? '';
  return {
    gap: (t.match(/חסר מידע לייצור/g) ?? []).length,
    naming: (t.match(/השם מבטיח/g) ?? []).length,
  };
});
ok('אין "חסר מידע לייצור" בספרייה', noise.gap === 0, String(noise.gap));
ok('ואין "השם מבטיח"', noise.naming === 0, String(noise.naming));

ok('בלי שגיאות דף', errs.length === 0, errs.join(' ; '));

console.log(out.join('\n'));
await browser.close();
process.exit(out.some((l) => l.startsWith('FAIL')) ? 1 : 0);

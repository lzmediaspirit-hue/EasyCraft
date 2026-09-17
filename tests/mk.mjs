/** עוזר משותף: כניסה, לקוח, פרויקט עם קיר אחד, וחזרה למסך ההדמיה. */
export async function setup(page, { name = 'בדיקה', walls = 'קיר יחיד' } = {}) {
  const btn = (re) => page.getByRole('button', { name: re }).first();
  const dlg = () => page.getByRole('dialog').last();
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.getByLabel('שם משתמש').fill('admin');
  await page.getByLabel('סיסמה').fill('admin2026');
  await btn('כניסה').click(); await page.waitForTimeout(1400);
  await btn(/לקוח ראשון|לקוח חדש|הוספת לקוח/).click(); await page.waitForTimeout(500);
  await dlg().getByLabel('שם').first().fill(name);
  await dlg().getByLabel(/עיר/).fill('תל אביב');
  await dlg().getByRole('button', { name: /שמירה|הוספה/ }).click(); await page.waitForTimeout(900);
  await btn(new RegExp(name)).click(); await page.waitForTimeout(700);
  await btn(/פרויקט ראשון|פרויקט חדש|הוספת פרויקט/).click(); await page.waitForTimeout(500);
  await dlg().getByRole('button', { name: /^מטבח/ }).click(); await page.waitForTimeout(800);
  await pickWalls(page, walls); await page.waitForTimeout(700);
  await btn(/קיר נקי/).click(); await page.waitForTimeout(700);
  await dlg().getByRole('button', { name: /יצירת הפרויקט/ }).click(); await page.waitForTimeout(1700);
  /* הגוונים נבחרים אחרי היצירה — "גוון לכולם" בסרגל ההדמיה */
  await pickFinishes(page);
}

/**
 * בוחר את פריסת הקירות באשף.
 * האשף מציע שלוש בחירות — קיר יחיד, כמה קירות, חדר מורכב — ובשנייה
 * המספר נבחר מיד אחריה. הבדיקות ממשיכות לבקש "שני קירות".
 */
export async function pickWalls(page, walls) {
  const btn = (re) => page.getByRole('button', { name: re }).first();
  const COUNT = { 'שני קירות': 2, 'שלושה קירות': 3, 'ארבעה קירות': 4 };
  if (typeof walls === 'number' || COUNT[walls]) {
    const n = typeof walls === 'number' ? walls : COUNT[walls];
    await btn(/כמה קירות/).click();
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: `${n} קירות` }).click();
    return;
  }
  if (/ייחודי|מורכב/.test(walls)) return btn(/חדר מורכב/).click();
  await btn(new RegExp(walls)).click();
}

/** בוחר לבן לכל ארבעת החלקים, דרך "גוון לכולם". */
export async function pickFinishes(page) {
  const btn = (re) => page.getByRole('button', { name: re }).first();
  const dlg = () => page.getByRole('dialog').last();
  await btn(/גוון לכולם/).click(); await page.waitForTimeout(800);
  const white = dlg().getByRole('button', { name: 'לבן' });
  for (let i = 0; i < 4; i++) await white.nth(i).click().catch(() => {});
  await page.waitForTimeout(400);
  while (await page.getByRole('dialog').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(250); }
}

export async function addUnit(page, n = 0) {
  const btn = (re) => page.getByRole('button', { name: re }).first();
  const dlg = () => page.getByRole('dialog').last();
  while (await page.getByRole('dialog').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(250); }
  await btn(/הוספת ארגז/).click(); await page.waitForTimeout(700);
  await dlg().locator('div.relative > button').filter({ hasText: /\S/ }).nth(n).click(); await page.waitForTimeout(900);
}

/**
 * הארגז שבדיקה מתכוונת אליו, לפי תפקיד ולא לפי שם.
 *
 * הספרייה נבנית בנגרייה, והשמות שבה משתנים כשהיא מוחלפת. בדיקה
 * שצריכה "ארגז תחתון עם שתי דלתות" מתכוונת לתפקיד הזה, לא למחרוזת
 * מסוימת — ולכן ההתאמה בין תפקיד לשם יושבת כאן, במקום אחד, ולא
 * פזורה בעשרים חבילות.
 *
 * הביטויים הם של ספריית המטבח, והכרטיסייה שבה כל אחד יושב רשומה
 * לצידו: "תחתונים" נפתחת כברירת מחדל, והשאר נבחרות לפניה.
 */
export const BOX = {
  /* תחתונים */
  /* ארגז תחתון רגיל — כשלבדיקה לא משנה איזה */
  any: /^ארון תחתון שתי דלתות/,
  doors1: /^ארון תחתון דלתות — מטבח/,
  doors2: /^ארון תחתון שתי דלתות/,
  drawers: /^ארון תחתון מגירות/,
  sink: /^ארון כיור/,
  hob: /^ארון כיריים עם מגירות/,
  oven: /^ארון תנור תחתון/,
  ovenDrawer: /^ארון תנור עם מגירה/,
  cornerL: /^ארון פינה L/,
  blindEnd: /^פינה מתה ימין/,
  blindStart: /^פינה מתה שמאל/,
  /* מוצר של המערכת, ולא ארגז שנחתך */
  dishwasher: /^מדיח/,
  /* עליונים */
  upper: /^ארון עליון דלתות/,
  upperOpen: /^ארון עליון פתוח/,
  upperLift: /^ארון עליון קלפה/,
  /* עמודות */
  tall: /^עמודת מזווה מדפים/,
  fridge: /^מקרר/,
};

/** הכרטיסייה שבה יושב כל ארגז, למי שצריך לעבור אליה קודם. */
export const TAB = { upper: 'עליונים', tall: 'עמודות', island: 'איים', shelf: 'מדפים' };

/** ארגזים שאינם במטבח — עם החדר שצריך לעבור אליו כדי להגיע אליהם. */
export const OTHER_ROOM = {
  /* זכוכית אינה במטבח: ויטרינה ותצוגה הן של הסלון */
  glassUpper: { box: /^ארון תצוגה עליון/, room: /^סלון/, tab: TAB.upper },
  glassTall: { box: /^ויטרינה גבוהה/, room: /^סלון/, tab: TAB.tall },
};

/**
 * מוסיף ארגז מהספרייה לפי שם, ולא לפי מקום ברשימה.
 *
 * הספרייה היא של הנגרייה ולא רשימה קבועה, ולכן "הארגז השני" אינו
 * אותו ארגז בכל ספרייה. בדיקה שצריכה ארגז דלתות מבקשת ארגז דלתות.
 *
 * הספרייה נפתחת ישר בחדר של הפרויקט: כרטיסייה אחרת נבחרת בשמה,
 * וחדר אחר — דרך "לשלב הקודם", שחוזר לתפריט החדרים.
 *
 * `edit` משאיר את עורך הארגז פתוח; ברירת המחדל סוגרת אותו, כי רוב
 * הבדיקות רוצות את הארגז על הקיר ולא את המסך שמעליו.
 */
export async function addBox(page, box, { tab, room, edit = false } = {}) {
  const dlg = () => page.getByRole('dialog').last();
  while (await page.getByRole('dialog').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(250); }
  await page.getByRole('button', { name: /הוספת ארגז/ }).first().click();
  await page.waitForTimeout(700);
  if (room) {
    const back = dlg().getByRole('button', { name: 'לשלב הקודם' });
    if (await back.count()) { await back.first().click(); await page.waitForTimeout(500); }
    await dlg().getByRole('button', { name: room }).first().click();
    await page.waitForTimeout(600);
  }
  if (tab) {
    await dlg().getByRole('button', { name: tab, exact: true }).click();
    await page.waitForTimeout(500);
  }
  await dlg().getByRole('button', { name: box }).first().click();
  await page.waitForTimeout(900);
  if (edit) return;
  await page.getByRole('button', { name: 'סיום עריכה' }).first().click().catch(() => {});
  await page.waitForTimeout(400);
}

/** מוסיף ארגז ומשאיר את העורך פתוח — מה שרוב הבדיקות הוותיקות מצפות לו. */
export function addNamed(page, box) {
  return addBox(page, box, { edit: true });
}

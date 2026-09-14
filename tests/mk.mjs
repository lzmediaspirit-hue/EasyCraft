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

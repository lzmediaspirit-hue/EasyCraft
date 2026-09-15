import { chromium } from 'playwright';
import { setup, addNamed } from './mk.mjs';
const SP = new URL('shots/', import.meta.url).pathname;
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await b.newPage({ viewport: { width: 400, height: 840 }, deviceScaleFactor: 2 });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && errs.push(m.text()));
const full = (n) => page.screenshot({ path: `${SP}/L28-${n}.png`, fullPage: true });
const btn = (re) => page.getByRole('button', { name: re }).first();
const dlg = () => page.getByRole('dialog').last();
const ok = (l, c, e = '') => console.log(`${c ? 'PASS' : 'FAIL'}  ${l}${e ? ' — ' + e : ''}`);
const clear = async () => { while (await page.getByRole('dialog').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(250); } };
const fills = async () => (await page.locator('g[data-unit-id] rect').evaluateAll((e) => e.map((x) => x.getAttribute('fill')))).filter(Boolean);

await setup(page, { name: 'מסלולים בע״מ' });
await addNamed(page, /^ארגז דלת אחת/);
await page.getByRole('button', { name: 'סיום עריכה' }).first().click(); await page.waitForTimeout(300);
await addNamed(page, /^ארגז שתי דלתות/);
await page.getByRole('button', { name: 'סיום עריכה' }).first().click(); await page.waitForTimeout(300);
await btn(/^חישוב/).click(); await page.waitForTimeout(1600);
await dlg().getByRole('button', { name: /מכירה והתחלת עבודה/ }).click(); await page.waitForTimeout(900);
await dlg().getByRole('button', { name: /סימון כנמכר/ }).click(); await page.waitForTimeout(1200);
await clear();
await page.getByRole('button', { name: /^תכנון$/ }).first().click(); await page.waitForTimeout(700);

/* --- מסלולים --- */
await page.locator('g[data-unit-id]').first().click(); await page.waitForTimeout(700);
const w = await dlg().innerText();
ok('tracks listed', w.includes('גוף') && w.includes('גב') && w.includes('חזיתות'), w.slice(0, 120).replace(/\n/g, ' / '));
await full('1-tracks');
/* דילוג אסור */
const edged = dlg().getByRole('button', { name: 'קנטים' }).first();
ok('cannot skip to edging', await edged.isDisabled());
await dlg().getByRole('button', { name: 'מוכן לחיתוך' }).first().click(); await page.waitForTimeout(400);
await dlg().getByRole('button', { name: 'נחתך' }).first().click(); await page.waitForTimeout(400);
ok('edging opens after cutting', !(await dlg().getByRole('button', { name: 'קנטים' }).first().isDisabled()));
await dlg().getByRole('button', { name: 'קנטים' }).first().click(); await page.waitForTimeout(400);
await full('2-chain');
await clear();
ok('cabinet turns orange', (await fills()).includes('#fed7aa'), (await fills()).join(','));

/* --- התקנה לא הופכת לירוק --- */
await page.locator('g[data-unit-id]').first().click(); await page.waitForTimeout(600);
await dlg().getByRole('button', { name: 'הורכב' }).first().click(); await page.waitForTimeout(300);
await dlg().getByRole('button', { name: 'הותקן' }).first().click(); await page.waitForTimeout(400);
await full('3-installed');
await clear();
const f2 = await fills();
ok('installed but not complete is not green', !f2.includes('#d1fae5'), f2.join(','));
ok('check mark drawn', await page.locator('path[stroke="#059669"]').count() >= 1);

/* --- סימון מהיר --- */
await btn(/סימון מהיר/).click(); await page.waitForTimeout(700);
const bulk = await dlg().innerText();
ok('bulk sheet lists track+stage', bulk.includes('מוכן לחיתוך'), bulk.split('\n').slice(0, 4).join(' / '));
await full('4-bulk');
await dlg().getByRole('button', { name: /חזיתות — מוכן לחיתוך/ }).first().click(); await page.waitForTimeout(900);
await page.locator('g[data-unit-id]').last().click(); await page.waitForTimeout(600);
ok('bulk applied to the other cabinet', (await dlg().innerText()).includes('חזיתות: מוכן לחיתוך'), (await dlg().innerText()).slice(0, 100).replace(/\n/g, ' / '));
await full('5-after-bulk');

console.log(errs.length ? 'ERRORS: ' + errs.join(' | ') : 'no console errors');
await b.close();

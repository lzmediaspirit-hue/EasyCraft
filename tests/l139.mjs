import './_exit.mjs';
/*
 * שכבה 139 — שולחן עבודה במסך רחב.
 *
 * בנייד הספרייה היא גיליון שנפתח ונסגר, והמאפיינים לוח שעולה
 * מלמטה. במחשב יש מקום לשלושתם, וכל פתיחה וסגירה היא עבודה מיותרת:
 * הספרייה בהתחלה של השורה, הקיר באמצע, המאפיינים בסוף.
 */
import { chromium } from 'playwright';
import { BOX, addNamed, setup } from './mk.mjs';

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + String(e).slice(0, 200)));
const out = [];
const ok = (name, cond, extra = '') => out.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' | ' + extra : ''}`);

/** המלבנים של שלושת האזורים, או null למי שאינו על המסך */
const boxes = () =>
  page.evaluate(() => {
    const at = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return r.width === 0 && r.height === 0 ? null : { x: Math.round(r.x), w: Math.round(r.width) };
    };
    return {
      library: at('.desktop-library'),
      canvas: at('.planner-canvas'),
      props: at('.planner-properties'),
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });

await setup(page, { name: 'שולחן בע״מ' });
await addNamed(page, BOX.doors1);
await page.waitForTimeout(900);

const wide = await boxes();
ok('הספרייה על המסך ברוחב 1440', !!wide.library, JSON.stringify(wide.library));
ok('והיא ברוחב 280', wide.library?.w === 280, String(wide.library?.w));
ok('לוח המאפיינים ברוחב 340', wide.props?.w === 340, String(wide.props?.w));
ok('והקיר מקבל את מה שנשאר', (wide.canvas?.w ?? 0) > 600, String(wide.canvas?.w));
ok('אין גלילה לרוחב', !wide.overflow);

/*
 * ב-RTL הספרייה בתחילת השורה — כלומר בצד ימין, שהוא ה-x הגדול —
 * והמאפיינים בסופה, בצד שמאל.
 */
ok('הספרייה בתחילת השורה והמאפיינים בסופה',
  (wide.library?.x ?? 0) > (wide.canvas?.x ?? 0) && (wide.canvas?.x ?? 0) > (wide.props?.x ?? 0),
  JSON.stringify([wide.library?.x, wide.canvas?.x, wide.props?.x]));

/* הספרייה מוסיפה ארגז ישירות, בלי גיליון */
const before = await page.locator('svg g[data-unit-id]').count();
await page.getByRole('button', { name: /^הוספת ארון תחתון שתי דלתות/ }).first().click();
await page.waitForTimeout(1200);
ok('לחיצה בספרייה מניחה ארגז על הקיר',
  (await page.locator('svg g[data-unit-id]').count()) === before + 1);
ok('ואין גיליון שנפתח', (await page.getByRole('dialog').count()) === 0);

/* --- 1024: הספרייה מתקפלת, המאפיינים נשארים --- */
await page.setViewportSize({ width: 1024, height: 800 });
await page.waitForTimeout(600);
const mid = await boxes();
ok('ב-1024 הספרייה מתקפלת', mid.library === null);
ok('והמאפיינים עדיין עמודה', mid.props?.w === 340, String(mid.props?.w));
ok('ואין גלילה לרוחב', !mid.overflow);

/* --- נייד: הכול כמו שהיה --- */
await page.setViewportSize({ width: 420, height: 900 });
await page.waitForTimeout(600);
const small = await boxes();
ok('בנייד אין ספרייה קבועה', small.library === null);
/* `display: contents` — העטיפה קיימת ב-DOM ואינה קיימת בפריסה */
ok('והמאפיינים אינם עמודה אלא כמו שהיו', small.props === null, JSON.stringify(small.props));
ok('והלוח עצמו עדיין שם', (await page.getByRole('separator', { name: 'גובה לוח העריכה' }).count()) === 1);
ok('ואין גלילה לרוחב', !small.overflow);

await browser.close();
for (const e of errs) out.push('FAIL ' + e);
console.log(out.join('\n'));
const fail = out.filter((l) => l.startsWith('FAIL')).length;
console.log(`${out.length - fail} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);

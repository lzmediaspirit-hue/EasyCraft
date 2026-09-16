/*
 * שורת כישלון היא גם קוד יציאה.
 *
 * חבילה שהדפיסה FAIL וסיימה ב-0 נראית תקינה לכל מי שאינו קורא את
 * הפלט: למריץ אוטומטי, ל-CI, ולכל `&&` בשורת פקודה. הספירה
 * הטקסטואלית שהמריץ עשה עבדה — עד שחבילה נפלה לפני ההשוואה
 * הראשונה שלה, לא הדפיסה כלום, ודווחה "ok".
 *
 * כאן זה נסגר במקום אחד: הדפסה של שורת כישלון, בכל אחת מהצורות
 * שהחבילות משתמשות בהן, מסמנת את התהליך ככושל. מייבאים שורה אחת
 * ואין מה לזכור.
 */

/** הצורות שבהן חבילה מדווחת על כישלון. "0 fail" אינו כישלון. */
const BAD = [/^FAIL\b/, /^PAGEERROR\b/, /\b[1-9]\d* fail\b/, /\b[1-9]\d* wrong of\b/, /\b[1-9]\d* בעיות\b/, /\b[1-9]\d* נפלו\b/];

const say = console.log;
console.log = (...args) => {
  const line = args.map((a) => (typeof a === 'string' ? a : '')).join(' ').trimStart();
  if (BAD.some((re) => re.test(line))) process.exitCode = 1;
  say(...args);
};

/* דף שזרק שגיאה הוא כישלון גם כשאיש לא בדק אותו */
process.on('unhandledRejection', (e) => {
  say('PAGEERROR unhandledRejection: ' + String(e).slice(0, 300));
  process.exit(1);
});

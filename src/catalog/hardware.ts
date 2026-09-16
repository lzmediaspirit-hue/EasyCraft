import type { Hardware, HardwareSpec, Settings } from '../db/types';

/**
 * הפרזול של הנגרייה.
 *
 * שתי שורות מגיעות עם האפליקציה, בשמות שנמסרו ולא בשמות שהומצאו:
 * "מנגנון מיקרו" ו"מנגנון מגירות לפינה מתה". אין להן ספק, דגם,
 * מידת התקנה או מרווח פתיחה — אלה נתוני יצרן, והמצאה שלהם גרועה
 * מחוסר: נגר שיקבל מספר שאיש לא בדק יזמין לפיו.
 *
 * מה שחסר נאמר במפורש על המסך, ולא מוצג כתכנון תקין.
 */
export const SHIPPED_HARDWARE: HardwareSpec[] = [
  {
    id: 'hw-micro',
    name: 'מנגנון מיקרו',
    unit: 'יח׳',
    note: 'חסרים נתוני התאמה: ספק, דגם, מידת התקנה ומרווח פתיחה.',
  },
  {
    id: 'hw-blind-corner',
    name: 'מנגנון מגירות לפינה מתה',
    unit: 'סט',
    note: 'חסרים נתוני התאמה: ספק, דגם, מידת התקנה ומרווח פתיחה.',
  },
];

/** רשימת הפרזול שבוחרים ממנה: של העסק, ואם אין — זו שמגיעה עם האפליקציה. */
export function hardwareSpecs(settings?: Pick<Settings, 'hardware'>): HardwareSpec[] {
  return settings?.hardware?.length ? settings.hardware : SHIPPED_HARDWARE;
}

/**
 * שורת פרזול חדשה לארגז, מתוך תבנית.
 *
 * המחיר מועתק ואינו מקושר: עדכון מחיר ברשימת העסק אינו משנה הצעה
 * שכבר יצאה, בדיוק כמו ארגז שהונח על קיר ושומר את מידותיו בעצמו.
 */
export function fromSpec(spec: HardwareSpec, qty = 1): Hardware {
  return {
    id: crypto.randomUUID(),
    specId: spec.id,
    name: spec.name,
    supplier: spec.supplier,
    model: spec.model,
    qty,
    unit: spec.unit,
    factoryPrice: spec.factoryPrice,
    consumerPrice: spec.consumerPrice,
    currency: spec.currency,
    replaces: spec.replaces,
    note: spec.note,
  };
}

/**
 * מה חסר בשורה כדי שאפשר יהיה להזמין לפיה.
 *
 * מחיר אפס שנקבע בכוונה אינו מחיר חסר, ולכן הבדיקה היא על
 * `undefined` ולא על אפס — פרזול שהנגר מקבל בחינם מהספק הוא
 * מקרה אמיתי, והוא אינו "לא הוזן".
 */
export function missingFacts(row: Pick<Hardware, 'supplier' | 'model' | 'consumerPrice'>): string[] {
  const out: string[] = [];
  if (!row.supplier) out.push('ספק');
  if (!row.model) out.push('דגם');
  if (row.consumerPrice === undefined) out.push('מחיר');
  return out;
}

/** מה שהפרזול של הארגז מוסיף למחיר ללקוח. */
export function hardwareTotal(rows: Hardware[] | undefined, who: 'factory' | 'consumer'): number {
  return (rows ?? []).reduce((n, r) => {
    const price = who === 'factory' ? r.factoryPrice : r.consumerPrice;
    return n + (price ?? 0) * r.qty;
  }, 0);
}

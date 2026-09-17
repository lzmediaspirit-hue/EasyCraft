import { capsProvide, unitCaps, CAPABILITY_LABELS, type CapSource, type Capability } from './capabilities';
import { applianceOf } from './appliances';
import { glyphDef } from './glyphList';
import type { CatalogItem } from '../db/types';

/*
 * יכולת נדרשת: מה שאי אפשר להחליף בארגז דומה.
 *
 * זו ידיעה על הקטלוג ולא על התכנון, ולכן היא יושבת כאן: גם
 * המתכנן האוטומטי שואל אותה ("האם הארגז הזה ממלא את התפקיד"),
 * וגם כללי הבנייה ("האם התבנית מקיימת את מה שהשם מבטיח").
 */

/**
 * תפקיד שדורש יכולת פיזית, ולא רק קטגוריה ומפלס.
 *
 * ארגז כיור אינו ארגז דלתות עם שם אחר: יש בו חלל פנוי מתחת
 * למשטח, ויש משטח שאפשר לחתוך בו. ארון תנור אינו ארון מגירות עם
 * שם אחר: יש בו נישה במידות התקן של תנור.
 *
 * וזה בדיוק מה שהשתנה כאן. עד כה היכולת נקבעה מהאיור ומהשם:
 * שינוי שם של ארגז דלתות ל״כיור״ הספיק כדי שיעבור כארגז כיור,
 * ואייקון תנור לבדו סיפק גם תנור וגם מיקרוגל. אבל הבעלים בונה
 * ארגזים בעורך הדו־ממדי, והתכנון צריך להבין את מה שנבנה ולא לנחש
 * לפי השם. לכן התשובה נגזרת מהמבנה — ראה `capabilities.ts` — והשם
 * והאיור נשארים מה שהם: הצעה בעורך, לא הוכחה.
 */
export interface RoleNeed {
  /** מפתח היכולת המבנית שנדרשת */
  cap: Capability;
  /** איך קוראים לזה למשתמש */
  label: string;
  /** מילים בשם שמצהירות על התפקיד — לבדיקה, לא להוכחה */
  words: string[];
}

function need(cap: Capability, words: string[]): RoleNeed {
  return { cap, label: CAPABILITY_LABELS[cap], words };
}

export const ROLE_NEEDS: Record<string, RoleNeed> = {
  sink: need('sink', ['כיור']),
  hob: need('hob', ['כיריים', 'כיריה']),
  oven: need('oven', ['תנור']),
  ovenMicro: need('ovenMicro', ['תנור ומיקרוגל']),
  fridge: need('fridge', ['מקרר']),
  dishwasher: need('dishwasher', ['מדיח']),
  hood: need('hood', ['אדים', 'קולט']),
  micro: need('micro', ['מיקרוגל']),
};

/** לאיזה תפקיד כל מפתח בהצעה שייך. מפתח שאינו כאן הוא ארגז רגיל. */
export const ROLE_OF_KEY: Record<string, RoleNeed> = {
  'k-base-sink': ROLE_NEEDS.sink,
  'k-base-hob': ROLE_NEEDS.hob,
  'k-base-dw': ROLE_NEEDS.dishwasher,
  'k-tall-oven': ROLE_NEEDS.oven,
  'k-tall-ovenmicro': ROLE_NEEDS.ovenMicro,
  'k-tall-fridge': ROLE_NEEDS.fridge,
  'k-up-hood': ROLE_NEEDS.hood,
  'k-up-micro': ROLE_NEEDS.micro,
};

/** המפרט של פריט ספרייה, במידות ברירת המחדל שלו. */
export function itemSpec(item: CatalogItem): CapSource {
  return {
    ...item,
    widthMm: item.defaultWidthMm,
    heightMm: item.defaultHeightMm,
    depthMm: item.defaultDepthMm,
  };
}

/**
 * האם הארגז הזה, כפי שנבנה, ממלא את התפקיד.
 *
 * מכשיר עצמאי הוא היוצא מן הכלל: מקרר *הוא* המקרר, ואין צורך
 * שיהיה בו חלל שמכיל מקרר.
 */
export function roleCapable(item: CatalogItem, role: RoleNeed): boolean {
  const spec = itemSpec(item);
  if (glyphDef(item.glyph).standalone) return applianceOf(spec)?.type === role.cap;
  if (spec.applianceType === role.cap) return true;
  return capsProvide(unitCaps(spec), role.cap);
}

/**
 * התפקיד שהשם מבטיח, אם יש כזה.
 *
 * זו בדיקה על הטקסט בלבד, והיא משמשת לשני דברים: להשוות בין מה
 * שנכתב לבין מה שנבנה, וכדי שתפקיד מילוי כללי לא ייקח ארגז ששמו
 * מבטיח שירות. היא לעולם אינה מקנה יכולת.
 */
export function promisedRole(name: string): RoleNeed | undefined {
  return Object.values(ROLE_NEEDS).find((role) => role.words.some((w) => name.includes(w)));
}

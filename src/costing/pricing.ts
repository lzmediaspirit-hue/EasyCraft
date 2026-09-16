import type { PlacedUnit, PricingMode, Project } from '../db/types';
import type { ProjectCosting } from './boards';

export interface Quote {
  mode: PricingMode;
  /**
   * מה שהלקוח משלם בפועל, כולל מע"מ.
   *
   * זה המספר היחיד שנאמר ללקוח, שממנו נבנים התשלומים ושמולו נמדדת
   * היתרה. קודם הוא היה לפני מע"מ בשיטת החומרים ואחריו בשאר, ולכן
   * מסך החומרים הראה "לתשלום 770" בזמן שהמכירה יצרה תשלום של 700.
   */
  amount: number;
  /** הפירוק שלו, כדי שיהיה ברור מאיפה הגיע */
  beforeVat: number;
  vatAmount: number;
  vatPct: number;
  /** במה הוא נמדד — למשל "12.4 מ״ר חזית" */
  basis: string;
  /** מה החישוב הפנימי אומר, כדי לראות רווח מול הצעה. גם הוא כולל מע"מ */
  materialsAmount: number;
}


export const PRICING_LABEL: Record<PricingMode, string> = {
  materials: 'לפי חומרים',
  perUnit: 'לפי ארגזים',
  perMeter: 'לפי מטר רץ',
  manual: 'מחיר קבוע',
};

/** שטח החזית של ארגז במ"ר — הגודל שהלקוח באמת רואה. */
function unitFrontM2(u: PlacedUnit): number {
  return (u.widthMm / 1000) * (u.heightMm / 1000);
}

/** מטר רץ של קיר שהארונות התחתונים תופסים. */
function runningMeters(units: PlacedUnit[]): number {
  return units.filter((u) => u.level !== 'wall').reduce((n, u) => n + u.widthMm, 0) / 1000;
}

/**
 * המחיר שהלקוח משלם.
 *
 * חישוב החומרים הוא העלות שהאפליקציה יודעת לגזור, אבל נגר מוכר
 * בשיטה שלו — למטר רץ במטבח, לארגז בארון, או במספר שסוכם בעל פה.
 * לכן כל שיטה מחזירה גם את המחיר וגם את הבסיס שלו, וגם את חישוב
 * החומרים לצידו — כדי שאפשר יהיה לראות אם ההצעה מכסה את העלות.
 */
export function projectQuote(
  project: Project,
  units: PlacedUnit[],
  costing: ProjectCosting | undefined,
): Quote {
  const vatPct = costing?.vatPct ?? 0;
  const materialsAmount = costing?.consumerWithVat ?? 0;
  const mode = project.pricingMode ?? 'materials';

  /**
   * מחיר שנגר הקליד ביד.
   *
   * המספר הזה הוא מה שנאמר ללקוח, ולכן העסק קובע אם הוא כבר כולל
   * מע"מ. ברירת המחדל היא שכן — וזו גם ההתנהגות שהייתה עד שהשאלה
   * נשאלה, כך שמחיר שכבר נקבע לפרויקט אינו משתנה מתחת לידיים.
   */
  const typed = (value: number, basis: string): Quote => {
    const includes = project.priceIncludesVat ?? true;
    const amount = Math.round(includes ? value : value * (1 + vatPct / 100));
    const beforeVat = Math.round(includes ? value / (1 + vatPct / 100) : value);
    return { mode, amount, beforeVat, vatAmount: amount - beforeVat, vatPct, basis, materialsAmount };
  };

  if (mode === 'manual') {
    return typed(project.manualPrice ?? 0, 'מחיר שנקבע ידנית');
  }

  if (mode === 'perUnit') {
    const rate = project.perUnitRate ?? 0;
    const m2 = units.reduce((n, u) => n + unitFrontM2(u), 0);
    return typed(m2 * rate, `${m2.toFixed(2)} מ״ר חזית · ${rate}₪ למ״ר`);
  }

  if (mode === 'perMeter') {
    const rate = project.perMeterRate ?? 0;
    const m = runningMeters(units);
    return typed(m * rate, `${m.toFixed(2)} מ׳ רץ · ${rate}₪ למטר`);
  }

  /* חישוב החומרים כבר יודע מה לפני מע"מ ומה אחריו — אין מה לנחש */
  return {
    mode,
    amount: materialsAmount,
    beforeVat: costing?.consumerTotal ?? 0,
    vatAmount: costing?.vatAmount ?? 0,
    vatPct,
    basis: 'חישוב פלטות ואביזרים',
    materialsAmount,
  };
}


/**
 * כמה כבר שולם וכמה נשאר.
 *
 * החוב נמדד מול מחיר המכירה ולא מול פריסת התשלומים: פרויקט שנמכר
 * ב-1,000 בלי שנבנתה לו פריסה הראה "נותר 0", כאילו הלקוח אינו חייב
 * כלום. הפריסה היא לוח זמנים לגבייה, לא ההגדרה של החוב.
 */
export function paymentStatus(
  project: Project,
  /** מחיר המכירה, כשהוא ידוע. בלעדיו נמדד רק מה שנפרס */
  saleAmount?: number,
): {
  /** מה שהלקוח חייב בסך הכול */
  total: number;
  /** מה שנפרס לתשלומים — יכול להיות פחות מהחוב */
  scheduled: number;
  paid: number;
  due: number;
  fullyPaid: boolean;
} {
  const list = project.payments ?? [];
  const scheduled = list.reduce((n, p) => n + p.amount, 0);
  const paid = list.filter((p) => p.paidAt).reduce((n, p) => n + p.amount, 0);
  const total = project.soldAt ? Math.max(saleAmount ?? 0, scheduled) : scheduled;
  return { total, scheduled, paid, due: total - paid, fullyPaid: total > 0 && paid >= total };
}


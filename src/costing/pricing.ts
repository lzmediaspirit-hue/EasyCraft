import type { PlacedUnit, PricingMode, Project } from '../db/types';
import type { ProjectCosting } from './boards';

export interface Quote {
  mode: PricingMode;
  /** המחיר שהלקוח משלם, בשקלים */
  amount: number;
  /** במה הוא נמדד — למשל "12.4 מ״ר חזית" */
  basis: string;
  /** מה החישוב הפנימי אומר, כדי לראות רווח מול הצעה */
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
  const materialsAmount = costing?.consumerTotal ?? 0;
  const mode = project.pricingMode ?? 'materials';

  if (mode === 'manual') {
    return {
      mode,
      amount: project.manualPrice ?? 0,
      basis: 'מחיר שנקבע ידנית',
      materialsAmount,
    };
  }

  if (mode === 'perUnit') {
    const rate = project.perUnitRate ?? 0;
    const m2 = units.reduce((n, u) => n + unitFrontM2(u), 0);
    return {
      mode,
      amount: Math.round(m2 * rate),
      basis: `${m2.toFixed(2)} מ״ר חזית · ${rate}₪ למ״ר`,
      materialsAmount,
    };
  }

  if (mode === 'perMeter') {
    const rate = project.perMeterRate ?? 0;
    const m = runningMeters(units);
    return {
      mode,
      amount: Math.round(m * rate),
      basis: `${m.toFixed(2)} מ׳ רץ · ${rate}₪ למטר`,
      materialsAmount,
    };
  }

  return { mode, amount: materialsAmount, basis: 'חישוב פלטות ואביזרים', materialsAmount };
}

/** כמה כבר שולם וכמה נשאר. */
export function paymentStatus(project: Project): {
  total: number;
  paid: number;
  due: number;
  fullyPaid: boolean;
} {
  const list = project.payments ?? [];
  const total = list.reduce((n, p) => n + p.amount, 0);
  const paid = list.filter((p) => p.paidAt).reduce((n, p) => n + p.amount, 0);
  return { total, paid, due: total - paid, fullyPaid: list.length > 0 && paid >= total };
}

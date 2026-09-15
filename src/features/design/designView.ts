import { useCallback, useState } from 'react';
import type { MeasureAxis } from './WallElevation';
import type { RulerAxis } from './wallRuler';

/**
 * איך מסתכלים על הקיר.
 *
 * שבעה מצבים שכולם עונים על שאלה אחת — מה רואים עכשיו — ישבו
 * כשבעה `useState` נפרדים בתוך המסך, ולצדם אותה שלישיית איפוס
 * שהועתקה לכל מקום שהחליף מצב. כאן הם דבר אחד עם שם.
 *
 * מה שאינו כאן במכוון: הקיר שנבחר והארגז שנבחר. אלה לא "איך
 * מסתכלים" אלא "על מה עובדים", והם שייכים למסך.
 */
export interface DesignView {
  /** מבט תלת־ממדי על החדר, במקום ציור חזית שטוח */
  iso: boolean;
  /** חזיתות מוסתרות — רואים את הגוף והמדפים */
  inside: boolean;
  /** מידות על כל הארגזים, בציר שנבחר */
  measure: MeasureAxis | null;
  /** שני קצוות שנבחרו למדידת המרווח ביניהם */
  rulerPair: string[] | null;
  /** הציר שהסרגל מודד בו */
  rulerAxis: RulerAxis;
  /**
   * ההצמדה פעילה.
   *
   * כבויה = הארגז נוחת בדיוק במקום שהאצבע לקחה אותו, מעוגל
   * לסנטימטר שלם. זה המילוט: כשההצמדה מושכת למקום שאינו הנכון —
   * מרווח מכוון בין שני ארגזים, ארגז שצריך לעמוד קצת בחוץ — אין
   * במגע שום מקש שאפשר להחזיק, ולכן זה מתג ולא צירוף מקשים.
   */
  snap: boolean;
  /** מחווני הקיר מתחת להדמיה */
  statsOpen: boolean;
  /** שורת לשוניות הקירות */
  wallsOpen: boolean;
  /**
   * סרגלי הכלים שמעל ההדמיה.
   *
   * שלוש שורות כפתורים תופסות שליש מסך בטלפון. מי שמסדר ארגזים
   * צריך אותן; מי שרק מסתכל על הקיר — לא, וכשהוא מראה אותו ללקוח
   * הן רק רעש.
   */
  toolsOpen: boolean;
  /**
   * העליונים יורדים מהתמונה.
   *
   * זו התנועה שנגר עושה ביד על שרטוט: מרים את השורה העליונה כדי
   * לראות מה קורה מתחתיה. היא שייכת לרגע ההסתכלות ולא לפרויקט,
   * ולכן היא כאן ולא בשדה של הארגז.
   */
  /** המחוונים סופרים את החדר כולו ולא את הקיר שעובדים עליו */
  roomStats: boolean;
}

const INITIAL: DesignView = {
  iso: false,
  inside: false,
  measure: null,
  rulerPair: null,
  rulerAxis: 'w',
  snap: true,
  /* הנתונים מתחילים סגורים: מי שפותח הדמיה בא לראות את הקיר */
  statsOpen: false,
  wallsOpen: true,
  toolsOpen: true,
  roomStats: false,
};

/**
 * ארגז שאינו מצויר עכשיו.
 *
 * סיבה אחת, ומקום אחד שיודע עליה: הנגר הסתיר אותו בעצמו. שני
 * הציורים והמבט מלמעלה שואלים כאן ולא כל אחד לחוד, כדי שלא ייווצר
 * מצב שארגז נעלם במבט אחד ונשאר באחר.
 *
 * זו הסתכלות ולא מחיקה: הארגז ממשיך לתפוס מקום על הקיר, לחסום
 * גרירה ולהיספר בחומרים, במחיר ובניסור.
 */
export function outOfSight(u: { hidden?: boolean }): boolean {
  return !!u.hidden;
}

export function useDesignView() {
  const [view, setView] = useState<DesignView>(INITIAL);

  const set = useCallback(
    <K extends keyof DesignView>(key: K, value: DesignView[K]) =>
      setView((v) => ({ ...v, [key]: value })),
    [],
  );

  const toggle = useCallback(
    (
      key:
        | 'iso'
        | 'inside'
        | 'snap'
        | 'statsOpen'
        | 'wallsOpen'
        | 'toolsOpen'
        | 'roomStats'
    ) =>
      setView((v) => ({ ...v, [key]: !v[key] })),
    [],
  );

  /**
   * לחיצות חוזרות על המדידה מחליפות ציר: רוחב, גובה, עומק וכיבוי.
   * בורר ציר בשורה נפרדת גזל מקום מהציור, ובטלפון הוא נחתך.
   */
  const cycleMeasure = useCallback(
    () =>
      setView((v) => ({
        ...v,
        measure: v.measure === null ? 'w' : v.measure === 'w' ? 'h' : v.measure === 'h' ? 'd' : null,
        rulerPair: null,
      })),
    [],
  );

  /** פותח או סוגר את הסרגל, ומכבה את המדידה שמתחרה בו על אותו ציור. */
  const toggleRuler = useCallback(
    () => setView((v) => ({ ...v, rulerPair: v.rulerPair === null ? [] : null, measure: null })),
    [],
  );

  /** מחליף את ציר הסרגל ומנקה את מה שנבחר — צירוף אחר, מדידה אחרת. */
  const setRulerAxis = useCallback(
    (rulerAxis: RulerAxis) => setView((v) => ({ ...v, rulerAxis, rulerPair: [] })),
    [],
  );

  /**
   * בוחר או מבטל קצה לסרגל. הסרגל מודד בין שניים, ולכן השלישי
   * דוחף החוצה את הראשון — במקום לדרוש ניקוי ידני לפני כל מדידה.
   */
  const pickRulerEnd = useCallback(
    (id: string | null) =>
      setView((v) => {
        if (!id) return { ...v, rulerPair: [] };
        const cur = v.rulerPair ?? [];
        return {
          ...v,
          rulerPair: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id].slice(-2),
        };
      }),
    [],
  );

  /** מכבה את כלי המדידה. נדרש בכל מעבר מצב שמשנה את מה שמסתכלים עליו. */
  const clearTools = useCallback(
    () => setView((v) => ({ ...v, measure: null, rulerPair: null })),
    [],
  );

  return { view, set, toggle, cycleMeasure, toggleRuler, setRulerAxis, pickRulerEnd, clearTools };
}

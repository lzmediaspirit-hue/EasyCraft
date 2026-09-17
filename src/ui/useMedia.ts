import { useSyncExternalStore } from 'react';

/**
 * האם המסך עונה על התנאי הזה עכשיו.
 *
 * הפריסה עצמה היא CSS, ולכן רוב הדברים אינם צריכים את זה. מה שכן
 * צריך הוא מה שעדיף שלא יהיה קיים כלל: פאנל שמוסתר ב-CSS עדיין
 * נבנה, עדיין שואל את המסד, ועדיין נמצא ב-DOM — ואז חיפוש טקסט
 * מוצא בנייד את מה שרואים רק במחשב.
 */
export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

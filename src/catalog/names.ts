/**
 * שם הארגז, מנוקה.
 *
 * "ארון  כיור" ו"ארון כיור" הם אותו ארגז מבחינת מי שקורא אותם,
 * והמסד ראה בהם שניים. רווח כפול, רווח בקצה, וצורות יוניקוד שונות
 * לאותה אות — כל אלה נכנסים לשדה בלי שאיש התכוון להם, בעיקר
 * כשמדביקים שם מגיליון.
 */
export function cleanCabinetName(name: string): string {
  return name.normalize('NFKC').trim().replace(/\s+/gu, ' ');
}

/**
 * המפתח שלפיו נקבע ששני שמות הם אותו שם.
 *
 * אותיות גדולות וקטנות אינן הבדל בין ארגזים: "MDF לבן" ו-"mdf לבן"
 * הם אותו ארגז, ושניהם ברשימה הם ארגז אחד שאי אפשר לבחור בו.
 */
export function cabinetNameKey(name: string): string {
  return cleanCabinetName(name).toLocaleLowerCase('he');
}

/**
 * שם פנוי שנגזר משם תפוס.
 *
 * "שמירה כארגז חדש" הציעה את שם הארגז שעל הקיר, והוא בדיוק השם
 * של הפריט שממנו הוא נולד — כלומר שם תפוס, תמיד. שער השמירה היה
 * צודק בדחייה, והמסך היה זה ששלח אותו לשם. מספר בסוף, עד שנמצא
 * שם שאינו קיים.
 */
export function freeCabinetName(base: string, taken: string[]): string {
  const used = new Set(taken.map(cabinetNameKey));
  const clean = cleanCabinetName(base);
  if (!used.has(cabinetNameKey(clean))) return clean;
  for (let n = 2; ; n++) {
    const next = `${clean} ${n}`;
    if (!used.has(cabinetNameKey(next))) return next;
  }
}

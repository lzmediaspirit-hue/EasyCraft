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

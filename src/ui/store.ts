/**
 * הודעה על שינוי, למי שמאזין.
 *
 * שש חנויות באפליקציה — יחידת התצוגה, תפקיד הצפייה, מה מוצג
 * בהדמיה, ההיסטוריה, הניווט והכניסה — כתבו את אותן ארבע שורות:
 * אוסף מאזינים, הרשמה, ביטול הרשמה, והודעה לכולם.
 *
 * זה לא המצב עצמו אלא הדרך לספר שהוא השתנה, ולכן זו פונקציה קטנה
 * ולא מחלקה של חנות: לכל חנות יש צורה משלה, ורק ההודעה משותפת.
 */
export function subscribers() {
  const listeners = new Set<() => void>();
  return {
    /** מחזיר פונקציה שמבטלת את ההרשמה — כמו ש-useSyncExternalStore מצפה */
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    notify() {
      listeners.forEach((l) => l());
    },
  };
}

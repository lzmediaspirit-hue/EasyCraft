import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/*
 * הקובץ הזה רץ ב-node ולא בדפדפן, אבל הפרויקט מוגדר כולו לדפדפן.
 * הצהרה מקומית אחת עדיפה על @types/node, שהיה משנה את הטיפוסים
 * הגלובליים של כל הקוד — למשל setTimeout שמחזיר טיימר של node.
 */
declare const process: { env: Record<string, string | undefined> };

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { host: true, port: 5173 },
  /*
   * האתר ב-GitHub Pages יושב תחת /EasyCraft/ ולא בשורש הדומיין, ולכן
   * הנתיבים לקבצים חייבים להיות יחסיים לו. בפיתוח ובקובץ הבודד השורש
   * הוא השורש, ולכן ברירת המחדל נשארת '/'.
   */
  base: process.env.BASE_PATH || '/',
});

import { useLiveQuery } from 'dexie-react-hooks';
import { finishesRepo, materialsRepo } from './materialsRepo';
import type { Finish, Material } from '../db/types';

/**
 * החומרים והגוונים של העסק.
 *
 * שישה מסכים שאלו את שניהם, כל אחד בשתי שורות משלו. הם תמיד באים
 * יחד — גוון בלי החומרים שהוא קיים עליהם אינו שלם — ולכן זו שאלה
 * אחת. `undefined` פירושו שהטעינה עוד לא הסתיימה, כמו בכל שאילתה
 * חיה, ולכן מסך שממתין להם ממשיך להמתין בדיוק אותו דבר.
 */
export function useMaterialsAndFinishes(): {
  materials: Material[] | undefined;
  finishes: Finish[] | undefined;
} {
  const materials = useLiveQuery(() => materialsRepo.list(), []);
  const finishes = useLiveQuery(() => finishesRepo.all(), []);
  return { materials, finishes };
}

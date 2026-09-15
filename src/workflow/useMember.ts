import { useSyncExternalStore } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { session } from './auth';
import { teamRepo } from './workflowRepo';
import type { TeamMember } from '../db/types';

/** מזהה מי שמחובר עכשיו. */
function useCurrentMemberId(): string | null {
  return useSyncExternalStore(session.subscribe, session.memberId, () => null);
}

/**
 * המשתמש המחובר.
 * `undefined` עוד נטען; `null` אין אף אחד — ואז מוצג מסך הכניסה.
 *
 * חשבון שהושבת או נמחק אינו מחובר, וגם החיבור השמור שלו נמחק. בלי
 * זה השבתה חוסמת רק כניסה חדשה: מי שכבר היה מחובר נשאר עם ההרשאות
 * שלו עד שיצא ביוזמתו, וזה בדיוק מה שההשבתה באה למנוע.
 */
export function useCurrentMember(): TeamMember | null | undefined {
  const id = useCurrentMemberId();
  return useLiveQuery(async () => {
    if (!id) return null;
    const member = await teamRepo.get(id);
    if (member?.active) return member;
    session.signOut();
    return null;
  }, [id]);
}

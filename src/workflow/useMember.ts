import { useSyncExternalStore } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { currentMember, teamRepo } from './workflowRepo';
import type { TeamMember } from '../db/types';

/** מזהה מי שמחובר במכשיר הזה, כרשום ב-localStorage. */
export function useCurrentMemberId(): string | null {
  return useSyncExternalStore(currentMember.subscribe, currentMember.id, () => null);
}

/**
 * מי מחובר עכשיו.
 *
 * `undefined` עוד לא נטען; `null` אין אף אחד — ואז האפליקציה
 * מתנהגת כמו קודם, בלי תהליכי עבודה, וזה בכוונה: נגרייה של אדם
 * אחד לא צריכה להעביר לעצמה משימות.
 */
export function useCurrentMember(): TeamMember | null | undefined {
  const id = useCurrentMemberId();
  return useLiveQuery(async () => (id ? ((await teamRepo.get(id)) ?? null) : null), [id]);
}

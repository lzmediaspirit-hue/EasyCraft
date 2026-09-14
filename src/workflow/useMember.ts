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
 */
export function useCurrentMember(): TeamMember | null | undefined {
  const id = useCurrentMemberId();
  return useLiveQuery(async () => (id ? ((await teamRepo.get(id)) ?? null) : null), [id]);
}

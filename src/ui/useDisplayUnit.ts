import { useSyncExternalStore } from 'react';
import { displayUnit, type DisplayUnit } from './units';

/** יחידת התצוגה הנוכחית — מ"מ או ס"מ. */
export function useDisplayUnit(): DisplayUnit {
  return useSyncExternalStore(displayUnit.subscribe, displayUnit.get, () => 'cm' as const);
}

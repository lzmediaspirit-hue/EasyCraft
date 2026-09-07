import { useSyncExternalStore } from 'react';

export type Route =
  | { name: 'customers' }
  | { name: 'projects'; customerId: string }
  /** `work` פותח את ההדמיה ישר במצב מעקב תהליך עבודה */
  | { name: 'design'; projectId: string; work?: boolean }
  | { name: 'workflow'; projectId: string }
  | { name: 'archive' }
  | { name: 'tasks' }
  | { name: 'calendar' }
  | { name: 'team' }
  | { name: 'stock' }
  | { name: 'settings' }
  | { name: 'defaults' };

/**
 * ניווט מבוסס מחסנית. כל מסך נדחף למחסנית וכפתור "חזור" שולף אותו,
 * כולל כפתור החזרה של המכשיר — כדי שהאפליקציה תתנהג כמו אפליקציה.
 */
let stack: Route[] = [{ name: 'customers' }];
const listeners = new Set<() => void>();
/** האם היסטוריית הדפדפן זמינה. בסביבות מוטמעות היא עלולה להיחסם. */
let historyWorks = true;

function emit() {
  listeners.forEach((l) => l());
}

export const nav = {
  push(route: Route) {
    stack = [...stack, route];
    try {
      history.pushState({ depth: stack.length }, '');
    } catch {
      historyWorks = false;
    }
    emit();
  },
  back() {
    if (stack.length <= 1) return;
    if (historyWorks) {
      history.back();
      return;
    }
    stack = stack.slice(0, -1);
    emit();
  },
  /**
   * חוזר למסך הפתיחה ומאפס את המחסנית.
   * נדרש בהחלפת משתמש: מה שהיה פתוח שייך למי שהיה מחובר, ולא
   * בהכרח מותר למי שנכנס אחריו.
   */
  reset() {
    stack = [{ name: 'customers' }];
    emit();
  },
  current(): Route {
    return stack[stack.length - 1];
  },
  canGoBack(): boolean {
    return stack.length > 1;
  },
};

window.addEventListener('popstate', () => {
  if (stack.length > 1) {
    stack = stack.slice(0, -1);
    emit();
  }
});

export function useRoute(): Route {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => stack[stack.length - 1],
  );
}

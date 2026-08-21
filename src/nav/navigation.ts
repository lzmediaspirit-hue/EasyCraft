import { useSyncExternalStore } from 'react';

export type Route =
  | { name: 'customers' }
  | { name: 'projects'; customerId: string }
  | { name: 'design'; projectId: string };

/**
 * ניווט מבוסס מחסנית. כל מסך נדחף למחסנית וכפתור "חזור" שולף אותו,
 * כולל כפתור החזרה של המכשיר — כדי שהאפליקציה תתנהג כמו אפליקציה.
 */
let stack: Route[] = [{ name: 'customers' }];
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export const nav = {
  push(route: Route) {
    stack = [...stack, route];
    history.pushState({ depth: stack.length }, '');
    emit();
  },
  back() {
    if (stack.length > 1) history.back();
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

import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { customersRepo } from './customersRepo';
import { NewCustomerSheet } from './NewCustomerSheet';
import { normalizePhone } from './phone';
import { WorkBar } from '../workflow/WorkBar';
import { LibrarySheet } from '../design/LibrarySheet';
import { useCurrentMember } from '../../workflow/useMember';
import { ROLE_LABELS, viewRole, viewableRoles, useEffectiveRole } from '../../workflow/viewRole';
import type { Customer } from '../../db/types';
import {
  ArchiveIcon,
  BackIcon,
  BoxesIcon,
  NestIcon,
  ChevronIcon,
  DotsIcon,
  PhoneIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  SlidersIcon,
  UsersIcon,
} from '../../ui/icons';
import { nav } from '../../nav/navigation';

/** מעל כמה לקוחות מוצג שדה חיפוש. מתחת לזה הוא רק רעש. */
const SEARCH_THRESHOLD = 6;

/** לקוחות פעילים, או ארכיון של מי שסיים. */
export function CustomersScreen({ archived = false }: { archived?: boolean } = {}) {
  const customers = useLiveQuery(() => customersRepo.list(archived), [archived]);
  const archivedCount = useLiveQuery(
    async () => (await customersRepo.list(true)).length,
    [],
  );
  const [sheetOpen, setSheetOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const me = useCurrentMember();
  const role = useEffectiveRole(me?.role);
  const roles = viewableRoles(me?.role);
  const [query, setQuery] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const showSearch = (customers?.length ?? 0) >= SEARCH_THRESHOLD;

  const visible = useMemo(() => {
    if (!customers) return [];
    const q = query.trim();
    if (!q) return customers;
    const digits = normalizePhone(q);
    return customers.filter(
      (c) =>
        c.name.includes(q) ||
        c.city.includes(q) ||
        (digits.length > 1 && c.phone?.includes(digits)),
    );
  }, [customers, query]);

  function handleCreated(name: string) {
    setSheetOpen(false);
    setQuery('');
    setToast(`${name} נוסף ללקוחות`);
    window.setTimeout(() => setToast(null), 2600);
  }

  return (
    <div className="app-page flex min-h-dvh flex-col bg-stone-50">
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-stone-50/95 px-5 pt-6 pb-4 backdrop-blur">
        <div className="flex items-center gap-2.5">
          {archived && (
            <button
              onClick={() => nav.back()}
              aria-label="חזרה"
              className="-ms-2.5 shrink-0 rounded-full p-2 text-stone-500 transition-colors hover:bg-stone-200/70 hover:text-stone-800"
            >
              <BackIcon />
            </button>
          )}
          <h1 className="text-2xl font-bold text-stone-900">
            {archived ? 'לקוחות שסיימו' : 'לקוחות'}
          </h1>
          {!!customers?.length && (
            <span className="num text-sm font-medium text-stone-400">{customers.length}</span>
          )}
          <span className="ms-auto flex shrink-0 items-center">
            {/*
              הספרייה נגישה גם בלי פרויקט פתוח: בונים ומתחזקים אותה
              בזמן שקט, כדי שבפגישה עם הלקוח רק בוחרים ממנה.
            */}
            {!archived && role === 'manager' && (
              <button
                onClick={() => setLibraryOpen(true)}
                aria-label="ספריית הארגזים"
                title="ספריית הארגזים"
                className="rounded-full p-2 text-stone-400 transition-colors hover:bg-stone-200/70 hover:text-stone-700"
              >
                <BoxesIcon />
              </button>
            )}
            {/* מלאי הלוחות — מה צריך להזמין היום, לפי הפרויקטים */}
            {!archived && (
              <button
                onClick={() => nav.push({ name: 'stock' })}
                aria-label="מלאי לוחות"
                title="מלאי לוחות"
                className="rounded-full p-2 text-stone-400 transition-colors hover:bg-stone-200/70 hover:text-stone-700"
              >
                <NestIcon />
              </button>
            )}
            {!archived && (
              <button
                onClick={() => nav.push({ name: 'archive' })}
                aria-label="לקוחות שסיימו"
                title="לקוחות שסיימו"
                className="relative rounded-full p-2 text-stone-400 transition-colors hover:bg-stone-200/70 hover:text-stone-700"
              >
                <ArchiveIcon />
                {!!archivedCount && (
                  <span className="num absolute -top-0.5 -end-0.5 grid min-w-4 place-items-center rounded-full bg-stone-300 px-1 text-[10px] font-medium text-stone-700">
                    {archivedCount}
                  </span>
                )}
              </button>
            )}
            {/*
              המידות שחוזרות בכל פרויקט — רגליים, עומקים, גובה קיר.
              הן יושבות ליד ההגדרות ולא בתוכן: מי שפותח פרויקט חדש
              נוגע בהן, ולא צריך לעבור דרך מחירי אביזרים כדי להגיע.
            */}
            {role === 'manager' && (
              <button
                onClick={() => nav.push({ name: 'defaults' })}
                aria-label="ברירות מחדל לפרויקט"
                title="ברירות מחדל לפרויקט"
                className="rounded-full p-2 text-stone-400 transition-colors hover:bg-stone-200/70 hover:text-stone-700"
              >
                <SlidersIcon />
              </button>
            )}
            {role === 'manager' && (
            <button
              onClick={() => nav.push({ name: 'settings' })}
              aria-label="הגדרות"
              className="-me-2 rounded-full p-2 text-stone-400 transition-colors hover:bg-stone-200/70 hover:text-stone-700"
            >
              <SettingsIcon />
            </button>
            )}
          </span>
        </div>

        {/*
          מצב תצוגה לפי תפקיד.
          לפני שיש משתמש לכל אחד בנגרייה, המנהל צריך לראות מה הנגר
          יראה ומה התכנת יראה. זו תצוגה ולא הרשאה: אפשר לרדת בתפקיד
          ולא לעלות בו.
        */}
        {!archived && roles.length > 1 && (
          <div className="mt-3">
            <button
              onClick={() => setRoleOpen((v) => !v)}
              aria-expanded={roleOpen}
              className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-start text-sm transition-colors ${
                role !== me?.role
                  ? 'bg-oak-100 text-oak-900 ring-1 ring-oak-300'
                  : 'bg-stone-200/60 text-stone-600 hover:bg-stone-200'
              }`}
            >
              <UsersIcon className="size-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate font-medium">
                תצוגה של {ROLE_LABELS[role ?? 'manager']}
              </span>
              {role !== me?.role && (
                <span className="shrink-0 text-[11px] text-oak-700">לא התפקיד שלך</span>
              )}
            </button>

            {roleOpen && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {roles.map((r) => (
                  <button
                    key={r}
                    onClick={() => {
                      viewRole.set(r === me?.role ? null : r);
                      setRoleOpen(false);
                    }}
                    aria-pressed={role === r}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                      role === r
                        ? 'bg-oak-600 text-white'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    {ROLE_LABELS[r]}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {showSearch && (
          <div className="relative mt-3">
            <SearchIcon className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              type="search"
              placeholder="חיפוש לפי שם, עיר או טלפון"
              className="w-full rounded-xl border border-stone-200 bg-white py-2.5 pe-4 ps-10 text-[15px] text-stone-900 placeholder:text-stone-400 focus:border-oak-500 focus:outline-none"
            />
          </div>
        )}
      </header>

      <main className="flex-1 px-5 pb-32">
        {/* מה פתוח עכשיו — קודם לרשימת הלקוחות, כי זו השאלה של הבוקר */}
        <WorkBar />

        {customers === undefined ? null : customers.length === 0 ? (
          <EmptyState onAdd={() => setSheetOpen(true)} />
        ) : visible.length === 0 ? (
          <p className="pt-16 text-center text-stone-500">לא נמצאו לקוחות</p>
        ) : (
          <ul className="divide-y divide-stone-200/80 pt-2">
            {visible.map((customer) => (
              <CustomerRow key={customer.id} customer={customer} archived={archived} />
            ))}
          </ul>
        )}
      </main>

      {customers !== undefined && customers.length > 0 && (
        <div className="app-page fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-stone-50 via-stone-50 to-transparent px-5 pt-8 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <button
            onClick={() => setSheetOpen(true)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-oak-600 py-4 text-base font-semibold text-white shadow-lg shadow-oak-900/15 transition-colors hover:bg-oak-700"
          >
            <PlusIcon />
            לקוח חדש
          </button>
        </div>
      )}

      {sheetOpen && (
        <NewCustomerSheet onClose={() => setSheetOpen(false)} onCreated={handleCreated} />
      )}

      {libraryOpen && (
        <LibrarySheet
          roomKind="custom"
          manage
          onClose={() => setLibraryOpen(false)}
        />
      )}

      {toast && (
        <div
          role="status"
          className="fixed inset-x-0 bottom-28 z-40 mx-auto w-fit animate-fade-in rounded-full bg-stone-900 px-5 py-2.5 text-sm font-medium text-white shadow-xl"
        >
          {toast}
        </div>
      )}
    </div>
  );
}

function CustomerRow({ customer, archived }: { customer: Customer; archived: boolean }) {
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState(false);
  return (
    <li>
      <div className="flex items-center gap-3.5 py-1.5">
        <button
          onClick={() => nav.push({ name: 'projects', customerId: customer.id })}
          className="-mx-2 flex min-w-0 flex-1 items-center gap-3.5 rounded-xl px-2 py-2 text-start transition-colors hover:bg-stone-100 active:bg-stone-100"
        >
          <span
            aria-hidden="true"
            className="grid size-11 shrink-0 place-items-center rounded-full bg-oak-100 text-base font-semibold text-oak-700"
          >
            {customer.name.trim().charAt(0)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold text-stone-900">{customer.name}</span>
            <span className="block truncate text-sm text-stone-500">{customer.city}</span>
          </span>
          <ChevronIcon className="size-4 shrink-0 text-stone-300" />
        </button>

        <button
          onClick={() => setMenu((v) => !v)}
          aria-label={`פעולות ל${customer.name}`}
          aria-expanded={menu}
          className="shrink-0 rounded-full border border-stone-200 bg-white p-2.5 text-stone-400 transition-colors hover:border-oak-300 hover:text-oak-700"
        >
          <DotsIcon className="size-4" />
        </button>

        {customer.phone && (
          <a
            href={`tel:${customer.phone}`}
            aria-label={`חיוג ל${customer.name}`}
            className="shrink-0 rounded-full border border-stone-200 bg-white p-2.5 text-stone-500 transition-colors hover:border-oak-300 hover:text-oak-700"
          >
            <PhoneIcon className="size-4" />
          </a>
        )}
      </div>

      {/* פעולות שנדרשות לעיתים רחוקות — מוסתרות עד שמבקשים אותן */}
      {menu && (
        <div className="mb-2 flex flex-wrap gap-1.5 rounded-xl bg-stone-100 p-2">
          <button
            onClick={async () => {
              await customersRepo.setArchived(customer.id, !archived);
              setMenu(false);
            }}
            className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-50"
          >
            {archived ? 'החזרה ללקוחות פעילים' : 'סיים — העברה לארכיון'}
          </button>
          <button
            onClick={() => setConfirm(true)}
            className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
          >
            מחיקה
          </button>
        </div>
      )}

      {confirm && (
        <div className="mb-2 rounded-xl border border-red-200 bg-red-50 p-3">
          <p className="text-xs leading-snug text-red-900">
            מחיקת {customer.name} תמחק גם את כל הפרויקטים, ההדמיות והמחירים
            שלו. אי אפשר לבטל.
          </p>
          <div className="mt-2 flex gap-1.5">
            <button
              onClick={async () => {
                await customersRepo.remove(customer.id);
              }}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-700"
            >
              כן, למחוק
            </button>
            <button
              onClick={() => {
                setConfirm(false);
                setMenu(false);
              }}
              className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-stone-700"
            >
              ביטול
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center pt-24 text-center">
      <span className="grid size-20 place-items-center rounded-full bg-oak-100 text-oak-500">
        <UsersIcon className="size-9" />
      </span>
      <h2 className="mt-5 text-lg font-semibold text-stone-800">אין לקוחות עדיין</h2>
      <p className="mt-1.5 max-w-xs text-[15px] text-stone-500">
        כל עבודה מתחילה מלקוח. הוסף את הראשון כדי להתחיל.
      </p>
      <button
        onClick={onAdd}
        className="mt-7 flex items-center gap-2 rounded-2xl bg-oak-600 px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-oak-900/15 transition-colors hover:bg-oak-700"
      >
        <PlusIcon />
        הוספת לקוח
      </button>
    </div>
  );
}

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { projectsRepo } from './projectsRepo';
import { NewProjectWizard } from './NewProjectWizard';
import { SaleSheet } from './SaleSheet';
import { roomDef } from '../../catalog/rooms';
import { nav } from '../../nav/navigation';
import { ScreenHeader } from '../../ui/ScreenHeader';
import { BoxesIcon, ChevronIcon, PlusIcon, TagIcon } from '../../ui/icons';
import { stagesRepo, currentStage } from '../../workflow/workflowRepo';
import { useCurrentMember } from '../../workflow/useMember';
import { useEffectiveRole } from '../../workflow/viewRole';
import { STAGES, stageDef } from '../../workflow/stages';
import { projectQuote, paymentStatus } from '../../costing/pricing';
import { shekels } from '../../ui/units';
import type { PlacedUnit, Project, ProjectStage } from '../../db/types';
import type { ProjectCosting } from '../../costing/boards';

/** רשימת הפרויקטים של לקוח אחד. */
export function ProjectsScreen({ customerId }: { customerId: string }) {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [saleFor, setSaleFor] = useState<Project | null>(null);

  const customer = useLiveQuery(() => db.customers.get(customerId), [customerId]);
  const projects = useLiveQuery(() => projectsRepo.listForCustomer(customerId), [customerId]);
  const summaries = useLiveQuery(
    async (): Promise<Record<string, ProjectCosting>> =>
      projects ? projectsRepo.summaries(projects.map((p) => p.id)) : {},
    [projects],
  );
  const stages = useLiveQuery(() => stagesRepo.all(), []);
  const allUnits = useLiveQuery(() => db.units.toArray(), []);
  const me = useCurrentMember();
  /* גם תצוגה של תפקיד אחר מסתירה מחיר — זו כל הנקודה שלה */
  const role = useEffectiveRole(me?.role);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-stone-50">
      <ScreenHeader
        title={customer?.name ?? ''}
        subtitle={customer?.city}
        count={projects?.length}
      />

      <main className="flex-1 px-5 pb-32">
        {projects === undefined ? null : projects.length === 0 ? (
          <EmptyState onAdd={() => setWizardOpen(true)} />
        ) : (
          <ul className="space-y-3 pt-3">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                boards={summaries?.[project.id]}
                units={(allUnits ?? []).filter((u) => u.projectId === project.id)}
                stages={(stages ?? []).filter((x) => x.projectId === project.id)}
                isManager={role === 'manager'}
                onSale={() => setSaleFor(project)}
              />
            ))}
          </ul>
        )}
      </main>

      <div className="sticky bottom-0 mx-auto w-full max-w-lg px-5 pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <button
          onClick={() => setWizardOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-oak-600 py-4 text-base font-semibold text-white shadow-lg shadow-oak-900/15 transition-colors hover:bg-oak-700"
        >
          <PlusIcon />
          פרויקט חדש
        </button>
      </div>

      {wizardOpen && (
        <NewProjectWizard
          customerId={customerId}
          onClose={() => setWizardOpen(false)}
          onCreated={(projectId) => {
            setWizardOpen(false);
            nav.push({ name: 'design', projectId });
          }}
        />
      )}

      {saleFor && (
        <SaleSheet
          project={saleFor}
          units={(allUnits ?? []).filter((u) => u.projectId === saleFor.id)}
          costing={summaries?.[saleFor.id]}
          isManager={role === 'manager'}
          onClose={() => setSaleFor(null)}
        />
      )}
    </div>
  );
}

/**
 * כרטיס פרויקט.
 *
 * מה שמעניין כאן הוא לא כמה ארגזים יש אלא מה צריך להזמין ומה
 * המחיר: שורה לכל לוח וגוון, כי זו ההזמנה שיוצאת לספק, ולידה
 * המחיר ומצב התשלום. תהליך העבודה מופיע כנקודות קטנות, רק אחרי
 * שהפרויקט נמכר.
 */
function ProjectCard({
  project,
  boards,
  units,
  stages,
  isManager,
  onSale,
}: {
  project: Project;
  boards?: ProjectCosting;
  units: PlacedUnit[];
  stages: ProjectStage[];
  /** מחיר ותשלומים הם עניין של המנהל, ולא של מי שמייצר */
  isManager: boolean;
  onSale: () => void;
}) {
  const room = roomDef(project.roomKind);
  const quote = projectQuote(project, units, boards);
  const pay = paymentStatus(project);
  const sold = !!project.soldAt;

  return (
    <li className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
      <button
        onClick={() => nav.push({ name: 'design', projectId: project.id })}
        className="flex w-full items-center gap-3 p-3 text-start transition-colors hover:bg-stone-50"
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-oak-100 text-oak-600">
          <BoxesIcon className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-stone-900">{project.name}</span>
          <span className="block truncate text-sm text-stone-500">
            {project.roomKind === 'custom' ? 'חדר בהגדרה אישית' : room.label}
          </span>
        </span>
        {/*
          מה שהמנהל רואה כאן הוא כסף. התכנת והנגר רואים במקומו את
          מצב הייצור — כמה ארגזים ואיפה הם עומדים — כי זו השאלה
          שלהם, ומחיר הוא בין המנהל ללקוח.
        */}
        {isManager ? (
          <span className="shrink-0 text-end">
            <span className="num block text-base font-bold text-stone-900">
              {quote.amount > 0 ? shekels(quote.amount) : '—'}
            </span>
            {sold && (
              <span
                className={`num block text-[10px] ${
                  pay.fullyPaid ? 'text-oak-700' : 'text-amber-700'
                }`}
              >
                {pay.fullyPaid ? 'שולם' : `נותר ${shekels(pay.due)}`}
              </span>
            )}
          </span>
        ) : (
          <span className="shrink-0 text-end">
            <span className="num block text-base font-bold text-stone-900">{units.length}</span>
            <span className="block text-[10px] text-stone-400">ארגזים</span>
          </span>
        )}
        <ChevronIcon className="size-4 shrink-0 text-stone-300" />
      </button>

      {/* מה צריך להזמין: לוח, גוון וכמות */}
      {boards && boards.lines.length > 0 && (
        <ul className="border-t border-stone-100 px-3 py-2">
          {boards.lines.map((line) => (
            <li key={line.key} className="flex items-baseline gap-2 py-0.5 text-xs">
              {line.finish && (
                <span
                  aria-hidden="true"
                  className="size-3 shrink-0 self-center rounded border border-black/10"
                  style={{ background: line.finish.hex }}
                />
              )}
              <span className="min-w-0 flex-1 truncate text-stone-700">
                {line.finish?.name ?? 'בלי גוון'}
                <span className="text-stone-500"> · {line.material.name}</span>
                {!!line.finish?.texture && (
                  <span className="text-stone-400"> · {line.finish.texture}</span>
                )}
              </span>
              <span className="num shrink-0 font-semibold text-stone-800">{line.sheets}</span>
              <span className="shrink-0 text-[10px] text-stone-400">
                {line.sheets === 1 ? 'פלטה' : 'פלטות'}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* מכירה, ואחריה מצב התהליך */}
      <div className="flex items-center gap-2 border-t border-stone-100 px-3 py-2">
        {isManager && (
        <button
          onClick={onSale}
          className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
            sold
              ? 'bg-oak-50 text-oak-700 hover:bg-oak-100'
              : 'bg-oak-600 text-white hover:bg-oak-700'
          }`}
        >
          <TagIcon className="size-3.5" />
          {sold ? 'תשלומים' : 'מכירה'}
        </button>
        )}

        {sold && stages.length > 0 && (
          <button
            onClick={() => nav.push({ name: 'workflow', projectId: project.id })}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1.5 py-1 text-start transition-colors hover:bg-stone-100"
          >
            <StageDots stages={stages} />
            <span className="min-w-0 flex-1 truncate text-[11px] text-stone-500">
              {stageDef(currentStage(stages)?.key ?? 'brief').label}
            </span>
          </button>
        )}
        {!sold && (
          <span className="text-[11px] text-stone-400">
            תהליך העבודה נפתח אחרי המכירה
          </span>
        )}
      </div>
    </li>
  );
}

/** נקודה לכל שלב — איפה הפרויקט עומד, במבט אחד. */
function StageDots({ stages }: { stages: ProjectStage[] }) {
  const byKey = new Map(stages.map((s) => [s.key, s]));
  return (
    <span className="flex shrink-0 items-center gap-1" aria-hidden="true">
      {STAGES.map((def) => {
        const s = byKey.get(def.key);
        const done = s?.status === 'done' || s?.status === 'skipped';
        const active = s?.status === 'active';
        return (
          <span
            key={def.key}
            title={def.label}
            className={`rounded-full transition-colors ${
              active ? 'size-2 bg-oak-600 ring-2 ring-oak-200' : 'size-1.5'
            } ${done ? 'bg-oak-500' : active ? '' : 'bg-stone-300'}`}
          />
        );
      })}
    </span>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center pt-24 text-center">
      <span className="grid size-20 place-items-center rounded-full bg-oak-100 text-oak-500">
        <BoxesIcon className="size-9" />
      </span>
      <h2 className="mt-5 text-lg font-semibold text-stone-800">אין פרויקטים ללקוח הזה</h2>
      <p className="mt-1.5 max-w-xs text-[15px] leading-relaxed text-stone-500">
        פרויקט הוא חדר: מטבח, סלון או ארון. בוחרים חדר, מגדירים קירות,
        ומתחילים לבנות.
      </p>
      <button
        onClick={onAdd}
        className="mt-6 rounded-2xl bg-oak-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-oak-700"
      >
        פרויקט ראשון
      </button>
    </div>
  );
}

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { projectsRepo } from './projectsRepo';
import { NewProjectWizard } from './NewProjectWizard';
import { roomDef } from '../../catalog/rooms';
import { nav } from '../../nav/navigation';
import { count } from '../../ui/units';
import { ScreenHeader } from '../../ui/ScreenHeader';
import { BoxesIcon, ChevronIcon, FlowIcon, PlusIcon } from '../../ui/icons';
import { stagesRepo, currentStage } from '../../workflow/workflowRepo';
import { stageDef } from '../../workflow/stages';
import type { Project, ProjectStage } from '../../db/types';
import type { ProjectCosting } from '../../costing/boards';
import { shekels } from '../../ui/units';

/** רשימת הפרויקטים של לקוח אחד. */
export function ProjectsScreen({ customerId }: { customerId: string }) {
  const [wizardOpen, setWizardOpen] = useState(false);

  const customer = useLiveQuery(() => db.customers.get(customerId), [customerId]);
  const projects = useLiveQuery(() => projectsRepo.listForCustomer(customerId), [customerId]);
  const summaries = useLiveQuery(
    async (): Promise<Record<string, ProjectCosting>> =>
      projects ? projectsRepo.summaries(projects.map((p) => p.id)) : {},
    [projects],
  );
  const stages = useLiveQuery(() => stagesRepo.all(), []);

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
          <ul className="divide-y divide-stone-200/80 pt-2">
            {projects.map((project) => (
              <ProjectRow
                key={project.id}
                project={project}
                boards={summaries?.[project.id]}
                stages={(stages ?? []).filter((x) => x.projectId === project.id)}
              />
            ))}
          </ul>
        )}
      </main>

      {projects !== undefined && projects.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-lg bg-gradient-to-t from-stone-50 via-stone-50 to-transparent px-5 pt-8 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <button
            onClick={() => setWizardOpen(true)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-oak-600 py-4 text-base font-semibold text-white shadow-lg shadow-oak-900/15 transition-colors hover:bg-oak-700"
          >
            <PlusIcon />
            פרויקט חדש
          </button>
        </div>
      )}

      {wizardOpen && (
        <NewProjectWizard
          customerId={customerId}
          onClose={() => setWizardOpen(false)}
          onCreated={(projectId: string) => {
            setWizardOpen(false);
            nav.push({ name: 'design', projectId });
          }}
        />
      )}
    </div>
  );
}

function ProjectRow({
  project,
  boards,
  stages,
}: {
  project: Project;
  boards?: ProjectCosting;
  stages: ProjectStage[];
}) {
  const room = roomDef(project.roomKind);
  const units = boards?.units ?? 0;
  const price = boards?.consumerTotal ?? 0;
  const stage = currentStage(stages);

  return (
    <li>
      <button
        onClick={() => nav.push({ name: 'design', projectId: project.id })}
        className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-xl px-2 py-3.5 text-start transition-colors hover:bg-stone-100 active:bg-stone-100"
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-oak-100 text-oak-600">
          <BoxesIcon className="size-5" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-stone-900">{project.name}</span>
          <span className="block truncate text-sm text-stone-500">
            {project.roomKind === 'custom' ? 'חדר בהגדרה אישית' : room.label}
            {units > 0 && <span> · {count(units, 'ארגז אחד', 'ארגזים')}</span>}
          </span>
        </span>

        {/* שתי עמודות במרכז השורה, כדי שהמספרים לא יידחקו לפינה */}
        <span className="flex shrink-0 items-center gap-3 rounded-xl bg-stone-100/70 px-3 py-1.5">
          <Metric
            value={boards && boards.totalSheets > 0 ? String(boards.totalSheets) : '—'}
            label={boards?.totalSheets === 1 ? 'פלטה' : 'פלטות'}
          />
          <span className="h-7 w-px bg-stone-200" />
          <Metric value={price > 0 ? shekels(price) : '—'} label="מחיר" />
        </span>

        <ChevronIcon className="size-4 shrink-0 text-stone-300" />
      </button>

      {/* השלב שהפרויקט עומד בו — כניסה ישירה לתהליך העבודה */}
      {stage && (
        <button
          onClick={() => nav.push({ name: 'workflow', projectId: project.id })}
          className="-mx-2 mb-2 flex w-[calc(100%+1rem)] items-center gap-2 rounded-xl bg-stone-100/70 px-3 py-2 text-start transition-colors hover:bg-stone-200/70"
        >
          <FlowIcon className="size-4 shrink-0 text-stone-400" />
          <span className="min-w-0 flex-1 truncate text-xs text-stone-600">
            {stageDef(stage.key).label}
            <span className="text-stone-400">
              {stage.status === 'active' ? ' — פתוח' : ' — הסתיים'}
            </span>
          </span>
          <ChevronIcon className="size-3.5 shrink-0 text-stone-300" />
        </button>
      )}
    </li>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <span className="flex min-w-11 flex-col items-center">
      <span className="num text-sm leading-tight font-semibold text-stone-800">{value}</span>
      <span className="text-[10px] leading-tight text-stone-400">{label}</span>
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
      <p className="mt-1.5 max-w-xs text-[15px] text-stone-500">
        התחל מבחירת החדר, ומשם נגיע להדמיה ולהצעת מחיר.
      </p>
      <button
        onClick={onAdd}
        className="mt-7 flex items-center gap-2 rounded-2xl bg-oak-600 px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-oak-900/15 transition-colors hover:bg-oak-700"
      >
        <PlusIcon />
        פרויקט חדש
      </button>
    </div>
  );
}

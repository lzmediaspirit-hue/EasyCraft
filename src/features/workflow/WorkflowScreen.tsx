import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { projectsRepo } from '../projects/projectsRepo';
import { customersRepo } from '../customers/customersRepo';
import {
  attachmentsRepo,
  stagesRepo,
  stageProgress,
  teamRepo,
} from '../../workflow/workflowRepo';
import { useCurrentMember } from '../../workflow/useMember';
import { ROLE_LABEL, STAGES, canOwn, stageDef } from '../../workflow/stages';
import { StageSheet } from './StageSheet';
import { AttachmentsSection } from './AttachmentsSection';
import { ScreenHeader } from '../../ui/ScreenHeader';
import { nav } from '../../nav/navigation';
import { CheckIcon } from '../../ui/icons';
import type { ProjectStage, StageKey } from '../../db/types';

/**
 * תהליך העבודה של פרויקט אחד.
 *
 * כל שלב יודע למי הוא מחכה, ורק השלב הפתוח ניתן לסגירה — כך שאי
 * אפשר לחתוך לוחות לפני שהלקוח אישר. המנהל יכול לפתוח שלב מחדש
 * כשמשהו השתבש, כי בשטח זה קורה.
 */
export function WorkflowScreen({ projectId }: { projectId: string }) {
  const project = useLiveQuery(() => projectsRepo.get(projectId), [projectId]);
  const customer = useLiveQuery(
    async () => (project ? customersRepo.get(project.customerId) : undefined),
    [project?.customerId],
  );
  const stages = useLiveQuery(() => stagesRepo.listForProject(projectId), [projectId]);
  const team = useLiveQuery(() => teamRepo.list(), []);
  const attachments = useLiveQuery(() => attachmentsRepo.listForProject(projectId), [projectId]);
  const me = useCurrentMember();
  const [openStage, setOpenStage] = useState<StageKey | null>(null);

  // פרויקט שנוצר לפני שהתהליך היה קיים מקבל אותו בכניסה הראשונה
  useEffect(() => {
    stagesRepo.ensure(projectId);
  }, [projectId]);

  if (!project || !stages) return null;

  const progress = stageProgress(stages);
  const isManager = me?.role === 'manager';
  const memberName = (id?: string) => team?.find((m) => m.id === id)?.name;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-stone-50">
      <ScreenHeader
        title={project.name}
        subtitle={customer ? `${customer.name} · תהליך העבודה` : 'תהליך העבודה'}
      >
        <div className="mt-3 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-stone-200">
            <div
              className="h-full rounded-full bg-oak-600 transition-[width]"
              style={{ width: `${(progress.done / progress.total) * 100}%` }}
            />
          </div>
          <span className="num shrink-0 text-xs font-medium text-stone-500">
            {progress.done}/{progress.total}
          </span>
        </div>
      </ScreenHeader>

      <main className="flex-1 px-5 pb-10">
        <ol className="mt-4 space-y-2">
          {stages.map((stage) => (
            <StageRow
              key={stage.id}
              stage={stage}
              assignee={memberName(stage.assigneeId)}
              mine={!!me && canOwn(me.role, stageDef(stage.key).role)}
              isManager={isManager}
              onOpen={() => setOpenStage(stage.key)}
            />
          ))}
        </ol>

        {!me && (
          <p className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm leading-snug text-amber-900">
            אף אחד לא מחובר במכשיר הזה, ולכן אי אפשר לסגור שלבים.
            בוחרים מי אתה במסך הצוות.
          </p>
        )}

        <AttachmentsSection projectId={projectId} attachments={attachments ?? []} canEdit={!!me} />

        <button
          onClick={() => nav.push({ name: 'design', projectId })}
          className="mt-5 w-full rounded-2xl border border-stone-200 bg-white py-3 text-sm font-medium text-stone-700 transition-colors hover:border-oak-400 hover:text-oak-700"
        >
          פתיחת ההדמיה
        </button>
      </main>

      {openStage && (
        <StageSheet
          projectId={projectId}
          stage={stages.find((s) => s.key === openStage)!}
          team={team ?? []}
          me={me ?? null}
          onClose={() => setOpenStage(null)}
        />
      )}
    </div>
  );
}

function StageRow({
  stage,
  assignee,
  mine,
  isManager,
  onOpen,
}: {
  stage: ProjectStage;
  assignee?: string;
  mine: boolean;
  isManager: boolean;
  onOpen: () => void;
}) {
  const def = stageDef(stage.key);
  const done = stage.status === 'done';
  const skipped = stage.status === 'skipped';
  const active = stage.status === 'active';
  const index = STAGES.findIndex((s) => s.key === stage.key) + 1;
  // שלב שממתין לתורו נפתח רק למנהל — לכל השאר אין מה לעשות בו
  const openable = active || isManager;

  return (
    <li>
      <button
        onClick={onOpen}
        disabled={!openable}
        className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-start transition-colors ${
          active
            ? 'border-oak-400 bg-oak-50'
            : done || skipped
              ? 'border-stone-200 bg-white'
              : 'border-stone-200 bg-stone-100/60'
        } ${openable ? 'hover:border-oak-400' : 'cursor-default'}`}
      >
        <span
          className={`num grid size-8 shrink-0 place-items-center rounded-full text-sm font-semibold ${
            done
              ? 'bg-oak-600 text-white'
              : skipped
                ? 'bg-stone-300 text-white'
                : active
                  ? 'bg-white text-oak-700 ring-2 ring-oak-500'
                  : 'bg-stone-200 text-stone-500'
          }`}
        >
          {done ? <CheckIcon className="size-4" /> : index}
        </span>

        <span className="min-w-0 flex-1">
          <span
            className={`block truncate font-medium ${
              active ? 'text-stone-900' : done || skipped ? 'text-stone-700' : 'text-stone-500'
            }`}
          >
            {def.label}
            {skipped && <span className="ms-2 text-xs font-normal text-stone-400">דולג</span>}
          </span>
          <span className="block truncate text-xs text-stone-400">
            {assignee ??
              (def.role === 'customer' ? 'הלקוח' : ROLE_LABEL[def.role])}
            {active && mine && <span className="ms-1.5 text-oak-700">· אצלך</span>}
          </span>
        </span>

        {stage.scheduledAt && (
          <span className="num shrink-0 text-xs font-medium text-stone-500">
            {new Date(stage.scheduledAt).toLocaleDateString('he-IL', {
              day: '2-digit',
              month: '2-digit',
            })}
          </span>
        )}
      </button>
    </li>
  );
}

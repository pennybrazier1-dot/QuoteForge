import Link from "next/link";
import { CardHeading } from "@/components/dashboard/card";
import {
  buildAdminTasks,
  formatAdminTaskStatus,
  type AdminTaskProposal,
} from "@/lib/proposals/admin-tasks";
import { getStatusBadgeClass } from "@/lib/proposals/status";
import { SectionCard } from "@/components/ui/section-card";

const MAX_VISIBLE_TASKS = 4;

type TodaysAdminPanelProps = {
  proposals: AdminTaskProposal[];
};

export function TodaysAdminPanel({ proposals }: TodaysAdminPanelProps) {
  const tasks = buildAdminTasks(proposals);
  const visibleTasks = tasks.slice(0, MAX_VISIBLE_TASKS);
  const hasMore = tasks.length > MAX_VISIBLE_TASKS;

  return (
    <SectionCard as="article">
      <CardHeading
        title="Today's admin"
        hint={tasks.length > 0 ? `${tasks.length} to do` : "All caught up"}
      />

      {tasks.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No tasks for today. You&apos;re up to date.</p>
      ) : (
        <>
          <ul className="mt-4 space-y-2">
            {visibleTasks.map((task) => (
              <li key={task.id}>
                <Link href={task.href} className="qf-card-inset block">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium text-accent">{task.proposalNumber}</p>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium leading-none ${getStatusBadgeClass(task.status)}`}
                    >
                      {formatAdminTaskStatus(task.status)}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-sm font-medium">{task.customerName}</p>
                </Link>
              </li>
            ))}
          </ul>

          {hasMore ? (
            <Link
              href="/proposals"
              className="mt-4 inline-block text-sm font-medium text-accent transition-colors hover:text-accent-hover"
            >
              View all tasks →
            </Link>
          ) : null}
        </>
      )}
    </SectionCard>
  );
}

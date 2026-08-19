import * as React from 'react';
import { CheckCircle2, ChevronDown, Circle, ListTodo, Loader2, XCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

export type TaskStatus = 'pending' | 'running' | 'done' | 'failed';

export interface TaskItem {
  id: string;
  label: string;
  status?: TaskStatus;
}

export interface TaskProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  tasks: readonly TaskItem[];
  defaultOpen?: boolean;
}

function TaskStatusIcon({ status }: { status: TaskStatus }): React.ReactElement {
  if (status === 'running') {
    return <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-400" aria-hidden />;
  }
  if (status === 'done') {
    return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" aria-hidden />;
  }
  if (status === 'failed') {
    return <XCircle className="h-3.5 w-3.5 text-red-400" aria-hidden />;
  }
  return <Circle className="h-3.5 w-3.5 text-[var(--vibe-text-faint,#6f6f6f)]" aria-hidden />;
}

function isTerminalStatus(status: TaskStatus): boolean {
  return status === 'done' || status === 'failed';
}

function tasksAreComplete(tasks: readonly TaskItem[]): boolean {
  if (tasks.length === 0) {
    return false;
  }
  return tasks.every((task) => isTerminalStatus(task.status ?? 'pending'));
}

function tasksAreActive(tasks: readonly TaskItem[]): boolean {
  return tasks.some((task) => {
    const status = task.status ?? 'pending';
    return status === 'running' || status === 'pending';
  });
}

export function Task({
  title = 'Tasks',
  tasks,
  defaultOpen,
  className,...props
}: TaskProps): React.ReactElement {
  const complete = tasksAreComplete(tasks);
  const active = tasksAreActive(tasks);
  const [open, setOpen] = React.useState(() =>
    defaultOpen !== undefined ? defaultOpen: !complete);

  React.useEffect(() => {
    if (defaultOpen !== undefined) {
      return;
    }
    if (complete) {
      setOpen(false);
      return;
    }
    if (active) {
      setOpen(true);
    }
  }, [active, complete, defaultOpen]);

  if (tasks.length === 0) {
    return <></>;
  }

  const doneCount = tasks.filter((task) => (task.status ?? 'pending') === 'done').length;
  const headerLabel = complete && !open ? `${title} · ${doneCount}/${tasks.length}`: title;

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border border-[var(--vibe-border,rgb(255_255_255/0.09))] bg-[var(--vibe-composer-bg,#141414)] text-xs',
        className)}
      data-testid="operator-task"
      data-complete={complete ? 'true': 'false'}
      {...props}
    >
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-[var(--vibe-hover-bg,rgb(255_255_255/0.06))]"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open ? 'true': 'false'}
      >
        <ListTodo className="h-3.5 w-3.5 shrink-0 text-[var(--vibe-text-muted,#9a9a9a)]" aria-hidden />
        <span
          className={cn(
            'min-w-0 flex-1 font-medium text-[var(--vibe-text,#ececec)]',
            active && !complete && 'animate-pulse')}
        >
          {headerLabel}
        </span>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 shrink-0 text-[var(--vibe-text-muted,#9a9a9a)] transition-transform',
            open && 'rotate-180')}
          aria-hidden
        />
      </button>
      {open ? (
        <ul className="space-y-1 border-t border-[var(--vibe-border,rgb(255_255_255/0.09))] px-3 py-2">
          {tasks.map((task) => {
            const status: TaskStatus = task.status ?? 'pending';
            return (
              <li key={task.id} className="flex items-center gap-2 text-[var(--vibe-text-muted,#9a9a9a)]">
                <TaskStatusIcon status={status} />
                <span className="min-w-0 flex-1 truncate">{task.label}</span>
              </li>
            );
          })}
        </ul>
      ): null}
    </div>
  );
}

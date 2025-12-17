
'use client';

import { Header } from '@/components/layout/header';
import { KanbanBoard } from '@/components/tasks/kanban-board';
import type { Task, SharedLink, WorkflowStatus } from '@/lib/types';

interface SharedDashboardViewProps {
  tasks: Task[];
  statuses: WorkflowStatus[];
  permissions: SharedLink['permissions'];
}

export function SharedDashboardView({ tasks, permissions }: SharedDashboardViewProps) {

  return (
    <div className="flex h-svh flex-col bg-background">
      <Header title="Dashboard" />
      <main className="flex-1 overflow-hidden p-4 md:p-6">
        <KanbanBoard tasks={tasks || []} permissions={permissions} />
      </main>
    </div>
  );
}

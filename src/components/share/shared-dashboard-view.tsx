
'use client';

import { Header } from '@/components/layout/header';
import { KanbanBoard } from '@/components/tasks/kanban-board';
import type { Task, SharedLink, WorkflowStatus } from '@/lib/types';
import { useParams } from 'next/navigation';

interface SharedDashboardViewProps {
  tasks: Task[];
  permissions: SharedLink['permissions'];
  viewConfig?: SharedLink['viewConfig'];
}

export function SharedDashboardView({ tasks, permissions, viewConfig }: SharedDashboardViewProps) {
  const params = useParams();
  const linkId = params.linkId as string;

  return (
    <div className="flex h-svh flex-col bg-background">
      <Header title="Shared Dashboard" isPublicView={true} />
      <main className="flex-1 overflow-hidden p-4 md:p-6">
        <KanbanBoard tasks={tasks || []} permissions={permissions} isSharedView={true} linkId={linkId} />
      </main>
    </div>
  );
}

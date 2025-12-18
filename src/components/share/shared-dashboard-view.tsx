'use client';
import { KanbanBoard } from '@/components/tasks/kanban-board';
import type { Task, SharedLink } from '@/lib/types';
import { SharedHeader } from './shared-header';
import { Loader2 } from 'lucide-react';

interface SharedDashboardViewProps {
  session: SharedLink;
  tasks: Task[] | null;
  isLoading: boolean;
}

export function SharedDashboardView({ session, tasks, isLoading }: SharedDashboardViewProps) {
  return (
    <div className="flex flex-col flex-1 h-full w-full">
      <SharedHeader title="Task Board" />
      <main className="flex-1 overflow-hidden p-4 md:p-6 w-full">
        {isLoading ? (
            <div className="flex h-full w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        ) : (
            <KanbanBoard tasks={tasks || []} permissions={session.permissions} isSharedView={true} linkId={session.id} />
        )}
      </main>
    </div>
  );
}

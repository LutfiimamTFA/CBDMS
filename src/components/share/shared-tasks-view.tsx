'use client';
import { SharedHeader } from '@/components/share/shared-header';
import { SharedTasksTable } from '@/components/share/shared-tasks-table';
import type { Task, WorkflowStatus, Brand, User, SharedLink } from '@/lib/types';
import React from 'react';
import { Loader2 } from 'lucide-react';

interface SharedTasksViewProps {
  session: SharedLink;
  tasks: Task[] | null;
  statuses: WorkflowStatus[] | null;
  brands: Brand[] | null;
  users: User[] | null;
  isLoading: boolean;
}

export function SharedTasksView({ session, tasks, statuses, brands, users, isLoading }: SharedTasksViewProps) {
  return (
    <div className="flex flex-col flex-1 h-full w-full">
      <SharedHeader title="Task List" />
      <main className="flex-1 overflow-auto p-4 md:p-6 w-full">
        {isLoading ? (
          <div className="flex h-full w-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <SharedTasksTable 
              tasks={tasks || []}
              statuses={statuses || []}
              brands={brands || []}
              users={users || []}
              permissions={session.permissions}
              isShareView={true}
          />
        )}
      </main>
    </div>
  );
}

'use client';
import { SharedHeader } from '@/components/share/shared-header';
import { TasksDataTable } from '@/components/tasks/tasks-data-table';
import type { Task, WorkflowStatus, Brand, User, SharedLink } from '@/lib/types';
import React from 'react';

interface SharedTasksViewProps {
  tasks: Task[];
  statuses: WorkflowStatus[];
  brands: Brand[];
  users: User[];
  permissions: SharedLink['permissions'];
  viewConfig?: SharedLink['viewConfig'];
}

export function SharedTasksView({ tasks, statuses, brands, users, permissions, viewConfig }: SharedTasksViewProps) {
  const title = "Shared Tasks";
  
  return (
    <div className="flex h-svh flex-col bg-background">
      <SharedHeader title={title} />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <TasksDataTable 
            tasks={tasks || []}
            statuses={statuses || []}
            brands={brands || []}
            users={users || []}
            permissions={permissions}
            viewConfig={viewConfig}
        />
      </main>
    </div>
  );
}

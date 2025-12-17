
'use client';
import { Header } from '@/components/layout/header';
import { TasksDataTable } from '@/components/tasks/tasks-data-table';
import { useI18n } from '@/context/i18n-provider';
import type { Task, WorkflowStatus, Brand, User } from '@/lib/types';
import React from 'react';

interface SharedTasksViewProps {
  tasks: Task[];
  statuses: WorkflowStatus[];
  brands: Brand[];
  users: User[];
}

export function SharedTasksView({ tasks, statuses, brands, users }: SharedTasksViewProps) {
  // Although useI18n is here, the parent layout for share routes doesn't have the provider,
  // so we need to be careful. Let's provide a fallback.
  // A better solution is to not use components that rely on this hook in public views.
  const title = "Tasks";
  
  return (
    <div className="flex h-svh flex-col bg-background">
      <Header title={title} isPublicView={true} />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <TasksDataTable 
            tasks={tasks || []}
            statuses={statuses || []}
            brands={brands || []}
            users={users || []}
        />
      </main>
    </div>
  );
}

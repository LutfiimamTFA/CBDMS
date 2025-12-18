'use client';

import React from 'react';
import type { Task, SharedLink, WorkflowStatus, Brand, User } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SharedHeader } from './shared-header';
import { SharedTasksTable } from './shared-tasks-table';
import { KanbanBoard } from '../tasks/kanban-board';
import { SharedCalendarView } from './shared-calendar-view';
import { SharedScheduleView } from './shared-schedule-view';

interface SharedSimpleTasksViewProps {
  session: SharedLink;
  tasks: Task[] | null;
  statuses: WorkflowStatus[] | null;
  users: User[] | null;
  brands: Brand[] | null;
  isLoading: boolean;
  viewType: 'board' | 'list' | 'calendar' | 'schedule';
}

export function SharedSimpleTasksView({ session, tasks, statuses, users, brands, isLoading, viewType }: SharedSimpleTasksViewProps) {
  
  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex h-full w-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      )
    }

    if (!tasks || tasks.length === 0) {
      return (
         <Card>
            <CardContent className="p-12 text-center">
              <h3 className="text-lg font-semibold">No Tasks to Display</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                There are no tasks associated with this shared view.
              </p>
            </CardContent>
          </Card>
      )
    }

    switch(viewType) {
      case 'board':
        return <KanbanBoard tasks={tasks || []} permissions={session.permissions} isSharedView={true} />;
      case 'list':
        return <SharedTasksTable tasks={tasks} statuses={statuses || []} users={users || []} brands={brands || []} permissions={session.permissions} isShareView={true} />;
      case 'calendar':
        return <SharedCalendarView session={session} tasks={tasks} isLoading={isLoading} />;
      case 'schedule':
        return <SharedScheduleView session={session} tasks={tasks} isLoading={isLoading} />;
      default:
        return <SharedTasksTable tasks={tasks} statuses={statuses || []} users={users || []} brands={brands || []} permissions={session.permissions} isShareView={true} />;
    }
  }

  return (
    <div className="flex flex-col flex-1 h-full w-full">
      <SharedHeader title={session?.name || 'Shared View'} />
      <main className="flex-1 overflow-auto p-4 md:p-6 w-full">
        {renderContent()}
      </main>
    </div>
  );
}

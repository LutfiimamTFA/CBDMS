'use client';
import type { Task, WorkflowStatus, Brand, User, SharedLink } from '@/lib/types';
import React from 'react';
import { Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { SharedTasksTable } from './shared-tasks-table';
import { TaskDetailsSheet } from '../tasks/task-details-sheet';
import { useParams } from 'next/navigation';

interface SharedTasksViewProps {
  session: SharedLink;
  tasks: Task[] | null;
  statuses: WorkflowStatus[] | null;
  brands: Brand[] | null;
  users: User[] | null;
  isLoading: boolean;
}

export function SharedTasksView({ session, tasks, statuses, brands, users, isLoading }: SharedTasksViewProps) {
    const params = useParams();
    const taskId = Array.isArray(params.scope) && params.scope[0] === 'tasks' ? params.scope[1] : null;
    const [sheetOpen, setSheetOpen] = React.useState(!!taskId);
    const [activeTask, setActiveTask] = React.useState<Task | null>(null);

    React.useEffect(() => {
        if(taskId) {
            const task = tasks?.find(t => t.id === taskId);
            if (task) {
                setActiveTask(task);
                setSheetOpen(true);
            }
        } else {
            setSheetOpen(false);
        }
    }, [taskId, tasks]);


  return (
    <div className="flex flex-col flex-1 h-full w-full">
      <main className="flex-1 overflow-auto p-4 md:p-6 w-full">
        {isLoading ? (
          <div className="flex h-full w-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : !tasks || tasks.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <h3 className="text-lg font-semibold">No Tasks to Display</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                There are no tasks associated with this shared view.
              </p>
            </CardContent>
          </Card>
        ) : (
          <SharedTasksTable 
            tasks={tasks}
            statuses={statuses || []}
            brands={brands || []}
            users={users || []}
            permissions={session.permissions}
          />
        )}
      </main>
      {activeTask && (
          <TaskDetailsSheet 
            task={activeTask}
            open={sheetOpen}
            onOpenChange={(open) => {
                if(!open) {
                    window.history.pushState({}, '', `/share/${session.id}/tasks`);
                    setSheetOpen(false);
                    setActiveTask(null);
                }
            }}
            permissions={session.permissions}
          />
      )}
    </div>
  );
}

import { Header } from '@/components/layout/header';
import { AddTaskDialog } from '@/components/tasks/add-task-dialog';
import { TasksDataTable } from '@/components/tasks/tasks-data-table';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export default function TasksPage() {
  return (
    <div className="flex h-svh flex-col bg-background">
      <Header
        title="Tasks"
        actions={
          <div className="flex items-center gap-2">
            <AddTaskDialog>
              <Button>
                <Plus className="h-4 w-4" />
                Create Task
              </Button>
            </AddTaskDialog>
          </div>
        }
      />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <TasksDataTable />
      </main>
    </div>
  );
}

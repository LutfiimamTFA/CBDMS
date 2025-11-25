import { Header } from '@/components/layout/header';
import { KanbanBoard } from '@/components/tasks/kanban-board';
import { Plus } from 'lucide-react';
import { AddTaskDialog } from '@/components/tasks/add-task-dialog';
import { Button } from '@/components/ui/button';
import { SmartSuggestions } from '@/components/tasks/smart-suggestions';
import { UserNav } from '@/components/layout/user-nav';

export default function DashboardPage() {
  return (
    <div className="flex h-svh flex-col bg-background">
      <Header
        title="Task Board"
        actions={
          <div className="flex items-center gap-2">
            <SmartSuggestions />
            <AddTaskDialog>
              <Button>
                <Plus className="h-4 w-4" />
                Add Task
              </Button>
            </AddTaskDialog>
            <UserNav />
          </div>
        }
      />
      <main className="flex-1 overflow-hidden p-4 md:p-6">
        <KanbanBoard />
      </main>
    </div>
  );
}

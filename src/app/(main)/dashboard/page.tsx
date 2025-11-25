import { Header } from '@/components/layout/header';
import { KanbanBoard } from '@/components/tasks/kanban-board';
import { SmartSuggestions } from '@/components/tasks/smart-suggestions';

export default function DashboardPage() {
  return (
    <div className="flex h-svh flex-col bg-background">
      <Header
        title="Task Board"
        actions={
          <div className="flex items-center gap-2">
            <SmartSuggestions />
          </div>
        }
      />
      <main className="flex-1 overflow-hidden p-4 md:p-6">
        <KanbanBoard />
      </main>
    </div>
  );
}

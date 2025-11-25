import { Header } from '@/components/layout/header';
import { TasksDataTable } from '@/components/tasks/tasks-data-table';

export default function TasksPage() {
  return (
    <div className="flex h-svh flex-col bg-background">
      <Header title="Tasks" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <TasksDataTable />
      </main>
    </div>
  );
}

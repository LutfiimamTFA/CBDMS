
'use client';
import { Header } from '@/components/layout/header';
import { TasksDataTable } from '@/components/tasks/tasks-data-table';
import { useI18n } from '@/context/i18n-provider';
import { useSharedSession } from '@/context/shared-session-provider';

export default function TasksPage() {
  const { t } = useI18n();
  const { session } = useSharedSession();
  
  return (
    <div className="flex h-svh flex-col bg-background">
      <Header title={t('nav.list')} />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <TasksDataTable />
      </main>
    </div>
  );
}

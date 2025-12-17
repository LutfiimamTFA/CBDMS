'use client';
import { Header } from '@/components/layout/header';
import { TasksDataTable } from '@/components/tasks/tasks-data-table';
import { useI18n } from '@/context/i18n-provider';
import { useCollection, useFirestore } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { Task, WorkflowStatus, Brand, User } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import React from 'react';

interface SharedTasksViewProps {
  companyId: string;
}

export function SharedTasksView({ companyId }: SharedTasksViewProps) {
  const { t } = useI18n();
  const firestore = useFirestore();

  const tasksQuery = React.useMemo(() => {
    if (!firestore || !companyId) return null;
    return query(collection(firestore, 'tasks'), where('companyId', '==', companyId));
  }, [firestore, companyId]);
  const { data: tasks, isLoading: isTasksLoading } = useCollection<Task>(tasksQuery);

  const statusesQuery = React.useMemo(() => 
    firestore ? query(collection(firestore, 'statuses'), orderBy('order')) : null,
    [firestore]
  );
  const { data: statuses, isLoading: areStatusesLoading } = useCollection<WorkflowStatus>(statusesQuery);

  const brandsQuery = React.useMemo(() => 
    firestore ? query(collection(firestore, 'brands'), orderBy('name')) : null,
    [firestore]
  );
  const { data: brands, isLoading: areBrandsLoading } = useCollection<Brand>(brandsQuery);

  const usersQuery = React.useMemo(() => {
    if (!firestore || !companyId) return null;
    return query(collection(firestore, 'users'), where('companyId', '==', companyId));
  }, [firestore, companyId]);
  const { data: users, isLoading: areUsersLoading } = useCollection<User>(usersQuery);

  const isLoading = isTasksLoading || areStatusesLoading || areBrandsLoading || areUsersLoading;
  
  return (
    <div className="flex h-svh flex-col bg-background">
      <Header title={t('nav.list')} />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
           <TasksDataTable 
                tasks={tasks || []}
                statuses={statuses || []}
                brands={brands || []}
                users={users || []}
              />
        )}
      </main>
    </div>
  );
}

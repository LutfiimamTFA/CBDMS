
'use client';
import { SharedHeader } from '@/components/share/shared-header';
import { TasksDataTable } from '@/components/tasks/tasks-data-table';
import type { Task, WorkflowStatus, Brand, User, SharedLink } from '@/lib/types';
import React, { useMemo } from 'react';
import { useCollection, useFirestore } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';

interface SharedTasksViewProps {
  session: SharedLink;
}

export function SharedTasksView({ session }: SharedTasksViewProps) {
  const firestore = useFirestore();

  const tasksQuery = useMemo(() => {
    if (!firestore || !session.companyId) return null;
    return query(collection(firestore, 'tasks'), where('companyId', '==', session.companyId));
  }, [firestore, session.companyId]);

  const { data: tasks, isLoading: isTasksLoading } = useCollection<Task>(tasksQuery);

  const statusesQuery = useMemo(() => {
    if (!firestore || !session.companyId) return null;
    return query(collection(firestore, 'statuses'), where('companyId', '==', session.companyId));
  }, [firestore, session.companyId]);
  const { data: statuses, isLoading: areStatusesLoading } = useCollection<WorkflowStatus>(statusesQuery);
  
  const brandsQuery = useMemo(() => {
    if (!firestore || !session.companyId) return null;
    return query(collection(firestore, 'brands'), where('companyId', '==', session.companyId));
  }, [firestore, session.companyId]);
  const { data: brands, isLoading: areBrandsLoading } = useCollection<Brand>(brandsQuery);
  
  const usersQuery = useMemo(() => {
    if (!firestore || !session.companyId) return null;
    return query(collection(firestore, 'users'), where('companyId', '==', session.companyId));
  }, [firestore, session.companyId]);
  const { data: users, isLoading: areUsersLoading } = useCollection<User>(usersQuery);

  const isLoading = isTasksLoading || areStatusesLoading || areBrandsLoading || areUsersLoading;

  return (
    <div className="flex h-svh flex-col bg-background">
      <SharedHeader title="Task List" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        {isLoading ? (
          <div className="flex h-full w-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <TasksDataTable 
              tasks={tasks || []}
              statuses={statuses || []}
              brands={brands || []}
              users={users || []}
              permissions={session.permissions}
              viewConfig={session.viewConfig}
          />
        )}
      </main>
    </div>
  );
}

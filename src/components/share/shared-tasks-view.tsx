
'use client';
import { SharedHeader } from '@/components/share/shared-header';
import { TasksDataTable } from '@/components/tasks/tasks-data-table';
import type { Task, WorkflowStatus, Brand, User, SharedLink } from '@/lib/types';
import React, { useMemo } from 'react';
import { useCollection, useFirestore } from '@/firebase';
import { collection, query, where, type Query, orderBy } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';

interface SharedTasksViewProps {
  session: SharedLink;
}

export function SharedTasksView({ session }: SharedTasksViewProps) {
  const firestore = useFirestore();

  const tasksQuery = useMemo(() => {
    if (!firestore || !session.companyId) return null;

    let q: Query = query(collection(firestore, 'tasks'), where('companyId', '==', session.companyId));
    
    if (session.brandIds && session.brandIds.length > 0) {
      q = query(q, where('brandId', 'in', session.brandIds));
    } else if (session.creatorRole !== 'Super Admin') {
       // A non-admin MUST scope by brand. If no brands are in the link, show no tasks.
       return null;
    }

    return q;
  }, [firestore, session]);

  const { data: tasks, isLoading: isTasksLoading } = useCollection<Task>(tasksQuery);

  const statusesQuery = useMemo(() => {
    if (!firestore || !session.companyId) return null;
    return query(collection(firestore, 'statuses'), where('companyId', '==', session.companyId), orderBy('order'));
  }, [firestore, session.companyId]);
  const { data: statuses, isLoading: areStatusesLoading } = useCollection<WorkflowStatus>(statusesQuery);
  
  const brandsQuery = useMemo(() => {
    if (!firestore || !session.companyId) return null;
    let q: Query = query(collection(firestore, 'brands'), where('companyId', '==', session.companyId), orderBy('name'));
     // Also filter the available brands in the filter dropdown by the shared scope
    if (session.brandIds && session.brandIds.length > 0) {
      q = query(q, where('__name__', 'in', session.brandIds));
    }
    return q;
  }, [firestore, session]);
  const { data: brands, isLoading: areBrandsLoading } = useCollection<Brand>(brandsQuery);
  
  const usersQuery = useMemo(() => {
    if (!firestore || !session.companyId) return null;
    return query(collection(firestore, 'users'), where('companyId', '==', session.companyId));
  }, [firestore, session.companyId]);
  const { data: users, isLoading: areUsersLoading } = useCollection<User>(usersQuery);

  const isLoading = isTasksLoading || areStatusesLoading || areBrandsLoading || areUsersLoading;

  return (
    <div className="flex flex-col flex-1 h-full w-full">
      <SharedHeader title="Task List" />
      <main className="flex-1 overflow-auto p-4 md:p-6 w-full">
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
              isShareView={true}
          />
        )}
      </main>
    </div>
  );
}


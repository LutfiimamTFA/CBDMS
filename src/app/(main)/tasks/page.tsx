
'use client';
import { Header } from '@/components/layout/header';
import { TasksDataTable } from '@/components/tasks/tasks-data-table';
import { useI18n } from '@/context/i18n-provider';
import { useSharedSession } from '@/context/shared-session-provider';
import React, { useMemo } from 'react';
import { useCollection, useFirestore, useUserProfile } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { Task, WorkflowStatus, Brand, User } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { usePermissions } from '@/context/permissions-provider';

export default function TasksPage() {
  const { t } = useI18n();
  const firestore = useFirestore();
  const { profile, companyId, isLoading: isProfileLoading } = useUserProfile();
  const { permissions, isLoading: arePermsLoading } = usePermissions();
  const { session } = useSharedSession();

  const activeCompanyId = session ? session.companyId : companyId;

  // --- Data Fetching Logic ---
  const tasksQuery = React.useMemo(() => {
    if (!firestore || !activeCompanyId || !profile) return null;

    if (profile.role === 'Super Admin') {
      return query(collection(firestore, 'tasks'), where('companyId', '==', activeCompanyId));
    }
    
    // Managers see tasks only from their assigned brands
    if (profile.role === 'Manager') {
      if (!profile.brandIds || profile.brandIds.length === 0) {
        return null; // Manager has no brands, so they see no tasks.
      }
      return query(
        collection(firestore, 'tasks'), 
        where('companyId', '==', activeCompanyId),
        where('brandId', 'in', profile.brandIds)
      );
    }
    
    // Employees only see tasks assigned to them.
    if (profile.role === 'Employee') {
      return query(collection(firestore, 'tasks'), where('assigneeIds', 'array-contains', profile.id));
    }

    return null;
  }, [firestore, activeCompanyId, profile]);

  const { data: tasks, isLoading: isTasksLoading } = useCollection<Task>(tasksQuery);
  
  const statusesQuery = React.useMemo(() => 
    firestore ? query(collection(firestore, 'statuses'), orderBy('order')) : null,
    [firestore]
  );
  const { data: statuses, isLoading: areStatusesLoading } = useCollection<WorkflowStatus>(statusesQuery);
  
  const brandsQuery = React.useMemo(() => {
    if (!firestore || !profile) return null;

    let q = query(collection(firestore, 'brands'), orderBy('name'));

    // If Manager, only fetch the brands they are assigned to
    if (profile.role === 'Manager' && profile.brandIds && profile.brandIds.length > 0) {
      q = query(q, where('__name__', 'in', profile.brandIds));
    }
    return q;
  }, [firestore, profile]);
  const { data: brands, isLoading: areBrandsLoading } = useCollection<Brand>(brandsQuery);
  
  const usersQuery = React.useMemo(() => {
    if (!firestore || !activeCompanyId) return null;
    let q = query(collection(firestore, 'users'), where('companyId', '==', activeCompanyId));

    if (profile?.role === 'Manager') {
      q = query(q, where('managerId', '==', profile.id));
    }

    return q;
  }, [firestore, activeCompanyId, profile]);
  const { data: users, isLoading: isUsersLoading } = useCollection<User>(usersQuery);

  const isLoading = isTasksLoading || isProfileLoading || arePermsLoading || areStatusesLoading || areBrandsLoading || isUsersLoading;

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

    
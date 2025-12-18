'use client';
import { TasksDataTable } from '@/components/tasks/tasks-data-table';
import { useI18n } from '@/context/i18n-provider';
import React, { useMemo, useState } from 'react';
import { useCollection, useFirestore, useUserProfile } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { Task, WorkflowStatus, Brand, User } from '@/lib/types';
import { Loader2, Plus } from 'lucide-react';
import { usePermissions } from '@/context/permissions-provider';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AddTaskDialog } from '@/components/tasks/add-task-dialog';
import { Button } from '@/components/ui/button';

export default function TasksPage() {
  const { t } = useI18n();
  const firestore = useFirestore();
  const { profile, companyId, isLoading: isProfileLoading } = useUserProfile();
  const { permissions, isLoading: arePermsLoading } = usePermissions();
  const [activeTab, setActiveTab] = useState('all');

  // Base query: Fetches all tasks the user is allowed to see based on their role.
  const tasksQuery = React.useMemo(() => {
    if (!firestore || !companyId || !profile) return null;

    if (profile.role === 'Super Admin') {
      return query(collection(firestore, 'tasks'), where('companyId', '==', companyId));
    }
    
    if (profile.role === 'Manager') {
      if (!profile.brandIds || profile.brandIds.length === 0) {
        return null;
      }
      return query(
        collection(firestore, 'tasks'), 
        where('companyId', '==', companyId),
        where('brandId', 'in', profile.brandIds)
      );
    }
    
    if (profile.role === 'Employee' || profile.role === 'PIC') {
      return query(collection(firestore, 'tasks'), where('assigneeIds', 'array-contains', profile.id));
    }

    return null;
  }, [firestore, companyId, profile]);

  const { data: allVisibleTasks, isLoading: isTasksLoading } = useCollection<Task>(tasksQuery);
  
  const statusesQuery = React.useMemo(() => 
    firestore ? query(collection(firestore, 'statuses'), orderBy('order')) : null,
    [firestore]
  );
  const { data: statuses, isLoading: areStatusesLoading } = useCollection<WorkflowStatus>(statusesQuery);
  
  const brandsQuery = React.useMemo(() => {
    if (!firestore || !profile) return null;
    let q = query(collection(firestore, 'brands'), orderBy('name'));
    if (profile.role === 'Manager' && profile.brandIds && profile.brandIds.length > 0) {
      q = query(q, where('__name__', 'in', profile.brandIds));
    }
    return q;
  }, [firestore, profile]);
  const { data: brands, isLoading: areBrandsLoading } = useCollection<Brand>(brandsQuery);
  
  const teamUsersQuery = React.useMemo(() => {
    if (!firestore || !profile || profile.role !== 'Manager') return null;
    return query(collection(firestore, 'users'), where('managerId', '==', profile.id));
  }, [firestore, profile]);
  const { data: teamUsers, isLoading: isTeamUsersLoading } = useCollection<User>(teamUsersQuery);

  const usersQuery = React.useMemo(() => {
    if (!firestore || !companyId) return null;
    let q = query(collection(firestore, 'users'), where('companyId', '==', companyId));
    if (profile?.role === 'Manager') {
      // For managers, we fetch their own team to display in the assignee filter.
      // This is simpler than fetching all users and filtering on the client.
      q = query(q, where('managerId', '==', profile.id));
    }
    return q;
  }, [firestore, companyId, profile]);
  const { data: users, isLoading: isUsersLoading } = useCollection<User>(usersQuery);

  // Client-side filtering based on the active tab
  const filteredTasks = useMemo(() => {
    if (!allVisibleTasks || !profile) return [];

    switch (activeTab) {
      case 'my_tasks':
        return allVisibleTasks.filter(task => task.assigneeIds.includes(profile.id));
      case 'delegated':
        return allVisibleTasks.filter(task => task.createdBy.id === profile.id && !task.assigneeIds.includes(profile.id));
      case 'team_tasks':
        if (profile.role !== 'Manager' || !teamUsers) return [];
        const teamMemberIds = teamUsers.map(u => u.id);
        return allVisibleTasks.filter(task => task.assigneeIds.some(id => teamMemberIds.includes(id)));
      case 'all':
      default:
        return allVisibleTasks;
    }
  }, [allVisibleTasks, activeTab, profile, teamUsers]);


  const isLoading = isTasksLoading || isProfileLoading || arePermsLoading || areStatusesLoading || areBrandsLoading || isUsersLoading || (profile?.role === 'Manager' && isTeamUsersLoading);
  
  const canCreateTasks = useMemo(() => {
    if (arePermsLoading || !profile || !permissions) return false;
    if (profile.role === 'Super Admin') return true;
    if (profile.role === 'Manager') return permissions.Manager.canCreateTasks;
    if (profile.role === 'Employee') return permissions.Employee.canCreateTasks;
    return false;
  }, [profile, permissions, arePermsLoading]);
  
  const canDelegate = profile?.role === 'Super Admin' || profile?.role === 'Manager';

  return (
    <div className="flex h-svh flex-col bg-background">
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 md:w-fit">
              <TabsTrigger value="all">All Tasks</TabsTrigger>
              <TabsTrigger value="my_tasks">My Tasks</TabsTrigger>
              {canDelegate && <TabsTrigger value="delegated">Delegated by Me</TabsTrigger>}
              {profile?.role === 'Manager' && <TabsTrigger value="team_tasks">My Team's Tasks</TabsTrigger>}
            </TabsList>
          </Tabs>
           <div className="flex items-center gap-2">
            {canCreateTasks && (
              <AddTaskDialog>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Task
                </Button>
              </AddTaskDialog>
            )}
          </div>
        </div>
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div className="mt-4">
              <TasksDataTable 
              tasks={filteredTasks || []}
              statuses={statuses || []}
              brands={brands || []}
              users={users || []}
            />
          </div>
        )}
      </main>
    </div>
  );
}

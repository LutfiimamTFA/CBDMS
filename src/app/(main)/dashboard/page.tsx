
'use client';

import { useMemo, useState } from 'react';
import { Header } from '@/components/layout/header';
import { KanbanBoard } from '@/components/tasks/kanban-board';
import { SmartSuggestions } from '@/components/smart-suggestions/page';
import { useCollection, useFirestore, useUserProfile } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Task, User } from '@/lib/types';
import { Filter, Loader2, X } from 'lucide-react';
import { useI18n } from '@/context/i18n-provider';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { MultiSelect } from '@/components/ui/multi-select';
import { Badge } from '@/components/ui/badge';

export default function DashboardPage() {
  const { profile, isLoading: isProfileLoading } = useUserProfile();
  const firestore = useFirestore();
  const { t } = useI18n();

  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Query untuk tugas
  const tasksQuery = useMemo(() => {
    if (!firestore || !profile) return null;

    if (profile.role === 'Super Admin' || profile.role === 'Manager') {
      return query(collection(firestore, 'tasks'));
    }

    return query(
      collection(firestore, 'tasks'),
      where('assigneeIds', 'array-contains', profile.id)
    );
  }, [firestore, profile]);
  
  const { data: tasks, isLoading: isTasksLoading } = useCollection<Task>(tasksQuery);

  // Query untuk semua pengguna di perusahaan (untuk filter)
  const usersQuery = useMemo(() => {
    if (!firestore || !profile) return null;
    return query(
        collection(firestore, 'users'), 
        where('companyId', '==', profile.companyId)
    );
  }, [firestore, profile]);

  const { data: allUsers, isLoading: areUsersLoading } = useCollection<User>(usersQuery);

  // Opsi untuk filter MultiSelect
  const userOptions = useMemo(() => {
    if (!allUsers) return [];
    return allUsers.map(user => ({
      value: user.id,
      label: user.name,
    }));
  }, [allUsers]);

  // Logika untuk memfilter tugas
  const filteredTasks = useMemo(() => {
    if (!tasks) return [];
    if (selectedUsers.length === 0) return tasks;

    return tasks.filter(task =>
      task.assigneeIds.some(assigneeId => selectedUsers.includes(assigneeId))
    );
  }, [tasks, selectedUsers]);

  const resetFilters = () => {
    setSelectedUsers([]);
  };

  const isLoading = isProfileLoading || isTasksLoading || areUsersLoading;
  const isManagerOrAdmin = profile?.role === 'Manager' || profile?.role === 'Super Admin';

  return (
    <div className="flex h-svh flex-col bg-background">
      <Header
        title={t('nav.board')}
        actions={
          <div className="flex items-center gap-2">
            {profile?.role !== 'Super Admin' && <SmartSuggestions />}
          </div>
        }
      />
      <main className="flex-1 overflow-hidden p-4 md:p-6">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div className="flex h-full flex-col">
            <div className="mb-4 space-y-4">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">{t('dashboard.welcome').replace('{name}', profile?.name || '')}</h2>
                <p className="text-muted-foreground">
                  {t('dashboard.role').replace('{role}', profile?.role || '')}
                </p>
              </div>

              {isManagerOrAdmin && (
                <Collapsible open={isFilterOpen} onOpenChange={setIsFilterOpen} className="space-y-2">
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 border-dashed">
                      <Filter className="mr-2 h-4 w-4" />
                      Filter by Assignee
                      {selectedUsers.length > 0 && <Badge variant="secondary" className="ml-2">{selectedUsers.length}</Badge>}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className='p-4 border rounded-lg bg-card'>
                     <div className='flex flex-col lg:flex-row gap-4 items-start'>
                        <div className='flex-1 w-full space-y-2'>
                           <Label htmlFor='assignee-filter'>Assignees</Label>
                           <MultiSelect
                              id="assignee-filter"
                              options={userOptions}
                              onValueChange={setSelectedUsers}
                              defaultValue={selectedUsers}
                              placeholder="Select employees..."
                           />
                        </div>
                        {selectedUsers.length > 0 && (
                          <Button variant="ghost" size="sm" onClick={resetFilters} className="mt-auto">
                              <X className="mr-2 h-4 w-4"/>Reset
                          </Button>
                        )}
                     </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
            
            <div className="flex-1 overflow-hidden">
                <KanbanBoard tasks={filteredTasks || []} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

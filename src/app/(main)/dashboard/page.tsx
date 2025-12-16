
'use client';

import { useMemo, useState } from 'react';
import { Header } from '@/components/layout/header';
import { KanbanBoard } from '@/components/tasks/kanban-board';
import { SmartSuggestions } from '@/components/smart-suggestions/page';
import { useCollection, useFirestore, useUserProfile } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Task, User } from '@/lib/types';
import { Filter, Loader2, X, Archive } from 'lucide-react';
import { useI18n } from '@/context/i18n-provider';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { MultiSelect } from '@/components/ui/multi-select';
import { Badge } from '@/components/ui/badge';
import { useSharedSession } from '@/context/shared-session-provider';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';

export default function DashboardPage() {
  const { profile, companyId, isLoading: isProfileLoading } = useUserProfile();
  const firestore = useFirestore();
  const { t } = useI18n();
  const { session } = useSharedSession();

  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const activeCompanyId = session ? session.companyId : companyId;

  // Query untuk tugas
  const tasksQuery = useMemo(() => {
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

    return null; // Fallback for other roles or scenarios
  }, [firestore, activeCompanyId, profile]);
  
  const { data: tasks, isLoading: isTasksLoading } = useCollection<Task>(tasksQuery);

  // Query untuk semua pengguna di perusahaan (untuk filter)
  const usersQuery = useMemo(() => {
    if (!firestore || !activeCompanyId) return null;
    let q = query(collection(firestore, 'users'), where('companyId', '==', activeCompanyId));
    return q;
  }, [firestore, activeCompanyId]);

  const { data: allUsers, isLoading: areUsersLoading } = useCollection<User>(usersQuery);

  // Opsi untuk filter MultiSelect, disesuaikan untuk Manajer
  const userOptions = useMemo(() => {
    if (!allUsers || !profile) return [];
    
    if (profile.role === 'Manager') {
      const team = allUsers.filter(u => u.managerId === profile.id);
      const self = allUsers.find(u => u.id === profile.id);
      const options = self ? [self, ...team] : team;
      return options.map(user => ({ value: user.id, label: user.name }));
    }
    
    // Super Admin sees all employees and managers
    return allUsers
      .filter(u => u.role === 'Employee' || u.role === 'Manager')
      .map(user => ({
        value: user.id,
        label: user.name,
    }));

  }, [allUsers, profile]);

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
            {!session && profile?.role !== 'Super Admin' && <SmartSuggestions />}
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
                <h2 className="text-2xl font-bold tracking-tight">{t('dashboard.welcome').replace('{name}', profile?.name || 'Guest')}</h2>
                <p className="text-muted-foreground">
                  {t('dashboard.role').replace('{role}', profile?.role || 'Guest')}
                </p>
              </div>

               <Alert>
                  <Archive className="h-4 w-4" />
                  <AlertTitle>Papan Kanban Terfilter Otomatis</AlertTitle>
                  <AlertDescription>
                     Untuk menjaga fokus, papan ini hanya menampilkan tugas yang relevan:
                    <ul className="list-disc pl-5 mt-2 text-xs">
                        <li><b>Baru Selesai:</b> Menampilkan tugas di kolom 'Done' yang selesai dalam <strong>7 hari terakhir</strong>.</li>
                        <li><b>Akan Datang:</b> Menampilkan tugas di 'To Do' dengan tenggat waktu dalam <strong>30 hari ke depan</strong>.</li>
                        <li><b>Aktif:</b> Semua tugas yang sedang berjalan akan selalu terlihat.</li>
                    </ul>
                     <p className="mt-2 text-xs">
                      Untuk melihat <strong>semua tugas</strong> (termasuk arsip lama), silakan kunjungi halaman <Button variant="link" asChild className="p-0 h-auto text-xs"><Link href="/tasks">Daftar Tugas</Link></Button>.
                    </p>
                  </AlertDescription>
                </Alert>

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

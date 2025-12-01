
'use client';

import { useMemo } from 'react';
import { Header } from '@/components/layout/header';
import { KanbanBoard } from '@/components/tasks/kanban-board';
import { SmartSuggestions } from '@/components/smart-suggestions/page';
import { useCollection, useFirestore, useUserProfile } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Task } from '@/lib/types';
import { Loader2 } from 'lucide-react';

export default function DashboardPage() {
  const { profile, isLoading: isProfileLoading } = useUserProfile();
  const firestore = useFirestore();

  // Query is now optimized to filter tasks on the server-side based on role.
  const tasksQuery = useMemo(() => {
    if (!firestore || !profile) return null;

    // Admins and Managers see all tasks within their company.
    if (profile.role === 'Super Admin' || profile.role === 'Manager') {
      return query(collection(firestore, 'tasks'));
    }

    // Employees see only tasks where their ID is in the 'assigneeIds' array.
    return query(
      collection(firestore, 'tasks'),
      where('assigneeIds', 'array-contains', profile.id)
    );
  }, [firestore, profile]);
  
  const { data: tasks, isLoading: isTasksLoading } = useCollection<Task>(tasksQuery);

  const isLoading = isProfileLoading || isTasksLoading;

  return (
    <div className="flex h-svh flex-col bg-background">
      <Header
        title="Task Board"
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
            <div className="mb-6">
              <h2 className="text-2xl font-bold tracking-tight">Selamat Datang, {profile?.name}!</h2>
              <p className="text-muted-foreground">
                Anda masuk sebagai {profile?.role}. Selamat bekerja dan semoga harimu produktif!
              </p>
            </div>
            <div className="flex-1 overflow-hidden">
                <KanbanBoard tasks={tasks || []} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

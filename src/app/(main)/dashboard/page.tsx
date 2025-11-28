'use client';

import { useMemo } from 'react';
import { Header } from '@/components/layout/header';
import { KanbanBoard } from '@/components/tasks/kanban-board';
import { SmartSuggestions } from '@/components/smart-suggestions/page';
import { useCollection, useFirestore, useUserProfile } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import type { Task } from '@/lib/types';
import { Loader2 } from 'lucide-react';

export default function DashboardPage() {
  const { profile, isLoading: isProfileLoading } = useUserProfile();
  const firestore = useFirestore();

  // The query now depends on the user's role
  const tasksQuery = useMemo(() => {
    if (!firestore || !profile) return null;

    // Admins and Managers see all tasks
    if (profile.role === 'Super Admin' || profile.role === 'Manager') {
      return query(collection(firestore, 'tasks'));
    }

    // Employees see only tasks assigned to them
    // This part is now implicitly handled by the KanbanBoard component logic,
    // but a more robust implementation would filter here based on profile.id.
    // For now, we rely on the KanbanBoard's internal filter.
    return query(collection(firestore, 'tasks'));

  }, [firestore, profile]);
  
  const { data: allTasks, isLoading: isTasksLoading } = useCollection<Task>(tasksQuery);
  
  const tasksForBoard = useMemo(() => {
    if (!allTasks || !profile) return [];
    if (profile.role === 'Super Admin' || profile.role === 'Manager') {
      return allTasks;
    }
    // Filter tasks for employees client-side from the full list
    return allTasks.filter(task => task.assigneeIds.includes(profile.id));
  }, [allTasks, profile]);

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
          <KanbanBoard tasks={tasksForBoard} />
        )}
      </main>
    </div>
  );
}

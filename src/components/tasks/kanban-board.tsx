
'use client';

import { useState, useEffect, useMemo } from 'react';
import { KanbanColumn } from './kanban-column';
import type { Task, WorkflowStatus, Activity, User } from '@/lib/types';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useCollection, useFirestore, useUserProfile } from '@/firebase';
import { collection, query, orderBy, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/context/permissions-provider';

interface KanbanBoardProps {
  tasks: Task[];
}

export function KanbanBoard({ tasks: initialTasks }: KanbanBoardProps) {
  const [tasks, setTasks] = useState(initialTasks);
  const firestore = useFirestore();
  const { profile } = useUserProfile();
  const { toast } = useToast();

  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

  const statusesQuery = useMemo(
    () =>
      firestore && profile
        ? query(collection(firestore, 'statuses'), orderBy('order'))
        : null,
    [firestore, profile]
  );

  const { data: statuses, isLoading: areStatusesLoading } =
    useCollection<WorkflowStatus>(statusesQuery);
    
  const canDrag = useMemo(() => {
    if (!profile) return false;
    return profile.role === 'Super Admin' || profile.role === 'Manager';
  }, [profile]);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, taskId: string) => {
    if (!canDrag) return;
    e.dataTransfer.setData('taskId', taskId);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>, newStatus: string) => {
    if (!canDrag || !firestore || !profile) return;
    const taskId = e.dataTransfer.getData('taskId');
    const task = tasks.find(t => t.id === taskId);

    if (task && task.status !== newStatus) {
      // Optimistic UI update
      setTasks(currentTasks => 
        currentTasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t)
      );

      const taskRef = doc(firestore, 'tasks', taskId);
      
      const newActivity: Activity = {
        id: `act-${Date.now()}`,
        user: { id: profile.id, name: profile.name, avatarUrl: profile.avatarUrl || '' },
        action: `pindah tugas dari "${task.status}" menjadi "${newStatus}"`,
        timestamp: new Date().toISOString(),
      };
      
      const updates: Partial<Task> = {
        status: newStatus,
        activities: [...(task.activities || []), newActivity],
        lastActivity: newActivity,
        updatedAt: serverTimestamp() as any,
      };

      if (task.status === 'To Do' && newStatus !== 'To Do') {
        updates.actualStartDate = new Date().toISOString();
      }
      
      if (newStatus === 'Done') {
        updates.actualCompletionDate = new Date().toISOString();
      }

      try {
        await updateDoc(taskRef, updates);
        toast({
            title: "Tugas Diperbarui",
            description: `Tugas dipindahkan ke "${newStatus}".`
        });
      } catch (error) {
        console.error("Failed to update task status:", error);
        // Revert UI on failure
        setTasks(currentTasks => 
            currentTasks.map(t => t.id === taskId ? { ...t, status: task.status } : t)
        );
        toast({
            variant: "destructive",
            title: "Pembaruan Gagal",
            description: "Tidak dapat memindahkan tugas. Silakan coba lagi."
        });
      }
    }
  };

  if (areStatusesLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <ScrollArea className="h-full w-full">
      <div className="flex h-full gap-4 pb-4">
        {statuses?.map((status) => (
          <KanbanColumn
            key={status.id}
            status={status}
            tasks={tasks.filter((task) => task.status === status.name)}
            onDrop={handleDrop}
            onDragStart={handleDragStart}
            canDrag={canDrag}
          />
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}

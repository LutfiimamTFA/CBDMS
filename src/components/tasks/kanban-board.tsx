
'use client';

import { useState, useEffect, useMemo } from 'react';
import { KanbanColumn } from './kanban-column';
import type { Task, WorkflowStatus, Activity, User } from '@/lib/types';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  DragDropContext,
  DropResult,
} from 'react-beautiful-dnd';
import { useCollection, useFirestore, useUserProfile } from '@/firebase';
import { doc, collection, query, orderBy, where, serverTimestamp, writeBatch } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface KanbanBoardProps {
  tasks: Task[];
}

export function KanbanBoard({ tasks: initialTasks }: KanbanBoardProps) {
  const [isClient, setIsClient] = useState(false);
  const [tasks, setTasks] = useState(initialTasks);
  const firestore = useFirestore();
  const { profile } = useUserProfile();
  const { toast } = useToast();

  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

  useEffect(() => {
    setIsClient(true);
  }, []);
  
  const statusesQuery = useMemo(
    () =>
      firestore && profile
        ? query(
            collection(firestore, 'statuses'),
            // where('companyId', '==', profile.companyId),
            orderBy('order')
          )
        : null,
    [firestore, profile]
  );

  const { data: statuses, isLoading: areStatusesLoading } = useCollection<WorkflowStatus>(statusesQuery);

  const onDragEnd = (result: DropResult) => {
    const { source, destination, draggableId } = result;

    if (!destination) {
      return;
    }

    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return;
    }

    const startColumnStatus = source.droppableId;
    const endColumnStatus = destination.droppableId;
    
    // --- Firestore Update ---
    if (firestore && profile) {
      const taskRef = doc(firestore, 'tasks', draggableId);
      const movedTask = tasks.find(t => t.id === draggableId);

      if (movedTask) {
        const batch = writeBatch(firestore);
        
        const newActivity: Activity = {
          id: `act-${Date.now()}`,
          user: { id: profile.id, name: profile.name, avatarUrl: profile.avatarUrl || '' },
          action: `moved task from "${startColumnStatus}" to "${endColumnStatus}"`,
          timestamp: serverTimestamp(),
        };

        const updatedActivities = [...(movedTask.activities || []), newActivity];

        batch.update(taskRef, { 
          status: endColumnStatus,
          activities: updatedActivities,
          lastActivity: newActivity,
          updatedAt: serverTimestamp(),
        });
        
        batch.commit().then(() => {
            toast({
              title: "Task Moved",
              description: `Task status updated to "${endColumnStatus}".`,
            });
        }).catch(err => {
            console.error("Failed to update task on drag-and-drop", err);
            toast({
              variant: 'destructive',
              title: 'Update Failed',
              description: 'Could not save task move.'
            });
            // Note: No UI revert on failure to keep it simple. The hook will eventually catch up.
        });
      }
    }

    // --- Optimistic UI Update ---
    const updatedTasks = Array.from(tasks);
    const movedTaskIndex = updatedTasks.findIndex(t => t.id === draggableId);
    if (movedTaskIndex === -1) return;
    
    const [movedTask] = updatedTasks.splice(movedTaskIndex, 1);
    movedTask.status = endColumnStatus;

    // This part is tricky. A simple splice isn't enough for reordering within the full list.
    // However, since the Kanban columns are derived from this list, just updating the status
    // and re-inserting is sufficient for the columns to re-filter correctly.
    // For visual re-ordering, we can re-sort the tasks.
    updatedTasks.push(movedTask);
    
    // Setting state will trigger a re-render, and the columns will get the updated tasks.
    setTasks(updatedTasks);
  };

  if (!isClient || areStatusesLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <ScrollArea className="h-full w-full">
        <div className="flex h-full gap-4 pb-4">
          {statuses?.map((status) => (
            <KanbanColumn
              key={status.id}
              status={status}
              tasks={tasks.filter((task) => task.status === status.name)}
            />
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </DragDropContext>
  );
}

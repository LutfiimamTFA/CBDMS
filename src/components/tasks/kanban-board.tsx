
'use client';

import { useState, useEffect, useMemo } from 'react';
import { KanbanColumn } from './kanban-column';
import type { Task, WorkflowStatus } from '@/lib/types';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  DragDropContext,
  DropResult,
} from 'react-beautiful-dnd';
import { useCollection, useFirestore, useUserProfile } from '@/firebase';
import { doc, collection, query, orderBy, where } from 'firebase/firestore';
import { updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
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

    const endColumnStatus = destination.droppableId;
    
    // Optimistically update the UI
    const updatedTasks = Array.from(tasks);
    const movedTaskIndex = updatedTasks.findIndex(t => t.id === draggableId);
    if (movedTaskIndex === -1) return;
    
    const [movedTask] = updatedTasks.splice(movedTaskIndex, 1);
    movedTask.status = endColumnStatus;

    const tasksInEndColumn = updatedTasks
      .filter(t => t.status === endColumnStatus)
      .sort((a, b) => (a.createdAt as any) > (b.createdAt as any) ? 1 : -1);

    let newIndexInFullArray = updatedTasks.length;
    if (tasksInEndColumn[destination.index]) {
      newIndexInFullArray = updatedTasks.findIndex(t => t.id === tasksInEndColumn[destination.index].id);
    }

    updatedTasks.splice(newIndexInFullArray, 0, movedTask);

    setTasks(updatedTasks);


    // Update Firestore in the background
    if (firestore) {
      const taskRef = doc(firestore, 'tasks', draggableId);
      updateDocumentNonBlocking(taskRef, { status: endColumnStatus });
       toast({
        title: "Task Moved",
        description: `Task status updated to "${endColumnStatus}".`,
      });
    }
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

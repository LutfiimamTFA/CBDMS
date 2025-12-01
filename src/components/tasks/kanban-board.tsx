
'use client';

import { useState, useEffect } from 'react';
import { KanbanColumn } from './kanban-column';
import type { Task, Status } from '@/lib/types';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  DragDropContext,
  DropResult,
  Droppable,
} from 'react-beautiful-dnd';
import { useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import { updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';

const statuses: Status[] = ['To Do', 'Doing', 'Done'];

interface KanbanBoardProps {
  tasks: Task[];
}

export function KanbanBoard({ tasks: initialTasks }: KanbanBoardProps) {
  const [isClient, setIsClient] = useState(false);
  const [tasks, setTasks] = useState(initialTasks);
  const firestore = useFirestore();
  const { toast } = useToast();

  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const onDragEnd = (result: DropResult) => {
    const { source, destination, draggableId } = result;

    // Do nothing if dropped outside a valid droppable area
    if (!destination) {
      return;
    }

    // Do nothing if the item is dropped in the same place
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return;
    }

    const startColumnStatus = source.droppableId as Status;
    const endColumnStatus = destination.droppableId as Status;
    
    // Optimistically update the UI
    const updatedTasks = Array.from(tasks);
    const movedTaskIndex = updatedTasks.findIndex(t => t.id === draggableId);
    if (movedTaskIndex === -1) return;
    
    const [movedTask] = updatedTasks.splice(movedTaskIndex, 1);
    movedTask.status = endColumnStatus;

    // Find the new index in the destination column
    const tasksInEndColumn = updatedTasks
      .filter(t => t.status === endColumnStatus)
      .sort((a, b) => {
        // This is a simple sort, replace with your actual task order logic if you have one
        return a.createdAt > b.createdAt ? 1 : -1;
      });

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

  if (!isClient) {
    // Render a skeleton or placeholder on the server to avoid hydration mismatches
    return (
      <div className="flex h-full gap-4">
        {statuses.map((status) => (
          <div
            key={status}
            className="flex-1 h-full rounded-lg bg-secondary/50"
          >
            <div className="p-4 h-12" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <ScrollArea className="h-full w-full">
        <div className="flex h-full gap-4 pb-4">
          {statuses.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              tasks={tasks.filter((task) => task.status === status)}
            />
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </DragDropContext>
  );
}

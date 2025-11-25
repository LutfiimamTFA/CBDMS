'use client';

import { useState, useEffect } from 'react';
import { KanbanColumn } from './kanban-column';
import type { Task, Status } from '@/lib/types';
import { tasks as initialTasks } from '@/lib/data';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

const statuses: Status[] = ['To Do', 'Doing', 'Done'];

export function KanbanBoard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setTasks(initialTasks);
    setIsClient(true);
  }, []);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, taskId: string) => {
    e.dataTransfer.setData('taskId', taskId);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, newStatus: Status) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    setTasks((prevTasks) =>
      prevTasks.map((task) =>
        task.id === taskId ? { ...task, status: newStatus } : task
      )
    );
  };

  if (!isClient) {
    return null; // or a loading skeleton
  }

  return (
    <ScrollArea className="h-full w-full">
      <div className="grid h-full auto-cols-[minmax(280px,1fr)] grid-flow-col gap-4">
        {statuses.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            tasks={tasks.filter((task) => task.status === status)}
            onDrop={handleDrop}
            onDragStart={handleDragStart}
          />
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}

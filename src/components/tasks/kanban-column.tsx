'use client';

import { TaskCard } from './task-card';
import type { Task, Status } from '@/lib/types';
import { statusInfo } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface KanbanColumnProps {
  status: Status;
  tasks: Task[];
  onDrop: (e: React.DragEvent<HTMLDivElement>, status: Status) => void;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, taskId: string) => void;
}

export function KanbanColumn({ status, tasks, onDrop, onDragStart }: KanbanColumnProps) {
  const info = statusInfo[status];
  const Icon = info.icon;

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  return (
    <div
      className="flex h-full flex-col rounded-lg bg-secondary/50"
      onDragOver={handleDragOver}
      onDrop={(e) => onDrop(e, status)}
    >
      <div className="flex items-center gap-2 p-4">
        <Icon className="h-5 w-5 text-muted-foreground" />
        <h2 className="font-headline font-semibold">{status}</h2>
        <span className="ml-2 rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
          {tasks.length}
        </span>
      </div>
      <ScrollArea className="flex-1 px-2">
        <div className="flex flex-col gap-3 p-2">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} onDragStart={onDragStart} />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

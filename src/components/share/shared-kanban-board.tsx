'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { TaskCard } from '../tasks/task-card';
import type { Task, WorkflowStatus, SharedLink, User } from '@/lib/types';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { KanbanColumn } from '../tasks/kanban-column';
import { useSharedSession } from '@/context/shared-session-provider';

interface SharedKanbanBoardProps {
  tasks: Task[];
  statuses: WorkflowStatus[];
  permissions: SharedLink['permissions'];
  linkId: string;
}

export function SharedKanbanBoard({
  tasks: initialTasks,
  statuses,
  permissions,
  linkId,
}: SharedKanbanBoardProps) {
  const { setSharedTasks } = useSharedSession();
  const [tasks, setTasks] = useState(initialTasks);
  const { toast } = useToast();
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);

  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

  const canDrag = permissions.canChangeStatus;

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, taskId: string) => {
    if (!canDrag) return;
    e.dataTransfer.setData('taskId', taskId);
    setDraggingTaskId(taskId);
  };
  
  const handleDragEnd = () => {
    setDraggingTaskId(null);
  }

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>, newStatus: string) => {
    if (!canDrag) return;
    const taskId = e.dataTransfer.getData('taskId');
    const task = tasks.find((t) => t.id === taskId);

    if (task && task.status !== newStatus) {
      // Optimistic UI update
      const updatedTasks = tasks.map((t) =>
        t.id === taskId ? { ...t, status: newStatus } : t
      );
      setTasks(updatedTasks);
      setSharedTasks(updatedTasks);

      try {
        const response = await fetch('/api/share/update-task', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            linkId,
            taskId,
            updates: { status: newStatus },
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to update task.');
        }

        toast({
          title: 'Status Updated',
          description: `Task moved to "${newStatus}".`,
        });
      } catch (error: any) {
        // Revert optimistic update
        setTasks(tasks);
        setSharedTasks(tasks);
        toast({
          variant: 'destructive',
          title: 'Update Failed',
          description: error.message,
        });
      }
    }
  };
  
  if (!statuses || statuses.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">No workflow statuses found in this shared link.</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full w-full">
      <div className="flex h-full gap-4 pb-4">
        {statuses.map((status) => (
          <KanbanColumn
            key={status.id}
            status={status}
            tasks={tasks.filter((task) => task.status === status.name)}
            onDrop={handleDrop}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            canDrag={canDrag}
            draggingTaskId={draggingTaskId}
            permissions={permissions}
            isSharedView={true}
            linkId={linkId}
          />
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}

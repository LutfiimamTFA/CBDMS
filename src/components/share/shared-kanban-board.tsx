
'use client';

import React, { useState, useMemo } from 'react';
import type { Task, WorkflowStatus, SharedLink } from '@/lib/types';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { KanbanColumn } from '../tasks/kanban-column';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '../ui/card';

interface SharedKanbanBoardProps {
  initialTasks: Task[];
  statuses: WorkflowStatus[];
  accessLevel: SharedLink['accessLevel'];
  linkId: string;
}

export function SharedKanbanBoard({
  initialTasks,
  statuses,
  accessLevel,
  linkId,
}: SharedKanbanBoardProps) {
  // This component is now fully controlled. It receives tasks from its parent
  // which gets data from the real-time SharedSessionProvider.
  // No more local `useState` for tasks.
  const { toast } = useToast();
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const router = useRouter();

  const canDrag = accessLevel === 'status' || accessLevel === 'limited-edit';

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
    const task = initialTasks.find((t) => t.id === taskId);

    if (task && task.status !== newStatus) {
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

        // No more optimistic update or fire-and-forget here.
        // The snapshot listener in SharedSessionProvider will handle the UI update.
        toast({
          title: 'Status Updated',
          description: `Task moved to "${newStatus}".`,
        });
      } catch (error: any) {
        toast({
          variant: 'destructive',
          title: 'Update Failed',
          description: error.message,
        });
      }
    }
  };
  
  const handleCardClick = (taskId: string) => {
    const path = `/share/${linkId}/tasks/${taskId}`;
    router.push(path);
  };
  
  // Strict validation as required.
  if (!statuses || statuses.length < 2) {
    return (
      <div className="flex h-full items-center justify-center p-8 w-full">
        <Card className="w-full max-w-md text-center">
            <CardContent className="p-6">
                <h3 className="text-lg font-semibold">Incomplete Configuration</h3>
                <p className="text-muted-foreground mt-2">The workflow for this shared view is incomplete. The Kanban board cannot be displayed.</p>
            </CardContent>
        </Card>
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
            tasks={initialTasks.filter((task) => task.status === status.name)}
            onDrop={handleDrop}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onCardClick={handleCardClick}
            canDrag={canDrag}
            draggingTaskId={draggingTaskId}
          />
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}

'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { Task, WorkflowStatus, SharedLink, User } from '@/lib/types';
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
  const [tasks, setTasks] = useState(initialTasks);
  const { toast } = useToast();
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const router = useRouter();


  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

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
    const task = tasks.find((t) => t.id === taskId);

    if (task && task.status !== newStatus) {
      const originalTasks = tasks;
      // Optimistic UI update
      const updatedTasks = tasks.map((t) =>
        t.id === taskId ? { ...t, status: newStatus } : t
      );
      setTasks(updatedTasks);

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
        setTasks(originalTasks);
        toast({
          variant: 'destructive',
          title: 'Update Failed',
          description: error.message,
        });
      }
    }
  };
  
  const handleCardClick = (taskId: string) => {
    const canViewDetails = accessLevel === 'status' || accessLevel === 'limited-edit';
    if (!canViewDetails) {
        toast({ variant: 'destructive', title: 'Permission Denied', description: 'Viewing task details is not allowed with this link.' });
        return;
    }
    const path = `/share/${linkId}/tasks/${taskId}`;
    router.push(path);
  };
  
  if (!statuses || statuses.length < 2) {
    return (
      <div className="flex h-full items-center justify-center p-8 w-full">
        <Card className="w-full max-w-md text-center">
            <CardContent className="p-6">
                <p className="text-muted-foreground">The workflow for this shared view is incomplete. The Kanban board cannot be displayed.</p>
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
            tasks={tasks.filter((task) => task.status === status.name)}
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

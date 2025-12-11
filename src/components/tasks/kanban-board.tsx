
'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { TaskCard } from './task-card';
import type { Task, WorkflowStatus, Activity, User, SharedLink, Notification } from '@/lib/types';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useCollection, useFirestore, useUserProfile } from '@/firebase';
import { collection, query, orderBy, doc, updateDoc, serverTimestamp, writeBatch, where, deleteField } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/context/permissions-provider';
import { KanbanColumn } from './kanban-column';

const createActivity = (user: User, action: string): Activity => {
  return {
    id: `act-${crypto.randomUUID()}`, // Guarantees a unique ID for every new activity.
    user: { id: user.id, name: user.name, avatarUrl: user.avatarUrl || '' },
    action: action,
    timestamp: new Date().toISOString(),
  };
};

export function KanbanBoard({ tasks: initialTasks, permissions = null }: KanbanBoardProps) {
  const [tasks, setTasks] = useState(initialTasks);
  const firestore = useFirestore();
  const { profile } = useUserProfile();
  const { toast } = useToast();
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);

  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

  const statusesQuery = useMemo(
    () =>
      firestore
        ? query(collection(firestore, 'statuses'), orderBy('order'))
        : null,
    [firestore]
  );
  
  const { data: statuses, isLoading: areStatusesLoading } =
    useCollection<WorkflowStatus>(statusesQuery);
    
  const canDrag = useMemo(() => {
    if (permissions) {
      return permissions.canChangeStatus === true;
    }
    if (!profile) return false;
    return true;
  }, [profile, permissions]);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, taskId: string) => {
    if (!canDrag) return;
    e.dataTransfer.setData('taskId', taskId);
    setDraggingTaskId(taskId);
  };
  
  const handleDragEnd = () => {
    setDraggingTaskId(null);
  }
  
  const handleDrop = async (e: React.DragEvent<HTMLDivElement>, newStatus: string) => {
    if (!canDrag || !firestore || !profile) return;
    const taskId = e.dataTransfer.getData('taskId');
    const task = tasks.find(t => t.id === taskId);

    if (task && task.status !== newStatus) {
      
      const isEmployee = profile.role === 'Employee';
      if (isEmployee && newStatus === 'Done') {
        toast({
            variant: "destructive",
            title: "Action Not Allowed",
            description: "Only Managers or Admins can mark tasks as 'Done'."
        });
        return;
      }

      setTasks(currentTasks => 
        currentTasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t)
      );
      
      const batch = writeBatch(firestore);
      const taskRef = doc(firestore, 'tasks', taskId);
      
      const newActivity = createActivity(profile, `moved task from "${task.status}" to "${newStatus}"`);
      const updatedActivities = [...(task.activities || []), newActivity];

      const updates: Partial<Task> = {
        status: newStatus,
        activities: updatedActivities,
        lastActivity: newActivity,
        updatedAt: serverTimestamp() as any,
      };

      if (task.status === 'To Do' && newStatus !== 'To Do' && !task.actualStartDate) {
        updates.actualStartDate = new Date().toISOString();
      }
      
      if (newStatus === 'Done' && task.status !== 'Done') {
        updates.actualCompletionDate = new Date().toISOString();
      }
      
      if (newStatus !== 'Done' && task.status === 'Done') {
         updates.actualCompletionDate = deleteField() as any;
      }
      
      batch.update(taskRef, updates);

      // --- START: Improved Notification Logic ---
      const notificationTitle = `Status Changed: ${task.title}`;
      const notificationMessage = `${profile.name} changed the status of "${task.title.substring(0, 30)}..." to ${newStatus}.`;
      
      task.assigneeIds.forEach(assigneeId => {
        // Don't notify the person who made the change
        if (assigneeId === profile.id) return;

        const notifRef = doc(collection(firestore, `users/${assigneeId}/notifications`));
        const newNotification: Omit<Notification, 'id'> = {
            userId: assigneeId,
            title: notificationTitle,
            message: notificationMessage,
            taskId: task.id, 
            taskTitle: task.title,
            isRead: false,
            createdAt: serverTimestamp() as any,
            createdBy: newActivity.user,
        };
        batch.set(notifRef, newNotification);
      });
      // --- END: Improved Notification Logic ---


      try {
        await batch.commit();
        toast({
            title: "Task Updated",
            description: `Task moved to "${newStatus}".`
        });
      } catch (error) {
        console.error("Failed to update task status:", error);
        setTasks(currentTasks => 
            currentTasks.map(t => t.id === taskId ? { ...t, status: task.status } : t)
        );
        toast({
            variant: "destructive",
            title: "Update Failed",
            description: "Could not move the task. Please try again."
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
            onDragEnd={handleDragEnd}
            canDrag={canDrag}
            draggingTaskId={draggingTaskId}
            permissions={permissions}
          />
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}

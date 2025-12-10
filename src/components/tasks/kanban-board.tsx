
'use client';

import { useState, useEffect, useMemo } from 'react';
import { KanbanColumn } from './kanban-column';
import type { Task, WorkflowStatus, Activity, User, SharedLink, Notification } from '@/lib/types';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useCollection, useFirestore, useUserProfile } from '@/firebase';
import { collection, query, orderBy, doc, updateDoc, serverTimestamp, writeBatch, where, deleteField } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/context/permissions-provider';

interface KanbanBoardProps {
  tasks: Task[];
  permissions?: SharedLink['permissions'] | null;
}

const createActivity = (user: User, action: string): Activity => {
  return {
    id: `act-${crypto.randomUUID()}`,
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
  
  const usersQuery = useMemo(
    () => (firestore && profile ? query(collection(firestore, 'users'), where('companyId', '==', profile.companyId)) : null),
    [firestore, profile]
  );
  const { data: allUsers } = useCollection<User>(usersQuery);

  const { data: statuses, isLoading: areStatusesLoading } =
    useCollection<WorkflowStatus>(statusesQuery);
    
  const canDrag = useMemo(() => {
    if (permissions) {
      return permissions.canChangeStatus === true;
    }
    if (!profile) return false;
    // Semua peran bisa drag, tapi tujuannya dibatasi di handleDrop
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
      
      // --- Workflow Logic ---
      const isEmployee = profile.role === 'Employee';
      if (isEmployee && newStatus === 'Done') {
        toast({
            variant: "destructive",
            title: "Action Not Allowed",
            description: "Only Managers or Admins can mark tasks as 'Done'."
        });
        return; // Block the drop
      }

      // Optimistic UI update
      setTasks(currentTasks => 
        currentTasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t)
      );
      
      const batch = writeBatch(firestore);
      const taskRef = doc(firestore, 'tasks', taskId);
      
      const newActivity = createActivity(profile, `moved task from "${task.status}" to "${newStatus}"`);
      
      const updates: Partial<Task> = {
        status: newStatus,
        activities: [...(task.activities || []), newActivity],
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

      if (newStatus === 'Preview') {
          (allUsers || []).forEach(user => {
              if (user.companyId === profile.companyId && (user.role === 'Manager' || user.role === 'Super Admin')) {
                  const notifRef = doc(collection(firestore, `users/${user.id}/notifications`));
                  const newNotification: Omit<Notification, 'id'> = {
                      userId: user.id,
                      title: 'Task Ready for Review',
                      message: `${profile.name} has moved the task "${task.title}" to Preview.`,
                      taskId: task.id, 
                      isRead: false,
                      createdAt: serverTimestamp() as any,
                      createdBy: newActivity.user,
                  };
                  batch.set(notifRef, newNotification);
              }
          });
      }


      try {
        await batch.commit();
        toast({
            title: "Task Updated",
            description: `Task moved to "${newStatus}".`
        });
      } catch (error) {
        console.error("Failed to update task status:", error);
        // Revert UI on failure
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

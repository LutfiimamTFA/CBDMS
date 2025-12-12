
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Textarea } from '../ui/textarea';
import { Button } from '../ui/button';

const createActivity = (user: User, action: string): Activity => {
  return {
    id: `act-${crypto.randomUUID()}`, // Guarantees a unique ID for every new activity.
    user: { id: user.id, name: user.name, avatarUrl: user.avatarUrl || '' },
    action: action,
    timestamp: new Date().toISOString(),
  };
};

interface KanbanBoardProps {
  tasks: Task[];
  permissions?: SharedLink['permissions'] | null;
}

interface RevisionState {
  isOpen: boolean;
  task: Task | null;
  reason: string;
}

export function KanbanBoard({ tasks: initialTasks, permissions = null }: KanbanBoardProps) {
  const [tasks, setTasks] = useState(initialTasks);
  const firestore = useFirestore();
  const { profile } = useUserProfile();
  const { toast } = useToast();
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [revisionState, setRevisionState] = useState<RevisionState>({ isOpen: false, task: null, reason: '' });
  const [isSaving, setIsSaving] = useState(false);

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
      
      // If moving to 'Revisi', open the mandatory feedback dialog
      if (newStatus === 'Revisi' && task.status === 'Preview') {
        setRevisionState({ isOpen: true, task, reason: '' });
        return; // Stop the drop process, let the dialog handle it.
      }

      setTasks(currentTasks => 
        currentTasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t)
      );
      
      const batch = writeBatch(firestore);
      const taskRef = doc(firestore, 'tasks', taskId);
      
      let actionText = `moved task from "${task.status}" to "${newStatus}"`;

      const updates: Partial<Task> = {
        status: newStatus,
        updatedAt: serverTimestamp() as any,
      };
      
      if (task.status === 'Revisi' && newStatus === 'Doing') {
        updates.isUnderRevision = true;
        actionText = 'started working on revisions';
      }
      
      if (newStatus !== 'Doing' && task.isUnderRevision) {
        updates.isUnderRevision = deleteField() as any;
      }

      if (task.status === 'To Do' && newStatus !== 'To Do' && !task.actualStartDate) {
        updates.actualStartDate = new Date().toISOString();
      }
      
      if (newStatus === 'Done' && task.status !== 'Done') {
        updates.actualCompletionDate = new Date().toISOString();
      }
      
      if (newStatus !== 'Done' && task.status === 'Done') {
         updates.actualCompletionDate = deleteField() as any;
      }

      const newActivity = createActivity(profile, actionText);
      const updatedActivities = [...(task.activities || []), newActivity];
      updates.activities = updatedActivities;
      updates.lastActivity = newActivity;
      
      batch.update(taskRef, updates);

      let notificationTitle = `Status Changed: ${task.title}`;
      let notificationMessage = `${profile.name} changed the status of "${task.title.substring(0, 30)}..." to ${newStatus}.`;

      const notifiedUserIds = new Set<string>();

      // Notify all assignees (except the person making the change)
      task.assigneeIds.forEach(assigneeId => {
          if (assigneeId !== profile.id) {
              notifiedUserIds.add(assigneeId);
          }
      });
      
      // Notify the creator of the task (if they are not the one making the change)
      if (task.createdBy.id !== profile.id) {
          notifiedUserIds.add(task.createdBy.id);
      }

      notifiedUserIds.forEach(userId => {
          const notifRef = doc(collection(firestore, `users/${userId}/notifications`));
          const newNotification: Omit<Notification, 'id'> = {
              userId,
              title: notificationTitle,
              message: notificationMessage,
              taskId: task.id,
              isRead: false,
              createdAt: serverTimestamp() as any,
              createdBy: newActivity.user,
          };
          batch.set(notifRef, newNotification);
      });

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
  
  const handleConfirmRejection = async () => {
    if (!revisionState.task || !revisionState.reason.trim() || !firestore || !profile) return;
    setIsSaving(true);
    
    const task = revisionState.task;
    const taskRef = doc(firestore, 'tasks', task.id);
    const newStatus = 'Revisi';

    try {
        const batch = writeBatch(firestore);

        const newComment = {
            id: `c-${crypto.randomUUID()}`,
            user: profile,
            text: `**Revision Request:** ${revisionState.reason}`,
            timestamp: new Date().toISOString(),
            replies: [],
        };
        const newComments = [...(task.comments || []), newComment];
        
        const newActivity = createActivity(profile, `requested revisions and moved task to "${newStatus}"`);
        const updatedActivities = [...(task.activities || []), newActivity];

        batch.update(taskRef, {
            status: newStatus,
            comments: newComments,
            activities: updatedActivities,
            lastActivity: newActivity,
            updatedAt: serverTimestamp(),
        });
        
        const notificationMessage = `${profile.name} requested revisions on "${task.title.substring(0, 30)}...". See comments for details.`;
        task.assigneeIds.forEach(assigneeId => {
            if (assigneeId !== profile.id) {
                const notifRef = doc(collection(firestore, `users/${assigneeId}/notifications`));
                const newNotification: Omit<Notification, 'id'> = {
                    userId: assigneeId,
                    title: 'Revisions Required',
                    message: notificationMessage,
                    taskId: task.id,
                    isRead: false,
                    createdAt: serverTimestamp() as any,
                    createdBy: newActivity.user,
                };
                batch.set(notifRef, newNotification);
            }
        });

        await batch.commit();

        setTasks(currentTasks => 
            currentTasks.map(t => t.id === task.id ? { ...t, status: newStatus, comments: newComments } : t)
        );
        toast({ title: 'Revisions Requested', description: 'The task has been sent for revision.' });

    } catch (error) {
        console.error("Failed to request revisions:", error);
        toast({ variant: 'destructive', title: 'Update Failed', description: 'Could not send task for revision.' });
    } finally {
        setIsSaving(false);
        setRevisionState({ isOpen: false, task: null, reason: '' });
    }
  }


  if (areStatusesLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <>
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
    
    <Dialog open={revisionState.isOpen} onOpenChange={(open) => !open && setRevisionState({ isOpen: false, task: null, reason: '' })}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Reason for Revision</DialogTitle>
                <DialogDescription>
                  Please provide feedback for the assignee on why this task needs revisions. This will be added as a comment.
                </DialogDescription>
            </DialogHeader>
            <div className="py-4">
                <Textarea
                    value={revisionState.reason}
                    onChange={(e) => setRevisionState(prev => ({...prev, reason: e.target.value}))}
                    placeholder="e.g., The final design is missing the client's new logo."
                    rows={4}
                />
            </div>
            <DialogFooter>
                <Button variant="ghost" onClick={() => setRevisionState({ isOpen: false, task: null, reason: '' })}>Cancel</Button>
                <Button variant="destructive" onClick={handleConfirmRejection} disabled={isSaving || !revisionState.reason.trim()}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Request Revisions
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    </>
  );
}

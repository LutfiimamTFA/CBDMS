'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { TaskCard } from './task-card';
import type { Task, WorkflowStatus, Activity, User, SharedLink, Notification, RevisionItem } from '@/lib/types';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useCollection, useFirestore, useUserProfile } from '@/firebase';
import { collection, query, orderBy, doc, updateDoc, serverTimestamp, writeBatch, where, deleteField } from 'firebase/firestore';
import { Loader2, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/context/permissions-provider';
import { KanbanColumn } from './kanban-column';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Textarea } from '../ui/textarea';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

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
  items: Omit<RevisionItem, 'id' | 'completed'>[];
  currentItemText: string;
}

export function KanbanBoard({ tasks: initialTasks, permissions = null }: KanbanBoardProps) {
  const [tasks, setTasks] = useState(initialTasks);
  const firestore = useFirestore();
  const { profile } = useUserProfile();
  const { toast } = useToast();
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [revisionState, setRevisionState] = useState<RevisionState>({ isOpen: false, task: null, items: [], currentItemText: '' });
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
      
      if (newStatus === 'Revisi' && (task.status === 'Preview' || task.status === 'Done')) {
        setRevisionState({ isOpen: true, task, items: [], currentItemText: '' });
        return; 
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

      task.assigneeIds.forEach(assigneeId => {
          if (assigneeId !== profile.id) {
              notifiedUserIds.add(assigneeId);
          }
      });
      
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
    if (!revisionState.task || revisionState.items.length === 0 || !firestore || !profile) return;
    setIsSaving(true);
    
    const task = revisionState.task;
    const taskRef = doc(firestore, 'tasks', task.id);
    const newStatus = 'Revisi';
    
    const newRevisionItems: RevisionItem[] = revisionState.items.map(item => ({
        id: crypto.randomUUID(),
        text: item.text,
        completed: false,
    }));

    try {
        const batch = writeBatch(firestore);
        
        const newActivity = createActivity(profile, `requested revisions and moved task to "${newStatus}"`);
        const updatedActivities = [...(task.activities || []), newActivity];

        batch.update(taskRef, {
            status: newStatus,
            revisionItems: newRevisionItems,
            activities: updatedActivities,
            lastActivity: newActivity,
            updatedAt: serverTimestamp(),
            // Ensure we clear the completion date if a done task is sent for revision
            actualCompletionDate: deleteField(),
        });
        
        const notificationMessage = `${profile.name} requested revisions on "${task.title.substring(0, 30)}...". See task for revision checklist.`;
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
            currentTasks.map(t => t.id === task.id ? { ...t, status: newStatus, revisionItems: newRevisionItems } : t)
        );
        toast({ title: 'Revisions Requested', description: 'The task has been sent for revision.' });

    } catch (error) {
        console.error("Failed to request revisions:", error);
        toast({ variant: 'destructive', title: 'Update Failed', description: 'Could not send task for revision.' });
    } finally {
        setIsSaving(false);
        setRevisionState({ isOpen: false, task: null, items: [], currentItemText: '' });
    }
  }
  
  const handleAddRevisionItem = () => {
    if (revisionState.currentItemText.trim()) {
        setRevisionState(prev => ({
            ...prev,
            items: [...prev.items, { text: prev.currentItemText }],
            currentItemText: '',
        }));
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
    
    <Dialog open={revisionState.isOpen} onOpenChange={(open) => !open && setRevisionState({ isOpen: false, task: null, items: [], currentItemText: '' })}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Create Revision Checklist</DialogTitle>
                <DialogDescription>
                  Revisions for task: <span className="font-bold text-foreground">{revisionState.task?.title}</span>
                </DialogDescription>
                {revisionState.task?.description && (
                    <p className="text-xs text-muted-foreground pt-1 border-l-2 pl-2 italic">
                        {revisionState.task.description}
                    </p>
                )}
            </DialogHeader>
            <div className="py-4 space-y-4">
                <div className="space-y-2">
                    {revisionState.items.map((item, index) => (
                        <div key={index} className="flex items-center gap-2 bg-secondary p-2 rounded-md">
                            <span className="flex-1 text-sm">{item.text}</span>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setRevisionState(prev => ({...prev, items: prev.items.filter((_, i) => i !== index)}))}>X</Button>
                        </div>
                    ))}
                </div>
                 <div className="flex items-center gap-2">
                    <Input 
                        value={revisionState.currentItemText}
                        onChange={(e) => setRevisionState(prev => ({...prev, currentItemText: e.target.value}))}
                        placeholder="e.g., Fix the logo placement"
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddRevisionItem())}
                    />
                    <Button onClick={handleAddRevisionItem} disabled={!revisionState.currentItemText.trim()}>
                        <Plus className="mr-2 h-4 w-4"/> Add
                    </Button>
                </div>
            </div>
            <DialogFooter>
                <Button variant="ghost" onClick={() => setRevisionState({ isOpen: false, task: null, items: [], currentItemText: '' })}>Cancel</Button>
                <Button variant="destructive" onClick={handleConfirmRejection} disabled={isSaving || revisionState.items.length === 0}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Confirm Revisions
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    </>
  );
}

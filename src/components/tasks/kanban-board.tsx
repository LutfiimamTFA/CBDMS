
'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { TaskCard } from './task-card';
import type { Task, WorkflowStatus, Activity, User, SharedLink, Notification, RevisionItem, Subtask, Attachment } from '@/lib/types';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useCollection, useFirestore, useUserProfile } from '@/firebase';
import { collection, query, orderBy, doc, updateDoc, serverTimestamp, writeBatch, where, deleteField } from 'firebase/firestore';
import { Loader2, Plus, Check, ListChecks, Paperclip } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/context/permissions-provider';
import { KanbanColumn } from './kanban-column';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { isAfter, isBefore, startOfDay, addDays, subDays } from 'date-fns';
import { Separator } from '../ui/separator';
import { Checkbox } from '../ui/checkbox';
import { useRouter } from 'next/navigation';

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
  permissions?: SharedLink['accessLevel'] | null;
  isSharedView?: boolean;
  linkId?: string;
}

interface RevisionState {
  isOpen: boolean;
  task: Task | null;
  items: Omit<RevisionItem, 'id' | 'completed'>[];
  currentItemText: string;
}

interface FinalReviewState {
  isOpen: boolean;
  task: Task | null;
}

export function KanbanBoard({ tasks: initialTasks, permissions = null, isSharedView = false, linkId }: KanbanBoardProps) {
  const [tasks, setTasks] = useState(initialTasks);
  const firestore = useFirestore();
  const { profile } = useUserProfile();
  const { toast } = useToast();
  const router = useRouter();
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [revisionState, setRevisionState] = useState<RevisionState>({ isOpen: false, task: null, items: [], currentItemText: '' });
  const [finalReviewState, setFinalReviewState] = useState<FinalReviewState>({ isOpen: false, task: null });
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
    if (isSharedView) {
      return permissions === 'status' || permissions === 'limited-edit';
    }
    if (!profile) return false;
    return true;
  }, [profile, permissions, isSharedView]);

  const filteredTasks = useMemo(() => {
    if (!tasks) return [];
    if (isSharedView) return tasks; // Don't filter in shared view

    const now = new Date();
    const thirtyDaysFromNow = addDays(now, 30);
    const sevenDaysAgo = subDays(startOfDay(now), 7);

    return tasks.filter(task => {
      switch (task.status) {
        case 'Done':
          // Show if completed within the last 7 days
          return task.actualCompletionDate && isAfter(new Date(task.actualCompletionDate), sevenDaysAgo);
        case 'To Do':
          // Show if due date is within 30 days or if there's no due date
          return !task.dueDate || isBefore(new Date(task.dueDate), thirtyDaysFromNow);
        default:
          // Always show active tasks
          return true;
      }
    });
  }, [tasks, isSharedView]);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, taskId: string) => {
    if (!canDrag) return;
    e.dataTransfer.setData('taskId', taskId);
    setDraggingTaskId(taskId);
  };
  
  const handleDragEnd = () => {
    setDraggingTaskId(null);
  }
  
  const completeTaskMovement = async (task: Task, newStatus: string) => {
    if (!firestore || !profile) return;
    
    // Optimistic UI update
    setTasks(currentTasks => 
      currentTasks.map(t => t.id === task.id ? { ...t, status: newStatus } : t)
    );

    const batch = writeBatch(firestore);
    const taskRef = doc(firestore, 'tasks', task.id);
    
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
      // Revert optimistic UI update on failure
      setTasks(currentTasks => 
          currentTasks.map(t => t.id === task.id ? { ...t, status: task.status } : t)
      );
      toast({
          variant: "destructive",
          title: "Update Failed",
          description: "Could not move the task. Please try again."
      });
    }
  }


  const handleDrop = async (e: React.DragEvent<HTMLDivElement>, newStatus: string) => {
    if (!canDrag) return;
    const taskId = e.dataTransfer.getData('taskId');
    const task = tasks.find(t => t.id === taskId);

    if (task && task.status !== newStatus) {
      if (isSharedView) {
        if (!linkId) return;
         // Optimistic UI update
        const originalTasks = tasks;
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
        return;
      }
      
      if (!firestore || !profile) return;
      
      const isEmployeeOrPIC = profile.role === 'Employee' || profile.role === 'PIC';
      const isManagerOrAdmin = profile.role === 'Manager' || profile.role === 'Super Admin';

      // Block Employee/PIC from moving task to 'Done'
      if (isEmployeeOrPIC && newStatus === 'Done') {
        toast({
            variant: "destructive",
            title: "Action Not Allowed",
            description: "Only Managers or Admins can mark tasks as 'Done'."
        });
        return;
      }
      
      // Block Employee/PIC from moving task to 'Revisi'
      if (isEmployeeOrPIC && newStatus === 'Revisi') {
        toast({
            variant: "destructive",
            title: "Action Not Allowed",
            description: "Only Managers or Admins can move tasks for revision."
        });
        return;
      }

      // Open final review dialog for Manager/Admin moving task to 'Done'
      if (isManagerOrAdmin && newStatus === 'Done') {
          setFinalReviewState({ isOpen: true, task });
          return;
      }
      
      // Open revision dialog for Manager/Admin moving task from Preview/Done to Revisi
      if (isManagerOrAdmin && newStatus === 'Revisi' && (task.status === 'Preview' || task.status === 'Done')) {
        setRevisionState({ isOpen: true, task, items: [], currentItemText: '' });
        return; 
      }
      
      await completeTaskMovement(task, newStatus);
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
  
  const handleConfirmFinalReview = async () => {
    if (!finalReviewState.task) return;
    await completeTaskMovement(finalReviewState.task, 'Done');
    setFinalReviewState({ isOpen: false, task: null });
  }

  const handleCardClick = (taskId: string) => {
    const canViewDetails = !isSharedView || (permissions && permissions !== 'view');
    if (!canViewDetails) return;
    
    const path = isSharedView ? `/share/${linkId}/tasks/${taskId}` : `/tasks/${taskId}`;
    router.push(path);
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
            tasks={filteredTasks.filter((task) => task.status === status.name)}
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
    
     <Dialog open={finalReviewState.isOpen} onOpenChange={(open) => !open && setFinalReviewState({ isOpen: false, task: null })}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Final Review</DialogTitle>
                <DialogDescription>
                    You are about to mark this task as "Done". Please review the sub-tasks and attachments to ensure everything is complete.
                </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-6">
                <h3 className="font-semibold text-base">{finalReviewState.task?.title}</h3>
                <Separator />
                <div className="space-y-3">
                    <h4 className="font-medium text-sm flex items-center gap-2"><ListChecks className="h-4 w-4" />Sub-tasks</h4>
                     <div className="space-y-2 max-h-32 overflow-y-auto pr-2">
                        {finalReviewState.task?.subtasks && finalReviewState.task.subtasks.length > 0 ? (
                             finalReviewState.task.subtasks.map(subtask => (
                                <div key={subtask.id} className="flex items-center gap-3">
                                    <Checkbox id={`final-review-${subtask.id}`} checked={subtask.completed} disabled />
                                    <label htmlFor={`final-review-${subtask.id}`} className={`flex-1 text-sm ${subtask.completed ? 'line-through text-muted-foreground' : ''}`}>
                                        {subtask.title}
                                    </label>
                                </div>
                            ))
                        ) : (
                            <p className="text-sm text-muted-foreground">No sub-tasks for this item.</p>
                        )}
                    </div>
                </div>
                 <div className="space-y-3">
                    <h4 className="font-medium text-sm flex items-center gap-2"><Paperclip className="h-4 w-4" />Attachments</h4>
                     <div className="space-y-2 max-h-32 overflow-y-auto pr-2">
                        {finalReviewState.task?.attachments && finalReviewState.task.attachments.length > 0 ? (
                             finalReviewState.task.attachments.map(att => (
                                <div key={att.id} className="flex items-center gap-2 text-sm">
                                    <span>-</span>
                                    <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">{att.name}</a>
                                </div>
                            ))
                        ) : (
                            <p className="text-sm text-muted-foreground">No attachments for this item.</p>
                        )}
                    </div>
                </div>
            </div>
            <DialogFooter>
                <Button variant="ghost" onClick={() => setFinalReviewState({ isOpen: false, task: null })}>Cancel</Button>
                <Button variant="default" onClick={handleConfirmFinalReview}>
                    <Check className="mr-2 h-4 w-4" />
                    Confirm & Complete
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    </>
  );
}

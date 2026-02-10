'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { TaskCard } from './task-card';
import type { Task, WorkflowStatus, Activity, User, Notification, RevisionItem, RevisionCycle } from '@/lib/types';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useCollection, useFirestore, useUserProfile } from '@/firebase';
import { collection, query, orderBy, doc, updateDoc, serverTimestamp, writeBatch, where, deleteField } from 'firebase/firestore';
import { Loader2, Plus, Check, ListChecks, Paperclip, UploadCloud, FileText, FileImage, Archive, HelpCircle, Edit } from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { cn } from '@/lib/utils';


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

const getFileIcon = (fileName: string): React.ReactElement => {
    if (fileName.match(/\.(pdf)$/i)) {
      return <FileText className="h-5 w-5 text-red-500" />;
    }
    if (fileName.match(/\.(doc|docx)$/i)) {
      return <FileText className="h-5 w-5 text-blue-500" />;
    }
    if (fileName.match(/\.(jpg|jpeg|png|gif)$/i)) {
      return <FileImage className="h-5 w-5 text-green-500" />;
    }
    return <FileText className="h-5 w-5 text-muted-foreground" />;
};


export function KanbanBoard({ tasks: initialTasks }: KanbanBoardProps) {
  const [tasks, setTasks] = useState(initialTasks);
  const firestore = useFirestore();
  const { profile } = useUserProfile();
  const { toast } = useToast();
  const router = useRouter();
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [revisionState, setRevisionState] = useState<RevisionState>({ isOpen: false, task: null, items: [], currentItemText: '' });
  const [finalReviewState, setFinalReviewState] = useState<FinalReviewState>({ isOpen: false, task: null });
  const [isSaving, setIsSaving] = useState(false);
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const isSuperAdmin = profile?.role === 'Super Admin';

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
    if (!profile) return false;
    if (isSuperAdmin) return mode === 'edit';
    return true;
  }, [profile, isSuperAdmin, mode]);

  const { filteredTasks, hiddenOldTasksCount } = useMemo(() => {
    if (!tasks) return { filteredTasks: [], hiddenOldTasksCount: 0 };
    
    const sevenDaysAgo = subDays(startOfDay(new Date()), 7);
    const visibleTasks: Task[] = [];
    let hiddenCount = 0;

    for (const task of tasks) {
        if (task.status === 'Done') {
            // Only show 'Done' tasks completed in the last 7 days
            if (task.actualCompletionDate && isAfter(new Date(task.actualCompletionDate), sevenDaysAgo)) {
                visibleTasks.push(task);
            } else {
                hiddenCount++;
            }
        } else {
            // Show all other tasks regardless of status or due date
            visibleTasks.push(task);
        }
    }
    return { filteredTasks: visibleTasks, hiddenOldTasksCount: hiddenCount };
  }, [tasks]);

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
    if (!canDrag) {
       toast({
        variant: "destructive",
        title: "Mode Lihat Saja (View-Only)",
        description: "Aktifkan Mode Edit untuk mengubah status tugas.",
      });
      return;
    }
    const taskId = e.dataTransfer.getData('taskId');
    const task = tasks.find(t => t.id === taskId);

    if (task && task.status !== newStatus) {
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
      
      // Open revision dialog for Manager/Admin moving task from Preview/Done to Revisi
      if (isManagerOrAdmin && newStatus === 'Revisi' && (task.status === 'Preview' || task.status === 'Done')) {
        setRevisionState({ isOpen: true, task, items: [], currentItemText: '' });
        return; 
      }
      
      await completeTaskMovement(task, newStatus);
    }
  };
  
  const handleConfirmRejection = async () => {
    if (!revisionState.task || revisionState.items.length === 0 || !firestore || !profile) {
        toast({ variant: 'destructive', title: 'Checklist Empty', description: 'Please add at least one revision point.' });
        return;
    }
    setIsSaving(true);
    const task = revisionState.task;
    const taskRef = doc(firestore, 'tasks', task.id);
    const newStatus = 'Revisi';
    const newRevisionItems: RevisionItem[] = revisionState.items.map(item => ({ id: crypto.randomUUID(), text: item.text, completed: false }));
    const newRevisionCycle: RevisionCycle = {
        cycleNumber: (task.revisionHistory?.length ?? 0) + 1,
        requestedAt: serverTimestamp() as any,
        requestedBy: { id: profile.id, name: profile.name, avatarUrl: profile.avatarUrl || '' },
        items: newRevisionItems,
    };
    const taskUpdateData: any = {
        status: newStatus,
        revisionItems: newRevisionItems,
        revisionHistory: [...(task.revisionHistory || []), newRevisionCycle],
        lastActivity: createActivity(profile, `requested revisions and moved task to "${newStatus}"`),
        updatedAt: serverTimestamp() as any,
        actualCompletionDate: deleteField(),
    };
    taskUpdateData['activities'] = [...(task.activities || []), taskUpdateData.lastActivity];
    try {
        await updateDoc(taskRef, taskUpdateData);
        toast({ title: 'Revisions Requested', description: 'The task has been sent for revision.' });
        const notificationBatch = writeBatch(firestore);
        const notificationMessage = `${profile.name} requested revisions on "${task.title.substring(0, 30)}...".`;
        task.assigneeIds.forEach(assigneeId => {
            if (assigneeId !== profile.id) {
                const notifRef = doc(collection(firestore, `users/${assigneeId}/notifications`));
                notificationBatch.set(notifRef, {
                    userId: assigneeId,
                    title: 'Revisions Required',
                    message: notificationMessage,
                    taskId: task.id,
                    isRead: false,
                    createdAt: serverTimestamp(),
                    createdBy: { id: profile.id, name: profile.name, avatarUrl: profile.avatarUrl || '' },
                });
            }
        });
        await notificationBatch.commit().catch(notifError => {
            console.error('[requestRevisions] Notification failed but task was updated:', { taskId: task.id, errorCode: (notifError as any).code, message: (notifError as any).message });
            toast({ variant: 'destructive', title: 'Task Updated, Notif Failed', description: 'The task was sent for revision, but notifications could not be sent.' });
        });

    } catch (error: any) {
        console.error('[requestRevisions] Critical task update failed:', { taskId: task.id, errorCode: error.code, message: error.message });
        setTasks(initialTasks); 
        toast({ variant: 'destructive', title: 'Update Failed', description: 'Could not send task for revision. Please try again.' });
    } finally {
        setIsSaving(false);
        setRevisionState({ isOpen: false, task: null, items: [], currentItemText: '' });
    }
  };

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
    router.push(`/tasks/${taskId}`);
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
      {isSuperAdmin && (
        <div className="mb-4 flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setMode(m => m === 'view' ? 'edit' : 'view')}>
                <Edit className="mr-2 h-4 w-4" />
                {mode === 'view' ? 'Activate Edit Mode' : 'Deactivate Edit Mode'}
            </Button>
        </div>
      )}
      {hiddenOldTasksCount > 0 && (
          <Alert className="mb-4 bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800">
              <Archive className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <AlertTitle className="text-blue-800 dark:text-blue-300">Papan Dirapikan</AlertTitle>
              <AlertDescription>
                  {hiddenOldTasksCount} tugas yang sudah selesai lebih dari 7 hari telah diarsipkan dari tampilan ini.
                  <Link href="/tasks" className="ml-2 font-semibold underline">Lihat Semua</Link>
              </AlertDescription>
          </Alert>
      )}
      <div className={cn(isSuperAdmin && mode === 'edit' && 'ring-2 ring-yellow-500 ring-inset rounded-lg')}>
        {/* Desktop View */}
        <div className="hidden md:flex h-full w-full">
          <ScrollArea className="w-full">
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
        </div>

        {/* Mobile View */}
        <div className="md:hidden flex flex-col h-full">
            <Tabs defaultValue={statuses?.[0]?.name} className="flex flex-col h-full">
                <TabsList className="grid w-full grid-cols-3">
                    {statuses?.map((status) => (
                        <TabsTrigger key={status.id} value={status.name}>{status.name}</TabsTrigger>
                    ))}
                </TabsList>
                {statuses?.map((status) => (
                    <TabsContent key={status.id} value={status.name} className="flex-1 min-h-0">
                        <ScrollArea className="h-full">
                            <div className="flex flex-col gap-3 p-1">
                                {filteredTasks.filter((task) => task.status === status.name).map(task => (
                                    <TaskCard key={task.id} task={task} />
                                ))}
                            </div>
                        </ScrollArea>
                    </TabsContent>
                ))}
            </Tabs>
        </div>
      </div>
      
      <Dialog open={revisionState.isOpen} onOpenChange={(open) => !open && setRevisionState({ isOpen: false, task: null, items: [], currentItemText: '' })}>
          <DialogContent>
              <DialogHeader>
                  <DialogTitle>Create Revision Checklist</DialogTitle>
                  <DialogDescription>
                    Revisions for task: <span className="font-bold text-foreground">{revisionState.task?.title}</span>
                  </DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-[60vh] -mx-6 px-6">
                  <div className="space-y-4 px-6 py-4">
                      {revisionState.task?.description && (
                          <div className="space-y-2">
                              <h4 className="font-semibold text-sm">Task Description</h4>
                              <div className="text-xs text-muted-foreground pt-1 border-l-2 pl-2 italic prose prose-sm dark:prose-invert max-w-none">
                                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                      {revisionState.task.description}
                                  </ReactMarkdown>
                              </div>
                          </div>
                      )}
                      
                      <div className="space-y-2">
                          <h4 className="font-semibold text-sm">Files for Review</h4>
                          <div className="space-y-2 max-h-32 overflow-y-auto pr-2">
                              {revisionState.task?.deliverables && revisionState.task.deliverables.length > 0 ? (
                                  revisionState.task.deliverables.map(att => (
                                      <div key={att.id} className="flex items-center justify-between rounded-md bg-secondary/50 p-2 text-sm">
                                          <a href={att.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 truncate hover:underline">
                                              {getFileIcon(att.name)}
                                              <span className="truncate" title={att.name}>{att.name}</span>
                                          </a>
                                      </div>
                                  ))
                              ) : (
                                  <p className="text-sm text-muted-foreground">No files were submitted for this task.</p>
                              )}
                          </div>
                      </div>
                  </div>
                  <Separator/>
                  <div className="p-6 space-y-4">
                      <h4 className="font-semibold text-sm">Revision Points</h4>
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
              </ScrollArea>
              <DialogFooter className="p-6 pt-4 border-t">
                  <Button variant="ghost" onClick={() => setRevisionState({ isOpen: false, task: null, items: [], currentItemText: '' })}>Cancel</Button>
                  <Button variant="destructive" onClick={handleConfirmRejection} disabled={isSaving || revisionState.items.length === 0}>
                      {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Request Revisions
                  </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
      
      <Dialog open={finalReviewState.isOpen} onOpenChange={(open) => !open && setFinalReviewState({ isOpen: false, task: null })}>
          <DialogContent>
              <DialogHeader>
                  <DialogTitle>Final Review & Complete Task</DialogTitle>
                  <DialogDescription>
                      You are about to mark this task as "Done". Please review the items below to ensure everything is complete.
                  </DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-[60vh] -mx-6 px-6">
                <div className="py-4 space-y-6 px-6">
                  <div className="space-y-3">
                      <h4 className="font-medium text-sm flex items-center gap-2"><ListChecks className="h-4 w-4" />Sub-tasks</h4>
                      <div className="space-y-2 max-h-32 overflow-y-auto pr-2">
                          {finalReviewState.task?.subtasks && finalReviewState.task.subtasks.length > 0 ? (
                              finalReviewState.task.subtasks.map(subtask => ( 
                                  <div key={subtask.id} className="flex items-center gap-3">
                                      <Checkbox id={`final-review-${subtask.id}`} checked={subtask.completed} disabled />
                                      <label htmlFor={`final-review-${subtask.id}`} className={`flex-1 text-sm ${subtask.completed ? 'line-through text-muted-foreground' : ''}`}>{subtask.title}</label>
                                  </div> 
                              )) 
                          ) : ( 
                              <p className="text-sm text-muted-foreground">No sub-tasks for this item.</p> 
                          )}
                      </div>
                  </div>
                  <div className="space-y-3">
                      <h4 className="font-medium text-sm flex items-center gap-2"><UploadCloud className="h-4 w-4" />Deliverables</h4>
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
              </ScrollArea>
              <DialogFooter className="p-6 pt-0">
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

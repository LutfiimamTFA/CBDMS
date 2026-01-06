
'use client';

import React, { useState, useMemo } from 'react';
import type { Task, WorkflowStatus, SharedLink, RevisionItem } from '@/lib/types';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { KanbanColumn } from '../tasks/kanban-column';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '../ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Loader2, Plus } from 'lucide-react';

interface SharedKanbanBoardProps {
  initialTasks: Task[];
  statuses: WorkflowStatus[];
  accessLevel: SharedLink['accessLevel'];
  linkId: string;
}

interface RevisionState {
  isOpen: boolean;
  task: Task | null;
  items: Omit<RevisionItem, 'id' | 'completed'>[];
  currentItemText: string;
}

export function SharedKanbanBoard({
  initialTasks,
  statuses,
  accessLevel,
  linkId,
}: SharedKanbanBoardProps) {
  const { toast } = useToast();
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const router = useRouter();
  const [revisionState, setRevisionState] = useState<RevisionState>({ isOpen: false, task: null, items: [], currentItemText: '' });
  const [isSaving, setIsSaving] = useState(false);

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
      // Intercept 'Revisi' status change to show dialog
      if (newStatus === 'Revisi') {
          setRevisionState({ isOpen: true, task, items: [], currentItemText: '' });
          return;
      }
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
        toast({
          variant: 'destructive',
          title: 'Update Failed',
          description: error.message,
        });
      }
    }
  };
  
  const handleConfirmRejection = async () => {
    if (!revisionState.task || revisionState.items.length === 0) {
        toast({ variant: 'destructive', title: 'Checklist Empty', description: 'Please add at least one revision point.' });
        return;
    }
    setIsSaving(true);
    try {
        const response = await fetch('/api/share/update-task', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                linkId,
                taskId: revisionState.task.id,
                revisionItems: revisionState.items,
            }),
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to request revisions.');
        }
        toast({ title: 'Revisions Requested', description: `Task "${revisionState.task.title}" has been moved to Revisi.` });
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Update Failed', description: error.message });
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

  const handleCardClick = (taskId: string) => {
    const path = `/share/${linkId}/tasks/${taskId}`;
    router.push(path);
  };
  
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
    <>
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

    <Dialog open={revisionState.isOpen} onOpenChange={(open) => !open && setRevisionState({ isOpen: false, task: null, items: [], currentItemText: '' })}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Create Revision Checklist</DialogTitle>
                <DialogDescription>
                  What needs to be fixed on: <span className="font-bold text-foreground">{revisionState.task?.title}</span>?
                </DialogDescription>
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
                    Request Revisions
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    </>
  );
}

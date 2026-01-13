'use client';

import React, { useState, useMemo } from 'react';
import type { WorkItem, WorkflowStatus, User, RevisionItem, RevisionCycle, Notification } from '@/lib/types';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useCollection, useFirestore, useUserProfile } from '@/firebase';
import { collection, query, orderBy, doc, updateDoc, writeBatch, where, deleteField, serverTimestamp } from 'firebase/firestore';
import { Loader2, Plus, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { KanbanColumn } from './kanban-column';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TaskCard } from './task-card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

const createActivity = (user: User, action: string) => {
  return {
    id: `act-${crypto.randomUUID()}`,
    user: { id: user.id, name: user.name, avatarUrl: user.avatarUrl || '' },
    action: action,
    timestamp: new Date().toISOString(),
  };
};

interface GenericKanbanBoardProps {
  itemType: 'tasks' | 'socialMediaPosts' | 'webArticles';
  statusCollection: 'statuses' | 'socialMediaStatuses' | 'webStatuses';
}

interface RevisionState {
  isOpen: boolean;
  item: WorkItem | null;
  items: Omit<RevisionItem, 'id' | 'completed'>[];
  currentItemText: string;
}

export function GenericKanbanBoard({ itemType, statusCollection }: GenericKanbanBoardProps) {
  const firestore = useFirestore();
  const { profile } = useUserProfile();
  const { toast } = useToast();
  const router = useRouter();

  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);
  const [revisionState, setRevisionState] = useState<RevisionState>({ isOpen: false, item: null, items: [], currentItemText: '' });
  const [isSaving, setIsSaving] = useState(false);

  const statusesQuery = useMemo(() => 
    firestore ? query(collection(firestore, statusCollection), orderBy('order')) : null, 
  [firestore, statusCollection]);
  
  const { data: statuses, isLoading: areStatusesLoading } = useCollection<WorkflowStatus>(statusesQuery);
  
  const itemsQuery = useMemo(() => {
    if (!firestore || !profile) return null;
    let q = query(collection(firestore, itemType));

    if (profile.role === 'Manager' && profile.brandIds && profile.brandIds.length > 0) {
        q = query(q, where('brandId', 'in', profile.brandIds));
    } else if (profile.role === 'Employee' || profile.role === 'PIC') {
        q = query(q, where('assigneeIds', 'array-contains', profile.id));
    } else {
        q = query(q, where('companyId', '==', profile.companyId));
    }
    
    return q;
  }, [firestore, profile, itemType]);
  
  const { data: items, isLoading: areItemsLoading } = useCollection<WorkItem>(itemsQuery);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, itemId: string) => {
    e.dataTransfer.setData('itemId', itemId);
    setDraggingItemId(itemId);
  };
  
  const handleDragEnd = () => {
    setDraggingItemId(null);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>, newStatus: string) => {
    const itemId = e.dataTransfer.getData('itemId');
    if (!itemId || !firestore || !profile) return;
    
    const item = items?.find(i => i.id === itemId);
    if (!item || (item.statusInternal || item.status) === newStatus) return;

    if (profile.role === 'Manager' || profile.role === 'Super Admin') {
        if (newStatus === 'Revisi' && (item.statusInternal === 'Preview' || item.statusInternal === 'Done')) {
            setRevisionState({ isOpen: true, item, items: [], currentItemText: '' });
            return;
        }
    }
    
    try {
      const itemRef = doc(firestore, itemType, itemId);
      const updates: Partial<WorkItem> = {
        status: newStatus,
        statusInternal: newStatus,
        lastActivity: createActivity(profile, `moved item from "${item.statusInternal}" to "${newStatus}"`),
        updatedAt: serverTimestamp() as any,
      };
      updates.activities = [...(item.activities || []), updates.lastActivity!];

      await updateDoc(itemRef, updates);
      toast({ title: "Status Updated", description: `Item moved to "${newStatus}".` });
    } catch (error) {
      console.error("Failed to update status:", error);
      toast({ variant: "destructive", title: "Update Failed" });
    }
  };

  const handleConfirmRejection = async () => {
    if (!revisionState.item || revisionState.items.length === 0 || !firestore || !profile) {
        toast({ variant: 'destructive', title: 'Checklist Empty', description: 'Please add at least one revision point.' });
        return;
    }
    setIsSaving(true);
    const item = revisionState.item;
    const itemRef = doc(firestore, itemType, item.id);
    const newStatus = 'Revisi';
    
    const newRevisionItems: RevisionItem[] = revisionState.items.map(revItem => ({ id: crypto.randomUUID(), text: revItem.text, completed: false }));
    
    const newRevisionCycle: RevisionCycle = {
        cycleNumber: (item.revisionHistory?.length ?? 0) + 1,
        requestedAt: new Date().toISOString() as any,
        requestedBy: { id: profile.id, name: profile.name, avatarUrl: profile.avatarUrl || '' },
        items: newRevisionItems,
    };
    
    const itemUpdateData: any = {
        status: newStatus,
        statusInternal: newStatus,
        revisionItems: newRevisionItems,
        revisionHistory: [...(item.revisionHistory || []), newRevisionCycle],
        lastActivity: createActivity(profile, `requested revisions and moved item to "${newStatus}"`),
        updatedAt: serverTimestamp() as any,
    };
    itemUpdateData['activities'] = [...(item.activities || []), itemUpdateData.lastActivity];
    
    try {
        await updateDoc(itemRef, itemUpdateData);
        toast({ title: 'Revisions Requested', description: 'The item has been sent for revision.' });
    } catch (error) {
        toast({ variant: 'destructive', title: 'Update Failed', description: 'Could not send item for revision.' });
    } finally {
        setIsSaving(false);
        setRevisionState({ isOpen: false, item: null, items: [], currentItemText: '' });
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

  const handleCardClick = (itemId: string) => {
    // This needs to be dynamic based on itemType
    const basePath = itemType === 'tasks' ? '/tasks' : itemType === 'socialMediaPosts' ? '/social-media/posts' : '/web/articles';
    router.push(`${basePath}/${itemId}`);
  };

  if (areStatusesLoading || areItemsLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <>
      {/* Desktop View */}
      <div className="hidden md:flex h-full w-full">
        <ScrollArea className="w-full">
          <div className="flex h-full gap-4 pb-4">
            {statuses?.map((status) => (
              <KanbanColumn
                key={status.id}
                status={status}
                tasks={(items || []).filter((item) => (item.statusInternal || item.status) === status.name)}
                onDrop={handleDrop}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onCardClick={handleCardClick}
                canDrag={true}
                draggingTaskId={draggingItemId}
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
                  {(items || []).filter((task) => (task.statusInternal || task.status) === status.name).map(task => (
                    <TaskCard key={task.id} task={task} />
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          ))}
        </Tabs>
      </div>
      
      <Dialog open={revisionState.isOpen} onOpenChange={(open) => !open && setRevisionState({ isOpen: false, item: null, items: [], currentItemText: '' })}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Create Revision Checklist</DialogTitle>
                <DialogDescription>
                  Revisions for item: <span className="font-bold text-foreground">{revisionState.item?.title}</span>
                </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
                <div className="space-y-2">
                    {revisionState.items.map((item, index) => (
                        <div key={index} className="flex items-center gap-2 bg-secondary p-2 rounded-md">
                            <span className="flex-1 text-sm">{item.text}</span>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setRevisionState(prev => ({...prev, items: prev.items.filter((_, i) => i !== index)}))}><XCircle className="h-4 w-4" /></Button>
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
                <Button variant="ghost" onClick={() => setRevisionState({ isOpen: false, item: null, items: [], currentItemText: '' })}>Cancel</Button>
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

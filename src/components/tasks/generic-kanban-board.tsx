'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { WorkItem, WorkflowStatus, User, RevisionItem, RevisionCycle, Notification } from '@/lib/types';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useCollection, useFirestore, useUserProfile } from '@/firebase';
import { collection, query, orderBy, doc, updateDoc, writeBatch, where, deleteField, serverTimestamp } from 'firebase/firestore';
import { Loader2, Plus, XCircle, HelpCircle, Archive, History, Link as LinkIcon, Edit } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { KanbanColumn } from './kanban-column';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TaskCard } from './task-card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { isAfter, subDays } from 'date-fns';
import { Alert, AlertTitle, AlertDescription } from '../ui/alert';
import Link from 'next/link';
import { cn } from '@/lib/utils';


const createActivity = (user: User, action: string) => {
  return {
    id: `act-${crypto.randomUUID()}`,
    user: { id: user.id, name: user.name, avatarUrl: user.avatarUrl || '' },
    action: action,
    timestamp: new Date().toISOString(),
  };
};

interface GenericKanbanBoardProps {
  items: WorkItem[];
  users: User[];
  isLoading: boolean;
  itemType: 'tasks' | 'socialMediaPosts' | 'webArticles';
  statusCollection: 'statuses' | 'socialMediaStatuses' | 'webStatuses';
}

interface RevisionState {
  isOpen: boolean;
  item: WorkItem | null;
  items: Omit<RevisionItem, 'id' | 'completed'>[];
  currentItemText: string;
}

export function GenericKanbanBoard({ items: allItems, users, isLoading: areItemsLoading, itemType, statusCollection }: GenericKanbanBoardProps) {
  const firestore = useFirestore();
  const { profile } = useUserProfile();
  const { toast } = useToast();
  const router = useRouter();

  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);
  const [revisionState, setRevisionState] = useState<RevisionState>({ isOpen: false, item: null, items: [], currentItemText: '' });
  const [isSaving, setIsSaving] = useState(false);

  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const isSuperAdmin = profile?.role === 'Super Admin';

  const statusesQuery = useMemo(() => 
    firestore ? query(collection(firestore, statusCollection), orderBy('order')) : null, 
  [firestore, statusCollection]);
  
  const { data: statuses, isLoading: areStatusesLoading } = useCollection<WorkflowStatus>(statusesQuery);
  
  const { visibleItems, hiddenOldItemsCount } = useMemo(() => {
    if (!allItems) return { visibleItems: [], hiddenOldItemsCount: 0 };
    
    const sevenDaysAgo = subDays(new Date(), 7);
    const visibleItems: WorkItem[] = [];
    let hiddenCount = 0;

    for (const item of allItems) {
        const status = item.statusInternal || item.status;
        if (status === 'Done' || status === 'Posted') {
            if (item.actualCompletionDate && isAfter(new Date(item.actualCompletionDate), sevenDaysAgo)) {
                visibleItems.push(item);
            } else {
                hiddenCount++;
            }
        } else {
            visibleItems.push(item);
        }
    }
    return { visibleItems, hiddenOldItemsCount: hiddenCount };
  }, [allItems]);

  const listPagePath = useMemo(() => {
    switch (itemType) {
        case 'socialMediaPosts': return '/social-media/posts';
        case 'webArticles': return '/web/articles';
        case 'tasks':
        default:
            return '/tasks';
    }
  }, [itemType]);
  
  const canDrag = useMemo(() => {
    if (!profile) return false;
    if (isSuperAdmin) return mode === 'edit';
    return true;
  }, [profile, isSuperAdmin, mode]);


  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, itemId: string) => {
    if (!canDrag) return;
    e.dataTransfer.setData('itemId', itemId);
    setDraggingItemId(itemId);
  };
  
  const handleDragEnd = () => {
    setDraggingItemId(null);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>, newStatus: string) => {
    const itemId = e.dataTransfer.getData('itemId');
    if (!itemId || !firestore || !profile) return;
    
    if (!canDrag) {
      toast({
        variant: 'destructive',
        title: "Mode Lihat Saja (View-Only)",
        description: "Aktifkan Mode Edit untuk mengubah status tugas.",
      });
      return;
    }
    
    const item = allItems?.find(i => i.id === itemId);
    if (!item || (item.statusInternal || item.status) === newStatus) return;

    if (profile.role === 'Manager' || profile.role === 'Super Admin') {
        if (newStatus === 'Revisi' && ((item.statusInternal || item.status) === 'Preview' || (item.statusInternal || item.status) === 'Done')) {
            setRevisionState({ isOpen: true, item, items: [], currentItemText: '' });
            return;
        }
    }
    
    try {
      const itemRef = doc(firestore, itemType, itemId);
      const updates: Partial<WorkItem> = {
        status: newStatus,
        statusInternal: newStatus,
        lastActivity: createActivity(profile, `moved item from "${item.statusInternal || item.status}" to "${newStatus}"`),
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
    const basePath = itemType === 'tasks' ? '/tasks' : itemType === 'socialMediaPosts' ? '/social-media/posts' : '/web/articles';
    router.push(`${basePath}/${itemId}`);
  };

  const isLoading = areStatusesLoading || areItemsLoading;

  return (
    <>
      {isSuperAdmin && (
        <div className="px-4 md:px-6 mb-4 flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setMode(m => m === 'view' ? 'edit' : 'view')}>
                <Edit className="mr-2 h-4 w-4" />
                {mode === 'view' ? 'Activate Edit Mode' : 'Deactivate Edit Mode'}
            </Button>
        </div>
      )}
      <div className={cn("flex-1 overflow-hidden h-full flex flex-col transition-all duration-300", isSuperAdmin && mode === 'edit' && "ring-2 ring-yellow-500 ring-inset rounded-lg")}>
        {hiddenOldItemsCount > 0 && (
            <Alert className="mb-4 bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800 mx-4 md:mx-6">
                <Archive className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <AlertTitle className="text-blue-800 dark:text-blue-300">Papan Dirapikan</AlertTitle>
                <AlertDescription>
                    {hiddenOldItemsCount} item yang sudah selesai lebih dari 7 hari telah diarsipkan dari tampilan ini.
                    <Link href={listPagePath} className="ml-2 font-semibold underline">Lihat Semua</Link>
                </AlertDescription>
            </Alert>
        )}
        
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <>
            {/* Desktop View */}
            <div className="hidden md:flex h-full w-full px-4 md:px-6">
              <ScrollArea className="w-full">
                <div className="flex h-full gap-4 pb-4">
                  {statuses?.map((status) => (
                    <KanbanColumn
                      key={status.id}
                      status={status}
                      tasks={(visibleItems || []).filter((item) => (item.statusInternal || item.status) === status.name)}
                      onDrop={handleDrop}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      onCardClick={handleCardClick}
                      canDrag={canDrag}
                      draggingTaskId={draggingItemId}
                      workstream={itemType}
                      users={users}
                    />
                  ))}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </div>

            {/* Mobile View */}
            <div className="md:hidden flex flex-col h-full px-4 md:px-6">
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
                        {(visibleItems || []).filter((task) => (task.statusInternal || task.status) === status.name).map(task => (
                          <TaskCard key={task.id} task={task} />
                        ))}
                      </div>
                    </ScrollArea>
                  </TabsContent>
                ))}
              </Tabs>
            </div>
          </>
        )}
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

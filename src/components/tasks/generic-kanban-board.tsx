
'use client';

import React, { useState, useMemo } from 'react';
import { TaskCard } from './task-card';
import type { WorkItem, WorkflowStatus } from '@/lib/types';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useCollection, useFirestore, useUserProfile } from '@/firebase';
import { collection, query, orderBy, doc, updateDoc, where } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { KanbanColumn } from './kanban-column';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface GenericKanbanBoardProps {
  itemType: 'tasks' | 'socialMediaPosts' | 'webArticles';
  statusCollection: 'statuses' | 'socialMediaStatuses' | 'webStatuses';
}

export function GenericKanbanBoard({ itemType, statusCollection }: GenericKanbanBoardProps) {
  const firestore = useFirestore();
  const { profile } = useUserProfile();
  const { toast } = useToast();
  const router = useRouter();

  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);

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

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, taskId: string) => {
    e.dataTransfer.setData('taskId', taskId);
    setDraggingTaskId(taskId);
  };
  
  const handleDragEnd = () => {
    setDraggingTaskId(null);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>, newStatus: string) => {
    const taskId = e.dataTransfer.getData('taskId');
    if (!taskId || !firestore) return;
    
    try {
      const taskRef = doc(firestore, itemType, taskId);
      await updateDoc(taskRef, { status: newStatus, statusInternal: newStatus });
      toast({ title: "Status Updated", description: `Item moved to "${newStatus}".` });
    } catch (error) {
      console.error("Failed to update status:", error);
      toast({ variant: "destructive", title: "Update Failed" });
    }
  };

  const handleCardClick = (itemId: string) => {
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
                  {(items || []).filter((task) => (task.statusInternal || task.status) === status.name).map(task => (
                    <TaskCard key={task.id} task={task} />
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </>
  );
}

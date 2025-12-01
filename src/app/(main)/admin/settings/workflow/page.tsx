
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Header } from '@/components/layout/header';
import { useCollection, useFirestore, useUserProfile } from '@/firebase';
import {
  collection,
  doc,
  query,
  orderBy,
  writeBatch,
  addDoc,
  deleteDoc,
  updateDoc,
  getDocs
} from 'firebase/firestore';
import type { WorkflowStatus } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, Trash2, Edit, GripVertical } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';

const defaultStatuses: Omit<WorkflowStatus, 'id' | 'companyId'>[] = [
    { name: 'To Do', order: 0, color: 'bg-gray-500' },
    { name: 'Doing', order: 1, color: 'bg-blue-500' },
    { name: 'Done', order: 2, color: 'bg-green-500' },
];

export default function WorkflowSettingsPage() {
  const firestore = useFirestore();
  const { profile } = useUserProfile();
  const { toast } = useToast();

  const [statuses, setStatuses] = useState<WorkflowStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isNewStatusDialogOpen, setNewStatusDialogOpen] = useState(false);
  const [newStatusName, setNewStatusName] = useState('');
  
  const [editStatus, setEditStatus] = useState<WorkflowStatus | null>(null);
  const [deleteStatus, setDeleteStatus] = useState<WorkflowStatus | null>(null);

  const statusesCollectionRef = useMemo(
    () =>
      firestore && profile
        ? query(
            collection(firestore, 'statuses'),
            // where('companyId', '==', profile.companyId),
            orderBy('order')
          )
        : null,
    [firestore, profile]
  );
  
  const { data: dbStatuses, isLoading: isDbStatusesLoading } = useCollection<WorkflowStatus>(statusesCollectionRef);

  useEffect(() => {
    if (dbStatuses) {
        setStatuses(dbStatuses);
    }
  }, [dbStatuses]);

  // Effect to seed initial statuses if the collection is empty
  useEffect(() => {
    if (!statusesCollectionRef || isDbStatusesLoading || !firestore || !profile) return;
    
    const seedInitialStatuses = async () => {
        const snapshot = await getDocs(statusesCollectionRef);
        if (snapshot.empty) {
            const batch = writeBatch(firestore);
            defaultStatuses.forEach(status => {
                const docRef = doc(collection(firestore, 'statuses'));
                batch.set(docRef, { ...status, companyId: profile.companyId });
            });
            await batch.commit();
            toast({
                title: 'Workflow Initialized',
                description: 'Default statuses (To Do, Doing, Done) have been created.'
            })
        }
        setIsLoading(false);
    }

    seedInitialStatuses();
  }, [statusesCollectionRef, isDbStatusesLoading, firestore, profile, toast]);
  

  const handleCreateStatus = async () => {
    if (!newStatusName.trim() || !firestore || !profile) return;
    try {
      await addDoc(collection(firestore, 'statuses'), {
        name: newStatusName,
        order: statuses.length,
        color: 'bg-purple-500', // Default color for new statuses
        companyId: profile.companyId,
      });
      toast({ title: 'Status Created', description: `Status "${newStatusName}" has been added.` });
      setNewStatusName('');
      setNewStatusDialogOpen(false);
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not create status.' });
    }
  };
  
  const handleUpdateStatus = async () => {
    if (!editStatus || !editStatus.name.trim() || !firestore) return;
     try {
      const docRef = doc(firestore, 'statuses', editStatus.id);
      await updateDoc(docRef, { name: editStatus.name });
      toast({ title: 'Status Updated', description: 'Status name has been changed.' });
      setEditStatus(null);
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not update status.' });
    }
  };

  const handleDeleteStatus = async () => {
    if (!deleteStatus || !firestore) return;
     try {
      // TODO: Add logic to handle tasks that currently have this status
      const docRef = doc(firestore, 'statuses', deleteStatus.id);
      await deleteDoc(docRef);
      toast({ title: 'Status Deleted', description: `Status "${deleteStatus.name}" has been removed.` });
      setDeleteStatus(null);
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not delete status.' });
    }
  }
  
  const onDragEnd = async (result: DropResult) => {
    if (!result.destination || !firestore) {
      return;
    }
    
    const items = Array.from(statuses);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    // Optimistically update UI
    setStatuses(items);

    // Update 'order' field in Firestore
    const batch = writeBatch(firestore);
    items.forEach((status, index) => {
        const docRef = doc(firestore, 'statuses', status.id);
        batch.update(docRef, { order: index });
    });

    try {
        await batch.commit();
        toast({ title: 'Workflow Order Updated' });
    } catch (error) {
        console.error(error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not save the new order.' });
        // Revert UI if Firestore update fails
        setStatuses(dbStatuses || []);
    }
  };


  if (isLoading) {
      return <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="flex h-svh flex-col bg-background">
      <Header title="Workflow Settings" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="mx-auto max-w-2xl space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Manage Workflow</h2>
                    <p className="text-muted-foreground">
                        Customize the columns on your Kanban board. Drag to reorder.
                    </p>
                </div>
                <Dialog open={isNewStatusDialogOpen} onOpenChange={setNewStatusDialogOpen}>
                    <DialogTrigger asChild>
                        <Button><Plus className="mr-2 h-4 w-4" /> Add Status</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Create New Status</DialogTitle>
                            <DialogDescription>
                               This will add a new column to your team's Kanban board.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-2">
                           <Label htmlFor="new-status-name">Status Name</Label>
                           <Input id="new-status-name" value={newStatusName} onChange={(e) => setNewStatusName(e.target.value)} placeholder="e.g. In Review"/>
                        </div>
                        <DialogFooter>
                            <Button variant="ghost" onClick={() => setNewStatusDialogOpen(false)}>Cancel</Button>
                            <Button onClick={handleCreateStatus}>Create</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
            
            <div className="rounded-lg border p-4">
                <DragDropContext onDragEnd={onDragEnd}>
                    <Droppable droppableId="statuses">
                        {(provided) => (
                             <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                                {statuses.map((status, index) => (
                                    <Draggable key={status.id} draggableId={status.id} index={index}>
                                        {(provided) => (
                                            <div
                                                ref={provided.innerRef}
                                                {...provided.draggableProps}
                                                {...provided.dragHandleProps}
                                                className="flex items-center justify-between rounded-md bg-secondary/50 p-3"
                                            >
                                                <div className='flex items-center gap-3'>
                                                    <GripVertical className="h-5 w-5 text-muted-foreground"/>
                                                    <span className={`h-3 w-3 rounded-full ${status.color}`}></span>
                                                    <span className="font-medium">{status.name}</span>
                                                </div>
                                                <div className='flex items-center gap-2'>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditStatus(status)}>
                                                        <Edit className="h-4 w-4"/>
                                                    </Button>
                                                    {status.name !== 'To Do' && status.name !== 'Done' && (
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteStatus(status)}>
                                                            <Trash2 className="h-4 w-4"/>
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </Draggable>
                                ))}
                                {provided.placeholder}
                            </div>
                        )}
                    </Droppable>
                </DragDropContext>
            </div>
        </div>
      </main>

       {/* Edit Dialog */}
      <Dialog open={!!editStatus} onOpenChange={(isOpen) => !isOpen && setEditStatus(null)}>
          <DialogContent>
              <DialogHeader>
                  <DialogTitle>Edit Status Name</DialogTitle>
              </DialogHeader>
              <div className="space-y-2">
                  <Label htmlFor="edit-status-name">Status Name</Label>
                  <Input id="edit-status-name" value={editStatus?.name || ''} onChange={(e) => setEditStatus(s => s ? {...s, name: e.target.value} : null)} />
              </div>
              <DialogFooter>
                  <Button variant="ghost" onClick={() => setEditStatus(null)}>Cancel</Button>
                  <Button onClick={handleUpdateStatus}>Save Changes</Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
       <AlertDialog open={!!deleteStatus} onOpenChange={(isOpen) => !isOpen && setDeleteStatus(null)}>
          <AlertDialogContent>
              <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                      This will permanently delete the "{deleteStatus?.name}" status. Any tasks currently with this status will need to be moved. This action cannot be undone.
                  </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteStatus} className="bg-destructive hover:bg-destructive/90">
                    Confirm Deletion
                  </AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

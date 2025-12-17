'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
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
import { Loader2, Plus, Trash2, Edit, Save, GripVertical, Eye } from 'lucide-react';
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
import { cn } from '@/lib/utils';

const defaultStatuses: Omit<WorkflowStatus, 'id' | 'companyId'>[] = [
    { name: 'To Do', order: 0, color: '#808080' },
    { name: 'Doing', order: 1, color: '#3b82f6' },
    { name: 'Preview', order: 2, color: '#a855f7' },
    { name: 'Revisi', order: 3, color: '#f97316' }, // Added Revisi status
    { name: 'Done', order: 4, color: '#22c55e' },
];

export default function WorkflowSettingsPage() {
  const firestore = useFirestore();
  const { profile } = useUserProfile();
  const { toast } = useToast();

  const [statuses, setStatuses] = useState<WorkflowStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isNewStatusDialogOpen, setNewStatusDialogOpen] = useState(false);
  const [newStatusName, setNewStatusName] = useState('');
  const [newStatusColor, setNewStatusColor] = useState('#6b21a8');
  
  const [editStatus, setEditStatus] = useState<WorkflowStatus | null>(null);
  const [deleteStatus, setDeleteStatus] = useState<WorkflowStatus | null>(null);

  // Drag and drop state
  const draggedItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);


  const statusesCollectionRef = useMemo(
    () =>
      firestore && profile
        ? query(
            collection(firestore, 'statuses'),
            orderBy('order')
          )
        : null,
    [firestore, profile]
  );
  
  const { data: dbStatuses, isLoading: isDbStatusesLoading } = useCollection<WorkflowStatus>(statusesCollectionRef);

  useEffect(() => {
    if (dbStatuses) {
        setStatuses(dbStatuses);
        setIsLoading(false);
    }
  }, [dbStatuses]);

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
                description: 'Default statuses have been created.'
            })
        }
        if (!isDbStatusesLoading) setIsLoading(false);
    }

    seedInitialStatuses();
  }, [statusesCollectionRef, isDbStatusesLoading, firestore, profile, toast]);
  
  const handleDragEnd = async () => {
    if (draggedItem.current === null || dragOverItem.current === null || !firestore) return;
    
    const statusesClone = [...statuses];
    const dragged = statusesClone.splice(draggedItem.current, 1)[0];
    statusesClone.splice(dragOverItem.current, 0, dragged);
    
    setStatuses(statusesClone); // Optimistic UI update

    draggedItem.current = null;
    dragOverItem.current = null;
    
    // Auto-save the new order
    const batch = writeBatch(firestore);
    statusesClone.forEach((status, index) => {
        const docRef = doc(firestore, 'statuses', status.id);
        batch.update(docRef, { order: index });
    });
    
    try {
        await batch.commit();
        toast({ title: 'Order Saved', description: 'Your workflow order has been automatically updated.' });
    } catch (error) {
        console.error('Failed to save order:', error);
        setStatuses(statuses); // Revert on failure
        toast({ variant: 'destructive', title: 'Error', description: 'Could not save the new order.' });
    }
  };

  const handleCreateStatus = async () => {
    if (!newStatusName.trim() || !firestore || !profile) return;
    try {
      await addDoc(collection(firestore, 'statuses'), {
        name: newStatusName,
        order: statuses.length,
        color: newStatusColor,
        companyId: profile.companyId,
      });
      toast({ title: 'Status Created', description: `Status "${newStatusName}" has been added.` });
      setNewStatusName('');
      setNewStatusColor('#6b21a8');
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
      await updateDoc(docRef, { name: editStatus.name, color: editStatus.color });
      toast({ title: 'Status Updated', description: 'Status has been changed.' });
      setEditStatus(null);
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not update status.' });
    }
  };

  const handleDeleteStatus = async () => {
    if (!deleteStatus || !firestore) return;
     try {
      const docRef = doc(firestore, 'statuses', deleteStatus.id);
      await deleteDoc(docRef);
      const remainingStatuses = statuses.filter(s => s.id !== deleteStatus.id);
      
      const batch = writeBatch(firestore);
      remainingStatuses.forEach((status, index) => {
            const docRef = doc(firestore, 'statuses', status.id);
            batch.update(docRef, { order: index });
        });
      await batch.commit();

      toast({ title: 'Status Deleted', description: `Status "${deleteStatus.name}" has been removed.` });
      setDeleteStatus(null);
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not delete status.' });
    }
  }

  if (isLoading) {
      return <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="flex h-svh flex-col bg-background">
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="mx-auto max-w-2xl space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Manage Workflow</h2>
                    <p className="text-muted-foreground">
                        Customize the columns on your Kanban board. Drag and drop to reorder.
                    </p>
                </div>
                <div className='flex gap-2'>
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
                          <div className="space-y-4">
                             <div className='space-y-2'>
                               <Label htmlFor="new-status-name">Status Name</Label>
                               <Input id="new-status-name" value={newStatusName} onChange={(e) => setNewStatusName(e.target.value)} placeholder="e.g. In Review"/>
                             </div>
                             <div className='space-y-2'>
                               <Label htmlFor="new-status-color">Status Color</Label>
                               <div className='flex items-center gap-2'>
                                  <Input id="new-status-color" type="color" value={newStatusColor} onChange={(e) => setNewStatusColor(e.target.value)} className="w-16 h-10 p-1"/>
                                  <span className='text-sm text-muted-foreground'>Choose a color for this status.</span>
                               </div>
                             </div>
                          </div>
                          <DialogFooter>
                              <Button variant="ghost" onClick={() => setNewStatusDialogOpen(false)}>Cancel</Button>
                              <Button onClick={handleCreateStatus}>Create</Button>
                          </DialogFooter>
                      </DialogContent>
                  </Dialog>
                </div>
            </div>
            
            <div className="rounded-lg border p-4">
                <div className="space-y-2">
                    {statuses.map((status, index) => (
                        <div
                            key={status.id}
                            className={cn(
                                "flex items-center justify-between rounded-md bg-secondary/50 p-2 transition-all cursor-grab active:cursor-grabbing",
                                draggedItem.current === index && 'opacity-50'
                            )}
                            draggable
                            onDragStart={() => (draggedItem.current = index)}
                            onDragEnter={() => (dragOverItem.current = index)}
                            onDragEnd={handleDragEnd}
                            onDragOver={(e) => e.preventDefault()}
                        >
                            <div className='flex items-center gap-3'>
                                <GripVertical className='h-5 w-5 text-muted-foreground' />
                                {status.name === 'Preview' ? (
                                    <Eye className="h-4 w-4" style={{ color: status.color }}/>
                                ) : (
                                   <span className="h-3 w-3 rounded-full" style={{ backgroundColor: status.color }}></span>
                                )}
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
                    ))}
                </div>
            </div>
        </div>
      </main>

       {/* Edit Dialog */}
      <Dialog open={!!editStatus} onOpenChange={(isOpen) => !isOpen && setEditStatus(null)}>
          <DialogContent>
              <DialogHeader>
                  <DialogTitle>Edit Status</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className='space-y-2'>
                  <Label htmlFor="edit-status-name">Status Name</Label>
                  <Input id="edit-status-name" value={editStatus?.name || ''} onChange={(e) => setEditStatus(s => s ? {...s, name: e.target.value} : null)} />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor="edit-status-color">Status Color</Label>
                  <Input id="edit-status-color" type="color" value={editStatus?.color || ''} onChange={(e) => setEditStatus(s => s ? {...s, color: e.target.value} : null)} className="w-16 h-10 p-1"/>
                </div>
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

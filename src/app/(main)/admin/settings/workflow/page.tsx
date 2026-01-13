
'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
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
} from 'firebase/firestore';
import type { WorkflowStatus } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, Trash2, Edit, Save, GripVertical } from 'lucide-react';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type WorkflowType = 'tasks' | 'socialMedia' | 'web';

const collectionMap: Record<WorkflowType, string> = {
  tasks: 'statuses',
  socialMedia: 'socialMediaStatuses',
  web: 'webStatuses',
};

const WorkflowSection = ({ type, title, description }: { type: WorkflowType, title: string, description: string }) => {
  const firestore = useFirestore();
  const { profile } = useUserProfile();
  const { toast } = useToast();

  const collectionName = collectionMap[type];

  const [statuses, setStatuses] = useState<WorkflowStatus[]>([]);
  const [isNewStatusDialogOpen, setNewStatusDialogOpen] = useState(false);
  const [newStatusName, setNewStatusName] = useState('');
  const [newStatusColor, setNewStatusColor] = useState('#6b21a8');
  
  const [editStatus, setEditStatus] = useState<WorkflowStatus | null>(null);
  const [deleteStatus, setDeleteStatus] = useState<WorkflowStatus | null>(null);

  const draggedItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  const statusesCollectionRef = useMemo(
    () =>
      firestore && profile
        ? query(collection(firestore, collectionName), orderBy('order'))
        : null,
    [firestore, profile, collectionName]
  );
  
  const { data: dbStatuses, isLoading: isDbStatusesLoading } = useCollection<WorkflowStatus>(statusesCollectionRef);

  useEffect(() => {
    if (dbStatuses) {
        setStatuses(dbStatuses);
    }
  }, [dbStatuses]);
  
  const handleDragEnd = async () => {
    if (draggedItem.current === null || dragOverItem.current === null || !firestore) return;
    
    let statusesClone = [...statuses];
    const dragged = statusesClone.splice(draggedItem.current, 1)[0];
    statusesClone.splice(dragOverItem.current, 0, dragged);
    
    setStatuses(statusesClone); 

    draggedItem.current = null;
    dragOverItem.current = null;
    
    const batch = writeBatch(firestore);
    statusesClone.forEach((status, index) => {
        const docRef = doc(firestore, collectionName, status.id);
        batch.update(docRef, { order: index });
    });
    
    try {
        await batch.commit();
        toast({ title: 'Order Saved', description: `Your ${title} order has been updated.` });
    } catch (error) {
        setStatuses(statuses); 
        toast({ variant: 'destructive', title: 'Error', description: 'Could not save the new order.' });
    }
  };

  const handleCreateStatus = async () => {
    if (!newStatusName.trim() || !firestore || !profile) return;
    try {
      await addDoc(collection(firestore, collectionName), {
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
      toast({ variant: 'destructive', title: 'Error', description: 'Could not create status.' });
    }
  };
  
  const handleUpdateStatus = async () => {
    if (!editStatus || !editStatus.name.trim() || !firestore) return;
     try {
      const docRef = doc(firestore, collectionName, editStatus.id);
      await updateDoc(docRef, { name: editStatus.name, color: editStatus.color });
      toast({ title: 'Status Updated', description: 'Status has been changed.' });
      setEditStatus(null);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not update status.' });
    }
  };

  const handleDeleteStatus = async () => {
    if (!deleteStatus || !firestore) return;
     try {
      const docRef = doc(firestore, collectionName, deleteStatus.id);
      await deleteDoc(docRef);
      const remainingStatuses = statuses.filter(s => s.id !== deleteStatus.id);
      
      const batch = writeBatch(firestore);
      remainingStatuses.forEach((status, index) => {
            const docRef = doc(firestore, collectionName, status.id);
            batch.update(docRef, { order: index });
        });
      await batch.commit();

      toast({ title: 'Status Deleted', description: `Status "${deleteStatus.name}" has been removed.` });
      setDeleteStatus(null);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not delete status.' });
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
           <Dialog open={isNewStatusDialogOpen} onOpenChange={setNewStatusDialogOpen}>
                <DialogTrigger asChild>
                    <Button variant="outline" size="sm"><Plus className="mr-2 h-4 w-4" /> Add Status</Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create Status for {title}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className='space-y-2'>
                        <Label htmlFor={`new-${type}-name`}>Status Name</Label>
                        <Input id={`new-${type}-name`} value={newStatusName} onChange={(e) => setNewStatusName(e.target.value)} placeholder="e.g. In Review"/>
                        </div>
                        <div className='space-y-2'>
                        <Label htmlFor={`new-${type}-color`}>Status Color</Label>
                        <div className='flex items-center gap-2'>
                            <Input id={`new-${type}-color`} type="color" value={newStatusColor} onChange={(e) => setNewStatusColor(e.target.value)} className="w-16 h-10 p-1"/>
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
      </CardHeader>
      <CardContent>
          <div className="space-y-2">
              {isDbStatusesLoading ? <div className='flex justify-center p-4'><Loader2 className="h-6 w-6 animate-spin"/></div> : (
              statuses.map((status, index) => (
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
                          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: status.color }}></span>
                          <span className="font-medium">{status.name}</span>
                      </div>
                      <div className='flex items-center gap-2'>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditStatus(status)}>
                              <Edit className="h-4 w-4"/>
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteStatus(status)}>
                              <Trash2 className="h-4 w-4"/>
                          </Button>
                      </div>
                  </div>
              )))}
              {statuses.length === 0 && !isDbStatusesLoading && (
                <div className="text-center py-8 text-muted-foreground">
                    No statuses found. Click "Add Status" to create one.
                </div>
              )}
          </div>
           {/* Edit Dialog */}
          <Dialog open={!!editStatus} onOpenChange={(isOpen) => !isOpen && setEditStatus(null)}>
              <DialogContent>
                  <DialogHeader>
                      <DialogTitle>Edit Status</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className='space-y-2'>
                      <Label htmlFor={`edit-${type}-name`}>Status Name</Label>
                      <Input id={`edit-${type}-name`} value={editStatus?.name || ''} onChange={(e) => setEditStatus(s => s ? {...s, name: e.target.value} : null)} />
                    </div>
                    <div className='space-y-2'>
                      <Label htmlFor={`edit-${type}-color`}>Status Color</Label>
                      <Input id={`edit-${type}-color`} type="color" value={editStatus?.color || ''} onChange={(e) => setEditStatus(s => s ? {...s, color: e.target.value} : null)} className="w-16 h-10 p-1"/>
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
                          This will permanently delete the "{deleteStatus?.name}" status. Any items currently with this status will need to be moved. This action cannot be undone.
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
      </CardContent>
    </Card>
  );
}


export default function WorkflowPage() {

  return (
    <div className="flex h-svh flex-col bg-background p-4 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
            <h2 className="text-2xl font-bold tracking-tight">Manage Workflows</h2>
            <p className="text-muted-foreground">
                Customize the columns for each module. Drag and drop to reorder.
            </p>
        </div>
      </div>
      <div className="grid lg:grid-cols-3 gap-6">
        <WorkflowSection type="tasks" title="Task Workflow" description="Statuses for general tasks and projects."/>
        <WorkflowSection type="socialMedia" title="Social Media Workflow" description="Statuses for social media posts."/>
        <WorkflowSection type="web" title="Web Content Workflow" description="Statuses for web articles."/>
      </div>
    </div>
  );
}

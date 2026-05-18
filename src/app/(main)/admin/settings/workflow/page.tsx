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
  where,
} from 'firebase/firestore';
import type { WorkflowStatus } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Loader2,
  Plus,
  Trash2,
  Edit,
  GripVertical,
  AlertTriangle,
} from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type WorkflowType = 'tasks' | 'socialMedia' | 'web';

const defaultStatuses: Record<
  WorkflowType,
  Omit<WorkflowStatus, 'id' | 'companyId'>[]
> = {
  tasks: [
    { name: 'To Do', order: 0, color: '#808080', workstream: 'tasks' },
    { name: 'Doing', order: 1, color: '#3b82f6', workstream: 'tasks' },
    { name: 'Preview', order: 2, color: '#a855f7', workstream: 'tasks' },
    { name: 'Revisi', order: 3, color: '#f97316', workstream: 'tasks' },
    { name: 'Done', order: 4, color: '#22c55e', workstream: 'tasks' },
  ],
  socialMedia: [
    { name: 'Idea', order: 0, color: '#808080', workstream: 'socialMedia' },
    { name: 'Draft', order: 1, color: '#3b82f6', workstream: 'socialMedia' },
    { name: 'Review', order: 2, color: '#a855f7', workstream: 'socialMedia' },
    { name: 'Scheduled', order: 3, color: '#f97316', workstream: 'socialMedia' },
    { name: 'Published', order: 4, color: '#22c55e', workstream: 'socialMedia' },
  ],
  web: [
    { name: 'Backlog', order: 0, color: '#808080', workstream: 'web' },
    { name: 'Writing', order: 1, color: '#3b82f6', workstream: 'web' },
    { name: 'Review', order: 2, color: '#a855f7', workstream: 'web' },
    { name: 'Revision', order: 3, color: '#f97316', workstream: 'web' },
    { name: 'Published', order: 4, color: '#22c55e', workstream: 'web' },
  ],
};

export default function WorkflowPage() {
  const firestore = useFirestore();
  const { profile } = useUserProfile();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<WorkflowType>('tasks');
  const [statuses, setStatuses] = useState<WorkflowStatus[]>([]);
  const [isMigrating, setIsMigrating] = useState(false);

  const [isNewStatusDialogOpen, setNewStatusDialogOpen] = useState(false);
  const [newStatusName, setNewStatusName] = useState('');
  const [newStatusColor, setNewStatusColor] = useState('#6b21a8');

  const [editStatus, setEditStatus] = useState<WorkflowStatus | null>(null);
  const [deleteStatus, setDeleteStatus] = useState<WorkflowStatus | null>(null);

  const draggedItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  const statusesQuery = useMemo(() => {
    if (!firestore || !profile) return null;

    return query(
      collection(firestore, 'statuses'),
      where('workstream', '==', activeTab),
      orderBy('order')
    );
  }, [firestore, profile, activeTab]);

  const allStatusesQuery = useMemo(() => {
    if (!firestore) return null;
    return collection(firestore, 'statuses');
  }, [firestore]);

  const { data: dbStatuses, isLoading: isDbStatusesLoading } =
    useCollection<WorkflowStatus>(statusesQuery);

  const { data: allStatuses, isLoading: areAllStatusesLoading } =
    useCollection<WorkflowStatus>(allStatusesQuery);

  const hasLegacyStatuses = useMemo(() => {
    return allStatuses?.some((status) => !status.workstream) ?? false;
  }, [allStatuses]);

  const isLoading = isDbStatusesLoading || areAllStatusesLoading;

  useEffect(() => {
    if (dbStatuses) {
      setStatuses(dbStatuses);
    }
  }, [dbStatuses]);

  const handleDragEnd = async () => {
    if (
      draggedItem.current === null ||
      dragOverItem.current === null ||
      !firestore
    ) {
      return;
    }

    const statusesClone = [...statuses];
    const dragged = statusesClone.splice(draggedItem.current, 1)[0];
    statusesClone.splice(dragOverItem.current, 0, dragged);

    setStatuses(statusesClone);

    draggedItem.current = null;
    dragOverItem.current = null;

    const batch = writeBatch(firestore);

    statusesClone.forEach((status, index) => {
      const docRef = doc(firestore, 'statuses', status.id);
      batch.update(docRef, { order: index });
    });

    try {
      await batch.commit();

      toast({
        title: 'Order Saved',
        description: 'Your workflow order has been updated.',
      });
    } catch (error) {
      setStatuses(statuses);

      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not save the new order.',
      });
    }
  };

  const handleCreateStatus = async () => {
    if (!newStatusName.trim() || !firestore || !profile) return;

    try {
      await addDoc(collection(firestore, 'statuses'), {
        name: newStatusName.trim(),
        order: statuses.length,
        color: newStatusColor,
        companyId: profile.companyId,
        workstream: activeTab,
      });

      toast({
        title: 'Status Created',
        description: `Status "${newStatusName}" has been added.`,
      });

      setNewStatusName('');
      setNewStatusColor('#6b21a8');
      setNewStatusDialogOpen(false);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not create status.',
      });
    }
  };

  const handleSeedDefaults = async () => {
    if (!firestore || !profile) return;

    const batch = writeBatch(firestore);
    const seedData = defaultStatuses[activeTab].map((status) => ({
      ...status,
      companyId: profile.companyId,
      workstream: activeTab,
    }));

    seedData.forEach((status) => {
      const docRef = doc(collection(firestore, 'statuses'));
      batch.set(docRef, status);
    });

    try {
      await batch.commit();

      toast({
        title: 'Success',
        description: `Default statuses for ${activeTab} have been created.`,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not seed default statuses.',
      });
    }
  };

  const handleUpdateStatus = async () => {
    if (!editStatus || !editStatus.name.trim() || !firestore) return;

    try {
      const docRef = doc(firestore, 'statuses', editStatus.id);

      await updateDoc(docRef, {
        name: editStatus.name.trim(),
        color: editStatus.color,
      });

      toast({
        title: 'Status Updated',
        description: 'Status has been changed.',
      });

      setEditStatus(null);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not update status.',
      });
    }
  };

  const handleDeleteStatus = async () => {
    if (!deleteStatus || !firestore) return;

    try {
      const docRef = doc(firestore, 'statuses', deleteStatus.id);
      await deleteDoc(docRef);

      const remainingStatuses = statuses.filter(
        (status) => status.id !== deleteStatus.id
      );

      const batch = writeBatch(firestore);

      remainingStatuses.forEach((status, index) => {
        const remainingDocRef = doc(firestore, 'statuses', status.id);
        batch.update(remainingDocRef, { order: index });
      });

      await batch.commit();

      toast({
        title: 'Status Deleted',
        description: `Status "${deleteStatus.name}" has been removed.`,
      });

      setDeleteStatus(null);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not delete status.',
      });
    }
  };

  const handleMigration = async () => {
    if (!firestore || !allStatuses) return;

    setIsMigrating(true);

    const legacyStatuses = allStatuses.filter((status) => !status.workstream);

    if (legacyStatuses.length === 0) {
      toast({
        title: 'No action needed',
        description: 'All statuses are already up to date.',
      });

      setIsMigrating(false);
      return;
    }

    const batch = writeBatch(firestore);

    legacyStatuses.forEach((status) => {
      const docRef = doc(firestore, 'statuses', status.id);
      batch.update(docRef, { workstream: 'tasks' });
    });

    try {
      await batch.commit();

      toast({
        title: 'Migration Successful',
        description: `${legacyStatuses.length} statuses have been migrated to the tasks workstream.`,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Migration Failed',
        description: 'An error occurred during migration.',
      });
    } finally {
      setIsMigrating(false);
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex h-full items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      );
    }

    if (statuses.length === 0) {
      return (
        <div className="rounded-lg border p-8 text-center">
          <h3 className="font-semibold">No Statuses Found</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            There are no workflow statuses for this workstream.
          </p>
          <Button onClick={handleSeedDefaults} className="mt-4">
            Seed Default Statuses
          </Button>
        </div>
      );
    }

    return (
      <div className="rounded-lg border p-4">
        <div className="space-y-2">
          {statuses.map((status, index) => (
            <div
              key={status.id}
              className={cn(
                'flex cursor-grab items-center justify-between rounded-md bg-secondary/50 p-2 transition-all active:cursor-grabbing',
                draggedItem.current === index && 'opacity-50'
              )}
              draggable
              onDragStart={() => {
                draggedItem.current = index;
              }}
              onDragEnter={() => {
                dragOverItem.current = index;
              }}
              onDragEnd={handleDragEnd}
              onDragOver={(event) => event.preventDefault()}
            >
              <div className="flex items-center gap-3">
                <GripVertical className="h-5 w-5 text-muted-foreground" />
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: status.color }}
                />
                <span className="font-medium">{status.name}</span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setEditStatus(status)}
                >
                  <Edit className="h-4 w-4" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => setDeleteStatus(status)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-svh flex-col bg-background">
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="mx-auto max-w-2xl space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">
                Manage Workflow
              </h2>
              <p className="text-muted-foreground">
                Customize columns for each workstream.
              </p>
            </div>

            <Dialog
              open={isNewStatusDialogOpen}
              onOpenChange={setNewStatusDialogOpen}
            >
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Status
                </Button>
              </DialogTrigger>

              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Status</DialogTitle>
                  <DialogDescription>
                    This will add a new column to the selected workflow.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-status-name">Status Name</Label>
                    <Input
                      id="new-status-name"
                      value={newStatusName}
                      onChange={(event) => setNewStatusName(event.target.value)}
                      placeholder="e.g. In Review"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="new-status-color">Status Color</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="new-status-color"
                        type="color"
                        value={newStatusColor}
                        onChange={(event) =>
                          setNewStatusColor(event.target.value)
                        }
                        className="h-10 w-16 p-1"
                      />
                      <span className="text-sm text-muted-foreground">
                        Choose a color for this status.
                      </span>
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    variant="ghost"
                    onClick={() => setNewStatusDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleCreateStatus}>Create</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {hasLegacyStatuses && (
            <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-900/20">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                <div>
                  <h4 className="font-semibold text-amber-800 dark:text-amber-300">
                    Data Migration Needed
                  </h4>
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    Some existing statuses need to be updated for the workstream
                    feature.
                  </p>
                </div>
              </div>

              <Button onClick={handleMigration} disabled={isMigrating}>
                {isMigrating && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Migrate Statuses
              </Button>
            </div>
          )}

          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as WorkflowType)}
          >
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="tasks">Tasks</TabsTrigger>
              <TabsTrigger value="socialMedia">Social Media</TabsTrigger>
              <TabsTrigger value="web">Web</TabsTrigger>
            </TabsList>

            <TabsContent value="tasks" className="mt-4">
              {renderContent()}
            </TabsContent>

            <TabsContent value="socialMedia" className="mt-4">
              {renderContent()}
            </TabsContent>

            <TabsContent value="web" className="mt-4">
              {renderContent()}
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <Dialog
        open={!!editStatus}
        onOpenChange={(isOpen) => !isOpen && setEditStatus(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Status</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-status-name">Status Name</Label>
              <Input
                id="edit-status-name"
                value={editStatus?.name || ''}
                onChange={(event) =>
                  setEditStatus((status) =>
                    status ? { ...status, name: event.target.value } : null
                  )
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-status-color">Status Color</Label>
              <Input
                id="edit-status-color"
                type="color"
                value={editStatus?.color || '#6b21a8'}
                onChange={(event) =>
                  setEditStatus((status) =>
                    status ? { ...status, color: event.target.value } : null
                  )
                }
                className="h-10 w-16 p-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditStatus(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateStatus}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteStatus}
        onOpenChange={(isOpen) => !isOpen && setDeleteStatus(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the "{deleteStatus?.name}" status.
              Any tasks currently with this status will need to be moved. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteStatus}
              className="bg-destructive hover:bg-destructive/90"
            >
              Confirm Deletion
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

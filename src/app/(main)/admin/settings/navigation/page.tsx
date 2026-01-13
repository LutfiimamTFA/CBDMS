
'use client';
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useCollection, useFirestore, useUserProfile } from '@/firebase';
import type { NavigationItem } from '@/lib/types';
import {
  collection,
  doc,
  query,
  orderBy,
  writeBatch,
  getDocs,
  setDoc,
  deleteDoc,
  Timestamp,
} from 'firebase/firestore';
import { Loader2, Icon as LucideIcon, Save, RefreshCw, GripVertical, FolderPlus, Plus, Pencil, Trash2, Shield, AlertTriangle } from 'lucide-react';
import * as lucideIcons from 'lucide-react';
import { defaultNavItems } from '@/lib/navigation-items';
import { Button } from '@/components/ui/button';
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription as AlertDescriptionUI, AlertTitle } from '@/components/ui/alert';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const Icon = ({
  name,
  ...props
}: { name: string } & React.ComponentProps<typeof LucideIcon>) => {
  const LucideIconComponent = (lucideIcons as Record<string, any>)[name];
  if (!LucideIconComponent) return <lucideIcons.HelpCircle {...props} />;
  return <LucideIconComponent {...props} />;
};

const availableRoles = ['Super Admin', 'Manager', 'PIC', 'Employee', 'Client'] as const;
type Role = (typeof availableRoles)[number];

// This function now only checks if the item is critical, the "locking" logic is handled in the component.
const isItemCritical = (item: NavigationItem) => item.path === '/admin/settings/navigation';

export default function NavigationSettingsPage() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { profile } = useUserProfile();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [navItems, setNavItems] = useState<NavigationItem[]>([]);
  const [initialNavItems, setInitialNavItems] = useState<NavigationItem[]>([]);

  const [isConfirmOpen, setConfirmOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ title: '', description: '', onConfirm: () => {} });

  const [editItem, setEditItem] = useState<NavigationItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<NavigationItem | null>(null);

  const navItemsCollectionRef = useMemo(
    () => firestore ? query(collection(firestore, 'navigationItems'), orderBy('order')) : null, [firestore]
  );
  const { data: navItemsFromDB, isLoading: isNavItemsLoading } = useCollection<NavigationItem>(navItemsCollectionRef);

  useEffect(() => {
    if (navItemsFromDB) {
      const sorted = [...navItemsFromDB].sort((a,b) => a.order - b.order);
      setNavItems(sorted);
      setInitialNavItems(JSON.parse(JSON.stringify(sorted)));
      setIsLoading(false);
    }
  }, [navItemsFromDB]);

  const hasChanges = useMemo(() => {
    return JSON.stringify(initialNavItems) !== JSON.stringify(navItems);
  }, [initialNavItems, navItems]);

  const handleRoleChange = (itemId: string, role: Role, isChecked: boolean) => {
    setNavItems(currentItems => {
        return currentItems.map(item => {
            if (item.id === itemId) {
                if (isItemCritical(item) && role === 'Super Admin' && !isChecked) {
                    toast({ variant: 'destructive', title: 'Action Denied', description: 'Cannot remove Super Admin access from this critical page.'});
                    return item;
                }
                let updatedRoles: Role[] = item.roles as Role[];
                if (isChecked) {
                    updatedRoles = [...updatedRoles, role];
                } else {
                    updatedRoles = updatedRoles.filter((r) => r !== role);
                }
                return { ...item, roles: [...new Set(updatedRoles)] as Role[] };
            }
            return item;
        });
    });
  };
  
  const backupAndRun = async (action: () => Promise<void>, actionName: 'save' | 'reset') => {
    if (!firestore) return;
    setIsSaving(true);
    setConfirmOpen(false);

    try {
        const backupTimestamp = new Date().toISOString();
        const backupMetaRef = doc(firestore, 'navigationItemBackups', backupTimestamp);
        const batch = writeBatch(firestore);
        
        batch.set(backupMetaRef, {
            createdAt: Timestamp.now(),
            action: actionName,
            createdBy: profile?.id || 'unknown',
        });

        const currentItemsSnap = await getDocs(collection(firestore, 'navigationItems'));
        currentItemsSnap.forEach(itemDoc => {
            const itemBackupRef = doc(firestore, `navigationItemBackups/${backupTimestamp}/items`, itemDoc.id);
            batch.set(itemBackupRef, itemDoc.data());
        });

        await batch.commit();
        toast({ title: "Backup Created", description: `A backup has been saved to 'navigationItemBackups'.`});

        await action();
        
    } catch (error: any) {
        toast({
            variant: 'destructive',
            title: 'Operation Failed',
            description: error.message || 'An unexpected error occurred.',
        });
    } finally {
        setIsSaving(false);
    }
  };

  const handleSaveChanges = async () => {
    await backupAndRun(async () => {
        if (!firestore || !hasChanges) return;
        const batch = writeBatch(firestore);
        
        navItems.forEach(item => {
            const docRef = doc(firestore, 'navigationItems', item.id);
            if (isItemCritical(item) && !item.roles.includes('Super Admin')) {
              item.roles.push('Super Admin');
            }
            batch.update(docRef, { ...item });
        });
        
        await batch.commit();

        setInitialNavItems(JSON.parse(JSON.stringify(navItems)));
        toast({
            title: 'Configuration Saved',
            description: 'All sidebar changes have been saved to Firestore.',
        });
    }, 'save');
  };
  
  const handleAddItem = async (isFolder: boolean) => {
    if (!firestore) return;

    const newItemData: Omit<NavigationItem, 'id'> = {
      label: isFolder ? 'New Folder' : 'New Item',
      path: isFolder ? '' : '/new-path',
      icon: isFolder ? 'Folder' : 'File',
      order: navItems.length,
      roles: ['Super Admin'],
      parentId: null,
      isEnabled: true,
    };
    
    try {
        const newItemRef = doc(collection(firestore, 'navigationItems'));
        const newItemWithId: NavigationItem = { ...newItemData, id: newItemRef.id };
        await setDoc(newItemRef, newItemWithId);
        
        setNavItems(prev => [...prev, newItemWithId]);
        setInitialNavItems(prev => [...prev, newItemWithId]);
        setEditItem(newItemWithId);
        toast({ title: 'Item Added', description: 'New item created. Edit its details now.'});
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Failed to add item', description: e.message });
    }
  };
  
  const handleUpdateItem = async (updatedItem: NavigationItem) => {
    setNavItems(prev => prev.map(item => item.id === editItem?.id ? updatedItem : item));
    setEditItem(null);
  };

  const handleDeleteItem = async () => {
    if (!firestore || !deleteItem) return;
    if (isItemCritical(deleteItem)) {
      toast({ variant: 'destructive', title: 'Action Denied', description: 'Cannot delete this critical system page.'});
      setDeleteItem(null);
      return;
    }
    
    setIsSaving(true);
    try {
        const docRef = doc(firestore, 'navigationItems', deleteItem.id);
        await deleteDoc(docRef);
        setNavItems(prev => prev.filter(item => item.id !== deleteItem.id));
        setInitialNavItems(prev => prev.filter(item => item.id !== deleteItem.id));
        toast({ title: 'Item Deleted', description: `"${deleteItem.label}" has been removed.`});
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Failed to delete item', description: e.message });
    } finally {
        setIsSaving(false);
        setDeleteItem(null);
    }
  };
  
  const handleToggleEnable = (itemId: string, isEnabled: boolean) => {
    setNavItems(prev => prev.map(item => {
        if (item.id === itemId) {
            if (isItemCritical(item) && !isEnabled) {
                toast({ variant: 'destructive', title: 'Action Denied', description: 'Cannot disable this critical system page.'});
                return item;
            }
            return { ...item, isEnabled }
        }
        return item;
    }));
  };

  const handleResetToDefault = async () => {
    await backupAndRun(async () => {
        if (!firestore) return;
        
        const existingItemsSnap = await getDocs(collection(firestore, 'navigationItems'));
        
        const deleteBatch = writeBatch(firestore);
        existingItemsSnap.docs.forEach(doc => deleteBatch.delete(doc.ref));
        await deleteBatch.commit();
        
        const writeBatch = writeBatch(firestore);
        defaultNavItems.forEach(item => {
            const docRef = doc(firestore, 'navigationItems', item.id);
            writeBatch.set(docRef, item);
        });

        await writeBatch.commit();
        toast({ title: 'Sidebar Reset', description: 'Navigation has been reset to its default state.' });
    }, 'reset');
  };
  
  const openConfirmDialog = (type: 'save' | 'reset') => {
    if (type === 'save') {
        setConfirmDialog({
            title: 'Confirm Changes',
            description: 'This will save the new sidebar structure to Firestore. A backup will be created first.',
            onConfirm: handleSaveChanges
        });
    } else {
        setConfirmDialog({
            title: 'Reset to Default?',
            description: 'This will erase all custom changes and restore the default sidebar. A backup will be created first. This action is irreversible.',
            onConfirm: handleResetToDefault
        });
    }
    setConfirmOpen(true);
  };

  const { rootItems } = useMemo(() => {
    const items = [...navItems].sort((a,b) => a.order - b.order);
    const rootItems = items.filter(item => !item.parentId);
    return { rootItems };
  }, [navItems]);
  
  const renderGroup = useCallback((items: NavigationItem[], isSubItem = false) => {
    return items.map((item) => (
      <React.Fragment key={item.id}>
        <TableRow
          className={cn(
            !item.isEnabled && 'opacity-50',
          )}
        >
          <TableCell className={cn(isSubItem && "pl-12")}>
            <div className="flex items-center gap-3">
              <Icon name={item.icon} className="h-5 w-5" />
              <div className="flex flex-col">
                <span className="font-medium">{item.label}</span>
                <span className="text-xs text-muted-foreground font-mono">{item.path || "(Folder)"}</span>
              </div>
            </div>
          </TableCell>
          {availableRoles.map((role) => (
            <TableCell key={role} className="text-center">
              <Checkbox
                checked={item.roles.includes(role)}
                onCheckedChange={(checked) => {
                  handleRoleChange(item.id, role, !!checked);
                }}
                disabled={isItemCritical(item) && role === 'Super Admin'}
              />
            </TableCell>
          ))}
          <TableCell className="text-right">
              <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={() => setEditItem(item)}><Pencil className="h-4 w-4"/></Button></TooltipTrigger>
                    <TooltipContent><p>Edit Details</p></TooltipContent>
                </Tooltip>
                 <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteItem(item)} disabled={isItemCritical(item)}>
                            <Trash2 className={cn("h-4 w-4", !isItemCritical(item) && "text-destructive")}/>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Delete Item</p></TooltipContent>
                </Tooltip>
                 <Tooltip>
                    <TooltipTrigger asChild>
                        <Checkbox 
                            checked={item.isEnabled} 
                            onCheckedChange={(checked) => handleToggleEnable(item.id, !!checked)}
                            className={cn("h-5 w-5 ml-2", isItemCritical(item) && "cursor-not-allowed opacity-50")}
                            disabled={isItemCritical(item)}
                        />
                    </TooltipTrigger>
                    <TooltipContent><p>{item.isEnabled ? 'Enabled' : 'Disabled'}</p></TooltipContent>
                 </Tooltip>
              </TooltipProvider>
          </TableCell>
        </TableRow>
        {item.path === '' &&
          renderGroup(
            navItems.filter((child) => child.parentId === item.id).sort((a,b) => a.order - b.order),
            true
          )}
      </React.Fragment>
    ));
  }, [navItems]);


  return (
    <div className="h-svh flex flex-col bg-background">
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold">Sidebar Navigation Editor</h2>
            <p className="text-muted-foreground">
              Configure roles and manage menu visibility. Changes are saved automatically.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleAddItem(true)}><FolderPlus className="mr-2 h-4 w-4"/> Add Folder</Button>
            <Button variant="outline" onClick={() => handleAddItem(false)}><Plus className="mr-2 h-4 w-4"/> Add Item</Button>
            <Button variant="destructive" onClick={() => openConfirmDialog('reset')} disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <RefreshCw className="mr-2 h-4 w-4"/>}
                Reset to Default
            </Button>
            <Button onClick={() => openConfirmDialog('save')} disabled={!hasChanges || isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
                Save Changes
            </Button>
          </div>
        </div>
         <Alert variant="default" className="mb-4 bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800">
            <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
            <AlertTitle className="text-yellow-800 dark:text-yellow-300">Advanced Mode</AlertTitle>
            <AlertDescriptionUI className="text-yellow-700 dark:text-yellow-400">
                You are in advanced navigation settings. Changes here directly affect all users. Be careful when modifying critical system items.
            </AlertDescriptionUI>
        </Alert>

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[350px]">Menu Item</TableHead>
                {availableRoles.map((role) => (
                  <TableHead key={role} className="text-center">
                    {role}
                  </TableHead>
                ))}
                <TableHead className="text-right w-[150px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading || isNavItemsLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={2 + availableRoles.length}
                    className="h-64 text-center"
                  >
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : (
                renderGroup(rootItems)
              )}
            </TableBody>
          </Table>
        </div>
      </main>

       <AlertDialog open={isConfirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>{confirmDialog.title}</AlertDialogTitle>
                <AlertDialogDescription>{confirmDialog.description}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={confirmDialog.onConfirm}>
                  Confirm
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {editItem && (
        <EditItemDialog
            item={editItem}
            onClose={() => setEditItem(null)}
            onSave={handleUpdateItem}
        />
      )}
      
      {deleteItem && (
        <AlertDialog open={!!deleteItem} onOpenChange={(open) => !open && setDeleteItem(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will permanently delete the menu item <strong className='text-foreground'>"{deleteItem.label}"</strong>. 
                        This action cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteItem} className="bg-destructive hover:bg-destructive/90" disabled={isSaving}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        Yes, delete item
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

function EditItemDialog({ item, onClose, onSave }: { item: NavigationItem, onClose: () => void, onSave: (item: NavigationItem) => void }) {
    const [label, setLabel] = useState(item.label);
    const [path, setPath] = useState(item.path);
    const [icon, setIcon] = useState(item.icon);

    const handleSave = () => {
        onSave({ ...item, label, path, icon });
    };
    
    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Item: {item.label}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="label" className="text-right">Label</Label>
                        <Input id="label" value={label} onChange={(e) => setLabel(e.target.value)} className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="path" className="text-right">Path</Label>
                        <Input id="path" value={path} onChange={(e) => setPath(e.target.value)} className="col-span-3" disabled={item.path === ''}/>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="icon" className="text-right">Icon</Label>
                        <Input id="icon" value={icon} onChange={(e) => setIcon(e.target.value)} className="col-span-3" />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSave}>Save Changes</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

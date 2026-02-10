
'use client';
import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
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
import { Loader2, Icon as LucideIcon, Save, RefreshCw, GripVertical, FolderPlus, Plus, Pencil, Trash2, Shield, AlertTriangle, MoreHorizontal, HelpCircle, Undo2, Redo2 } from 'lucide-react';
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


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

const isItemCritical = (item: NavigationItem) => item.path === '/admin/settings/navigation';

export default function NavigationSettingsPage() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { profile } = useUserProfile();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [history, setHistory] = useState<NavigationItem[][]>([[]]);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState(0);
  const navItems = history[currentHistoryIndex] || [];
  
  const [initialNavItems, setInitialNavItems] = useState<NavigationItem[]>([]);

  const [isConfirmOpen, setConfirmOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ title: '', description: '', onConfirm: () => {} });

  const [editItem, setEditItem] = useState<NavigationItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<NavigationItem | null>(null);

  const draggedItem = useRef<string | null>(null);
  const dragOverItem = useRef<string | null>(null);

  const navItemsCollectionRef = useMemo(
    () => firestore ? query(collection(firestore, 'navigationItems'), orderBy('order')) : null, [firestore]
  );
  const { data: navItemsFromDB, isLoading: isNavItemsLoading } = useCollection<NavigationItem>(navItemsCollectionRef);

  const updateHistory = (newNavItems: NavigationItem[]) => {
    const newHistory = history.slice(0, currentHistoryIndex + 1);
    setHistory([...newHistory, newNavItems]);
    setCurrentHistoryIndex(newHistory.length);
  };
  
  const handleUndo = useCallback(() => {
    if (currentHistoryIndex > 0) {
      setCurrentHistoryIndex(currentHistoryIndex - 1);
    }
  }, [currentHistoryIndex]);

  const handleRedo = useCallback(() => {
    if (currentHistoryIndex < history.length - 1) {
      setCurrentHistoryIndex(currentHistoryIndex + 1);
    }
  }, [currentHistoryIndex, history.length]);

  useEffect(() => {
    if (navItemsFromDB) {
      const sorted = [...navItemsFromDB].sort((a,b) => a.order - b.order);
      setHistory([sorted]);
      setCurrentHistoryIndex(0);
      setInitialNavItems(JSON.parse(JSON.stringify(sorted)));
      setIsLoading(false);
    }
  }, [navItemsFromDB]);
  
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const isUndo = (isMac ? event.metaKey : event.ctrlKey) && event.key === 'z';
      const isRedo = (isMac ? event.metaKey && event.shiftKey : event.ctrlKey) && event.key === 'y';

      if (isUndo) {
        event.preventDefault();
        handleUndo();
      }
      if (isRedo) {
        event.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleUndo, handleRedo]);


  const hasChanges = useMemo(() => {
    return JSON.stringify(initialNavItems) !== JSON.stringify(navItems);
  }, [initialNavItems, navItems]);
  
  const canUndo = currentHistoryIndex > 0;
  const canRedo = currentHistoryIndex < history.length - 1;


  const handleRoleChange = (itemId: string, role: Role, isChecked: boolean) => {
    const newNavItems = navItems.map(item => {
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
    updateHistory(newNavItems);
  };
  
  const handleDragEnd = () => {
    if (draggedItem.current === null || dragOverItem.current === null || draggedItem.current === dragOverItem.current) {
      draggedItem.current = null;
      dragOverItem.current = null;
      return;
    }
    
    let itemsClone = [...navItems];
    const draggedItemData = itemsClone.find(item => item.id === draggedItem.current!);
    const dropTargetData = itemsClone.find(item => item.id === dragOverItem.current!);
    
    if (!draggedItemData || !dropTargetData) return;

    // If the drop target is a folder, the dragged item becomes its child.
    // Otherwise, it adopts the same parent as the drop target (which could be null for root level).
    const newParentId = dropTargetData.path === '' ? dropTargetData.id : dropTargetData.parentId;
    const updatedDraggedItem = { ...draggedItemData, parentId: newParentId };

    const dragIndex = itemsClone.findIndex(item => item.id === draggedItemData.id);
    itemsClone.splice(dragIndex, 1);

    const dropIndex = itemsClone.findIndex(item => item.id === dropTargetData.id);
    itemsClone.splice(dropIndex, 0, updatedDraggedItem);
    
    const reorderedItems = itemsClone.map((item, index) => ({ ...item, order: index }));
    
    updateHistory(reorderedItems);
    
    draggedItem.current = null;
    dragOverItem.current = null;
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
        
        const currentIds = new Set(navItems.map(item => item.id));
        const initialIds = new Set(initialNavItems.map(item => item.id));

        // Delete items that are in initial but not in current
        initialNavItems.forEach(item => {
            if (!currentIds.has(item.id)) {
                const docRef = doc(firestore, 'navigationItems', item.id);
                batch.delete(docRef);
            }
        });

        navItems.forEach(item => {
            const docRef = doc(firestore, 'navigationItems', item.id);
            if (isItemCritical(item) && !item.roles.includes('Super Admin')) {
              item.roles.push('Super Admin');
            }
            batch.set(docRef, item, { merge: true });
        });
        
        await batch.commit();
        
        const newInitialState = JSON.parse(JSON.stringify(navItems));
        setInitialNavItems(newInitialState);
        setHistory([newInitialState]);
        setCurrentHistoryIndex(0);

        toast({
            title: 'Configuration Saved',
            description: 'All sidebar changes have been saved to Firestore.',
        });
    }, 'save');
  };
  
  const handleAddItem = async (isFolder: boolean) => {
    if (!firestore) return;

    const newItemId = doc(collection(firestore, 'newId')).id;
    const newItemData: NavigationItem = {
      id: newItemId,
      label: isFolder ? 'New Folder' : 'New Item',
      path: isFolder ? '' : '/new-path',
      icon: isFolder ? 'Folder' : 'File',
      order: navItems.length,
      roles: ['Super Admin'],
      parentId: null,
      isEnabled: true,
    };
    
    updateHistory([...navItems, newItemData]);
    setEditItem(newItemData);
    toast({ title: 'Item Added', description: 'New item created locally. Save changes to persist.'});
  };
  
  const handleUpdateItem = async (updatedItem: NavigationItem) => {
    updateHistory(navItems.map(item => item.id === editItem?.id ? updatedItem : item));
    setEditItem(null);
  };

  const handleDeleteItem = async () => {
    if (!deleteItem) return;
    if (isItemCritical(deleteItem)) {
      toast({ variant: 'destructive', title: 'Action Denied', description: 'Cannot delete this critical system page.'});
      setDeleteItem(null);
      return;
    }
    
    updateHistory(navItems.filter(item => item.id !== deleteItem.id));
    toast({ title: 'Item Marked for Deletion', description: `"${deleteItem.label}" will be removed upon saving.`});
    setDeleteItem(null);
  };
  
  const handleToggleEnable = (itemId: string, isEnabled: boolean) => {
    const newItems = navItems.map(item => {
        if (item.id === itemId) {
            if (isItemCritical(item) && !isEnabled) {
                toast({ variant: 'destructive', title: 'Action Denied', description: 'Cannot disable this critical system page.'});
                return item;
            }
            return { ...item, isEnabled }
        }
        return item;
    });
    updateHistory(newItems);
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

        const sortedDefaults = defaultNavItems.sort((a, b) => a.order - b.order);
        setHistory([sortedDefaults]);
        setCurrentHistoryIndex(0);
        setInitialNavItems(JSON.parse(JSON.stringify(sortedDefaults)));

        toast({ title: 'Sidebar Reset', description: 'Navigation has been reset to its default state.' });
    }, 'reset');
  };
  
  const openConfirmDialog = (type: 'save' | 'reset') => {
    if (type === 'save') {
        setConfirmDialog({
            title: 'Confirm Changes',
            description: 'This will save all pending navigation changes (order, edits, deletions, additions) to the database. A backup will be created first.',
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
            "cursor-grab active:cursor-grabbing",
             draggedItem.current === item.id && 'opacity-50'
          )}
          draggable
          onDragStart={() => (draggedItem.current = item.id)}
          onDragEnter={() => (dragOverItem.current = item.id)}
          onDragEnd={handleDragEnd}
          onDragOver={(e) => e.preventDefault()}
        >
          <TableCell className={cn(isSubItem && "pl-12")}>
            <div className="flex items-center gap-3">
              <GripVertical className="h-5 w-5 text-muted-foreground" />
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
                    <TooltipTrigger asChild>
                        <Checkbox 
                            checked={item.isEnabled} 
                            onCheckedChange={(checked) => handleToggleEnable(item.id, !!checked)}
                            className={cn("h-5 w-5 mr-2", isItemCritical(item) && "cursor-not-allowed opacity-50")}
                            disabled={isItemCritical(item)}
                        />
                    </TooltipTrigger>
                    <TooltipContent><p>{item.isEnabled ? 'Enabled' : 'Disabled'}</p></TooltipContent>
                 </Tooltip>
              </TooltipProvider>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuItem onSelect={() => setEditItem(item)}>
                        <Pencil className="mr-2 h-4 w-4"/>
                        Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setDeleteItem(item)} disabled={isItemCritical(item)} className="text-destructive focus:text-destructive">
                        <Trash2 className="mr-2 h-4 w-4"/>
                        Delete
                    </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
          </TableCell>
        </TableRow>
        {item.path === '' &&
          renderGroup(
            navItems.filter((child) => child.parentId === item.id).sort((a,b) => a.order - b.order),
            true
          )}
      </React.Fragment>
    ));
  }, [navItems, draggedItem, dragOverItem, handleDragEnd, handleRoleChange, handleToggleEnable]);


  return (
    <div className="h-svh flex flex-col bg-background">
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold">Sidebar Navigation Editor</h2>
            <p className="text-muted-foreground">
              Configure roles, manage menu visibility and reorder items by dragging them.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleAddItem(true)}><FolderPlus className="mr-2 h-4 w-4"/> Add Folder</Button>
            <Button variant="outline" onClick={() => handleAddItem(false)}><Plus className="mr-2 h-4 w-4"/> Add Item</Button>
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" onClick={handleUndo} disabled={!canUndo}><Undo2 className="h-4 w-4"/></Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Undo (Ctrl+Z)</p></TooltipContent>
                </Tooltip>
            </TooltipProvider>
             <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" onClick={handleRedo} disabled={!canRedo}><Redo2 className="h-4 w-4"/></Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Redo (Ctrl+Y)</p></TooltipContent>
                </Tooltip>
            </TooltipProvider>
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
            allItems={navItems}
        />
      )}
      
      {deleteItem && (
        <AlertDialog open={!!deleteItem} onOpenChange={(open) => !open && setDeleteItem(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will permanently delete the menu item <strong className='text-foreground'>"{deleteItem.label}"</strong> and any sub-items within it. 
                        This action will be saved upon clicking "Save Changes".
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteItem} className="bg-destructive hover:bg-destructive/90">
                        Yes, delete item
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

function EditItemDialog({ item, onClose, onSave, allItems }: { item: NavigationItem, onClose: () => void, onSave: (item: NavigationItem) => void, allItems: NavigationItem[] }) {
    const [label, setLabel] = useState(item.label);
    const [path, setPath] = useState(item.path);
    const [icon, setIcon] = useState(item.icon);
    const [parentId, setParentId] = useState<string | null>(item.parentId);
    
    const potentialParents = useMemo(() => {
        return allItems.filter(i => i.path === '' && i.id !== item.id);
    }, [allItems, item.id]);

    const handleSave = () => {
        onSave({ ...item, label, path, icon, parentId });
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
                        {item.path === '' && (
                             <div className="col-start-2 col-span-3 mt-1">
                                <p className="text-xs text-muted-foreground flex items-center gap-1"><HelpCircle className="h-3 w-3"/> The path for a folder cannot be changed.</p>
                            </div>
                        )}
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="icon" className="text-right">Icon</Label>
                        <Input id="icon" value={icon} onChange={(e) => setIcon(e.target.value)} className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="parent" className="text-right">Parent</Label>
                         <Select value={parentId || 'root'} onValueChange={(value) => setParentId(value === 'root' ? null : value)}>
                            <SelectTrigger className="col-span-3">
                                <SelectValue placeholder="Select a parent..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="root">— Root Level —</SelectItem>
                                {potentialParents.map(p => (
                                    <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
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


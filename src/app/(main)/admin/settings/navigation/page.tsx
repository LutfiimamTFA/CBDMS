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
import { useCollection, useFirestore } from '@/firebase';
import type { NavigationItem } from '@/lib/types';
import {
  collection,
  doc,
  query,
  orderBy,
  writeBatch,
  getDocs,
  addDoc,
  updateDoc,
} from 'firebase/firestore';
import { Loader2, Icon as LucideIcon, Save, RefreshCw, GripVertical, FolderPlus, Plus, Pencil, Trash2 } from 'lucide-react';
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

const isItemLocked = (item: NavigationItem) => {
    return ['nav_admin', 'nav_settings', 'nav_settings_navigation'].includes(item.id);
}

export default function NavigationSettingsPage() {
  const { toast } = useToast();
  const firestore = useFirestore();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [navItems, setNavItems] = useState<NavigationItem[]>([]);
  const [initialNavItems, setInitialNavItems] = useState<NavigationItem[]>([]);

  const [isConfirmOpen, setConfirmOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ title: '', description: '', onConfirm: () => {} });

  const [editItem, setEditItem] = useState<NavigationItem | null>(null);
  
  const dragItem = React.useRef<string | null>(null);
  const dragOverItem = React.useRef<string | null>(null);

  const navItemsCollectionRef = useMemo(
    () =>
      firestore
        ? query(collection(firestore, 'navigationItems'), orderBy('order'))
        : null,
    [firestore]
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

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, id: string) => {
    dragItem.current = id;
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>, id: string) => {
    dragOverItem.current = id;
  };

  const handleDragEnd = () => {
    if (dragItem.current && dragOverItem.current && dragItem.current !== dragOverItem.current) {
        const itemsCopy = [...navItems];
        const draggedItemIndex = itemsCopy.findIndex(item => item.id === dragItem.current);
        const dragOverItemIndex = itemsCopy.findIndex(item => item.id === dragOverItem.current);

        const draggedItemContent = itemsCopy.splice(draggedItemIndex, 1)[0];
        itemsCopy.splice(dragOverItemIndex, 0, draggedItemContent);
        
        const reorderedItems = itemsCopy.map((item, index) => ({ ...item, order: index }));
        setNavItems(reorderedItems);
    }
    dragItem.current = null;
    dragOverItem.current = null;
  };
  
  const handleDropOnFolder = (folderId: string) => {
    if (dragItem.current && folderId !== dragItem.current) {
      setNavItems(prevItems =>
        prevItems.map(item =>
          item.id === dragItem.current ? { ...item, parentId: folderId } : item
        )
      );
    }
  };

  const handleRoleChange = (itemId: string, role: Role, isChecked: boolean) => {
    setNavItems(currentItems => {
        return currentItems.map(item => {
            if (item.id === itemId) {
                let updatedRoles: Role[] = item.roles as Role[];
                if (isChecked) {
                    updatedRoles = [...updatedRoles, role];
                } else {
                    if (isItemLocked(item) && role === 'Super Admin') {
                        toast({ variant: 'destructive', title: 'Action Denied', description: 'Cannot remove Super Admin access from critical settings.'});
                        return item;
                    }
                    updatedRoles = updatedRoles.filter((r) => r !== role);
                }
                return { ...item, roles: [...new Set(updatedRoles)] as Role[] };
            }
            return item;
        });
    });
  };

  const handleSaveChanges = async () => {
    if (!firestore || !hasChanges) return;
    setIsSaving(true);
    setConfirmOpen(false);

    try {
        const batch = writeBatch(firestore);
        navItems.forEach(item => {
            const docRef = doc(firestore, 'navigationItems', item.id);
            // Create a plain object without extra properties from the original type
            const { id, ...itemData } = item;
            batch.update(docRef, itemData);
        });
        await batch.commit();

        setInitialNavItems(JSON.parse(JSON.stringify(navItems))); // Update initial state after save
        toast({
            title: 'Configuration Saved',
            description: 'All sidebar changes have been saved.',
        });
    } catch (error: any) {
        toast({
            variant: 'destructive',
            title: 'Save Failed',
            description: error.message,
        });
    } finally {
        setIsSaving(false);
    }
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
        const docRef = await addDoc(collection(firestore, 'navigationItems'), newItemData);
        const newItemWithId: NavigationItem = { ...newItemData, id: docRef.id };
        setNavItems(prev => [...prev, newItemWithId]);
        setInitialNavItems(prev => [...prev, newItemWithId]);
        setEditItem(newItemWithId);
        toast({ title: 'Item Added', description: 'New item created. Edit its details now.'});
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Failed to add item', description: e.message });
    }
  };
  
  const handleUpdateItem = (updatedItem: NavigationItem) => {
    if(!editItem) return;
    setNavItems(prev => prev.map(item => item.id === editItem.id ? updatedItem : item));
    setEditItem(null);
  };
  
  const handleToggleEnable = (itemId: string, isEnabled: boolean) => {
    setNavItems(prev => prev.map(item => {
        if (item.id === itemId) {
            if (isItemLocked(item)) {
                toast({ variant: 'destructive', title: 'Action Denied', description: 'Cannot disable a critical system item.'});
                return item;
            }
            return { ...item, isEnabled }
        }
        return item;
    }));
  };

  const handleResetToDefault = async () => {
    if (!firestore) return;
    setIsSaving(true);
    setConfirmOpen(false);

    try {
      const batch = writeBatch(firestore);
      const existingItemsSnap = await getDocs(collection(firestore, 'navigationItems'));
      existingItemsSnap.docs.forEach(doc => batch.delete(doc.ref));
      
      defaultNavItems.forEach(item => {
        const docRef = doc(firestore, 'navigationItems', item.id);
        batch.set(docRef, item);
      });

      await batch.commit();
      toast({ title: 'Sidebar Reset', description: 'Navigation has been reset to its default state.' });

    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Reset Failed', description: e.message });
    } finally {
      setIsSaving(false);
    }
  };
  
  const openConfirmDialog = (type: 'save' | 'reset') => {
    if (type === 'save') {
        setConfirmDialog({
            title: 'Confirm Changes',
            description: 'Are you sure you want to apply these navigation changes?',
            onConfirm: handleSaveChanges
        });
    } else {
        setConfirmDialog({
            title: 'Reset to Default?',
            description: 'This will erase all your custom changes and restore the default sidebar structure. This action is irreversible.',
            onConfirm: handleResetToDefault
        });
    }
    setConfirmOpen(true);
  };


  const { rootItems, itemMap } = useMemo(() => {
    const items = [...navItems].sort((a,b) => a.order - b.order);
    const itemMap = new Map(items.map(item => [item.id, item]));
    const rootItems = items.filter(item => !item.parentId);
    return { rootItems, itemMap };
  }, [navItems]);
  
  const renderGroup = useCallback((items: NavigationItem[], isSubItem = false) => {
    return items.map((item) => (
      <React.Fragment key={item.id}>
        <TableRow
          onDragOver={(e) => e.preventDefault()}
          onDragStart={(e) => handleDragStart(e, item.id)}
          onDragEnter={(e) => handleDragEnter(e, item.id)}
          onDragEnd={handleDragEnd}
          onDrop={() => item.path === '' && handleDropOnFolder(item.id)}
          draggable
          className={!item.isEnabled ? 'opacity-50' : ''}
        >
          <TableCell className={isSubItem ? "pl-12" : ""}>
            <div className="flex items-center gap-3">
              <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab"/>
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
                disabled={isItemLocked(item) && role === 'Super Admin'}
              />
            </TableCell>
          ))}
          <TableCell className="text-right">
              <Button variant="ghost" size="icon" onClick={() => setEditItem(item)}><Pencil className="h-4 w-4"/></Button>
              <Checkbox 
                checked={item.isEnabled} 
                onCheckedChange={(checked) => handleToggleEnable(item.id, !!checked)}
                className={cn("h-5 w-5 ml-2", isItemLocked(item) && "cursor-not-allowed opacity-50")}
              />
          </TableCell>
        </TableRow>
        {item.path === '' &&
          renderGroup(
            navItems.filter((child) => child.parentId === item.id).sort((a,b) => a.order - b.order),
            true
          )}
      </React.Fragment>
    ));
  }, [navItems, handleDragEnd]);


  return (
    <div className="h-svh flex flex-col bg-background">
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold">Sidebar Navigation Editor</h2>
            <p className="text-muted-foreground">
              Drag to reorder, nest items, and manage role visibility.
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
                <TableHead className="text-right w-[120px]">Actions</TableHead>
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
    
    const isLocked = isItemLocked(item);

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Item: {item.label}</DialogTitle>
                    <DialogDescription>
                        {isLocked && "This is a system-critical item. Some fields are locked."}
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="label" className="text-right">Label</Label>
                        <Input id="label" value={label} onChange={(e) => setLabel(e.target.value)} className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="path" className="text-right">Path</Label>
                        <Input id="path" value={path} onChange={(e) => setPath(e.target.value)} className="col-span-3" disabled={isLocked} />
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


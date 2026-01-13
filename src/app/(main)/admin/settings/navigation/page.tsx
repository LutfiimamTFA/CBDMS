
'use client';
import React, { useEffect, useMemo, useState } from 'react';
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
} from 'firebase/firestore';
import { Loader2, Icon as LucideIcon, Save, RefreshCw } from 'lucide-react';
import * as lucideIcons from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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

const Icon = ({
  name,
  ...props
}: { name: string } & React.ComponentProps<typeof LucideIcon>) => {
  const LucideIconComponent = (lucideIcons as Record<string, any>)[name];
  if (!LucideIconComponent) return <lucideIcons.HelpCircle {...props} />;
  return <LucideIconComponent {...props} />;
};

const availableRoles = ['Super Admin', 'Manager', 'Employee', 'Client'] as const;
type Role = (typeof availableRoles)[number];

export default function NavigationSettingsPage() {
  const { toast } = useToast();
  const firestore = useFirestore();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isConfirmOpen, setConfirmOpen] = useState(false);
  const [isSyncConfirmOpen, setSyncConfirmOpen] = useState(false);
  const [navItems, setNavItems] = useState<NavigationItem[]>([]);
  const [initialNavItems, setInitialNavItems] = useState<NavigationItem[]>([]);

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
      setNavItems(navItemsFromDB);
      setInitialNavItems(JSON.parse(JSON.stringify(navItemsFromDB))); // Deep copy for initial state
      setIsLoading(false);
    }
  }, [navItemsFromDB]);
  
  const handleSyncStructure = async () => {
    if (!firestore) return;
    setIsSyncing(true);
    setSyncConfirmOpen(false);

    try {
        const batch = writeBatch(firestore);
        const defaultIds = new Set(defaultNavItems.map(item => item.id));

        // Step 1: Upsert all items from the local source of truth.
        // This creates new items and updates existing ones with the correct parentId, order, etc.
        defaultNavItems.forEach(item => {
            const docRef = doc(firestore, 'navigationItems', item.id);
            batch.set(docRef, item, { merge: true });
        });

        // Step 2: Fetch all items currently in Firestore.
        const existingItemsSnapshot = await getDocs(collection(firestore, 'navigationItems'));
        
        // Step 3: Delete any items from Firestore that are NOT in our local source of truth.
        // This cleans up old or duplicated items.
        existingItemsSnapshot.docs.forEach(doc => {
            if (!defaultIds.has(doc.id)) {
                batch.delete(doc.ref);
            }
        });

        await batch.commit();
        toast({
            title: 'Sidebar Structure Synced',
            description: 'The sidebar navigation has been successfully restructured and cleaned up.',
        });
    } catch (err) {
        console.error("Failed to sync navigation structure", err);
        toast({
            variant: 'destructive',
            title: 'Sync Failed',
            description: 'Could not restructure the sidebar. Please try again.',
        });
    } finally {
        setIsSyncing(false);
    }
  };
  
  const hasChanges = useMemo(() => {
    return JSON.stringify(initialNavItems) !== JSON.stringify(navItems);
  }, [initialNavItems, navItems]);

  const handleRoleChange = (itemId: string, role: Role, isChecked: boolean) => {
    setNavItems(currentItems => {
        return currentItems.map(item => {
            if (item.id === itemId) {
                let updatedRoles: Role[];
                if (isChecked) {
                    updatedRoles = [...item.roles, role];
                } else {
                    updatedRoles = item.roles.filter((r) => r !== role);
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
            batch.update(docRef, { roles: item.roles });
        });
        await batch.commit();

        setInitialNavItems(JSON.parse(JSON.stringify(navItems))); // Update initial state after save
        toast({
            title: 'Permissions Saved',
            description: 'All navigation visibility changes have been saved.',
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

  const groupedNavItems = useMemo(() => {
    const itemMap = new Map(navItems.map(item => [item.id, item]));
    const childMap = new Map<string, NavigationItem[]>();

    navItems.forEach(item => {
        if (item.parentId) {
            if (!childMap.has(item.parentId)) {
                childMap.set(item.parentId, []);
            }
            childMap.get(item.parentId)!.push(item);
        }
    });
    
    const rootItems = navItems.filter(item => !item.parentId);
    
    return { rootItems, childMap, itemMap };
  }, [navItems]);

  const renderGroup = (items: NavigationItem[], isSubItem = false) => (
    items.sort((a,b) => a.order - b.order).map((item) => {
      const children = groupedNavItems.childMap.get(item.id) || [];
      return (
        <React.Fragment key={item.id}>
           <TableRow>
              <TableCell className={cn("font-medium", isSubItem && "pl-12")}>
                <div className="flex items-center gap-3">
                  <Icon name={item.icon} className="h-5 w-5" />
                  <div>
                    <span>{item.label}</span>
                    {item.path && <Badge variant="outline" className="ml-2 font-mono text-xs">{item.path}</Badge>}
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
                    aria-label={`Allow ${role} to see ${item.label}`}
                  />
                </TableCell>
              ))}
            </TableRow>
            {children.length > 0 && renderGroup(children, true)}
        </React.Fragment>
      )
    })
  );

  return (
    <div className="h-svh flex flex-col bg-background">
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold">Manage Sidebar Visibility</h2>
            <p className="text-muted-foreground">
              Control which user roles can see each sidebar menu item.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setSyncConfirmOpen(true)} disabled={isSyncing}>
                {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <RefreshCw className="mr-2 h-4 w-4"/>}
                Sync Sidebar Structure
            </Button>
            <Button onClick={() => setConfirmOpen(true)} disabled={!hasChanges || isSaving}>
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading || isNavItemsLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={1 + availableRoles.length}
                    className="h-64 text-center"
                  >
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : (
                renderGroup(groupedNavItems.rootItems)
              )}
            </TableBody>
          </Table>
        </div>
      </main>

       <AlertDialog open={isConfirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Confirm Changes</AlertDialogTitle>
                <AlertDialogDescription>
                    Are you sure you want to apply these navigation visibility changes?
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleSaveChanges}>
                  Yes, Save Changes
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <AlertDialog open={isSyncConfirmOpen} onOpenChange={setSyncConfirmOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Sync Sidebar Structure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This will restructure the navigation items in the database to match the latest code definition. It will create new groups, move items, and delete old/duplicate items.
                    <br/><br/>
                    This action is recommended to fix display issues but is irreversible.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleSyncStructure}>
                  Yes, Sync Structure
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

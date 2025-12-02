
'use client';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableCaption,
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
import { Loader2, Icon as LucideIcon, Save } from 'lucide-react';
import * as lucideIcons from 'lucide-react';
import { Header } from '@/components/layout/header';
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
  const [isConfirmOpen, setConfirmOpen] = useState(false);
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
    }
  }, [navItemsFromDB]);


  useEffect(() => {
    if (isNavItemsLoading || !firestore) return;

    const syncDefaultsToFirestore = async () => {
        setIsLoading(true);
        try {
            const existingItemsSnapshot = await getDocs(collection(firestore, 'navigationItems'));
            const existingItemIds = new Set(existingItemsSnapshot.docs.map(doc => doc.id));
            const missingItems = defaultNavItems.filter(
                (defaultItem) => !existingItemIds.has(defaultItem.id)
            );

            if (missingItems.length > 0) {
                const batch = writeBatch(firestore);
                missingItems.forEach((item) => {
                    const docRef = doc(firestore, 'navigationItems', item.id);
                    batch.set(docRef, item);
                });

                await batch.commit();
                toast({
                    title: 'Navigation Synced',
                    description: `${missingItems.length} new navigation item(s) have been added.`,
                });
            }
        } catch (err) {
            console.error("Failed to sync navigation items", err);
            toast({
                variant: 'destructive',
                title: 'Sync Failed',
                description: 'Could not add new navigation items automatically.',
            });
        } finally {
           setIsLoading(false);
        }
    };
    
    syncDefaultsToFirestore();

  }, [isNavItemsLoading, firestore, toast]);
  
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
    const mainItems = navItems.filter(item => !item.path.startsWith('/admin'));
    const adminItems = navItems.filter(item => item.path.startsWith('/admin') && !item.path.startsWith('/admin/settings'));
    const settingsItems = navItems.filter(item => item.path.startsWith('/admin/settings'));
    return { mainItems, adminItems, settingsItems };
  }, [navItems]);

  const renderGroup = (title: string, items: NavigationItem[]) => (
    <>
      <TableRow className="bg-muted/50 hover:bg-muted/50">
        <TableCell colSpan={1 + availableRoles.length} className="py-2 px-4 text-sm font-semibold text-muted-foreground">
          {title}
        </TableCell>
      </TableRow>
      {items.length > 0 ? items.sort((a,b) => a.order - b.order).map((item) => (
        <TableRow key={item.id}>
          <TableCell className="font-medium">
            <div className="flex items-center gap-3">
              <Icon name={item.icon} className="h-5 w-5" />
              <div>
                <span>{item.label}</span>
                <Badge variant="outline" className="ml-2 font-mono text-xs">
                  {item.path}
                </Badge>
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
      )) : (
        <TableRow>
            <TableCell colSpan={1 + availableRoles.length} className="text-center text-muted-foreground py-4">No items in this group.</TableCell>
        </TableRow>
      )}
    </>
  );

  return (
    <div className="h-svh flex flex-col bg-background">
      <Header title="Navigation Settings" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold">Manage Sidebar Visibility</h2>
            <p className="text-muted-foreground">
              Control which user roles can see each sidebar menu item.
            </p>
          </div>
           <Button onClick={() => setConfirmOpen(true)} disabled={!hasChanges || isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
            Save Changes
          </Button>
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
                <>
                  {renderGroup("Main Menu", groupedNavItems.mainItems)}
                  {renderGroup("Admin Section", groupedNavItems.adminItems)}
                  {renderGroup("Settings Section", groupedNavItems.settingsItems)}
                </>
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
    </div>
  );
}

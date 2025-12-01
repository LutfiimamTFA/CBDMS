
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
  updateDoc,
  writeBatch,
  getDocs,
} from 'firebase/firestore';
import { Loader2, Icon as LucideIcon } from 'lucide-react';
import * as lucideIcons from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Badge } from '@/components/ui/badge';
import { defaultNavItems } from '@/lib/navigation-items';

// Helper to get Lucide icon component by name
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
  const [navItems, setNavItems] = useState<NavigationItem[]>([]);

  const navItemsCollectionRef = useMemo(
    () =>
      firestore
        ? query(collection(firestore, 'navigationItems'), orderBy('order'))
        : null,
    [firestore]
  );
  const { data: navItemsFromDB, isLoading: isNavItemsLoading } = useCollection<NavigationItem>(navItemsCollectionRef);

  useEffect(() => {
    // This effect ensures the local state is synced with Firestore on initial load and updates.
    if (navItemsFromDB) {
      setNavItems(navItemsFromDB);
    }
  }, [navItemsFromDB]);


  useEffect(() => {
    if (isNavItemsLoading || !firestore) return;

    // This effect syncs default items TO Firestore if they don't exist yet.
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

  const handleRoleChange = async (
    itemId: string,
    role: Role,
    isChecked: boolean
  ) => {
    if (!firestore || !navItems) return;

    const itemToUpdate = navItems.find((item) => item.id === itemId);
    if (!itemToUpdate) return;

    let updatedRoles: Role[];
    if (isChecked) {
      updatedRoles = [...itemToUpdate.roles, role];
    } else {
      updatedRoles = itemToUpdate.roles.filter((r) => r !== role);
    }
    updatedRoles = [...new Set(updatedRoles)];

    const itemDocRef = doc(firestore, 'navigationItems', itemId);
    try {
      await updateDoc(itemDocRef, { roles: updatedRoles });
      toast({
        title: 'Permissions Updated',
        description: `Access for ${role} on "${itemToUpdate.label}" has been ${isChecked ? 'granted' : 'revoked'}.`,
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: error.message,
      });
    }
  };

  return (
    <div className="h-svh flex flex-col bg-background">
      <Header title="Navigation Settings" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="mb-4">
          <h2 className="text-2xl font-bold">Manage Sidebar Visibility</h2>
          <p className="text-muted-foreground">
            Control which user roles can see each sidebar menu item. Changes are
            saved automatically.
          </p>
        </div>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[250px]">Menu Item</TableHead>
                {availableRoles.map((role) => (
                  <TableHead key={role} className="text-center">
                    {role}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isNavItemsLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={1 + availableRoles.length}
                    className="h-24 text-center"
                  >
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : (
                navItems?.sort((a,b) => a.order - b.order).map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <Icon name={item.icon} className="h-5 w-5" />
                        <div>
                          <span>{item.label}</span>
                          <Badge
                            variant="outline"
                            className="ml-2 font-mono text-xs"
                          >
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
                          disabled={role === 'Super Admin'} // Super Admin always has access
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </main>
    </div>
  );
}


'use client';
import React, { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { MoreHorizontal, Plus, Trash2, Edit, Loader2, Icon as LucideIcon } from 'lucide-react';
import * as lucideIcons from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { NavigationItem } from '@/lib/types';
import { collection, doc, writeBatch, query, orderBy, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

// Helper to get Lucide icon component by name
const Icon = ({ name, ...props }: { name: string } & React.ComponentProps<typeof LucideIcon>) => {
  const LucideIcon = (lucideIcons as Record<string, any>)[name];
  if (!LucideIcon) return <lucideIcons.HelpCircle {...props} />;
  return <LucideIcon {...props} />;
};

const navItemSchema = z.object({
  label: z.string().min(2, 'Label is required.'),
  path: z.string().startsWith('/', "Path must start with a '/'. " ).min(2, 'Path is required.'),
  icon: z.string().min(1, 'Icon is required.'),
  order: z.coerce.number().min(0, 'Order must be a positive number.'),
  roles: z.array(z.string()).min(1, 'At least one role must be selected.'),
});

type NavItemFormValues = z.infer<typeof navItemSchema>;
const availableRoles = ['Super Admin', 'Manager', 'Employee', 'Client'];


export default function NavigationSettingsPage() {
  const { toast } = useToast();
  const firestore = useFirestore();

  const [isFormOpen, setFormOpen] = useState(false);
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<NavigationItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const navItemsCollectionRef = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'navigationItems'), orderBy('order')) : null),
    [firestore]
  );
  const { data: navItems, isLoading: isNavItemsLoading } = useCollection<NavigationItem>(navItemsCollectionRef);

  const form = useForm<NavItemFormValues>({
    resolver: zodResolver(navItemSchema),
    defaultValues: { label: '', path: '/', icon: 'Home', order: 100, roles: [] },
  });

  useEffect(() => {
    if (selectedItem) {
      form.reset({
        label: selectedItem.label,
        path: selectedItem.path,
        icon: selectedItem.icon,
        order: selectedItem.order,
        roles: selectedItem.roles,
      });
    } else {
      form.reset({ label: '', path: '/', icon: 'Home', order: (navItems?.length || 0) + 1, roles: [] });
    }
  }, [selectedItem, form, navItems]);

  const handleSubmit = async (data: NavItemFormValues) => {
    if (!firestore) return;
    setIsLoading(true);
    try {
      if (selectedItem) {
        // Update existing item
        const itemDocRef = doc(firestore, 'navigationItems', selectedItem.id);
        await updateDoc(itemDocRef, data as any);
        toast({ title: 'Navigation Item Updated', description: `"${data.label}" has been saved.` });
      } else {
        // Create new item
        await addDoc(collection(firestore, 'navigationItems'), data as any);
        toast({ title: 'Navigation Item Created', description: `"${data.label}" has been added to the sidebar.` });
      }
      setFormOpen(false);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Operation Failed', description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedItem || !firestore) return;
    setIsLoading(true);
    try {
      const itemDocRef = doc(firestore, 'navigationItems', selectedItem.id);
      await deleteDoc(itemDocRef);
      toast({ title: 'Navigation Item Deleted', description: `"${selectedItem.label}" has been removed.` });
      setDeleteDialogOpen(false);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Deletion Failed', description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const openFormDialog = (item: NavigationItem | null) => {
    setSelectedItem(item);
    setFormOpen(true);
  };

  const openDeleteDialog = (item: NavigationItem) => {
    setSelectedItem(item);
    setDeleteDialogOpen(true);
  };

  return (
    <div className="h-svh flex-col bg-background p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
            <div>
                <h2 className="text-2xl font-bold">Manage Sidebar Navigation</h2>
                <p className="text-muted-foreground">Add, edit, or remove items from the main sidebar.</p>
            </div>
            <Button size="sm" onClick={() => openFormDialog(null)}>
                <Plus className="mr-2" /> Create New Item
            </Button>
        </div>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Icon</TableHead>
                <TableHead>Label</TableHead>
                <TableHead>Path</TableHead>
                <TableHead>Visible To</TableHead>
                <TableHead><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isNavItemsLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    <Loader2 className='h-6 w-6 animate-spin mx-auto' />
                  </TableCell>
                </TableRow>
              ) : (
                navItems?.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.order}</TableCell>
                    <TableCell><Icon name={item.icon} className="h-5 w-5" /></TableCell>
                    <TableCell>{item.label}</TableCell>
                    <TableCell><code className="text-sm bg-muted p-1 rounded-sm">{item.path}</code></TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {item.roles.map(role => <Badge key={role} variant="secondary">{role}</Badge>)}
                      </div>
                    </TableCell>
                    <TableCell>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => openFormDialog(item)}><Edit className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => openDeleteDialog(item)}><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        
        {/* Form Dialog */}
        <Dialog open={isFormOpen} onOpenChange={setFormOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{selectedItem ? 'Edit' : 'Create'} Navigation Item</DialogTitle>
                    <DialogDescription>Fill in the details for the sidebar menu item.</DialogDescription>
                </DialogHeader>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                    <div className='grid grid-cols-2 gap-4'>
                         <div className="space-y-2">
                            <Label htmlFor="label">Label</Label>
                            <Input id="label" {...form.register('label')} />
                            {form.formState.errors.label && <p className="text-sm text-destructive">{form.formState.errors.label.message}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="path">Path</Label>
                            <Input id="path" {...form.register('path')} />
                            {form.formState.errors.path && <p className="text-sm text-destructive">{form.formState.errors.path.message}</p>}
                        </div>
                    </div>
                     <div className='grid grid-cols-2 gap-4'>
                        <div className="space-y-2">
                            <Label htmlFor="icon">Icon Name (lucide-react)</Label>
                            <Input id="icon" {...form.register('icon')} />
                            {form.formState.errors.icon && <p className="text-sm text-destructive">{form.formState.errors.icon.message}</p>}
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="order">Order</Label>
                            <Input id="order" type="number" {...form.register('order')} />
                            {form.formState.errors.order && <p className="text-sm text-destructive">{form.formState.errors.order.message}</p>}
                        </div>
                    </div>
                    <div className="space-y-3">
                        <Label>Visible To Roles</Label>
                        <div className="grid grid-cols-2 gap-4 rounded-md border p-4">
                        {availableRoles.map((role) => (
                            <div key={role} className="flex items-center space-x-2">
                                <Checkbox
                                    id={`role-${role}`}
                                    checked={form.watch('roles').includes(role)}
                                    onCheckedChange={(checked) => {
                                        const currentRoles = form.getValues('roles');
                                        if (checked) {
                                            form.setValue('roles', [...currentRoles, role]);
                                        } else {
                                            form.setValue('roles', currentRoles.filter((r) => r !== role));
                                        }
                                    }}
                                />
                                <Label htmlFor={`role-${role}`} className="font-normal">{role}</Label>
                            </div>
                        ))}
                        </div>
                        {form.formState.errors.roles && <p className="text-sm text-destructive">{form.formState.errors.roles.message}</p>}
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => setFormOpen(false)}>Cancel</Button>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            {selectedItem ? 'Save Changes' : 'Create Item'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
              <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                      This will permanently delete the navigation item <span className="font-bold">"{selectedItem?.label}"</span>.
                  </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                    Yes, delete
                  </AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

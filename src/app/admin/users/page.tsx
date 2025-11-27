'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { MoreHorizontal, Plus, Trash2, Edit, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCollection, useFirestore, useMemoFirebase, useUserProfile } from '@/firebase';
import type { User } from '@/lib/types';
import { collection } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import { usePermissions } from '@/context/permissions-provider';

const userSchema = z.object({
  name: z.string().min(2, 'Name is required.'),
  email: z.string().email('Invalid email address.'),
  role: z.enum(['Super Admin', 'Manager', 'Employee', 'Client']),
  password: z.string().min(6, 'Password must be at least 6 characters.').optional(),
});

const editUserSchema = userSchema.omit({ password: true });

type UserFormValues = z.infer<typeof userSchema>;
type EditUserFormValues = z.infer<typeof editUserSchema>;

export default function UsersPage() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { profile: currentUserProfile } = useUserProfile();
  const { permissions, isLoading: permissionsLoading } = usePermissions();

  const [isCreateDialogOpen, setCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const usersCollectionRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'users') : null),
    [firestore]
  );
  const { data: users, isLoading: isUsersLoading } = useCollection<User>(usersCollectionRef);

  const createForm = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      name: '',
      email: '',
      role: 'Employee',
    },
  });

  const editForm = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserSchema),
  });
  
  const canManageUsers = useMemo(() => {
    if (!currentUserProfile || !permissions) return false;
    if (currentUserProfile.role === 'Super Admin') return true;
    if (currentUserProfile.role === 'Manager') {
      return permissions.Manager.canManageUsers;
    }
    return false;
  }, [currentUserProfile, permissions]);

  const canDeleteUsers = useMemo(() => {
      if (!currentUserProfile || !permissions) return false;
      if (currentUserProfile.role === 'Super Admin') return true;
      if (currentUserProfile.role === 'Manager') {
        return permissions.Manager.canDeleteUsers;
      }
      return false;
  }, [currentUserProfile, permissions]);


  useEffect(() => {
    if (selectedUser) {
      editForm.reset({
        name: selectedUser.name,
        email: selectedUser.email,
        role: selectedUser.role,
      });
    }
  }, [selectedUser, editForm]);

  const handleCreateUser = async (data: UserFormValues) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create user.');
      }
      
      toast({
        title: 'User Created',
        description: `${data.name} has been added to the system.`,
      });
      createForm.reset();
      setCreateDialogOpen(false);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Creation Failed',
        description: error.message,
      });
    } finally {
        setIsLoading(false);
    }
  };

  const handleUpdateUser = async (data: EditUserFormValues) => {
    if (!selectedUser) return;
    setIsLoading(true);
    try {
      const response = await fetch('/api/update-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: selectedUser.id, ...data }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update user.');
      }

      toast({
        title: 'User Updated',
        description: `${data.name}'s details have been saved.`,
      });
      setEditDialogOpen(false);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: error.message,
      });
    } finally {
        setIsLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    setIsLoading(true);
    try {
      const response = await fetch('/api/delete-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: selectedUser.id }),
      });

      if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to delete user.');
      }

      toast({
        title: 'User Deleted',
        description: `${selectedUser.name} has been removed.`,
      });
      setDeleteDialogOpen(false);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Deletion Failed',
        description: error.message,
      });
    } finally {
        setIsLoading(false);
    }
  };
  
  const openEditDialog = (user: User) => {
    setSelectedUser(user);
    setEditDialogOpen(true);
  };
  
  const openDeleteDialog = (user: User) => {
    setSelectedUser(user);
    setDeleteDialogOpen(true);
  };

  const roleColors: Record<User['role'], string> = {
    'Super Admin': 'bg-red-500 text-white',
    'Manager': 'bg-blue-500 text-white',
    'Employee': 'bg-green-500 text-white',
    'Client': 'bg-gray-500 text-white',
  }

  return (
    <div className="flex h-svh flex-col bg-background">
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
            <div>
                <h2 className="text-2xl font-bold">User Management</h2>
                <p className="text-muted-foreground">Manage all users in the system.</p>
            </div>
            {canManageUsers && (
                <Dialog open={isCreateDialogOpen} onOpenChange={setCreateDialogOpen}>
                    <DialogTrigger asChild>
                    <Button size="sm">
                        <Plus className="mr-2" /> Add User
                    </Button>
                    </DialogTrigger>
                    <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add New User</DialogTitle>
                        <DialogDescription>
                        Fill in the details to create a new user account.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={createForm.handleSubmit(handleCreateUser)} className="space-y-4">
                        <div className="space-y-2">
                        <Label htmlFor="name-create">Full Name</Label>
                        <Input id="name-create" {...createForm.register('name')} />
                        {createForm.formState.errors.name && <p className="text-sm text-destructive">{createForm.formState.errors.name.message}</p>}
                        </div>
                        <div className="space-y-2">
                        <Label htmlFor="email-create">Email Address</Label>
                        <Input id="email-create" type="email" {...createForm.register('email')} />
                        {createForm.formState.errors.email && <p className="text-sm text-destructive">{createForm.formState.errors.email.message}</p>}
                        </div>
                        <div className="space-y-2">
                        <Label htmlFor="password-create">Password</Label>
                        <Input id="password-create" type="password" {...createForm.register('password')} />
                        {createForm.formState.errors.password && <p className="text-sm text-destructive">{createForm.formState.errors.password.message}</p>}
                        </div>
                        <div className="space-y-2">
                        <Label htmlFor="role-create">Role</Label>
                        <Controller
                            control={createForm.control}
                            name="role"
                            render={({ field }) => (
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <SelectTrigger id="role-create">
                                <SelectValue placeholder="Select a role" />
                                </SelectTrigger>
                                <SelectContent>
                                  {currentUserProfile?.role === 'Super Admin' && <SelectItem value="Super Admin">Super Admin</SelectItem>}
                                  <SelectItem value="Manager">Manager</SelectItem>
                                  <SelectItem value="Employee">Employee</SelectItem>
                                  <SelectItem value="Client">Client</SelectItem>
                                </SelectContent>
                            </Select>
                            )}
                        />
                        </div>
                        <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            Create User
                        </Button>
                        </DialogFooter>
                    </form>
                    </DialogContent>
                </Dialog>
            )}
        </div>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Created At</TableHead>
                {canManageUsers && <TableHead><span className="sr-only">Actions</span></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isUsersLoading || permissionsLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    <div className='flex items-center justify-center gap-2'>
                        <Loader2 className='h-5 w-5 animate-spin' />
                        Loading users...
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                users?.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                        <Badge className={roleColors[user.role]}>{user.role}</Badge>
                    </TableCell>
                    <TableCell>
                      {user.createdAt ? format(parseISO(user.createdAt), 'PPpp') : 'N/A'}
                    </TableCell>
                    {canManageUsers && (
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
                            <DropdownMenuItem onClick={() => openEditDialog(user)}>
                                <Edit className="mr-2 h-4 w-4" /> Edit
                            </DropdownMenuItem>
                            {canDeleteUsers && <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => openDeleteDialog(user)}
                                >
                                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                                </DropdownMenuItem>
                            </>}
                            </DropdownMenuContent>
                        </DropdownMenu>
                        </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </main>

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User: {selectedUser?.name}</DialogTitle>
            <DialogDescription>
              Update the user's details below.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit(handleUpdateUser)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name-edit">Full Name</Label>
              <Input id="name-edit" {...editForm.register('name')} />
              {editForm.formState.errors.name && <p className="text-sm text-destructive">{editForm.formState.errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-edit">Email Address</Label>
              <Input id="email-edit" type="email" {...editForm.register('email')} readOnly />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-edit">Role</Label>
               <Controller
                    control={editForm.control}
                    name="role"
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger id="role-edit">
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                        <SelectContent>
                          {currentUserProfile?.role === 'Super Admin' && <SelectItem value="Super Admin">Super Admin</SelectItem>}
                          <SelectItem value="Manager">Manager</SelectItem>
                          <SelectItem value="Employee">Employee</SelectItem>
                          <SelectItem value="Client">Client</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isLoading}>
                 {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
              <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete the user account
                      for <span className="font-bold">{selectedUser?.name}</span> and remove their data from our servers.
                  </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteUser} className="bg-destructive hover:bg-destructive/90" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                    Yes, delete user
                  </AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

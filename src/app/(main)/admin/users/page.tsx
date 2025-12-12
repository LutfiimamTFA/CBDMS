
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
import { MoreHorizontal, Plus, Trash2, Edit, Loader2, KeyRound, Copy, Star, Mail } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCollection, useFirestore, useUserProfile, useDoc } from '@/firebase';
import type { User, Brand, CompanySettings } from '@/lib/types';
import { collection, doc, query, where, orderBy, updateDoc, setDoc } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import { usePermissions } from '@/context/permissions-provider';
import { Header } from '@/components/layout/header';
import { MultiSelect } from '@/components/ui/multi-select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';


const userSchema = z.object({
  name: z.string().min(2, 'Name is required.'),
  email: z.string().email('Invalid email address.'),
  role: z.enum(['Super Admin', 'Manager', 'Employee', 'Client']),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
  managerId: z.string().optional(),
  brandIds: z.array(z.string()).optional(),
});

const editUserSchema = z.object({
  name: z.string().min(2, 'Name is required.'),
  email: z.string().email('Invalid email address.'),
  role: z.enum(['Super Admin', 'Manager', 'Employee', 'Client']),
  managerId: z.string().optional(),
  brandIds: z.array(z.string()).optional(),
});

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
  const [isResetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdatingEmergencyStatus, setIsUpdatingEmergencyStatus] = useState<string | null>(null);

  const usersCollectionRef = useMemo(() => {
    if (!firestore || !currentUserProfile) return null;
    let q = query(collection(firestore, 'users'), where('companyId', '==', currentUserProfile.companyId));
    // For Managers, we fetch all managers and employees to filter on client side.
    if (currentUserProfile.role === 'Manager') {
        q = query(q, where('role', 'in', ['Manager', 'Employee']));
    }
    return q;
  }, [firestore, currentUserProfile]);
  const { data: users, isLoading: isUsersLoading } = useCollection<User>(usersCollectionRef);
  
  const brandsQuery = useMemo(
    () => (firestore ? query(collection(firestore, 'brands'), orderBy('name')) : null),
    [firestore]
  );
  const { data: brands, isLoading: areBrandsLoading } = useCollection<Brand>(brandsQuery);
  
  const companySettingsDocRef = useMemo(() => {
    if (!firestore || !currentUserProfile?.companyId) return null;
    return doc(firestore, 'companySettings', currentUserProfile.companyId);
  }, [firestore, currentUserProfile?.companyId]);
  
  const { data: companySettings, isLoading: isCompanySettingsLoading } = useDoc<CompanySettings>(companySettingsDocRef);

  const managers = useMemo(() => (users || []).filter(u => u.role === 'Manager'), [users]);
  
  const brandOptions = useMemo(() => {
    return (brands || []).map(b => ({ value: b.id, label: b.name }));
  }, [brands]);


  const sortedAndGroupedUsers = useMemo(() => {
    if (!users || !currentUserProfile) return [];

    let usersToShow = users;
    
    // For Managers, filter to only show their direct reports and themself
    if (currentUserProfile.role === 'Manager') {
      usersToShow = users.filter(user => 
        user.id === currentUserProfile.id || user.managerId === currentUserProfile.id
      );
    }
    
    const roleOrder: Record<User['role'], number> = {
        'Super Admin': 0,
        'Manager': 1,
        'Employee': 2,
        'Client': 3,
    };

    return [...usersToShow].sort((a, b) => {
        if (a.id === currentUserProfile?.id) return -1;
        if (b.id === currentUserProfile?.id) return 1;
        
        const roleComparison = roleOrder[a.role] - roleOrder[b.role];
        if (roleComparison !== 0) return roleComparison;

        return a.name.localeCompare(b.name);
    });
  }, [users, currentUserProfile]);


  const createForm = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      name: '',
      email: '',
      role: 'Employee',
      password: '',
      managerId: '',
      brandIds: [],
    },
  });

  const editForm = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserSchema),
  });
  
  const createFormRole = createForm.watch('role');
  const editFormRole = editForm.watch('role');

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
        managerId: selectedUser.managerId || '',
        brandIds: selectedUser.brandIds || [],
      });
    }
  }, [selectedUser, editForm]);

  const handleCreateUser = async (data: UserFormValues) => {
    if (!firestore || !currentUserProfile) return;
    setIsLoading(true);
    try {
      if (currentUserProfile?.role === 'Manager' && (data.role === 'Super Admin' || data.role === 'Manager')) {
        throw new Error("Managers can only create Employee or Client users.");
      }

      const payload: any = { ...data, companyId: currentUserProfile.companyId };
      
      // If the creator is a Manager, automatically assign the new user to them.
      if (currentUserProfile.role === 'Manager' && data.role === 'Employee') {
        payload.managerId = currentUserProfile.id;
      }
      
      const response = await fetch('/api/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
    if (!selectedUser || !firestore || !currentUserProfile) return;
    setIsLoading(true);
    try {
      const apiPayload = { uid: selectedUser.id, ...data };
      
      const response = await fetch('/api/update-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiPayload),
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

   const handleForcePasswordReset = async () => {
        if (!selectedUser) return;
        setIsLoading(true);
        setResetConfirmOpen(false);
        try {
            const response = await fetch('/api/admin-reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uid: selectedUser.id }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to reset password.');
            }
            
            setGeneratedPassword(data.temporaryPassword);
            
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Operation Failed',
                description: error.message,
            });
        } finally {
            setIsLoading(false);
        }
    };

  const handleToggleEmergencyAdmin = async (manager: User) => {
    if (!companySettingsDocRef) return;
    setIsUpdatingEmergencyStatus(manager.id);
    
    try {
      const isCurrentlyEmergencyAdmin = companySettings?.emergencyAdminUserId === manager.id;
      const newEmergencyAdminId = isCurrentlyEmergencyAdmin ? null : manager.id;
      
      await setDoc(companySettingsDocRef, { emergencyAdminUserId: newEmergencyAdminId }, { merge: true });

      toast({
        title: 'Success!',
        description: isCurrentlyEmergencyAdmin 
          ? `Revoked emergency status from ${manager.name}.`
          : `Granted emergency admin status to ${manager.name}.`,
      });

    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Operation Failed',
        description: error.message || 'Could not update emergency admin status.',
      });
    } finally {
      setIsUpdatingEmergencyStatus(null);
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

  const openResetConfirmDialog = (user: User) => {
      setSelectedUser(user);
      setResetConfirmOpen(true);
  }
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
        title: "Copied to Clipboard",
        description: "The temporary password has been copied."
    });
  }

  const roleColors: Record<User['role'], string> = {
    'Super Admin': 'bg-red-500 text-white',
    'Manager': 'bg-blue-500 text-white',
    'Employee': 'bg-green-500 text-white',
    'Client': 'bg-gray-500 text-white',
  }
  
  let lastRole: string | null = null;
  const emergencyAdminId = companySettings?.emergencyAdminUserId;


  return (
    <div className="flex h-svh flex-col bg-background">
      <Header title="User Management" />
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
                    <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Add New User</DialogTitle>
                        <DialogDescription>
                        Fill in the details to create a new user account.
                        </DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="max-h-[70vh] -mx-6 px-6">
                      <div className="py-4">
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
                                      {currentUserProfile?.role === 'Super Admin' && <SelectItem value="Manager">Manager</SelectItem>}
                                      <SelectItem value="Employee">Employee</SelectItem>
                                      <SelectItem value="Client">Client</SelectItem>
                                    </SelectContent>
                                </Select>
                                )}
                              />
                            </div>
                             {currentUserProfile?.role === 'Super Admin' && createFormRole === 'Manager' && (
                                <Controller
                                    control={createForm.control}
                                    name="brandIds"
                                    render={({ field }) => (
                                      <div className="space-y-2">
                                        <Label>Managed Brands</Label>
                                        <MultiSelect
                                          options={brandOptions}
                                          onValueChange={field.onChange}
                                          defaultValue={field.value || []}
                                          placeholder="Select brands..."
                                        />
                                      </div>
                                    )}
                                />
                             )}
                             {currentUserProfile?.role === 'Super Admin' && createFormRole === 'Employee' && (
                                <div className="space-y-2">
                                    <Label htmlFor="manager-create">Assign Manager</Label>
                                    <Controller
                                        control={createForm.control}
                                        name="managerId"
                                        render={({ field }) => (
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <SelectTrigger id="manager-create">
                                            <SelectValue placeholder="Select a manager" />
                                            </SelectTrigger>
                                            <SelectContent>
                                            {managers.map(m => {
                                                const managedBrands = m.brandIds?.map(id => brands?.find(b => b.id === id)?.name).filter(Boolean) || [];
                                                return (
                                                    <SelectItem key={m.id} value={m.id}>
                                                        <div className="flex flex-col">
                                                            <span>{m.name}</span>
                                                            {managedBrands.length > 0 && 
                                                                <span className="text-xs text-muted-foreground">{managedBrands.join(', ')}</span>
                                                            }
                                                        </div>
                                                    </SelectItem>
                                                )
                                            })}
                                            </SelectContent>
                                        </Select>
                                        )}
                                    />
                                </div>
                             )}
                            <DialogFooter className="pt-4">
                              <Button type="button" variant="ghost" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
                              <Button type="submit" disabled={isLoading}>
                                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                  Create User
                              </Button>
                            </DialogFooter>
                        </form>
                      </div>
                    </ScrollArea>
                    </DialogContent>
                </Dialog>
            )}
        </div>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Scope / Manager</TableHead>
                <TableHead className="hidden lg:table-cell">Created At</TableHead>
                {canManageUsers && <TableHead><span className="sr-only">Actions</span></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isUsersLoading || permissionsLoading || isCompanySettingsLoading || areBrandsLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    <div className='flex items-center justify-center gap-2'>
                        <Loader2 className='h-5 w-5 animate-spin' />
                        Loading users...
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                sortedAndGroupedUsers.map((user) => {
                  const showRoleHeader = user.role !== lastRole;
                  lastRole = user.role;
                  const isCurrentUser = user.id === currentUserProfile?.id;
                  const canEditThisUser = currentUserProfile?.role === 'Super Admin' || (currentUserProfile?.role === 'Manager' && user.role !== 'Manager' && user.role !== 'Super Admin');
                  const isEmergencyAdmin = emergencyAdminId === user.id;

                  const manager = users?.find(u => u.id === user.managerId);
                  const managedBrands = user.brandIds?.map(id => brands?.find(b => b.id === id)?.name).filter(Boolean) || [];

                  return (
                    <React.Fragment key={user.id}>
                      {showRoleHeader && (
                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                          <TableCell colSpan={5} className="py-2 px-4 text-sm font-semibold text-muted-foreground">
                            {user.role === 'Super Admin' ? 'Administrators' : user.role === 'Manager' ? 'Managers' : `${user.role}s`}
                          </TableCell>
                        </TableRow>
                      )}
                      <TableRow data-state={isCurrentUser || isEmergencyAdmin ? 'selected' : ''}>
                        <TableCell className="font-medium">
                          <div className='flex items-center gap-2'>
                            <span>{user.name}</span>
                            {isCurrentUser && <Badge variant='outline'>(You)</Badge>}
                             {isEmergencyAdmin && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <Badge variant='destructive' className='gap-1'><Star className='h-3 w-3'/> Emergency Admin</Badge>
                                    </TooltipTrigger>
                                    <TooltipContent><p>{user.name} has temporary Super Admin privileges.</p></TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                          </div>
                          <div className='text-muted-foreground text-sm'>{user.email}</div>
                        </TableCell>
                        <TableCell>
                            <Badge className={roleColors[user.role]}>{user.role}</Badge>
                        </TableCell>
                        <TableCell>
                          {user.role === 'Manager' ? (
                            <div className="flex flex-wrap gap-1">
                              {managedBrands.map(brandName => <Badge key={brandName} variant="secondary">{brandName}</Badge>)}
                            </div>
                          ) : user.role === 'Employee' && manager ? (
                             <span className="text-sm text-muted-foreground">{manager.name}</span>
                          ) : null}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {user.createdAt ? format(parseISO(user.createdAt), 'PPpp') : 'N/A'}
                        </TableCell>
                        {canManageUsers && (
                            <TableCell>
                             {!isCurrentUser && canEditThisUser && (
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
                                     <DropdownMenuItem onClick={() => openResetConfirmDialog(user)}>
                                        <KeyRound className="mr-2 h-4 w-4" /> Reset Password
                                    </DropdownMenuItem>
                                     {currentUserProfile?.role === 'Super Admin' && user.role === 'Manager' && (
                                        <DropdownMenuItem
                                          disabled={isUpdatingEmergencyStatus !== null && !isEmergencyAdmin}
                                          onClick={() => handleToggleEmergencyAdmin(user)}
                                        >
                                          {isUpdatingEmergencyStatus === user.id ? (
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                                          ) : (
                                            <Star className="mr-2 h-4 w-4" />
                                          )}
                                          {isEmergencyAdmin ? 'Revoke Emergency Status' : 'Make Emergency Admin'}
                                        </DropdownMenuItem>
                                      )}
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
                             )}
                            </TableCell>
                        )}
                      </TableRow>
                    </React.Fragment>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </main>

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User: {selectedUser?.name}</DialogTitle>
            <DialogDescription>
              Update the user's details below.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] -mx-6 px-6">
            <div className="py-4">
                <form onSubmit={editForm.handleSubmit(handleUpdateUser)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name-edit">Full Name</Label>
                    <Input id="name-edit" {...editForm.register('name')} />
                    {editForm.formState.errors.name && <p className="text-sm text-destructive">{editForm.formState.errors.name.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email-edit">Email Address</Label>
                    <Input id="email-edit" type="email" {...editForm.register('email')} />
                    {editForm.formState.errors.email && <p className="text-sm text-destructive">{editForm.formState.errors.email.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role-edit">Role</Label>
                     <Controller
                          control={editForm.control}
                          name="role"
                          render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value} disabled={currentUserProfile?.role !== 'Super Admin'}>
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
                  {editFormRole === 'Manager' && (
                       <Controller
                          control={editForm.control}
                          name="brandIds"
                          render={({ field }) => (
                            <div className="space-y-2">
                              <Label>Managed Brands</Label>
                              <MultiSelect
                                options={brandOptions}
                                onValueChange={field.onChange}
                                defaultValue={field.value || []}
                                placeholder="Select brands..."
                              />
                            </div>
                          )}
                      />
                  )}
                  {editFormRole === 'Employee' && (
                      <div className="space-y-2">
                          <Label htmlFor="manager-edit">Assign Manager</Label>
                          <Controller
                              control={editForm.control}
                              name="managerId"
                              render={({ field }) => (
                              <Select onValueChange={field.onChange} value={field.value}>
                                  <SelectTrigger id="manager-edit">
                                  <SelectValue placeholder="Select a manager" />
                                  </SelectTrigger>
                                  <SelectContent>
                                  {managers.map(m => {
                                      const managedBrands = m.brandIds?.map(id => brands?.find(b => b.id === id)?.name).filter(Boolean) || [];
                                      return (
                                          <SelectItem key={m.id} value={m.id}>
                                              <div className="flex flex-col">
                                                  <span>{m.name}</span>
                                                  {managedBrands.length > 0 && 
                                                      <span className="text-xs text-muted-foreground">{managedBrands.join(', ')}</span>
                                                  }
                                              </div>
                                          </SelectItem>
                                      )
                                  })}
                                  </SelectContent>
                              </Select>
                              )}
                          />
                      </div>
                  )}
                  <DialogFooter className="pt-4">
                    <Button type="button" variant="ghost" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={isLoading}>
                       {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                      Save Changes
                    </Button>
                  </DialogFooter>
                </form>
              </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={isResetConfirmOpen} onOpenChange={setResetConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Reset Password for {selectedUser?.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                    This will generate a new temporary password and mark the user's account to require a password change on their next login.
                    <br/><br/>
                    You will be shown the temporary password to provide to the user. Are you sure you want to proceed?
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleForcePasswordReset} disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Yes, Reset Password
                </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!generatedPassword} onOpenChange={(open) => !open && setGeneratedPassword(null)}>
          <DialogContent>
              <DialogHeader>
                  <DialogTitle>Temporary Password Generated</DialogTitle>
                  <DialogDescription>
                    Please provide the following temporary password to <strong className='text-foreground'>{selectedUser?.name}</strong>. They will be required to change it upon login.
                  </DialogDescription>
              </DialogHeader>
              <div className='py-4'>
                <div className='flex items-center gap-2'>
                    <Input readOnly value={generatedPassword || ''} className="font-mono text-lg" />
                    <Button size="icon" onClick={() => copyToClipboard(generatedPassword || '')}><Copy className='h-4 w-4'/></Button>
                </div>
              </div>
              <DialogFooter>
                  <Button onClick={() => setGeneratedPassword(null)}>Done</Button>
              </DialogFooter>
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

    

'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Header } from '@/components/layout/header';
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
import { Textarea } from '@/components/ui/textarea';
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
import { MoreHorizontal, Plus, Trash2, Edit, Loader2, Repeat, Building2, User, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCollection, useFirestore, useUserProfile } from '@/firebase';
import type { RecurringTaskTemplate, Brand, User as UserType } from '@/lib/types';
import { collection, query, orderBy, addDoc, updateDoc, deleteDoc, serverTimestamp, doc, where } from 'firebase/firestore';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';


const templateSchema = z.object({
  title: z.string().min(3, 'Title is required.'),
  description: z.string().optional(),
  frequency: z.enum(['daily', 'weekly', 'monthly']),
  daysOfWeek: z.array(z.string()).optional(),
  dayOfMonth: z.coerce.number().optional(),
  defaultAssigneeIds: z.array(z.string()).min(1, 'At least one assignee is required.'),
  defaultPriority: z.enum(['Urgent', 'High', 'Medium', 'Low']),
  defaultBrandId: z.string().min(1, 'Brand is required.'),
});

type TemplateFormValues = z.infer<typeof templateSchema>;

const days: Record<string, string> = {
    Sunday: 'Su',
    Monday: 'Mo',
    Tuesday: 'Tu',
    Wednesday: 'We',
    Thursday: 'Th',
    Friday: 'Fr',
    Saturday: 'Sa',
};

export default function RecurringTasksPage() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { profile } = useUserProfile();

  const [isDialogOpen, setDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<RecurringTaskTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<UserType[]>([]);

  const templatesCollectionRef = useMemo(() => 
    firestore && profile ? query(collection(firestore, 'recurringTaskTemplates'), where('companyId', '==', profile.companyId)) : null, 
  [firestore, profile]);
  const { data: templates, isLoading: templatesLoading } = useCollection<RecurringTaskTemplate>(templatesCollectionRef);

  const brandsQuery = useMemo(() => 
    firestore ? query(collection(firestore, 'brands'), orderBy('name')) : null, 
  [firestore]);
  const { data: brands, isLoading: brandsLoading } = useCollection<Brand>(brandsQuery);

  const usersQuery = useMemo(() => 
    firestore && profile ? query(collection(firestore, 'users'), where('companyId', '==', profile.companyId)) : null, 
  [firestore, profile]);
  const { data: users, isLoading: usersLoading } = useCollection<UserType>(usersQuery);

  const employeeUsers = useMemo(() => {
    if (!users) return [];
    return users.filter(user => user.role === 'Employee');
  }, [users]);

  const form = useForm<TemplateFormValues>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      title: '',
      description: '',
      frequency: 'weekly',
      daysOfWeek: [],
      defaultAssigneeIds: [],
      defaultPriority: 'Medium',
      defaultBrandId: '',
    },
  });
  
  const frequency = form.watch('frequency');

  useEffect(() => {
    if (selectedTemplate) {
      form.reset({
        title: selectedTemplate.title,
        description: selectedTemplate.description,
        frequency: selectedTemplate.frequency,
        daysOfWeek: selectedTemplate.daysOfWeek,
        dayOfMonth: selectedTemplate.dayOfMonth,
        defaultAssigneeIds: selectedTemplate.defaultAssigneeIds,
        defaultPriority: selectedTemplate.defaultPriority,
        defaultBrandId: selectedTemplate.defaultBrandId,
      });
      const assignees = (users || []).filter(u => selectedTemplate.defaultAssigneeIds.includes(u.id));
      setSelectedUsers(assignees);
    } else {
      form.reset({
        title: '',
        description: '',
        frequency: 'weekly',
        daysOfWeek: [],
        defaultAssigneeIds: [],
        defaultPriority: 'Medium',
        defaultBrandId: '',
      });
      setSelectedUsers([]);
    }
  }, [selectedTemplate, form, users]);


  const handleOpenDialog = (template: RecurringTaskTemplate | null = null) => {
    setSelectedTemplate(template);
    setDialogOpen(true);
  };
  
  const handleOpenDeleteDialog = (template: RecurringTaskTemplate) => {
    setSelectedTemplate(template);
    setDeleteDialogOpen(true);
  }

  const handleSelectUser = (user: UserType) => {
    if (!selectedUsers.find((u) => u.id === user.id)) {
      const newSelectedUsers = [...selectedUsers, user];
      setSelectedUsers(newSelectedUsers);
      form.setValue('defaultAssigneeIds', newSelectedUsers.map(u => u.id));
    }
  };

  const handleRemoveUser = (userId: string) => {
    const newSelectedUsers = selectedUsers.filter((u) => u.id !== userId);
    setSelectedUsers(newSelectedUsers);
    form.setValue('defaultAssigneeIds', newSelectedUsers.map(u => u.id));
  };


  const handleSubmit = async (data: TemplateFormValues) => {
    if (!firestore || !profile) return;
    setIsLoading(true);

    const templateData = {
        ...data,
        companyId: profile.companyId,
        createdAt: selectedTemplate ? selectedTemplate.createdAt : serverTimestamp(),
        lastGeneratedAt: selectedTemplate?.lastGeneratedAt,
    };
    
    try {
        if (selectedTemplate) {
            const templateRef = doc(firestore, 'recurringTaskTemplates', selectedTemplate.id);
            await updateDoc(templateRef, templateData);
            toast({ title: 'Template Updated', description: `Template "${data.title}" has been saved.` });
        } else {
            await addDoc(collection(firestore, 'recurringTaskTemplates'), templateData);
            toast({ title: 'Template Created', description: `Template "${data.title}" has been saved.` });
        }
        setDialogOpen(false);
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
        setIsLoading(false);
    }
  };

  const handleDeleteTemplate = async () => {
    if (!selectedTemplate || !firestore) return;
    setIsLoading(true);
    try {
      const templateRef = doc(firestore, 'recurringTaskTemplates', selectedTemplate.id);
      await deleteDoc(templateRef);
      toast({ title: 'Template Deleted', description: `Template "${selectedTemplate.title}" has been removed.` });
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

  return (
    <div className="flex h-svh flex-col bg-background">
      <Header title="Recurring Tasks" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Recurring Task Templates</h2>
            <p className="text-muted-foreground">
              Create and manage templates for tasks that need to be done on a regular schedule.
            </p>
          </div>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            Create Template
          </Button>
        </div>

        {templatesLoading ? (
            <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin"/></div>
        ) : templates && templates.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {templates.map((template) => (
              <Card key={template.id}>
                <CardHeader>
                  <CardTitle>{template.title}</CardTitle>
                  <CardDescription>{template.description || 'No description'}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                    <div className='flex items-center gap-2'><Repeat className='h-4 w-4 text-muted-foreground'/> <span>Repeats {template.frequency}</span></div>
                    <div className='flex items-center gap-2'><Building2 className='h-4 w-4 text-muted-foreground'/> <span>{(brands || []).find(b => b.id === template.defaultBrandId)?.name}</span></div>
                    <div className='flex items-center gap-2'><User className='h-4 w-4 text-muted-foreground'/> <span>Assigned to {template.defaultAssigneeIds.length} users</span></div>
                </CardContent>
                <CardFooter className="flex justify-between">
                    <Badge variant={template.defaultPriority === 'Urgent' ? 'destructive' : 'secondary'}>{template.defaultPriority}</Badge>
                    <div>
                        <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(template)}><Edit className="h-4 w-4"/></Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleOpenDeleteDialog(template)}><Trash2 className="h-4 w-4"/></Button>
                    </div>
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <Repeat className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-medium">No Templates Found</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Get started by creating a new recurring task template.
              </p>
            </CardContent>
          </Card>
        )}
      </main>

      <Dialog open={isDialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl grid-rows-[auto_minmax(0,1fr)_auto] p-0 max-h-[90vh]">
          <DialogHeader className="p-6 pb-4">
            <DialogTitle>{selectedTemplate ? 'Edit Template' : 'Create New Template'}</DialogTitle>
            <DialogDescription>
              Tasks will be automatically generated based on this template's schedule.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="px-6">
            <div className="py-4">
              <form id="recurring-task-form" onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="title">Template Title</Label>
                    <Input id="title" {...form.register('title')} placeholder="e.g., Weekly Social Media Post" />
                    {form.formState.errors.title && <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>}
                </div>
                <div className="space-y-2">
                    <Label htmlFor="description">Default Description (optional)</Label>
                    <Textarea id="description" {...form.register('description')} placeholder="Default content for the generated tasks"/>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Frequency</Label>
                        <Controller
                            control={form.control}
                            name="frequency"
                            render={({ field }) => (
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <SelectTrigger><SelectValue/></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="daily">Daily</SelectItem>
                                        <SelectItem value="weekly">Weekly</SelectItem>
                                        <SelectItem value="monthly">Monthly</SelectItem>
                                    </SelectContent>
                                </Select>
                            )}
                        />
                    </div>
                    {frequency === 'weekly' && (
                        <div className="space-y-2">
                             <Label>On these days</Label>
                             <Controller
                                name="daysOfWeek"
                                control={form.control}
                                render={({ field }) => (
                                    <ToggleGroup type="multiple" variant="outline" value={field.value} onValueChange={field.onChange} className="flex-wrap justify-start">
                                        {Object.entries(days).map(([fullName, shortName]) => <ToggleGroupItem key={fullName} value={fullName} className="h-9 px-3">{shortName}</ToggleGroupItem>)}
                                    </ToggleGroup>
                                )}
                             />
                        </div>
                    )}
                     {frequency === 'monthly' && (
                        <div className="space-y-2">
                            <Label>Day of Month</Label>
                            <Input type="number" min="1" max="31" {...form.register('dayOfMonth')} placeholder="e.g., 15"/>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-2">
                        <Label>Default Priority</Label>
                         <Controller
                            control={form.control}
                            name="defaultPriority"
                            render={({ field }) => (
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <SelectTrigger><SelectValue/></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Urgent">Urgent</SelectItem>
                                        <SelectItem value="High">High</SelectItem>
                                        <SelectItem value="Medium">Medium</SelectItem>
                                        <SelectItem value="Low">Low</SelectItem>
                                    </SelectContent>
                                </Select>
                            )}
                        />
                    </div>
                     <div className="space-y-2">
                        <Label>Default Brand</Label>
                         <Controller
                            control={form.control}
                            name="defaultBrandId"
                            render={({ field }) => (
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <SelectTrigger><SelectValue placeholder="Select a brand"/></SelectTrigger>
                                    <SelectContent>
                                        {brandsLoading ? <Loader2 className="animate-spin"/> : brands?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            )}
                        />
                         {form.formState.errors.defaultBrandId && <p className="text-sm text-destructive">{form.formState.errors.defaultBrandId.message}</p>}
                    </div>
                </div>

                <div className="space-y-2">
                    <Label>Default Assignees</Label>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-start text-muted-foreground"><Plus className="mr-2 h-4 w-4"/> Add Assignees</Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width]">
                            <ScrollArea className="h-48">
                                {usersLoading ? <Loader2 className="animate-spin"/> : (employeeUsers).map(user => (
                                    <Button key={user.id} variant="ghost" className="w-full justify-start" onClick={() => handleSelectUser(user)}>
                                         <div className="flex items-center gap-2">
                                            <Avatar className="h-6 w-6"><AvatarImage src={user.avatarUrl}/><AvatarFallback>{user.name.charAt(0)}</AvatarFallback></Avatar>
                                            {user.name}
                                        </div>
                                    </Button>
                                ))}
                            </ScrollArea>
                        </PopoverContent>
                    </Popover>
                     {selectedUsers.length > 0 && (
                        <div className="space-y-2 pt-2">
                            <ScrollArea className="max-h-32">
                                <div className="space-y-2 pr-4">
                                {selectedUsers.map((user) => (
                                    <div key={user.id} className="flex items-center justify-between rounded-md bg-secondary/50 p-2">
                                        <div className="flex items-center gap-2">
                                            <Avatar className="h-7 w-7"><AvatarImage src={user.avatarUrl} alt={user.name} /><AvatarFallback>{user.name?.charAt(0)}</AvatarFallback></Avatar>
                                            <span className="text-sm font-medium">{user.name}</span>
                                        </div>
                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRemoveUser(user.id)}><X className="h-4 w-4" /></Button>
                                    </div>
                                ))}
                                </div>
                            </ScrollArea>
                        </div>
                    )}
                     {form.formState.errors.defaultAssigneeIds && <p className="text-sm text-destructive">{form.formState.errors.defaultAssigneeIds.message}</p>}
                </div>
              </form>
            </div>
          </ScrollArea>
          <DialogFooter className="p-6 pt-4 border-t">
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" form="recurring-task-form" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                {selectedTemplate ? 'Save Changes' : 'Create Template'}
              </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will permanently delete the template "{selectedTemplate?.title}". This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTemplate} className="bg-destructive hover:bg-destructive/90" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
              Yes, delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


'use client';

import React, { useState, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  MoreHorizontal,
  Plus,
  Trash2,
  Edit,
  Loader2,
  Repeat,
  Users,
  Building2,
  Star,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCollection, useFirestore, useUserProfile } from '@/firebase';
import type { RecurringTaskTemplate, User, Brand } from '@/lib/types';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Header } from '@/components/layout/header';
import { priorityInfo } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';


const templateSchema = z.object({
  title: z.string().min(2, 'Title is required.'),
  description: z.string().optional(),
  frequency: z.enum(['daily', 'weekly', 'monthly']),
  defaultBrandId: z.string().min(1, 'Brand is required.'),
  defaultPriority: z.enum(['Urgent', 'High', 'Medium', 'Low']),
  defaultAssigneeIds: z
    .array(z.string())
    .min(1, 'At least one assignee is required.'),
});

type TemplateFormValues = z.infer<typeof templateSchema>;

export default function RecurringTasksPage() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { profile } = useUserProfile();

  const [isDialogOpen, setDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] =
    useState<RecurringTaskTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const templatesQuery = useMemo(() => {
    if (!firestore || !profile) return null;
    return query(
      collection(firestore, 'recurringTaskTemplates'),
      where('companyId', '==', profile.companyId)
    );
  }, [firestore, profile]);
  const { data: templates, isLoading: templatesLoading } =
    useCollection<RecurringTaskTemplate>(templatesQuery);

  const usersQuery = useMemo(() => {
    if (!firestore || !profile) return null;
    return query(
      collection(firestore, 'users'),
      where('companyId', '==', profile.companyId),
      where('role', '==', 'Employee')
    );
  }, [firestore, profile]);
  const { data: users, isLoading: usersLoading } = useCollection<User>(usersQuery);

  const brandsQuery = useMemo(() => {
    if (!firestore || !profile) return null;
    return query(
      collection(firestore, 'brands'),
      orderBy('name')
    );
  }, [firestore, profile]);
  const { data: brands, isLoading: brandsLoading } =
    useCollection<Brand>(brandsQuery);

  const form = useForm<TemplateFormValues>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      title: '',
      description: '',
      frequency: 'daily',
      defaultBrandId: '',
      defaultPriority: 'Medium',
      defaultAssigneeIds: [],
    },
  });

  const handleOpenDialog = (template: RecurringTaskTemplate | null = null) => {
    setSelectedTemplate(template);
    if (template) {
      form.reset({
        title: template.title,
        description: template.description || '',
        frequency: template.frequency,
        defaultBrandId: template.defaultBrandId,
        defaultPriority: template.defaultPriority,
        defaultAssigneeIds: template.defaultAssigneeIds,
      });
    } else {
      form.reset({
        title: '',
        description: '',
        frequency: 'daily',
        defaultBrandId: '',
        defaultPriority: 'Medium',
        defaultAssigneeIds: [],
      });
    }
    setDialogOpen(true);
  };
  
  const handleOpenDeleteDialog = (template: RecurringTaskTemplate) => {
    setSelectedTemplate(template);
    setDeleteDialogOpen(true);
  };

  const handleSubmit = async (data: TemplateFormValues) => {
    if (!firestore || !profile) return;
    setIsLoading(true);

    const templateData = {
      ...data,
      companyId: profile.companyId,
    };

    try {
      if (selectedTemplate) {
        const templateRef = doc(
          firestore,
          'recurringTaskTemplates',
          selectedTemplate.id
        );
        await updateDoc(templateRef, templateData);
        toast({
          title: 'Template Updated',
          description: `Template "${data.title}" has been saved.`,
        });
      } else {
        await addDoc(collection(firestore, 'recurringTaskTemplates'), {
          ...templateData,
          createdAt: serverTimestamp(),
        });
        toast({
          title: 'Template Created',
          description: `Template "${data.title}" has been added.`,
        });
      }
      setDialogOpen(false);
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

  const handleDeleteTemplate = async () => {
    if (!selectedTemplate || !firestore) return;
    setIsLoading(true);
    try {
      const templateRef = doc(
        firestore,
        'recurringTaskTemplates',
        selectedTemplate.id
      );
      await deleteDoc(templateRef);
      toast({
        title: 'Template Deleted',
        description: `Template "${selectedTemplate.title}" has been removed.`,
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

  return (
    <div className="flex h-svh flex-col bg-background">
      <Header title="Recurring Task Templates" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold">Manage Recurring Tasks</h2>
            <p className="text-muted-foreground">
              Create and manage templates for tasks that are generated
              automatically.
            </p>
          </div>
          <Button size="sm" onClick={() => handleOpenDialog()}>
            <Plus className="mr-2" /> Create Template
          </Button>
        </div>
        {templatesLoading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : templates && templates.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {(templates || []).map((template) => {
              const assignedUsers =
                users?.filter((u) =>
                  template.defaultAssigneeIds.includes(u.id)
                ) || [];
              const brand = brands?.find(b => b.id === template.defaultBrandId);
              const priority = priorityInfo[template.defaultPriority];
              return (
                <Card key={template.id} className="flex flex-col">
                  <CardHeader>
                    <CardTitle className="flex justify-between items-start">
                      {template.title}
                       <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleOpenDialog(template)}>
                              <Edit className="mr-2 h-4 w-4"/> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleOpenDeleteDialog(template)} className="text-destructive">
                              <Trash2 className="mr-2 h-4 w-4"/> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                    </CardTitle>
                    <CardDescription>{template.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-grow space-y-4">
                     <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Repeat className="h-4 w-4" />
                        <span>
                          Repeats <Badge variant="secondary" className='capitalize'>{template.frequency}</Badge>
                        </span>
                     </div>
                     <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Building2 className="h-4 w-4" />
                        <span>
                          Brand: <Badge variant="outline">{brand?.name || 'N/A'}</Badge>
                        </span>
                     </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <priority.icon className={`h-4 w-4 ${priority.color}`} />
                        <span>
                          Priority: <Badge variant="outline">{template.defaultPriority}</Badge>
                        </span>
                     </div>
                    <div className="flex items-start gap-2 text-sm text-muted-foreground">
                        <Users className="h-4 w-4 mt-0.5" />
                         <TooltipProvider>
                         <span>
                           Assigned to:
                           <div className="flex flex-wrap gap-1 mt-1">
                            {assignedUsers.map(user => (
                                <Tooltip key={user.id}>
                                    <TooltipTrigger>
                                        <Badge variant="secondary">{user.name.split(' ')[0]}</Badge>
                                    </TooltipTrigger>
                                    <TooltipContent><p>{user.name}</p></TooltipContent>
                                </Tooltip>
                            ))}
                          </div>
                        </span>
                        </TooltipProvider>
                     </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="p-12 text-center text-muted-foreground">
              <h3 className="text-lg font-semibold text-foreground">No Templates Found</h3>
              <p className="mt-2">
                Click "Create Template" to get started with automated recurring tasks.
              </p>
            </CardContent>
          </Card>
        )}
      </main>

      <Dialog open={isDialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedTemplate ? 'Edit Template' : 'Create New Template'}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <Label htmlFor="title">Template Title</Label>
                  <FormControl>
                    <Input id="title" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <Label htmlFor="description">Description</Label>
                  <FormControl>
                    <Input id="description" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="frequency"
                render={({ field }) => (
                  <FormItem>
                    <Label>Frequency</Label>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="defaultPriority"
                render={({ field }) => (
                  <FormItem>
                    <Label>Default Priority</Label>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                         {Object.values(priorityInfo).map((p) => (<SelectItem key={p.value} value={p.value}><div className="flex items-center gap-2"><p.icon className={`h-4 w-4 ${p.color}`} />{p.label}</div></SelectItem>))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
             <FormField
                control={form.control}
                name="defaultBrandId"
                render={({ field }) => (
                  <FormItem>
                    <Label>Default Brand</Label>
                     <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a brand" />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            {brandsLoading ? <div className="flex items-center justify-center p-2"><Loader2 className="animate-spin h-4 w-4" /></div> : brands?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            <Controller
              control={form.control}
              name="defaultAssigneeIds"
              render={({ field }) => (
                <FormItem>
                  <Label>Default Assignees</Label>
                  <FormControl>
                   <Select onValueChange={(val) => field.onChange([val])} value={field.value.length > 0 ? field.value[0] : ''}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select an employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {usersLoading ? <div className="flex items-center justify-center p-2"><Loader2 className="animate-spin h-4 w-4" /></div> : users?.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {selectedTemplate ? 'Save Changes' : 'Create Template'}
              </Button>
            </DialogFooter>
          </form>
          </Form>
        </DialogContent>
      </Dialog>
      
       <AlertDialog open={isDeleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the template
              <span className="font-bold"> "{selectedTemplate?.title}"</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTemplate} className="bg-destructive hover:bg-destructive/90" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
              Yes, delete template
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

    
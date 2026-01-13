'use client';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { tags as allTags } from '@/lib/data';
import { priorityInfo } from '@/lib/utils';
import React, { useEffect, useMemo, useState, useRef } from 'react';
import { ScrollArea } from '../ui/scroll-area';
import { Calendar, Clock, Copy, Loader2, Mail, Plus, Repeat, Share, Tag, Trash, Trash2, User, UserPlus, Users, Wand2, X, Hash, Calendar as CalendarIcon, Type, List, Paperclip, FileUp, Link as LinkIcon, FileImage, HelpCircle, Star, Timer, Blocks, GitMerge, ListTodo, MessageSquare, AtSign, Send, Edit, FileText, Building2, Bold, Italic, List as ListIcon, ListOrdered, Table as TableIcon, Upload, Workflow } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Separator } from '../ui/separator';
import { useI18n } from '@/context/i18n-provider';
import { suggestPriority } from '@/ai/flows/suggest-priority';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '../ui/textarea';
import type { Tag as TagType, TimeLog, Task, User as UserType, Subtask, Comment, Attachment, Notification, WorkflowStatus, Brand, SocialMediaPost } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Progress } from '../ui/progress';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Checkbox } from '../ui/checkbox';
import { Switch } from '../ui/switch';
import { useCollection, useFirestore, useUserProfile, useStorage } from '@/firebase';
import { collection, serverTimestamp, writeBatch, doc, query, orderBy, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Calendar as CalendarComponent } from '../ui/calendar';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '../ui/card';
import { MultiSelect } from '../ui/multi-select';
import { addDays, format, formatDistanceToNow, parse, parseISO, startOfWeek, nextSaturday } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getInitials } from '@/lib/utils';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { RichTextEditor } from '../ui/rich-text-editor';
import { formatHours } from '@/lib/utils';


const postSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  brandId: z.string().min(1, 'Brand is required'),
  caption: z.string().optional(),
  statusInternal: z.string(),
  priority: z.enum(['Urgent', 'High', 'Medium', 'Low']),
  assigneeIds: z.array(z.string()).min(1, 'At least one assignee is required'),
  timeEstimate: z.coerce.number().min(0, 'Must be a positive number').optional(),
  startDate: z.string().optional(),
  scheduledAt: z.date().optional(),
});


type PostFormValues = z.infer<typeof postSchema>;

type ShareSetting = 'public' | 'private';

type CustomFieldType = 'Text' | 'Number' | 'Date' | 'Dropdown';
type CustomField = {
  id: number;
  name: string;
  type: CustomFieldType;
  value: string;
  options?: string; // For dropdown options
};


export function AddSocialMediaPostDialog({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [selectedUsers, setSelectedUsers] = React.useState<UserType[]>([]);
  const [isSuggesting, setIsSuggesting] = React.useState(false);
  const [suggestionReason, setSuggestionReason] = React.useState<string | null>(null);
  const { t, language } = useI18n();
  const { toast } = useToast();
  
  const [isUploading, setIsUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [subtasks, setSubtasks] = React.useState<Subtask[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = React.useState('');
  
  const [attachments, setAttachments] = React.useState<Attachment[]>([]);
  
  const firestore = useFirestore();
  const storage = useStorage();

  const { user, profile: currentUserProfile } = useUserProfile();

  const usersQuery = React.useMemo(() => {
    if (!firestore || !currentUserProfile) return null;
    let q = query(collection(firestore, 'users'), where('companyId', '==', currentUserProfile.companyId));
    return q;
  }, [firestore, currentUserProfile]);

  const { data: allUsers, isLoading: areUsersLoading } = useCollection<UserType>(usersQuery);
  
  const userOptions = useMemo(() => {
    if (!allUsers || !currentUserProfile) return [];

    if (currentUserProfile.role === 'Super Admin') {
        return allUsers
            .filter(u => u.role === 'Manager' || u.role === 'Employee')
            .map(user => ({ value: user.id, label: user.name }));
    }

    if (currentUserProfile.role === 'Manager') {
      const team = allUsers.filter(u => u.managerId === currentUserProfile.id);
      const self = allUsers.find(u => u.id === currentUserProfile.id);
      const options = self ? [self, ...team] : team;
      return options.map(user => ({ value: user.id, label: user.name }));
    }
    
    if (currentUserProfile.role === 'Employee') {
        const myTeam = (allUsers || []).filter(u => u.managerId === currentUserProfile.managerId);
        return myTeam.map(user => ({ value: user.id, label: user.name }));
    }

    return [];

  }, [allUsers, currentUserProfile]);

  const brandsQuery = React.useMemo(() => {
    if (!firestore || !currentUserProfile) return null;
    
    if (currentUserProfile.role === 'Manager') {
        if (!currentUserProfile.brandIds || currentUserProfile.brandIds.length === 0) {
            return query(collection(firestore, 'brands'), where('__name__', '==', 'no-brands-for-manager'));
        }
        return query(collection(firestore, 'brands'), where('__name__', 'in', currentUserProfile.brandIds), orderBy('name'));
    }
    
    return query(collection(firestore, 'brands'), orderBy('name'));

  }, [firestore, currentUserProfile]);

  const { data: brands, isLoading: areBrandsLoading } = useCollection<Brand>(brandsQuery);

  const form = useForm<PostFormValues>({
    resolver: zodResolver(postSchema),
    defaultValues: {
      title: '',
      brandId: '',
      caption: '',
      statusInternal: 'To Do',
      priority: 'Medium',
      assigneeIds: [],
      startDate: '',
      scheduledAt: undefined,
      timeEstimate: undefined,
    },
  });
  
  const singleBrandId = useMemo(() => {
    if (brands && brands.length === 1) {
        return brands[0].id;
    }
    return null;
  }, [brands]);

  useEffect(() => {
    if (open) {
        form.reset({
          title: '',
          brandId: singleBrandId || '',
          caption: '',
          statusInternal: 'To Do',
          priority: 'Medium',
          assigneeIds: [],
          startDate: '',
          scheduledAt: undefined,
          timeEstimate: undefined,
        });

        setSelectedUsers([]);
        setSubtasks([]);
        setAttachments([]);
        setSuggestionReason(null);
        
        if (currentUserProfile && user) {
             if (currentUserProfile.role === 'Employee') {
                const selfUser = allUsers?.find(u => u.id === user.uid);
                if (selfUser) {
                    setSelectedUsers([selfUser]);
                    form.setValue('assigneeIds', [selfUser.id]);
                }
            }
        }
        if (singleBrandId) {
            form.setValue('brandId', singleBrandId);
        }
    }
  }, [open, currentUserProfile, user, form, allUsers, singleBrandId]);


  const onSubmit = async (data: PostFormValues) => {
    if (!firestore || !currentUserProfile) return;
    
    const batch = writeBatch(firestore);
    const newPostRef = doc(collection(firestore, 'socialMediaPosts'));
    
    const cleanedData = Object.fromEntries(
      Object.entries(data).filter(([_, v]) => v !== undefined)
    );

    const newPostData = {
        ...cleanedData,
        id: newPostRef.id,
        status: 'Draft', // Default external status
        createdAt: new Date().toISOString(),
        assignees: selectedUsers,
        subtasks,
        attachments,
        companyId: currentUserProfile.companyId,
        createdBy: {
          id: currentUserProfile.id,
          name: currentUserProfile.name,
          avatarUrl: currentUserProfile.avatarUrl || '',
        },
    };
    batch.set(newPostRef, newPostData);

    selectedUsers.forEach(assignee => {
        if (assignee.id === currentUserProfile.id) return; 
        const notificationRef = doc(collection(firestore, `users/${assignee.id}/notifications`));
        const notification: Omit<Notification, 'id'> = {
            userId: assignee.id,
            title: 'New Social Media Post Assigned',
            message: `${currentUserProfile.name} assigned you a new post: "${data.title}"`,
            taskId: newPostRef.id,
            isRead: false,
            createdAt: serverTimestamp(),
            createdBy: {
                id: currentUserProfile.id,
                name: currentUserProfile.name,
                avatarUrl: currentUserProfile.avatarUrl || '',
            }
        };
        batch.set(notificationRef, notification);
    });

    try {
        await batch.commit();
        toast({
            title: 'Social Media Post Created',
            description: `${data.title} has been added.`
        });
        setOpen(false);

    } catch (error) {
        console.error("Failed to create post:", error);
        toast({
            variant: 'destructive',
            title: 'Creation Failed',
            description: 'Could not create the post. Please try again.'
        });
    }
  };

  const handleSuggestPriority = async () => {
    const title = form.getValues('title');
    if (!title) {
      toast({
        variant: 'destructive',
        title: 'Title is required',
        description: 'Please enter a post title before suggesting a priority.',
      });
      return;
    }
    setIsSuggesting(true);
    setSuggestionReason(null);
    try {
      const result = await suggestPriority({
        title,
        description: form.getValues('caption'),
        language: language.name,
      });
      form.setValue('priority', result.priority);
      setSuggestionReason(result.reason);
      toast({
        title: `Priority suggested: ${result.priority}`,
      });
    } catch (e) {
      console.error(e);
      toast({
        variant: 'destructive',
        title: 'Suggestion Failed',
        description: 'Could not get an AI suggestion. Please try again.',
      });
    } finally {
      setIsSuggesting(false);
    }
  };
  
  const handleAddSubtask = () => {
    if (newSubtaskTitle.trim()) {
      const newSubtask: Subtask = {
        id: `sub-${Date.now()}`,
        title: newSubtaskTitle,
        completed: false,
      };
      setSubtasks([...subtasks, newSubtask]);
      setNewSubtaskTitle('');
    }
  };

  const handleToggleSubtask = (subtaskId: string) => {
    setSubtasks(
      subtasks.map(st => st.id === subtaskId ? { ...st, completed: !st.completed } : st)
    );
  };
  
  const handleRemoveSubtask = (subtaskId: string) => {
    setSubtasks(subtasks.filter(st => st.id !== subtaskId));
  }

  const subtaskProgress = useMemo(() => {
    if (subtasks.length === 0) return 0;
    const completedCount = subtasks.filter(st => st.completed).length;
    return (completedCount / subtasks.length) * 100;
  }, [subtasks]);

  return (
    <>
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent className="flex flex-col p-0 h-screen w-screen max-w-full">
        <SheetHeader className="p-6 pb-0">
          <SheetTitle>Create Social Media Post</SheetTitle>
          <SheetDescription>
            Fill in the details for the new social media post.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 min-h-0">
          <ScrollArea className="h-full">
            <div className="p-6">
              <Form {...form}>
                <form
                  id="add-post-form"
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-6"
                >
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="space-y-6 lg:col-span-2">
                       <FormField
                        control={form.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Internal Title</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., Q3 Campaign - Instagram Launch" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                       <FormField
                        control={form.control}
                        name="caption"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Caption</FormLabel>
                            <FormControl>
                              <Textarea placeholder="Write the post caption here..." {...field} rows={5} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="space-y-6 lg:col-span-1">
                      {singleBrandId ? (
                         <div className="space-y-2">
                            <Label>Brand</Label>
                            <div className="flex items-center gap-2 text-sm p-2 rounded-md bg-secondary text-secondary-foreground">
                                <Building2 className="h-4 w-4" />
                                <span>{brands?.find(b => b.id === singleBrandId)?.name}</span>
                            </div>
                        </div>
                      ) : (
                        <FormField
                            control={form.control}
                            name="brandId"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Brand</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                    <SelectTrigger>
                                    <SelectValue placeholder="Select a brand" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {areBrandsLoading ? (
                                    <div className="flex items-center justify-center p-2"><Loader2 className="h-4 w-4 animate-spin" /></div>
                                    ) : (
                                    brands?.map((brand) => (
                                        <SelectItem key={brand.id} value={brand.id}>
                                        <div className="flex items-center gap-2">
                                            <Building2 className="h-4 w-4" />
                                            {brand.name}
                                        </div>
                                        </SelectItem>
                                    ))
                                    )}
                                </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                      )}

                        <FormField
                            control={form.control}
                            name="priority"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Priority</FormLabel>
                                <div className="flex items-center gap-2">
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select priority" />
                                    </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                    {Object.values(priorityInfo).map((p) => (
                                        <SelectItem key={p.value} value={p.value}>
                                        <div className="flex items-center gap-2">
                                            <p.icon className={`h-4 w-4 ${p.color}`} />
                                            {p.label}
                                        </div>
                                        </SelectItem>
                                    ))}
                                    </SelectContent>
                                </Select>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    onClick={handleSuggestPriority}
                                    disabled={isSuggesting}
                                    title="Suggest Priority (AI)"
                                >
                                    {isSuggesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                                </Button>
                                </div>
                                {suggestionReason && <FormDescription className="text-primary">{suggestionReason}</FormDescription>}
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                      
                      <FormField
                        control={form.control}
                        name="assigneeIds"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Assign To</FormLabel>
                            {areUsersLoading ? (
                              <Loader2 className="animate-spin h-5 w-5" />
                            ) : (
                              <MultiSelect
                                options={userOptions}
                                onValueChange={(value) => {
                                  form.setValue('assigneeIds', value);
                                  setSelectedUsers(
                                    allUsers?.filter((u) => value.includes(u.id)) || []
                                  );
                                }}
                                defaultValue={field.value || []}
                                placeholder="Select team members..."
                              />
                            )}
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                       <div className="space-y-4 rounded-lg border p-4">
                          <h3 className="text-sm font-medium flex items-center gap-2"><Calendar className="h-4 w-4" />Dates</h3>
                          <FormField
                              control={form.control}
                              name="scheduledAt"
                              render={({ field }) => (
                                <FormItem className="flex flex-col">
                                  <FormLabel>Schedule Date</FormLabel>
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <FormControl>
                                        <Button
                                          variant={"outline"}
                                          className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                                        >
                                          {field.value ? (
                                            format(field.value, "PPP")
                                          ) : (
                                            <span>Pick a date</span>
                                          )}
                                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                        </Button>
                                      </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                      <CalendarComponent
                                        mode="single"
                                        selected={field.value}
                                        onSelect={field.onChange}
                                        disabled={(date) => date < new Date("1900-01-01")}
                                        initialFocus
                                      />
                                    </PopoverContent>
                                  </Popover>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                      </div>
                    </div>
                  </div>
                </form>
              </Form>
            </div>
          </ScrollArea>
        </div>
        <SheetFooter className="p-6 pt-4 border-t">
          <Button type="submit" form="add-post-form">
            Create Post
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
    </>
  );
}

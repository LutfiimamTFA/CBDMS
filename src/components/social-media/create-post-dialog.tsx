
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
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
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
  caption: z.string().min(1, 'Caption is required'),
  brandId: z.string().min(1, 'Brand is required'),
  description: z.string().optional(),
  postType: z.enum(['Upload', 'Branding']),
  platform: z.string().min(1, 'Platform is required'),
  assigneeIds: z.array(z.string()).min(1, 'At least one assignee is required'),
  timeEstimate: z.coerce.number().min(0, 'Must be a positive number').optional(),
  startDate: z.string().optional(),
  scheduledAt: z.date().optional(),
  tags: z.array(z.string()).optional(),
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


export function CreatePostDialog({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [selectedUsers, setSelectedUsers] = React.useState<UserType[]>([]);
  const [selectedTags, setSelectedTags] = React.useState<TagType[]>([]);
  const [isSuggesting, setIsSuggesting] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const [suggestionReason, setSuggestionReason] = React.useState<string | null>(null);
  const { t, language } = useI18n();
  const { toast } = useToast();

  const [timeLogs, setTimeLogs] = React.useState<TimeLog[]>([]);
  const [timeTracked, setTimeTracked] = React.useState(0);
  const [logNote, setLogNote] = React.useState('');
  const [logDate, setLogDate] = React.useState(format(new Date(), 'yyyy-MM-dd'));
  const [startTime, setStartTime] = React.useState(format(new Date(), 'HH:mm'));
  const [endTime, setEndTime] = React.useState(format(new Date(), 'HH:mm'));
  
  const [customFields, setCustomFields] = React.useState<CustomField[]>([]);
  const [attachments, setAttachments] = React.useState<Attachment[]>([]);
  const [deliverables, setDeliverables] = React.useState<Attachment[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const commentFileInputRef = React.useRef<HTMLInputElement>(null);

  const [isTablePopoverOpen, setIsTablePopoverOpen] = useState(false);
  const [tableRows, setTableRows] = useState(2);
  const [tableCols, setTableCols] = useState(3);


  const [isGdriveDialogOpen, setIsGdriveDialogOpen] = useState(false);
  const [gdriveLink, setGdriveLink] = useState('');
  const [gdriveName, setGdriveName] = useState('');
  const [gdriveFileType, setGdriveFileType] = useState<'attachment' | 'deliverable'>('attachment');


  const [subtasks, setSubtasks] = React.useState<Subtask[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = React.useState('');
  const [newSubtaskAssignee, setNewSubtaskAssignee] = React.useState<UserType | null>(null);
  const [waitingOnTaskIds, setWaitingOnTaskIds] = React.useState<string[]>([]);
  const [blockingTaskIds, setBlockingTaskIds] = React.useState<string[]>([]);
  const [linkedTaskIds, setLinkedTaskIds] = React.useState<string[]>([]);
  const [comments, setComments] = React.useState<Comment[]>([]);
  const [newComment, setNewComment] = React.useState('');
  const [mentionSuggestions, setMentionSuggestions] = React.useState<UserType[]>([]);
  const [isMentioning, setIsMentioning] = React.useState(false);
  
  const firestore = useFirestore();
  const storage = useStorage();

  const { user, profile: currentUserProfile } = useUserProfile();

  const usersQuery = React.useMemo(() => {
    if (!firestore || !currentUserProfile) return null;
    let q = query(collection(firestore, 'users'), where('companyId', '==', currentUserProfile.companyId));
    
    if (currentUserProfile.role === 'Employee' && currentUserProfile.managerId) {
      // This is a simplification. A more robust query might use an 'in' clause 
      // if we fetch manager's direct reports IDs first. For now, fetching all and filtering client-side is acceptable.
    }
    
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

  
  const socialMediaPostsCollectionRef = React.useMemo(() => {
    if (!firestore) return null;
    return collection(firestore, 'socialMediaPosts');
  }, [firestore]);

  const { data: allSocialMediaPosts } = useCollection<SocialMediaPost>(socialMediaPostsCollectionRef);
  
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
      caption: '',
      brandId: '',
      description: '',
      platform: 'Instagram',
      postType: 'Upload',
      assigneeIds: [],
      startDate: '',
      scheduledAt: undefined,
      timeEstimate: undefined,
      tags: [],
    },
  });
  
  useEffect(() => {
    if (open) {
        form.reset({
          caption: '',
          brandId: '',
          description: '',
          platform: 'Instagram',
          postType: 'Upload',
          assigneeIds: [],
          startDate: '',
          scheduledAt: undefined,
          timeEstimate: undefined,
          tags: [],
        });

        if (currentUserProfile && user) {
             if (currentUserProfile.role === 'Employee') {
                const selfUser = allUsers?.find(u => u.id === user.uid);
                if (selfUser) {
                    setSelectedUsers([selfUser]);
                    form.setValue('assigneeIds', [selfUser.id]);
                }
            }
        }
    }
  }, [open, currentUserProfile, user, form, allUsers]);


  const onSubmit = async (data: PostFormValues) => {
    if (!socialMediaPostsCollectionRef || !currentUserProfile || !firestore) return;
    
    const batch = writeBatch(firestore);

    const newPostRef = doc(collection(firestore, 'socialMediaPosts'));
    
    const newPostData = {
        ...data,
        status: 'Draft',
        createdAt: new Date().toISOString(),
        assignees: selectedUsers,
        tags: selectedTags,
        companyId: currentUserProfile.companyId,
        createdBy: currentUserProfile.id,
    };
    batch.set(newPostRef, newPostData);

    selectedUsers.forEach(assignee => {
        if (assignee.id === currentUserProfile.id) return; 
        const notificationRef = doc(collection(firestore, `users/${assignee.id}/notifications`));
        const notification: Omit<Notification, 'id'> = {
            userId: assignee.id,
            title: 'New Social Media Post Assigned',
            message: `${currentUserProfile.name} assigned you a new post: "${data.caption}"`,
            taskId: newPostRef.id, // Using taskId to link back
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
            description: `${data.caption} has been added as a draft.`
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

  const timeEstimateValue = form.watch('timeEstimate') ?? 0;
  
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
                  id="create-post-form"
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-6"
                >
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column */}
                    <div className="space-y-6 lg:col-span-2">
                       <FormField
                        control={form.control}
                        name="caption"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Caption</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., Announcing our new summer collection!" {...field} />
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
                            <FormLabel>Internal Notes/Description</FormLabel>
                            <FormControl>
                              <RichTextEditor
                                value={field.value || ''}
                                onChange={field.onChange}
                                placeholder="Add internal notes, links, or further details..."
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Right Column */}
                    <div className="space-y-6 lg:col-span-1">
                      <FormField
                          control={form.control}
                          name="postType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Post Type</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select a post type" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="Upload">Upload</SelectItem>
                                  <SelectItem value="Branding">Branding</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
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
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <FormField control={form.control} name="startDate" render={({ field }) => (<FormItem><FormLabel>Start Date</FormLabel><FormControl><Input type="date" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)}/>
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
                                              className={cn(
                                                "w-full pl-3 text-left font-normal",
                                                !field.value && "text-muted-foreground"
                                              )}
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

                       <div className='space-y-4 p-4 rounded-lg border'>
                          <div className="flex justify-between items-center"><h3 className='font-semibold text-sm'>Time Management</h3><div></div></div>
                          <Separator/>
                            <FormField
                                control={form.control}
                                name="timeEstimate"
                                render={({ field }) => (
                                    <FormItem className="grid grid-cols-3 items-center gap-2">
                                        <FormLabel className="text-muted-foreground text-sm">Est. Pengerjaan (hari)</FormLabel>
                                        <div className="col-span-2 flex items-center gap-2">
                                            <Input
                                                type="number"
                                                step="0.1"
                                                value={field.value !== undefined ? field.value / 8 : ''} 
                                                onChange={(e) => {
                                                    const days = e.target.value === '' ? undefined : parseFloat(e.target.value);
                                                    const hours = days !== undefined ? days * 8 : undefined;
                                                    field.onChange(hours);
                                                }}
                                                placeholder="e.g., 1.5"
                                            />
                                            <span className="text-sm text-muted-foreground whitespace-nowrap">({field.value || 0} jam)</span>
                                        </div>
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
          <Button type="submit" form="create-post-form">
            Create Post
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
    </>
  );
}

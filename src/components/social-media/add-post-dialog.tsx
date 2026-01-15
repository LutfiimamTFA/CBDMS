
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
import { priorityInfo } from '@/lib/utils';
import React, { useEffect, useMemo, useState, useRef } from 'react';
import { ScrollArea } from '../ui/scroll-area';
import { Calendar, Clock, Copy, Loader2, Mail, Plus, Repeat, Share, Tag, Trash, Trash2, User, UserPlus, Users, Wand2, X, Hash, Calendar as CalendarIcon, Type, List, Paperclip, FileUp, Link as LinkIcon, FileImage, HelpCircle, Star, Timer, Blocks, GitMerge, ListTodo, MessageSquare, AtSign, Send, Edit, FileText, Building2, Bold, Italic, List as ListIcon, ListOrdered, Table as TableIcon, Upload, Workflow, XCircle } from 'lucide-react';
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
import { getInitials } from '@/lib/utils';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { RichTextEditor } from '../ui/rich-text-editor';
import { formatHours } from '@/lib/utils';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import remarkGfm from 'remark-gfm';


const postSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  brandId: z.string().min(1, 'Brand is required'),
  caption: z.string().optional(),
  priority: z.enum(['Urgent', 'High', 'Medium', 'Low']),
  assigneeIds: z.array(z.string()).min(1, 'At least one assignee is required'),
  scheduledAt: z.date().optional(),
  postType: z.enum(['Upload', 'Branding']).default('Upload'),
  timeEstimate: z.coerce.number().min(0, 'Must be a positive number').optional(),
});

type PostFormValues = z.infer<typeof postSchema>;

type ShareSetting = 'public' | 'private';

export function AddSocialMediaPostDialog({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [isSuggesting, setIsSuggesting] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const [suggestionReason, setSuggestionReason] = React.useState<string | null>(null);
  const { t, language } = useI18n();
  const { toast } = useToast();
  
  const [selectedUsers, setSelectedUsers] = React.useState<UserType[]>([]);
  
  const [attachments, setAttachments] = React.useState<Attachment[]>([]);
  const [deliverables, setDeliverables] = React.useState<Attachment[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const commentFileInputRef = React.useRef<HTMLInputElement>(null);

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
  
  const tasksCollectionRef = React.useMemo(() => {
    if (!firestore) return null;
    return collection(firestore, 'tasks');
  }, [firestore]);

  const { data: allTasks } = useCollection<Task>(tasksCollectionRef);

  const usersQuery = React.useMemo(() => {
    if (!firestore || !currentUserProfile) return null;
    return query(collection(firestore, 'users'), where('companyId', '==', currentUserProfile.companyId));
  }, [firestore, currentUserProfile]);

  const { data: allUsers, isLoading: areUsersLoading } = useCollection<UserType>(usersQuery);

  const brandsQuery = useMemo(() => {
    if (!firestore || !currentUserProfile) return null;

    if (currentUserProfile.role === 'Super Admin') {
      return query(collection(firestore, 'brands'), where('companyId', '==', currentUserProfile.companyId), orderBy('name'));
    }
    
    if (currentUserProfile.role === 'Manager') {
        if (!currentUserProfile.brandIds || currentUserProfile.brandIds.length === 0) {
            return query(collection(firestore, 'brands'), where('__name__', '==', 'no-brands-for-manager'));
        }
        return query(collection(firestore, 'brands'), where('__name__', 'in', currentUserProfile.brandIds), orderBy('name'));
    }
    
    return null;

  }, [firestore, currentUserProfile]);
  
  const { data: brands, isLoading: areBrandsLoading } = useCollection<Brand>(brandsQuery);

  const { data: statuses, isLoading: areStatusesLoading } = useCollection<WorkflowStatus>(
    useMemo(() => firestore ? query(collection(firestore, 'socialMediaStatuses'), orderBy('order')) : null, [firestore])
  );

  const userOptions = useMemo(() => {
    if (!allUsers || !currentUserProfile) return [];
    if (currentUserProfile.role === 'Super Admin') {
        return allUsers.filter(u => u.role === 'Manager' || u.role === 'Employee').map(user => ({ value: user.id, label: user.name }));
    }
    if (currentUserProfile.role === 'Manager') {
      const team = allUsers.filter(u => u.managerId === currentUserProfile.id);
      const self = allUsers.find(u => u.id === currentUserProfile.id);
      return (self ? [self, ...team] : team).map(user => ({ value: user.id, label: user.name }));
    }
    if (currentUserProfile.role === 'Employee') {
        const myTeam = (allUsers || []).filter(u => u.managerId === currentUserProfile.managerId);
        return myTeam.map(user => ({ value: user.id, label: user.name }));
    }
    return [];
  }, [allUsers, currentUserProfile]);
  
  const form = useForm<PostFormValues>({
    resolver: zodResolver(postSchema),
    defaultValues: {
      title: '',
      brandId: '',
      caption: '',
      priority: 'Medium',
      assigneeIds: [],
      scheduledAt: undefined,
      postType: 'Upload',
      timeEstimate: undefined,
    },
  });
  
  const singleBrandId = useMemo(() => (brands && brands.length === 1) ? brands[0].id : null, [brands]);

  useEffect(() => {
    if (open) {
        form.reset({
          title: '',
          brandId: singleBrandId || '',
          caption: '',
          priority: 'Medium',
          assigneeIds: [],
          scheduledAt: undefined,
          postType: 'Upload',
          timeEstimate: undefined,
        });
        
        setSelectedUsers([]);
        setAttachments([]);
        setDeliverables([]);
        setSubtasks([]);
        setWaitingOnTaskIds([]);
        setBlockingTaskIds([]);
        setLinkedTaskIds([]);
        setComments([]);
        setSuggestionReason(null);
        
        if (currentUserProfile && user?.uid && currentUserProfile.role === 'Employee') {
            form.setValue('assigneeIds', [user.uid]);
        }
        if (singleBrandId) {
            form.setValue('brandId', singleBrandId);
        }
    }
  }, [open, currentUserProfile, user, form, singleBrandId]);

  const handleSuggestPriority = async () => {
    const title = form.getValues('title');
    if (!title) {
      toast({ variant: 'destructive', title: 'Title is required' });
      return;
    }
    setIsSuggesting(true);
    setSuggestionReason(null);
    try {
      const result = await suggestPriority({ title, description: form.getValues('caption'), language: language.name });
      form.setValue('priority', result.priority);
      setSuggestionReason(result.reason);
      toast({ title: `Priority suggested: ${result.priority}` });
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Suggestion Failed' });
    } finally {
      setIsSuggesting(false);
    }
  };

  const onSubmit = async (data: PostFormValues) => {
    if (!firestore || !currentUserProfile) return;
    
    const batch = writeBatch(firestore);
    const newPostRef = doc(collection(firestore, 'socialMediaPosts'));
    
    const newPostData: Partial<SocialMediaPost> = {
        ...data,
        id: newPostRef.id,
        status: statuses?.[0]?.name || 'To Do',
        statusInternal: statuses?.[0]?.name || 'To Do',
        createdAt: new Date().toISOString(),
        platform: 'Instagram', // Hardcoded for now
        companyId: currentUserProfile.companyId,
        createdBy: {
          id: currentUserProfile.id,
          name: currentUserProfile.name,
          avatarUrl: currentUserProfile.avatarUrl || '',
        },
        scheduledAt: data.scheduledAt?.toISOString(),
        subtasks,
        attachments,
        deliverables,
        waitingOnTaskIds,
        blockingTaskIds,
        linkedTaskIds,
        comments,
    };
    batch.set(newPostRef, newPostData);

    data.assigneeIds.forEach(assigneeId => {
        if (assigneeId === currentUserProfile.id) return; 
        const notificationRef = doc(collection(firestore, `users/${assigneeId}/notifications`));
        const notification: Omit<Notification, 'id'> = {
            userId: assigneeId,
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
  
    const getFileIcon = (fileName: string): React.ReactElement => {
    if (fileName.match(/\.(pdf)$/i)) {
      return <FileText className="h-5 w-5 text-red-500" />;
    }
    if (fileName.match(/\.(doc|docx)$/i)) {
      return <FileText className="h-5 w-5 text-blue-500" />;
    }
    if (fileName.match(/\.(jpg|jpeg|png|gif)$/i)) {
      return <FileImage className="h-5 w-5 text-green-500" />;
    }
    return <FileText className="h-5 w-5 text-muted-foreground" />;
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>, fileType: 'attachment' | 'deliverable') => {
    if (!event.target.files || !storage) return;
    
    setIsUploading(true);
    const files = Array.from(event.target.files);
    
    try {
        const uploadPromises = files.map(async (file) => {
            const storageRef = ref(storage, `attachments/${Date.now()}-${file.name}`);
            await uploadBytes(storageRef, file);
            const url = await getDownloadURL(storageRef);
            return {
                id: `local-${Date.now()}-${file.name}`,
                name: file.name,
                type: 'local' as const,
                url: url,
            };
        });
        
        const newFiles = await Promise.all(uploadPromises);
        if (fileType === 'attachment') {
            setAttachments(prev => [...prev, ...newFiles]);
        } else {
            setDeliverables(prev => [...prev, ...newFiles]);
        }
        
        toast({ title: 'Upload Successful', description: `${files.length} file(s) have been attached.` });

    } catch (error) {
        console.error("File upload failed:", error);
        toast({ variant: 'destructive', title: 'Upload Failed', description: 'Could not upload files. Please try again.' });
    } finally {
        setIsUploading(false);
        if(fileInputRef.current) fileInputRef.current.value = '';
    }
  };
  
  const handleConfirmGdriveLink = () => {
    if (gdriveLink && gdriveName) {
      const newFile: Attachment = {
        id: `gdrive-${Date.now()}`,
        name: gdriveName,
        type: 'gdrive',
        url: gdriveLink,
      };
       if (gdriveFileType === 'attachment') {
        setAttachments(prev => [...prev, newFile]);
      } else {
        setDeliverables(prev => [...prev, newFile]);
      }
      setIsGdriveDialogOpen(false);
      setGdriveLink('');
      setGdriveName('');
    } else {
        toast({ variant: 'destructive', title: 'Missing Info', description: 'Please provide both a link and a name.' });
    }
  };
  
    const handleRemoveFile = (id: string, fileType: 'attachment' | 'deliverable') => {
      if (fileType === 'attachment') setAttachments(prev => prev.filter(att => att.id !== id));
      else setDeliverables(prev => prev.filter(del => del.id !== id));
  };
  
  const subtaskProgress = useMemo(() => {
    if (subtasks.length === 0) return 0;
    const completedCount = subtasks.filter(st => st.completed).length;
    return (completedCount / subtasks.length) * 100;
  }, [subtasks]);
  
  const quickDateOptions = [
      { label: t('addtask.form.quickselect.today'), getValue: () => new Date() },
      { label: t('addtask.form.quickselect.tomorrow'), getValue: () => addDays(new Date(), 1) },
      { label: t('addtask.form.quickselect.thisweekend'), getValue: () => nextSaturday(new Date()) },
      { label: t('addtask.form.quickselect.nextweek'), getValue: () => addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), 7) },
  ];
  
  const handlePostComment = () => {};
  const handleMentionSelect = (user: UserType) => {};
  const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {};
  const handleAddSubtask = () => {};
  const handleToggleSubtask = (id: string) => {};
  const handleAssignSubtask = (id: string, user: UserType | null) => {};
  const handleRemoveSubtask = (id: string) => {};
  const handleAddDependency = (id: string, type: string) => {};
  const handleRemoveDependency = (id: string, type: string) => {};
  const renderDependencyList = (ids: string[], type: string) => <></>;

  return (
    <>
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent className="flex flex-col p-0 h-screen w-screen max-w-full">
        <SheetHeader className="p-6 pb-0">
          <SheetTitle>Create Social Media Post</SheetTitle>
          <SheetDescription>Fill in the details for the new social media post.</SheetDescription>
        </SheetHeader>
        <div className="flex-1 min-h-0">
          <ScrollArea className="h-full">
            <div className="p-6">
              <Form {...form}>
                <form id="add-post-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="space-y-6 lg:col-span-2">
                       <FormField control={form.control} name="title" render={({ field }) => ( <FormItem><FormLabel>Internal Title</FormLabel><FormControl><Input placeholder="e.g., Q3 Campaign - Instagram Launch" {...field} /></FormControl><FormMessage /></FormItem> )}/>
                       <FormField control={form.control} name="caption" render={({ field }) => ( <FormItem><FormLabel>Caption</FormLabel><FormControl><RichTextEditor value={field.value || ''} onChange={field.onChange} placeholder="Write the post caption here..." /></FormControl><FormMessage /></FormItem> )}/>
                       <FormField control={form.control} name="postType" render={({ field }) => ( <FormItem><FormLabel>Post Type</FormLabel><FormControl><RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex gap-4"><FormItem className="flex items-center space-x-2"><RadioGroupItem value="Upload" id="r-upload" /><FormLabel htmlFor="r-upload">Upload</FormLabel></FormItem><FormItem className="flex items-center space-x-2"><RadioGroupItem value="Branding" id="r-branding" /><FormLabel htmlFor="r-branding">Branding</FormLabel></FormItem></RadioGroup></FormControl><FormMessage /></FormItem> )}/>
                    </div>
                    <div className="space-y-6 lg:col-span-1">
                      {currentUserProfile?.role !== 'Employee' && (
                        !singleBrandId ? (
                          <FormField control={form.control} name="brandId" render={({ field }) => ( <FormItem><FormLabel>Brand</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a brand" /></SelectTrigger></FormControl><SelectContent>{areBrandsLoading ? <div className="p-2"><Loader2 className="h-4 w-4 animate-spin"/></div> : brands?.map((brand) => ( <SelectItem key={brand.id} value={brand.id}><div className="flex items-center gap-2"><Building2 className="h-4 w-4"/>{brand.name}</div></SelectItem> ))}</SelectContent></Select><FormMessage /></FormItem> )}/>
                        ) : ( <div className="space-y-2"><FormLabel>Brand</FormLabel><div className="p-2 bg-secondary rounded-md">{brands?.[0].name}</div></div> )
                      )}
                      <FormField control={form.control} name="priority" render={({ field }) => ( <FormItem><FormLabel>Priority</FormLabel><div className="flex gap-2"><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent>{Object.values(priorityInfo).map(p => (<SelectItem key={p.value} value={p.value}><div className="flex gap-2"><p.icon className={`h-4 w-4 ${p.color}`}/>{p.label}</div></SelectItem>))}</SelectContent></Select><Button type="button" variant="outline" size="icon" onClick={handleSuggestPriority} disabled={isSuggesting}><Wand2 className="h-4 w-4"/></Button></div>{suggestionReason && <FormDescription>{suggestionReason}</FormDescription>}<FormMessage/></FormItem> )}/>
                      <FormField control={form.control} name="assigneeIds" render={({ field }) => ( <FormItem><FormLabel>Assign To</FormLabel>{areUsersLoading ? <Loader2 className="h-5 w-5 animate-spin"/> : <MultiSelect options={userOptions} onValueChange={(v) => form.setValue('assigneeIds', v)} defaultValue={field.value || []} placeholder="Select members..."/>}<FormMessage /></FormItem> )}/>
                      <FormField control={form.control} name="scheduledAt" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>Schedule Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4"/>{field.value ? format(field.value, 'PPP') : <span>Pick a date</span>}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><CalendarComponent mode="single" selected={field.value} onSelect={field.onChange} initialFocus/></PopoverContent></Popover><FormMessage /></FormItem> )}/>
                      <div className="space-y-2"><Label className="text-xs text-muted-foreground">{t('addtask.form.quickselect')}</Label><div className="flex flex-wrap gap-2">{quickDateOptions.map(option => (<Button key={option.label} type="button" variant="outline" size="sm" onClick={() => form.setValue('scheduledAt', option.getValue())}>{option.label}</Button>))} <Button type="button" variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => form.setValue('scheduledAt', undefined)}>{t('addtask.form.quickselect.clear')}</Button></div></div>
                    </div>
                  </div>
                    <Tabs defaultValue="subtasks" className="w-full">
                    <TabsList className="grid w-full grid-cols-5">
                      <TabsTrigger value="subtasks"><ListTodo className="mr-2"/>Subtasks</TabsTrigger>
                      <TabsTrigger value="materials"><Paperclip className="mr-2"/>Materials</TabsTrigger>
                      <TabsTrigger value="deliverables"><Upload className="mr-2"/>Deliverables</TabsTrigger>
                      <TabsTrigger value="dependencies"><GitMerge className="mr-2"/>Dependencies</TabsTrigger>
                      <TabsTrigger value="comments"><MessageSquare className="mr-2"/>Comments</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="subtasks" className="mt-4 space-y-4 rounded-lg border p-4">
                        <div className="space-y-2"><div className="flex justify-between text-xs text-muted-foreground"><span>Progress</span><span>{subtasks.filter(st => st.completed).length}/{subtasks.length}</span></div><Progress value={subtaskProgress} /></div>
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                            {subtasks.map((subtask) => ( <div key={subtask.id} className="flex items-center gap-3 p-2 bg-secondary/50 rounded-md hover:bg-secondary transition-colors"><Checkbox id={`subtask-${subtask.id}`} checked={subtask.completed} onCheckedChange={() => handleToggleSubtask(subtask.id)} /><label htmlFor={`subtask-${subtask.id}`} className={`flex-1 text-sm ${subtask.completed ? 'line-through text-muted-foreground' : ''}`}>{subtask.title}</label><Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => handleRemoveSubtask(subtask.id)}><Trash className="h-4 w-4"/></Button></div> ))}
                        </div>
                        <div className="flex items-center gap-2"><Input placeholder="Add a new subtask..." value={newSubtaskTitle} onChange={(e) => setNewSubtaskTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddSubtask())} /><Button type="button" onClick={handleAddSubtask}><Plus className="h-4 w-4 mr-2" /> Add</Button></div>
                    </TabsContent>
                    <TabsContent value="materials" className="mt-4 space-y-4 rounded-lg border p-4">
                      <div className="space-y-2">
                          {attachments.map((att) => ( <div key={att.id} className="flex items-center justify-between rounded-md bg-secondary/50 p-2 text-sm"><a href={att.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 truncate hover:underline">{getFileIcon(att.name)}<span className="truncate" title={att.name}>{att.name}</span></a><Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => handleRemoveFile(att.id, 'attachment')}><X className="h-4 w-4" /></Button></div> ))}
                          {attachments.length === 0 && <p className="text-center text-muted-foreground text-sm py-4">No supporting materials attached.</p>}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t">
                          <input type="file" ref={fileInputRef} onChange={(e) => handleFileChange(e, 'attachment')} multiple className="hidden" />
                          <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>{isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Upload from Local</Button>
                          <Button type="button" variant="outline" onClick={() => { setGdriveFileType('attachment'); setIsGdriveDialogOpen(true); }}><div className="flex items-center justify-center gap-2"><svg className="mr-2" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10.5187 5.56875L5.43125 0.48125L0 9.25625L5.0875 14.3438L10.5187 5.56875Z" fill="#34A853"/><path d="M16 9.25625L10.5188 0.48125H5.43125L8.25625 4.8875L13.25 13.9062L16 9.25625Z" fill="#FFC107"/><path d="M2.83125 14.7875L8.25625 5.56875L5.51875 0.81875L0.0375 9.59375L2.83125 14.7875Z" fill="#1A73E8"/><path d="M13.25 13.9062L10.825 9.75L8.25625 4.8875L5.43125 10.1L8.03125 14.7875H13.1562L13.25 13.9062Z" fill="#EA4335"/></svg>Link from Google Drive</div></Button>
                      </div>
                    </TabsContent>
                    <TabsContent value="deliverables" className="mt-4 space-y-4 rounded-lg border p-4">
                      <div className="space-y-2">
                          <h4 className="font-medium text-sm">Initial Submission</h4>
                          {deliverables.length > 0 ? deliverables.map((att) => ( <div key={att.id} className="flex items-center justify-between rounded-md bg-secondary/50 p-2 text-sm"><a href={att.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 truncate hover:underline">{getFileIcon(att.name)}<span className="truncate" title={att.name}>{att.name}</span></a><Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => handleRemoveFile(att.id, 'deliverable')}><X className="h-4 w-4" /></Button></div> )) : ( <p className="text-center text-muted-foreground text-sm py-4">No deliverables submitted yet.</p> )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t">
                          <input type="file" ref={commentFileInputRef} onChange={(e) => handleFileChange(e, 'deliverable')} multiple className="hidden" />
                          <Button type="button" variant="outline" onClick={() => commentFileInputRef.current?.click()} disabled={isUploading}>{isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Upload from Local</Button>
                          <Button type="button" variant="outline" onClick={() => { setGdriveFileType('deliverable'); setIsGdriveDialogOpen(true); }}><div className="flex items-center justify-center gap-2"><svg className="mr-2" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10.5187 5.56875L5.43125 0.48125L0 9.25625L5.0875 14.3438L10.5187 5.56875Z" fill="#34A853"/><path d="M16 9.25625L10.5188 0.48125H5.43125L8.25625 4.8875L13.25 13.9062L16 9.25625Z" fill="#FFC107"/><path d="M2.83125 14.7875L8.25625 5.56875L5.51875 0.81875L0.0375 9.59375L2.83125 14.7875Z" fill="#1A73E8"/><path d="M13.25 13.9062L10.825 9.75L8.25625 4.8875L5.43125 10.1L8.03125 14.7875H13.1562L13.25 13.9062Z" fill="#EA4335"/></svg>Link from Google Drive</div></Button>
                      </div>
                    </TabsContent>
                    <TabsContent value="dependencies" className="mt-4 space-y-6 rounded-lg border p-4">
                        <p className="text-sm text-center text-muted-foreground">Dependencies are not available for Social Media posts.</p>
                    </TabsContent>
                    <TabsContent value="comments" className="mt-4 space-y-4 rounded-lg border p-4 relative">
                        <div className="space-y-4 max-h-48 overflow-y-auto pr-2">
                          {comments.map((comment) => ( <div key={comment.id} className="flex items-start gap-3"><Avatar className="h-8 w-8"><AvatarImage src={comment.user.avatarUrl}/><AvatarFallback>{getInitials(comment.user.name)}</AvatarFallback></Avatar><div><p className="text-sm font-medium">{comment.user.name} <span className="text-xs text-muted-foreground font-normal">{formatDistanceToNow(parseISO(comment.timestamp), { addSuffix: true })}</span></p><p className="text-sm">{comment.text}</p></div></div> ))}
                          {comments.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">No comments yet. Start the conversation!</p>}
                        </div>
                        <div className="flex items-start gap-2 pt-4 border-t">
                            <Avatar className="h-9 w-9"><AvatarImage src={currentUserProfile?.avatarUrl} /><AvatarFallback>{getInitials(currentUserProfile?.name)}</AvatarFallback></Avatar>
                            <div className="flex-1 relative">
                              <Textarea placeholder="Write a comment... (use '@' to mention)" value={newComment} onChange={handleCommentChange} />
                              {isMentioning && ( <Card className="absolute bottom-full mb-2 w-full max-h-48 overflow-y-auto"><CardContent className="p-1">{mentionSuggestions.map(user => ( <Button key={user.id} variant="ghost" className="w-full justify-start gap-2" onClick={() => handleMentionSelect(user)}><Avatar className="h-6 w-6"><AvatarImage src={user.avatarUrl}/><AvatarFallback>{getInitials(user.name)}</AvatarFallback></Avatar>{user.name}</Button> ))}</CardContent></Card> )}
                            </div>
                            <Button type="button" onClick={handlePostComment} disabled={!newComment.trim()}><Send className="h-4 w-4"/></Button>
                        </div>
                    </TabsContent>
                  </Tabs>
                </form>
              </Form>
            </div>
          </ScrollArea>
        </div>
        <SheetFooter className="p-6 pt-4 border-t">
          <Button type="submit" form="add-post-form">Create Post</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
    <Dialog open={isGdriveDialogOpen} onOpenChange={setIsGdriveDialogOpen}>
      <DialogContent>
          <DialogHeader>
              <DialogTitle>Link Google Drive File</DialogTitle>
              <DialogDescription>Paste the shareable link to your Google Drive file below.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
              <div className="space-y-2">
                  <Label htmlFor="gdrive-name">File Name</Label>
                  <Input id="gdrive-name" value={gdriveName} onChange={(e) => setGdriveName(e.target.value)} placeholder="e.g., Q3 Marketing Report" />
              </div>
              <div className="space-y-2">
                  <Label htmlFor="gdrive-link">File Link</Label>
                  <Input id="gdrive-link" value={gdriveLink} onChange={(e) => setGdriveLink(e.target.value)} placeholder="https://docs.google.com/..." />
              </div>
          </div>
          <DialogFooter>
              <Button variant="ghost" onClick={() => setIsGdriveDialogOpen(false)}>Cancel</Button>
              <Button onClick={() => handleConfirmGdriveLink()}>Add Link</Button>
          </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

    
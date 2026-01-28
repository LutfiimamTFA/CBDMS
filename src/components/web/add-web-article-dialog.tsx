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
  FormDescription,
} from '@/components/ui/form';
import { priorityInfo, getFileIcon } from '@/lib/utils';
import React, { useEffect, useMemo, useState, useRef } from 'react';
import { ScrollArea } from '../ui/scroll-area';
import { CalendarIcon, Loader2, Plus, Wand2, Building2, Paperclip, Upload, GitMerge, MessageSquare, ListTodo, Link as LinkIcon, Trash, UserPlus, Workflow, Blocks, X, Send, Timer } from 'lucide-react';
import { Separator } from '../ui/separator';
import { useI18n } from '@/context/i18n-provider';
import { suggestPriority } from '@/ai/flows/suggest-priority';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { useCollection, useFirestore, useUserProfile, useStorage } from '@/firebase';
import { collection, serverTimestamp, writeBatch, doc, query, where } from 'firebase/firestore';
import { Calendar as CalendarComponent } from '../ui/calendar';
import { cn } from '@/lib/utils';
import { MultiSelect } from '../ui/multi-select';
import { RichTextEditor } from '../ui/rich-text-editor';
import { useSafeBrands } from '@/hooks/use-safe-brands';
import type { WebArticle, User as UserType, Brand, Notification, Subtask, Attachment, Dependencies, Comment } from '@/lib/types';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { Checkbox } from '../ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { formatHours, getInitials } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const articleSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  brandId: z.string().min(1, 'Brand is required'),
  content: z.string().optional(),
  priority: z.enum(['Urgent', 'High', 'Medium', 'Low']),
  assigneeIds: z.array(z.string()).min(1, 'At least one assignee is required'),
  startDate: z.date().optional(),
  dueDate: z.date().optional(),
  timeEstimate: z.coerce.number().min(0).optional(),
}).refine((data) => {
    if (data.startDate && data.dueDate) return data.dueDate >= data.startDate;
    return true;
}, { message: "Due date must be after start date.", path: ["dueDate"]});


type ArticleFormValues = z.infer<typeof articleSchema>;


export function AddWebArticleDialog({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [isSuggesting, setIsSuggesting] = React.useState(false);
  const [suggestionReason, setSuggestionReason] = React.useState<string | null>(null);
  const { t, language } = useI18n();
  const { toast } = useToast();
  
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newSubtaskAssignee, setNewSubtaskAssignee] = useState<UserType | null>(null);

  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const [dependencies, setDependencies] = useState<Dependencies>({ waitingOn: [], blocking: [], linked: []});

  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  
  const [isGdriveDialogOpen, setIsGdriveDialogOpen] = useState(false);
  const [gdriveLink, setGdriveLink] = useState('');
  const [gdriveName, setGdriveName] = useState('');
  const [isMentioning, setIsMentioning] = useState(false);
  const [mentionSuggestions, setMentionSuggestions] = React.useState<UserType[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  
  const firestore = useFirestore();
  const storage = useStorage();

  const { user, profile: currentUserProfile, companyId } = useUserProfile();
  const { brands, brandMap, isLoading: areBrandsLoading } = useSafeBrands();
  
  const usersQuery = React.useMemo(() => {
    if (!firestore || !currentUserProfile) return null;
    return query(collection(firestore, 'users'), where('companyId', '==', currentUserProfile.companyId));
  }, [firestore, currentUserProfile]);
  const { data: allUsers, isLoading: areUsersLoading } = useCollection<UserType>(usersQuery);

  const articlesQuery = React.useMemo(() => {
    if (!firestore || !companyId) return null;
    return query(collection(firestore, 'webArticles'), where('companyId', '==', companyId));
  }, [firestore, companyId]);
  const { data: allArticles, isLoading: areArticlesLoading } = useCollection<WebArticle>(articlesQuery);

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
  
  const dependencyOptions = useMemo(() => (allArticles || []), [allArticles]);
  const groupedDependencyOptions = useMemo(() => {
      const grouped: Record<string, WebArticle[]> = {};
      dependencyOptions.forEach(article => {
          const brandName = brandMap.get(article.brandId) || 'Unbranded';
          if (!grouped[brandName]) grouped[brandName] = [];
          grouped[brandName].push(article);
      });
      return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
  }, [dependencyOptions, brandMap]);

  const form = useForm<ArticleFormValues>({
    resolver: zodResolver(articleSchema),
    defaultValues: {
      title: '',
      brandId: '',
      content: '',
      priority: 'Medium',
      assigneeIds: [],
      startDate: undefined,
      dueDate: undefined,
      timeEstimate: undefined,
    },
  });

  const assigneeIds = form.watch('assigneeIds');
  
  const subtaskAssigneeOptions = useMemo(() => {
    if (!allUsers || !currentUserProfile) return {};
    const mainAssignees = allUsers.filter(u => (assigneeIds || []).includes(u.id));
    const createGroup = (title: string, users: UserType[]) => users.length > 0 ? { [title]: users } : {};

    if (currentUserProfile.role === 'Super Admin') {
        const managers = allUsers.filter(u => u.role === 'Manager' && !mainAssignees.some(a => a.id === u.id));
        const employees = allUsers.filter(u => u.role === 'Employee' && !mainAssignees.some(a => a.id === u.id));
        return {
            ...createGroup("Task Assignees", mainAssignees),
            ...createGroup("Managers", managers),
            ...createGroup("Employees", employees),
        };
    }
    
    if (currentUserProfile.role === 'Manager') {
        const myTeam = allUsers.filter(u => u.managerId === currentUserProfile.id || u.id === currentUserProfile.id);
        const otherMembers = myTeam.filter(u => !mainAssignees.some(a => a.id === u.id));
        return {
            ...createGroup("Task Assignees", mainAssignees),
            ...createGroup("My Team", otherMembers),
        };
    }
    
    if (currentUserProfile.role === 'Employee') {
        const myTeam = allUsers.filter(u => u.managerId === currentUserProfile.managerId);
        const otherTeamMembers = myTeam.filter(u => !mainAssignees.some(a => a.id === u.id));
        return {
            ...createGroup("Task Assignees", mainAssignees),
            ...createGroup("My Team", otherTeamMembers),
        };
    }
    return {};
  }, [allUsers, currentUserProfile, assigneeIds]);
  
  const singleBrandId = useMemo(() => (brands && brands.length === 1) ? brands[0].id : null, [brands]);

  useEffect(() => {
    if (open) {
        form.reset({
          title: '',
          brandId: singleBrandId || '',
          content: '',
          priority: 'Medium',
          assigneeIds: [],
          startDate: undefined,
          dueDate: undefined,
          timeEstimate: undefined,
        });
        
        setSuggestionReason(null);
        setSubtasks([]);
        setAttachments([]);
        setDependencies({ waitingOn: [], blocking: [], linked: [] });
        setComments([]);

        if (currentUserProfile && user && currentUserProfile.role === 'Employee') {
            form.setValue('assigneeIds', [user.uid]);
        }
        if (singleBrandId) {
            form.setValue('brandId', singleBrandId);
        }
    }
  }, [open, currentUserProfile, user, form, singleBrandId]);

  const handleSuggestPriority = async () => {
    const title = form.getValues('title');
    if (!title) { toast({ variant: 'destructive', title: 'Title is required' }); return; }
    setIsSuggesting(true);
    setSuggestionReason(null);
    try {
      const result = await suggestPriority({ title, description: form.getValues('content'), language: language.name });
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

  const onSubmit = async (data: ArticleFormValues) => {
    if (!firestore || !currentUserProfile) return;
    
    const batch = writeBatch(firestore);
    const newArticleRef = doc(collection(firestore, 'webArticles'));
    
    const newArticleData: Omit<WebArticle, 'id' | 'createdAt'> & {createdAt: any} = {
        title: data.title,
        brandId: data.brandId,
        content: data.content || '',
        priority: data.priority,
        assigneeIds: data.assigneeIds,
        startDate: data.startDate?.toISOString(),
        dueDate: data.dueDate?.toISOString(),
        timeEstimate: data.timeEstimate,
        dependencies: dependencies,
        status: 'To Do',
        statusInternal: 'To Do',
        companyId: currentUserProfile.companyId,
        createdAt: serverTimestamp(),
        createdBy: { id: currentUserProfile.id, name: currentUserProfile.name, avatarUrl: currentUserProfile.avatarUrl || '' },
        subtasks,
        attachments,
        comments,
    };
    batch.set(newArticleRef, newArticleData);

    data.assigneeIds.forEach(assigneeId => {
        if (assigneeId === currentUserProfile.id) return; 
        const notificationRef = doc(collection(firestore, `users/${assigneeId}/notifications`));
        const notification: Omit<Notification, 'id'> = {
            userId: assigneeId,
            title: 'New Web Article Assigned',
            message: `${currentUserProfile.name} assigned you: "${data.title}"`,
            entityId: newArticleRef.id,
            entityType: 'webArticle',
            workstream: 'web',
            isRead: false,
            createdAt: serverTimestamp(),
            createdBy: { id: currentUserProfile.id, name: currentUserProfile.name, avatarUrl: currentUserProfile.avatarUrl || '' }
        };
        batch.set(notificationRef, notification);
    });

    try {
        await batch.commit();
        toast({ title: 'Web Article Created', description: `${data.title} has been added.` });
        setOpen(false);
    } catch (error) {
        console.error("Failed to create article:", error);
        toast({ variant: 'destructive', title: 'Creation Failed', description: 'Could not create the article. Please try again.' });
    }
  };
  
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || !storage || !user) return;
    setIsUploading(true);
    const files = Array.from(event.target.files);
    try {
        const uploadPromises = files.map(async (file) => {
            const storageRef = ref(storage, `attachments/${user.uid}/${Date.now()}-${file.name}`);
            await uploadBytes(storageRef, file);
            const url = await getDownloadURL(storageRef);
            return { id: `local-${Date.now()}-${file.name}`, name: file.name, type: 'local' as const, url };
        });
        const newFiles = await Promise.all(uploadPromises);
        setAttachments(prev => [...prev, ...newFiles]);
        toast({ title: 'Upload Successful' });
    } catch (error) {
        toast({ variant: 'destructive', title: 'Upload Failed' });
    } finally {
        setIsUploading(false);
        if(event.target) event.target.value = '';
    }
  };
  
  const handleConfirmGdriveLink = () => {
    if (!gdriveLink || !gdriveName) { toast({ variant: 'destructive', title: 'Missing Info' }); return; }
    const newFile: Attachment = { id: `gdrive-${Date.now()}`, name: gdriveName, type: 'gdrive', url: gdriveLink };
    setAttachments(prev => [...prev, newFile]);
    setIsGdriveDialogOpen(false); setGdriveLink(''); setGdriveName('');
  };
  
  const handleRemoveAttachment = (id: string) => {
    setAttachments(prev => prev.filter(att => att.id !== id));
  };
  
  const handleAddSubtask = () => {
    if (newSubtaskTitle.trim()) {
      const newSubtask: Subtask = {
        id: `sub-${Date.now()}`,
        title: newSubtaskTitle,
        completed: false,
        ...(newSubtaskAssignee && { assignee: { id: newSubtaskAssignee.id, name: newSubtaskAssignee.name, avatarUrl: newSubtaskAssignee.avatarUrl || '' } }),
      };
      setSubtasks([...subtasks, newSubtask]);
      setNewSubtaskTitle(''); setNewSubtaskAssignee(null);
    }
  };

  const handleToggleSubtask = (subtaskId: string) => {
    setSubtasks(subtasks.map(st => st.id === subtaskId ? { ...st, completed: !st.completed } : st));
  };
  
  const handleRemoveSubtask = (subtaskId: string) => { setSubtasks(subtasks.filter(st => st.id !== subtaskId)); };

  const handleAddDependency = (articleId: string, type: keyof Dependencies) => {
    setDependencies(prev => {
        const list = prev[type] || [];
        if (!list.includes(articleId)) {
            return { ...prev, [type]: [...list, articleId] };
        }
        return prev;
    });
  };

  const handleRemoveDependency = (articleId: string, type: keyof Dependencies) => {
    setDependencies(prev => ({
        ...prev,
        [type]: (prev[type] || []).filter(id => id !== articleId),
    }));
  };
  
  const handlePostComment = () => {
    if (!newComment.trim() || !currentUserProfile || !user) return;
    const comment: Comment = {
      id: `c-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      user: {
        id: user.uid,
        name: currentUserProfile.name || 'Unknown User',
        email: currentUserProfile.email || '',
        avatarUrl: currentUserProfile.avatarUrl || '',
        role: currentUserProfile.role,
        companyId: currentUserProfile.companyId,
        createdAt: currentUserProfile.createdAt,
      },
      text: newComment,
      timestamp: new Date().toISOString(),
      replies: [],
    };
    setComments([...comments, comment]);
    setNewComment('');
    setIsMentioning(false);
  };
  
  const handleCommentChange = (text: string) => {
    setNewComment(text);
    if (allUsers) {
      const mentionMatch = text.match(/@(\w*)$/);
      if (mentionMatch) {
        setIsMentioning(true);
        setMentionSuggestions(allUsers.filter(u => u.name.toLowerCase().includes(mentionMatch[1].toLowerCase())));
      } else {
        setIsMentioning(false);
      }
    }
  };

  const handleMentionSelect = (user: UserType) => {
    const currentComment = newComment;
    const atIndex = currentComment.lastIndexOf('@');
    const newCommentText = `${currentComment.substring(0, atIndex)}@${user.name.split(' ')[0]} `;
    setNewComment(newCommentText);
    setIsMentioning(false);
  };

  const renderDependencyList = (ids: string[], type: keyof Dependencies) => (
    <div className="flex flex-wrap gap-2">
        {(ids || []).map(id => {
            const article = allArticles?.find(p => p.id === id);
            return article ? (
                <Badge key={id} variant="secondary">
                    {article.title}
                    <button onClick={() => handleRemoveDependency(id, type)} className="ml-2 rounded-full hover:bg-background/50 p-0.5"><X className="h-3 w-3" /></button>
                </Badge>
            ) : null;
        })}
    </div>
  );

  return (
    <>
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent className="flex flex-col p-0 h-screen w-screen max-w-full">
        <SheetHeader className="p-6 pb-0">
          <SheetTitle>Create Web Article</SheetTitle>
          <SheetDescription>Fill in the details for the new web article.</SheetDescription>
        </SheetHeader>
        <div className="flex-1 min-h-0">
          <ScrollArea className="h-full">
            <div className="p-6">
              <Form {...form}>
                <form id="add-article-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="space-y-6 lg:col-span-2">
                       <FormField control={form.control} name="title" render={({ field }) => ( <FormItem><FormLabel>Article Title</FormLabel><FormControl><Input placeholder="e.g., The Future of AI in Marketing" {...field} /></FormControl><FormMessage /></FormItem> )}/>
                       <FormField control={form.control} name="content" render={({ field }) => ( <FormItem><FormLabel>Content</FormLabel><FormControl><RichTextEditor value={field.value || ''} onChange={field.onChange} placeholder="Write your article content here..." /></FormControl><FormMessage /></FormItem> )}/>
                    </div>
                    <div className="space-y-6 lg:col-span-1">
                      {singleBrandId ? (
                        <div className="space-y-2"><Label>Brand</Label><div className="p-2 bg-secondary rounded-md text-sm flex items-center gap-2"><Building2 className="h-4 w-4"/>{brandMap.get(singleBrandId) || '...'}</div></div>
                      ) : (
                        <FormField control={form.control} name="brandId" render={({ field }) => ( <FormItem><FormLabel>Brand</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a brand" /></SelectTrigger></FormControl><SelectContent>{areBrandsLoading ? <div className="p-2"><Loader2 className="h-4 w-4 animate-spin"/></div> : brands?.map((brand) => ( <SelectItem key={brand.id} value={brand.id}>{brand.name}</SelectItem> ))}</SelectContent></Select><FormMessage /></FormItem> )}/>
                      )}
                      <FormField control={form.control} name="priority" render={({ field }) => ( <FormItem><FormLabel>Priority</FormLabel><div className="flex gap-2"><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent>{Object.values(priorityInfo).map(p => (<SelectItem key={p.value} value={p.value}><div className="flex gap-2"><p.icon className={`h-4 w-4 ${p.color}`}/>{p.label}</div></SelectItem>))}</SelectContent></Select><Button type="button" variant="outline" size="icon" onClick={handleSuggestPriority} disabled={isSuggesting}><Wand2 className="h-4 w-4"/></Button></div>{suggestionReason && <FormDescription>{suggestionReason}</FormDescription>}<FormMessage/></FormItem> )}/>
                      <FormField control={form.control} name="assigneeIds" render={({ field }) => ( <FormItem><FormLabel>Assign To</FormLabel>{areUsersLoading ? <Loader2 className="h-5 w-5 animate-spin"/> : <MultiSelect options={userOptions} onValueChange={(v) => form.setValue('assigneeIds', v)} defaultValue={field.value || []} placeholder="Select members..."/>}<FormMessage /></FormItem> )}/>
                      
                      <div className="space-y-4 rounded-lg border p-4">
                        <FormField control={form.control} name="startDate" render={({ field }) => ( <FormItem><FormLabel>Start Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4"/>{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><CalendarComponent mode="single" selected={field.value} onSelect={field.onChange} /></PopoverContent></Popover><FormMessage /></FormItem> )}/>
                        <FormField control={form.control} name="dueDate" render={({ field }) => ( <FormItem><FormLabel>Due Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4"/>{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><CalendarComponent mode="single" selected={field.value} onSelect={field.onChange} /></PopoverContent></Popover><FormMessage /></FormItem> )}/>
                      </div>
                      <div className='space-y-4 p-4 rounded-lg border'>
                          <div className="flex justify-between items-center"><h3 className='font-semibold text-sm'>Time Management</h3><div></div></div>
                          <Separator/>
                            <FormField
                                control={form.control}
                                name="timeEstimate"
                                render={({ field }) => (
                                    <FormItem className="grid grid-cols-3 items-center gap-2">
                                        <FormLabel className="text-muted-foreground text-sm">Estimasi (hari)</FormLabel>
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
                   <Tabs defaultValue="comments" className="w-full">
                        <TabsList className="grid w-full grid-cols-4">
                          <TabsTrigger value="comments"><MessageSquare className="mr-2"/>Comments</TabsTrigger>
                          <TabsTrigger value="subtasks"><ListTodo className="mr-2"/>Subtasks</TabsTrigger>
                          <TabsTrigger value="files"><Paperclip className="mr-2"/>Files</TabsTrigger>
                          <TabsTrigger value="dependencies"><GitMerge className="mr-2"/>Dependencies</TabsTrigger>
                        </TabsList>
                        <TabsContent value="comments" className="mt-4 space-y-4 rounded-lg border p-4 relative">
                            <div className="space-y-4 max-h-48 overflow-y-auto pr-2">
                                {comments.map((comment) => (
                                <div key={comment.id} className="flex items-start gap-3">
                                    <Avatar className="h-8 w-8"><AvatarImage src={comment.user.avatarUrl}/><AvatarFallback>{getInitials(comment.user.name)}</AvatarFallback></Avatar>
                                    <div>
                                    <p className="font-semibold text-sm">{comment.user.name} <span className="text-xs text-muted-foreground font-normal">{formatDistanceToNow(parseISO(comment.timestamp), { addSuffix: true })}</span></p>
                                    <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: comment.text }} />
                                    </div>
                                </div>
                                ))}
                                {comments.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">No comments yet. Start the conversation!</p>}
                            </div>
                            <div className="flex items-start gap-2 pt-4 border-t">
                                <Avatar className="h-9 w-9"><AvatarImage src={currentUserProfile?.avatarUrl} /><AvatarFallback>{getInitials(currentUserProfile?.name)}</AvatarFallback></Avatar>
                                <div className="flex-1 relative">
                                <RichTextEditor value={newComment} onChange={handleCommentChange} placeholder="Write a comment... (use '@' to mention)" minHeight={100} />
                                {isMentioning && (
                                    <div className="absolute bottom-full mb-2 w-full max-h-48 overflow-y-auto border bg-background rounded-md shadow-lg z-10">
                                    <Command>
                                        <CommandList>
                                        {mentionSuggestions.map(user => (
                                        <CommandItem key={user.id} onSelect={() => handleMentionSelect(user)}>
                                            <Avatar className="h-6 w-6 mr-2"><AvatarImage src={user.avatarUrl}/><AvatarFallback>{getInitials(user.name)}</AvatarFallback></Avatar>
                                            {user.name}
                                        </CommandItem>
                                        ))}
                                        </CommandList>
                                    </Command>
                                    </div>
                                )}
                                </div>
                                <Button type="button" onClick={handlePostComment} disabled={!newComment.trim()}><Send className="h-4 w-4"/></Button>
                            </div>
                        </TabsContent>
                        <TabsContent value="subtasks" className="mt-4 space-y-4 rounded-lg border p-4">
                          <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                              {subtasks.map((subtask) => ( <div key={subtask.id} className="flex items-center gap-3 p-2 bg-secondary/50 rounded-md hover:bg-secondary transition-colors"><Checkbox id={`subtask-${subtask.id}`} checked={subtask.completed} onCheckedChange={() => handleToggleSubtask(subtask.id)} /><label htmlFor={`subtask-${subtask.id}`} className={`flex-1 text-sm ${subtask.completed ? 'line-through text-muted-foreground' : ''}`}>{subtask.title}</label><Popover><PopoverTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">{subtask.assignee ? ( <Avatar className="h-6 w-6"><AvatarImage src={subtask.assignee.avatarUrl} /><AvatarFallback>{getInitials(subtask.assignee.name)}</AvatarFallback></Avatar> ) : ( <UserPlus className="h-4 w-4" /> )}</Button></PopoverTrigger><PopoverContent className="w-60 p-1"><ScrollArea className="max-h-60"><div className="space-y-1">{Object.entries(subtaskAssigneeOptions).map(([group, users]) => ( users.length > 0 && ( <React.Fragment key={group}><Separator /><div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{group}</div>{users.map(user => ( <Button key={user.id} variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={() => setNewSubtaskAssignee(user)}><Avatar className="h-6 w-6"><AvatarImage src={user.avatarUrl} /><AvatarFallback>{getInitials(user.name)}</AvatarFallback></Avatar><span className="truncate">{user.name}</span></Button> ))}</React.Fragment> ) ))}</div></ScrollArea></PopoverContent></Popover><Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => handleRemoveSubtask(subtask.id)}><Trash className="h-4 w-4"/></Button></div> ))}
                          </div>
                          <div className="flex items-center gap-2"><Input placeholder="Add a new subtask..." value={newSubtaskTitle} onChange={(e) => setNewSubtaskTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddSubtask())} />
                          <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-muted-foreground">
                                  {newSubtaskAssignee ? (
                                    <Avatar className="h-6 w-6"><AvatarImage src={newSubtaskAssignee.avatarUrl} /><AvatarFallback>{getInitials(newSubtaskAssignee.name)}</AvatarFallback></Avatar>
                                  ) : (
                                    <UserPlus className="h-4 w-4" />
                                  )}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-60 p-1">
                                <ScrollArea className="max-h-60">
                                  <div className="space-y-1">
                                       {Object.entries(subtaskAssigneeOptions).map(([group, users]) => (
                                          users.length > 0 && (
                                              <React.Fragment key={group}>
                                                  <Separator />
                                                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{group}</div>
                                                  {users.map(user => (
                                                      <Button key={user.id} variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={() => setNewSubtaskAssignee(user)}>
                                                          <Avatar className="h-6 w-6"><AvatarImage src={user.avatarUrl} /><AvatarFallback>{getInitials(user.name)}</AvatarFallback></Avatar>
                                                          <span className="truncate">{user.name}</span>
                                                      </Button>
                                                  ))}
                                              </React.Fragment>
                                          )
                                      ))}
                                  </div>
                              </ScrollArea>
                            </PopoverContent>
                          </Popover>
                          <Button type="button" onClick={handleAddSubtask}><Plus className="h-4 w-4 mr-2" /> Add</Button></div>
                        </TabsContent>
                        <TabsContent value="files" className="mt-4 space-y-4 rounded-lg border p-4">
                            <div>
                                <h4 className="font-medium text-sm mb-2">Files</h4>
                                <div className="space-y-2">
                                    {attachments.map((att) => (
                                        <div key={att.id} className="flex items-center justify-between rounded-md bg-secondary/50 p-2 text-sm">
                                            <a href={att.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 truncate hover:underline">
                                            {getFileIcon(att.name)}
                                            <span className="truncate" title={att.name}>{att.name}</span>
                                            </a>
                                            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => handleRemoveAttachment(att.id)}><X className="h-4 w-4" /></Button>
                                        </div>
                                    ))}
                                </div>
                                {attachments.length === 0 && <p className="text-center text-muted-foreground text-sm py-4">No files attached.</p>}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 mt-2 border-t">
                                    <input type="file" ref={fileInputRef} onChange={(e) => handleFileChange(e)} multiple className="hidden" />
                                    <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>{isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Upload Files</Button>
                                    <Button type="button" variant="outline" onClick={() => setIsGdriveDialogOpen(true)}>
                                        <div className="flex items-center justify-center gap-2">
                                            <svg className="mr-2" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10.5187 5.56875L5.43125 0.48125L0 9.25625L5.0875 14.3438L10.5187 5.56875Z" fill="#34A853"/><path d="M16 9.25625L10.5188 0.48125H5.43125L8.25625 4.8875L13.25 13.9062L16 9.25625Z" fill="#FFC107"/><path d="M2.83125 14.7875L8.25625 5.56875L5.51875 0.81875L0.0375 9.59375L2.83125 14.7875Z" fill="#1A73E8"/><path d="M13.25 13.9062L10.825 9.75L8.25625 4.8875L5.43125 10.1L8.03125 14.7875H13.1562L13.25 13.9062Z" fill="#EA4335"/></svg>
                                            Link from Google Drive
                                        </div>
                                    </Button>
                                </div>
                            </div>
                        </TabsContent>
                        <TabsContent value="dependencies" className="mt-4 space-y-6 rounded-lg border p-4">
                            <div className="space-y-3"><h4 className="text-sm font-semibold flex items-center gap-2"><Workflow className="h-4 w-4 text-orange-500" />Waiting On</h4><p className="text-xs text-muted-foreground">These articles must be completed before this one can start.</p>{renderDependencyList(dependencies.waitingOn || [], 'waitingOn')}<Popover><PopoverTrigger asChild><Button variant="outline" size="sm" className="h-7"><Plus className="mr-2 h-3 w-3" />Add...</Button></PopoverTrigger><PopoverContent className="w-80"><Command><CommandInput placeholder="Search articles..." /><CommandList><CommandEmpty>No articles found.</CommandEmpty>{groupedDependencyOptions.map(([brandName, articles]) => (<CommandGroup key={brandName} heading={brandName}>{articles.map(article => (<CommandItem key={article.id} onSelect={() => handleAddDependency(article.id, 'waitingOn')}>{article.title}</CommandItem>))}</CommandGroup>))}</CommandList></Command></PopoverContent></Popover></div>
                            <Separator/>
                            <div className="space-y-3"><h4 className="text-sm font-semibold flex items-center gap-2"><Blocks className="h-4 w-4 text-red-500" />Blocking</h4><p className="text-xs text-muted-foreground">This article is blocking the following articles.</p>{renderDependencyList(dependencies.blocking || [], 'blocking')}<Popover><PopoverTrigger asChild><Button variant="outline" size="sm" className="h-7"><Plus className="mr-2 h-3 w-3" />Add...</Button></PopoverTrigger><PopoverContent className="w-80"><Command><CommandInput placeholder="Search articles..." /><CommandList><CommandEmpty>No articles found.</CommandEmpty>{groupedDependencyOptions.map(([brandName, articles]) => (<CommandGroup key={brandName} heading={brandName}>{articles.map(article => (<CommandItem key={article.id} onSelect={() => handleAddDependency(article.id, 'blocking')}>{article.title}</CommandItem>))}</CommandGroup>))}</CommandList></Command></PopoverContent></Popover></div>
                            <Separator/>
                            <div className="space-y-3"><h4 className="text-sm font-semibold flex items-center gap-2"><LinkIcon className="h-4 w-4 text-blue-500" />Linked Articles</h4><p className="text-xs text-muted-foreground">Related articles that are not dependent.</p>{renderDependencyList(dependencies.linked || [], 'linked')}<Popover><PopoverTrigger asChild><Button variant="outline" size="sm" className="h-7"><Plus className="mr-2 h-3 w-3" />Add...</Button></PopoverTrigger><PopoverContent className="w-80"><Command><CommandInput placeholder="Search articles..." /><CommandList><CommandEmpty>No articles found.</CommandEmpty>{groupedDependencyOptions.map(([brandName, articles]) => (<CommandGroup key={brandName} heading={brandName}>{articles.map(article => (<CommandItem key={article.id} onSelect={() => handleAddDependency(article.id, 'linked')}>{article.title}</CommandItem>))}</CommandGroup>))}</CommandList></Command></PopoverContent></Popover></div>
                        </TabsContent>
                    </Tabs>
                </form>
              </Form>
            </div>
          </ScrollArea>
        </div>
        <SheetFooter className="p-6 pt-4 border-t">
          <Button type="submit" form="add-article-form">
            Create Article
          </Button>
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
                <div className="space-y-2"><Label htmlFor="gdrive-name">File Name</Label><Input id="gdrive-name" value={gdriveName} onChange={(e) => setGdriveName(e.target.value)} placeholder="e.g., Q3 Marketing Report" /></div>
                <div className="space-y-2"><Label htmlFor="gdrive-link">File Link</Label><Input id="gdrive-link" value={gdriveLink} onChange={(e) => setGdriveLink(e.target.value)} placeholder="https://docs.google.com/..." /></div>
            </div>
            <DialogFooter>
                <Button variant="ghost" onClick={() => setIsGdriveDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleConfirmGdriveLink}>Add Link</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    </>
  );
}

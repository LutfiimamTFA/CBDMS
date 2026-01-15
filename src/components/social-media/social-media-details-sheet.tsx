'use client';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTrigger,
  SheetFooter,
  SheetTitle,
} from '@/components/ui/sheet';
import type { SocialMediaPost, TimeLog, User, Priority, Tag, Subtask, Comment, Attachment, Notification, Activity, Brand, WorkflowStatus, Dependencies } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '../ui/textarea';
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
} from '@/components/ui/form';
import { priorityInfo } from '@/lib/utils';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AtSign, CalendarIcon, Clock, Edit, FileUp, GitMerge, History, ListTodo, LogIn, MessageSquare, PauseCircle, PlayCircle, Plus, Repeat, Send, TagIcon, Trash, Trash2, Users, Wand2, X, Share2, Star, Link as LinkIcon, Paperclip, MoreHorizontal, Copy, FileImage, FileText, Building2, CheckCircle, AlertCircle, RefreshCcw, UserPlus, Check, ListChecks, Upload, Bold, Italic, Table as TableIcon, List as ListIcon, ListOrdered, UploadCloud, Circle, CircleDashed, XCircle, Workflow, Blocks, RotateCcw } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Separator } from '../ui/separator';
import { useI18n } from '@/context/i18n-provider';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { useCollection, useFirestore, useUserProfile, useStorage } from '@/firebase';
import { collection, doc, writeBatch, serverTimestamp, query, orderBy, updateDoc, deleteField, type Timestamp, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Badge } from '../ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import { Label } from '@/components/ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { Card, CardContent } from '../ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RichTextEditor } from '../ui/rich-text-editor';
import { usePermissions } from '@/context/permissions-provider';
import { deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { getInitials } from '@/lib/utils';
import { Checkbox } from '../ui/checkbox';
import { ScrollArea } from '../ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';

const postDetailsSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  brandId: z.string().min(1, 'Brand is required'),
  caption: z.string().optional(),
  status: z.string(),
  priority: z.enum(['Urgent', 'High', 'Medium', 'Low']),
  assigneeIds: z.array(z.string()).optional(),
  dueDate: z.string().optional(),
});

type PostDetailsFormValues = z.infer<typeof postDetailsSchema>;


interface SocialMediaPostDetailsSheetProps {
  post: SocialMediaPost;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SocialMediaPostDetailsSheet({ 
  post: initialPost, 
  open,
  onOpenChange,
}: SocialMediaPostDetailsSheetProps) {
  const { t } = useI18n();
  const { toast } = useToast();
  
  const [postState, setPostState] = useState(initialPost);
  useEffect(() => { setPostState(initialPost) }, [initialPost]);
  
  const [newComment, setNewComment] = useState('');
  const [newSubtask, setNewSubtask] = useState('');
  
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isDeleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  
  const firestore = useFirestore();
  const storage = useStorage();
  const { user: authUser, profile: currentUser } = useUserProfile();
  const { permissions, isLoading: arePermsLoading } = usePermissions();

  const allPostsQuery = useMemo(() => {
    if (!firestore || !currentUser) return null;
    return query(collection(firestore, 'socialMediaPosts'), where('companyId', '==', currentUser.companyId));
  }, [firestore, currentUser]);
  const { data: allPosts } = useCollection<SocialMediaPost>(allPostsQuery);
  
  const usersQuery = useMemo(() => {
    if (!firestore || !currentUser) return null;
    let q = query(collection(firestore, 'users'), where('companyId', '==', currentUser.companyId));
    return q;
  }, [firestore, currentUser]);
  const { data: allUsers } = useCollection<User>(usersQuery);
  
  const brandsQuery = useMemo(() => {
    if (!firestore || !currentUser) return null;
    return query(collection(firestore, 'brands'), orderBy('name'));
  }, [firestore, currentUser]);
  const { data: brands, isLoading: areBrandsLoading } = useCollection<Brand>(brandsQuery);

  const form = useForm<PostDetailsFormValues>({
    resolver: zodResolver(postDetailsSchema),
    values: {
        title: postState.title,
        brandId: postState.brandId,
        caption: postState.caption,
        status: postState.status,
        priority: postState.priority,
        assigneeIds: postState.assigneeIds,
        dueDate: postState.dueDate ? format(parseISO(postState.dueDate), 'yyyy-MM-dd') : undefined,
    }
  });
  
  const canEditContent = useMemo(() => {
      if (!currentUser) return false;
      const isCreator = currentUser.id === postState.createdBy.id;
      const isManagerOfBrand = currentUser.role === 'Manager' && postState.brandId && (currentUser.brandIds || []).includes(postState.brandId);
      return currentUser.role === 'Super Admin' || isManagerOfBrand || isCreator;
  }, [currentUser, postState]);

  const handleDelete = () => {
    if (!firestore || !postState) return;
    deleteDocumentNonBlocking(doc(firestore, 'socialMediaPosts', postState.id));
    toast({ title: "Post Deleted", description: "The post is being removed." });
    onOpenChange(false);
    setDeleteConfirmOpen(false);
  };
  
   const handlePostComment = async () => {
    if (!newComment.trim() || !firestore || !currentUser) return;
    const newCommentData: Comment = {
        id: crypto.randomUUID(),
        user: currentUser as User,
        text: newComment,
        timestamp: new Date().toISOString(),
        replies: [],
    };
    const newActivity = createActivity(currentUser, `commented: "${newComment.substring(0, 50)}..."`);
    await updateDoc(doc(firestore, 'socialMediaPosts', postState.id), { 
        comments: [...(postState.comments || []), newCommentData],
        lastActivity: newActivity,
        activities: [...(postState.activities || []), newActivity]
    });
    setNewComment('');
  };
  
   const handleAddSubtask = async () => {
    if (!newSubtask.trim() || !firestore) return;
    const subtask: Subtask = { id: `st-${Date.now()}`, title: newSubtask, completed: false };
    await updateDoc(doc(firestore, 'socialMediaPosts', postState.id), { subtasks: [...(postState.subtasks || []), subtask] });
    setNewSubtask('');
  };

  const handleToggleSubtask = async (subtaskId: string) => {
    if (!firestore) return;
    const newSubtasks = postState.subtasks?.map(st => st.id === subtaskId ? { ...st, completed: !st.completed } : st) || [];
    await updateDoc(doc(firestore, 'socialMediaPosts', postState.id), { subtasks: newSubtasks });
  };
  
  const handleRemoveSubtask = async (subtaskId: string) => {
    if (!firestore) return;
    const newSubtasks = postState.subtasks?.filter(st => st.id !== subtaskId) || [];
    await updateDoc(doc(firestore, 'socialMediaPosts', postState.id), { subtasks: newSubtasks });
  };

  const handleAddDependency = async (taskId: string, type: keyof Dependencies) => {
    if (!firestore) return;
    const currentDeps = { ...postState.dependencies };
    const list = currentDeps[type] || [];
    if (!list.includes(taskId)) {
        (currentDeps[type] as string[]).push(taskId);
        await updateDoc(doc(firestore, 'socialMediaPosts', postState.id), { dependencies: currentDeps });
    }
  };

  const handleRemoveDependency = async (taskId: string, type: keyof Dependencies) => {
    if (!firestore) return;
    const currentDeps = { ...postState.dependencies };
    const list = currentDeps[type] || [];
    currentDeps[type] = list.filter(id => id !== taskId);
    await updateDoc(doc(firestore, 'socialMediaPosts', postState.id), { dependencies: currentDeps });
  };
  
  const dependencyOptions = useMemo(() => (allPosts || []).filter(p => p.id !== postState.id), [allPosts, postState.id]);
  const groupedDependencyOptions = useMemo(() => {
      const grouped: Record<string, SocialMediaPost[]> = {};
      dependencyOptions.forEach(post => {
          const brandName = brands?.find(b => b.id === post.brandId)?.name || 'Unbranded';
          if (!grouped[brandName]) grouped[brandName] = [];
          grouped[brandName].push(post);
      });
      return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
  }, [dependencyOptions, brands]);
  
  const renderDependencyList = (ids: string[], type: keyof Dependencies) => (
    <div className="flex flex-wrap gap-2">
        {(ids || []).map(id => {
            const post = allPosts?.find(p => p.id === id);
            return post ? (
                <Badge key={id} variant="secondary">
                    {post.title}
                    <button onClick={() => handleRemoveDependency(id, type)} className="ml-2 rounded-full hover:bg-background/50 p-0.5">
                        <X className="h-3 w-3" />
                    </button>
                </Badge>
            ) : null;
        })}
    </div>
  );

  const getUniqueActivities = (activities: Activity[]): Activity[] => {
    if (!activities) return [];
    const seen = new Set();
    return activities.filter(activity => {
        const duplicate = seen.has(activity.id);
        seen.add(activity.id);
        return !duplicate;
    });
  };
  

  return (
    <>
    <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="flex flex-col p-0 h-screen w-screen max-w-full">
            <SheetHeader className="p-4 border-b flex-shrink-0">
                <SheetTitle className='sr-only'>Post Details for {postState.title}</SheetTitle>
                <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                        {postState.createdBy && `Created by ${postState.createdBy.name}`}
                    </p>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="sm"><MoreHorizontal className="h-4 w-4"/></Button></DropdownMenuTrigger>
                      <DropdownMenuContent>
                          <DropdownMenuItem onClick={() => setIsHistoryOpen(true)}><History className="mr-2 h-4 w-4"/>View History</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteConfirmOpen(true)}><Trash2 className="mr-2 h-4 w-4"/>Delete Post</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </SheetHeader>
             <div className="flex-1 min-h-0">
                <ScrollArea className="h-full" style={{height: 'calc(100vh - 65px)'}}>
                    <div className="p-6">
                        <FormField control={form.control} name="title" render={({ field }) => ( <Input {...field} readOnly={!canEditContent} className="text-2xl font-bold border-dashed h-auto p-0 border-0 focus-visible:ring-1"/> )}/>
                         <Tabs defaultValue="comments" className="w-full mt-6">
                            <TabsList className="grid w-full grid-cols-5">
                                <TabsTrigger value="comments"><MessageSquare className="mr-2"/>Comments</TabsTrigger>
                                <TabsTrigger value="subtasks"><ListTodo className="mr-2"/>Subtasks</TabsTrigger>
                                <TabsTrigger value="materials"><Paperclip className="mr-2"/>Materials</TabsTrigger>
                                <TabsTrigger value="deliverables"><Upload className="mr-2"/>Deliverables</TabsTrigger>
                                <TabsTrigger value="dependencies"><GitMerge className="mr-2"/>Dependencies</TabsTrigger>
                            </TabsList>
                             <TabsContent value="comments" className="mt-4 space-y-4 rounded-lg border p-4 relative">
                                <ScrollArea className="max-h-48 pr-2"><div className="space-y-4">
                                {(postState.comments || []).map((comment) => ( <div key={comment.id} className="flex items-start gap-3"><Avatar className="h-8 w-8"><AvatarImage src={comment.user.avatarUrl}/><AvatarFallback>{getInitials(comment.user.name)}</AvatarFallback></Avatar><div><p className="text-sm font-medium">{comment.user.name} <span className="text-xs text-muted-foreground font-normal">{formatDistanceToNow(parseISO(comment.timestamp), { addSuffix: true })}</span></p><p className="text-sm">{comment.text}</p></div></div> ))}
                                {(postState.comments || []).length === 0 && <p className="text-center text-muted-foreground text-sm py-8">No comments yet.</p>}
                                </div></ScrollArea>
                                <div className="flex items-start gap-2 pt-4 border-t">
                                    <Avatar className="h-9 w-9"><AvatarImage src={currentUser?.avatarUrl} /><AvatarFallback>{getInitials(currentUser?.name)}</AvatarFallback></Avatar>
                                    <Textarea placeholder="Write a comment..." value={newComment} onChange={(e) => setNewComment(e.target.value)} />
                                    <Button type="button" onClick={handlePostComment} disabled={!newComment.trim()}><Send className="h-4 w-4"/></Button>
                                </div>
                            </TabsContent>
                            <TabsContent value="subtasks" className="mt-4 space-y-4 rounded-lg border p-4">
                                <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                                    {(postState.subtasks || []).map((subtask) => ( <div key={subtask.id} className="flex items-center gap-3 p-2 bg-secondary/50 rounded-md hover:bg-secondary transition-colors"><Checkbox id={`subtask-${subtask.id}`} checked={subtask.completed} onCheckedChange={() => handleToggleSubtask(subtask.id)} /><label htmlFor={`subtask-${subtask.id}`} className={`flex-1 text-sm ${subtask.completed ? 'line-through text-muted-foreground' : ''}`}>{subtask.title}</label><Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => handleRemoveSubtask(subtask.id)}><Trash className="h-4 w-4"/></Button></div> ))}
                                </div>
                                <div className="flex items-center gap-2"><Input placeholder="Add a new subtask..." value={newSubtask} onChange={(e) => setNewSubtask(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddSubtask())} /><Button type="button" onClick={handleAddSubtask}><Plus className="h-4 w-4 mr-2" /> Add</Button></div>
                            </TabsContent>
                             <TabsContent value="materials" className="mt-4 space-y-2 rounded-lg border p-4">
                                 {(postState.attachments || []).map((att) => ( <div key={att.id} className="flex items-center justify-between rounded-md bg-secondary/50 p-2 text-sm"><a href={att.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 truncate hover:underline">{getFileIcon(att.name)}<span className="truncate" title={att.name}>{att.name}</span></a></div>))}
                                 {(postState.attachments || []).length === 0 && <p className="text-center text-muted-foreground text-sm py-4">No materials attached.</p>}
                            </TabsContent>
                             <TabsContent value="deliverables" className="mt-4 space-y-2 rounded-lg border p-4">
                                 {(postState.deliverables || []).map((att) => ( <div key={att.id} className="flex items-center justify-between rounded-md bg-secondary/50 p-2 text-sm"><a href={att.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 truncate hover:underline">{getFileIcon(att.name)}<span className="truncate" title={att.name}>{att.name}</span></a></div>))}
                                 {(postState.deliverables || []).length === 0 && <p className="text-center text-muted-foreground text-sm py-4">No deliverables submitted.</p>}
                            </TabsContent>
                            <TabsContent value="dependencies" className="mt-4 space-y-6 rounded-lg border p-4">
                                <div className="space-y-3"><h4 className="text-sm font-semibold flex items-center gap-2"><Workflow className="h-4 w-4 text-orange-500" />Waiting On</h4><p className="text-xs text-muted-foreground">Tugas-tugas ini harus selesai sebelum tugas ini bisa dimulai.</p>{renderDependencyList(postState.dependencies?.waitingOn || [], 'waitingOn')}<Popover><PopoverTrigger asChild><Button variant="outline" size="sm" className="h-7"><Plus className="mr-2 h-3 w-3" />Add...</Button></PopoverTrigger><PopoverContent className="w-80"><Command><CommandInput placeholder="Search posts..." /><CommandList><CommandEmpty>No posts found.</CommandEmpty>{groupedDependencyOptions.map(([brandName, posts]) => (<CommandGroup key={brandName} heading={brandName}>{posts.map(post => (<CommandItem key={post.id} onSelect={() => handleAddDependency(post.id, 'waitingOn')}>{post.title}</CommandItem>))}</CommandGroup>))}</CommandList></Command></PopoverContent></Popover></div>
                                <Separator/>
                                <div className="space-y-3"><h4 className="text-sm font-semibold flex items-center gap-2"><Blocks className="h-4 w-4 text-red-500" />Blocking</h4><p className="text-xs text-muted-foreground">Tugas ini menghalangi penyelesaian tugas-tugas berikut.</p>{renderDependencyList(postState.dependencies?.blocking || [], 'blocking')}<Popover><PopoverTrigger asChild><Button variant="outline" size="sm" className="h-7"><Plus className="mr-2 h-3 w-3" />Add...</Button></PopoverTrigger><PopoverContent className="w-80"><Command><CommandInput placeholder="Search posts..." /><CommandList><CommandEmpty>No posts found.</CommandEmpty>{groupedDependencyOptions.map(([brandName, posts]) => (<CommandGroup key={brandName} heading={brandName}>{posts.map(post => (<CommandItem key={post.id} onSelect={() => handleAddDependency(post.id, 'blocking')}>{post.title}</CommandItem>))}</CommandGroup>))}</CommandList></Command></PopoverContent></Popover></div>
                                <Separator/>
                                <div className="space-y-3"><h4 className="text-sm font-semibold flex items-center gap-2"><LinkIcon className="h-4 w-4 text-blue-500" />Linked Posts</h4><p className="text-xs text-muted-foreground">Tugas terkait tapi tidak saling memblokir.</p>{renderDependencyList(postState.dependencies?.linked || [], 'linked')}<Popover><PopoverTrigger asChild><Button variant="outline" size="sm" className="h-7"><Plus className="mr-2 h-3 w-3" />Add...</Button></PopoverTrigger><PopoverContent className="w-80"><Command><CommandInput placeholder="Search posts..." /><CommandList><CommandEmpty>No posts found.</CommandEmpty>{groupedDependencyOptions.map(([brandName, posts]) => (<CommandGroup key={brandName} heading={brandName}>{posts.map(post => (<CommandItem key={post.id} onSelect={() => handleAddDependency(post.id, 'linked')}>{post.title}</CommandItem>))}</CommandGroup>))}</CommandList></Command></PopoverContent></Popover></div>
                            </TabsContent>
                        </Tabs>
                    </div>
                </ScrollArea>
             </div>
        </SheetContent>
    </Sheet>
    
    <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Post Activity Log: {postState?.title}</DialogTitle><DialogDescription>A complete history of all changes made to this post.</DialogDescription></DialogHeader>
            <ScrollArea className="max-h-[60vh] -mx-6 px-6"><div className="space-y-6 py-4">
                {postState.activities && postState.activities.length > 0 ? (getUniqueActivities(postState.activities).slice().sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map((activity) => ( <div key={activity.id} className="flex items-start gap-4"><Avatar className="h-9 w-9"><AvatarImage src={activity.user.avatarUrl} alt={activity.user.name} /><AvatarFallback>{activity.user.name.charAt(0)}</AvatarFallback></Avatar><div><p className="text-sm"><span className="font-semibold">{activity.user.name}</span> {activity.action}.</p><p className="text-xs text-muted-foreground mt-0.5">{formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}</p></div></div> ))) : ( <p className="text-center text-muted-foreground py-8">No activities recorded.</p> )}
            </div></ScrollArea>
        </DialogContent>
    </Dialog>
    
    <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete this post?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the post: <strong className="text-foreground">{postState.title}</strong>. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Yes, Delete Post</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
    </AlertDialog>
    </>
  );
}
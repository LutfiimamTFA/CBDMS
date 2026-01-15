
'use client';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTrigger,
  SheetFooter,
  SheetTitle,
} from '@/components/ui/sheet';
import type { Task, TimeLog, User, Priority, Tag, Subtask, Comment, Attachment, Notification, Activity, Brand, WorkflowStatus, SharedLink, RevisionItem, RevisionCycle, SharedTask, Dependencies, SocialMediaPost } from '@/lib/types';
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
import { priorityInfo, formatLateness } from '@/lib/utils';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AtSign, CalendarIcon, Clock, Edit, FileUp, GitMerge, History, ListTodo, LogIn, MessageSquare, PauseCircle, PlayCircle, Plus, Repeat, Send, TagIcon, Trash, Trash2, Users, Wand2, X, Share2, Star, Link as LinkIcon, Paperclip, MoreHorizontal, Copy, FileImage, FileText, Building2, CheckCircle, AlertCircle, RefreshCcw, UserPlus, Check, ListChecks, Upload, Bold, Italic, Table as TableIcon, List as ListIcon, ListOrdered, UploadCloud, Circle, CircleDashed, XCircle, Workflow, Blocks, RotateCcw } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Separator } from '../ui/separator';
import { useI18n } from '@/context/i18n-provider';
import { Progress } from '../ui/progress';
import { format, formatDistanceToNow, parseISO, isAfter, endOfDay } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Checkbox } from '../ui/checkbox';
import { ScrollArea } from '../ui/scroll-area';
import { validatePriorityChange } from '@/ai/flows/validate-priority-change';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
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
import { ShareTaskDialog } from '../share/share-task-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { Card, CardContent } from '../ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useSharedSession } from '@/context/shared-session-provider';
import { tags as allTags } from '@/lib/data';
import { RichTextEditor } from '../ui/rich-text-editor';
import { deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { usePermissions } from '@/context/permissions-provider';


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

const getFileIcon = (fileName: string): React.ReactElement => {
    if (fileName.match(/\.(pdf)$/i)) return <FileText className="h-5 w-5 text-red-500" />;
    if (fileName.match(/\.(jpg|jpeg|png|gif)$/i)) return <FileImage className="h-5 w-5 text-green-500" />;
    return <FileText className="h-5 w-5 text-muted-foreground" />;
};

const createActivity = (user: User, action: string) => {
  return {
    id: `act-${crypto.randomUUID()}`,
    user: { id: user.id, name: user.name, avatarUrl: user.avatarUrl || '' },
    action: action,
    timestamp: new Date().toISOString(),
  };
};

const formatDate = (date: any): string => {
    if (!date) return 'N/A';
    const dateObj = date.toDate ? date.toDate() : new Date(date);
    if (isNaN(dateObj.getTime())) return 'Invalid date';
    return format(dateObj, 'PP, p');
};
  
const formatHours = (hours: number = 0) => {
    const h = Math.floor(hours);
    const m = Math.floor((hours - h) * 60);
    return `${h}h ${m}m`;
};

const getInitials = (name?: string | null) => {
    if (!name) return 'A';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('');
};

const getCurrentSubmissionCycle = (post: SocialMediaPost | null): number => {
    if (!post) return 1;
    const historyLength = post.revisionHistory?.length ?? 0;
    const currentStatus = post.statusInternal || post.status;
    if (currentStatus === 'Revisi') {
        return historyLength + 1;
    }
    return historyLength > 0 ? historyLength : 1;
};


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

  const isAssignee = !!currentUser && postState.assigneeIds.includes(currentUser.id);
  const isManagerOrAdmin = currentUser && (currentUser.role === 'Manager' || currentUser.role === 'Super Admin');

  const canEditContent = useMemo(() => {
    if (!currentUser) return false;
    const isCreator = currentUser.id === postState.createdBy.id;
    const isManagerOfBrand = currentUser.role === 'Manager' && postState.brandId && (currentUser.brandIds || []).includes(postState.brandId);
    return currentUser.role === 'Super Admin' || isManagerOfBrand || isCreator;
  }, [currentUser, postState]);

  const canUploadDeliverables = useMemo(() => {
    if (!currentUser) return false;
    return isAssignee || isManagerOrAdmin;
  }, [currentUser, isAssignee, isManagerOrAdmin]);

  const canDeleteTask = useMemo(() => {
    if (!currentUser) return false;
    const isCreator = postState.createdBy?.id === currentUser.id;
    if (currentUser.role === 'Super Admin') return true;
    if (currentUser.role === 'Manager') {
        return (currentUser.brandIds || []).includes(postState.brandId);
    }
    return isCreator;
  }, [currentUser, postState]);

  const handleDelete = () => {
    if (!firestore || !postState || !canDeleteTask) return;
    deleteDocumentNonBlocking(doc(firestore, 'socialMediaPosts', postState.id));
    toast({ title: "Post Deleted", description: "The post is being removed." });
    onOpenChange(false);
    setDeleteConfirmOpen(false);
  };
  
  const [isUploading, setIsUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const deliverableFileInputRef = React.useRef<HTMLInputElement>(null);
  const [isGdriveDialogOpen, setIsGdriveDialogOpen] = useState(false);
  const [gdriveLink, setGdriveLink] = useState('');
  const [gdriveName, setGdriveName] = useState('');
  const [gdriveFileType, setGdriveFileType] = useState<'attachment' | 'deliverable'>('attachment');
  
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>, fileType: 'attachment' | 'deliverable') => {
      if (!event.target.files || !storage || !postState?.id || !firestore || !currentUser) return;
      setIsUploading(true);
      try {
          const files = Array.from(event.target.files);
          const currentCycle = getCurrentSubmissionCycle(postState);
          const uploadPromises = files.map(async (file) => {
              const attachmentId = `${Date.now()}-${file.name}`;
              const storageRef = ref(storage, `social-media/${postState.companyId}/${attachmentId}`);
              await uploadBytes(storageRef, file);
              const url = await getDownloadURL(storageRef);
              return { id: attachmentId, name: file.name, type: 'local' as const, url, submittedAt: new Date().toISOString(), submittedBy: { id: currentUser.id, name: currentUser.name, avatarUrl: currentUser.avatarUrl || '' }, forRevisionCycle: fileType === 'deliverable' ? currentCycle : undefined };
          });
          const newFiles = await Promise.all(uploadPromises);
          const currentFiles = fileType === 'attachment' ? (postState.attachments || []) : (postState.deliverables || []);
          await updateDoc(doc(firestore, 'socialMediaPosts', postState.id), { [fileType === 'attachment' ? 'attachments' : 'deliverables']: [...currentFiles, ...newFiles] });
          toast({ title: 'Upload Successful' });
      } catch (error) {
          toast({ variant: 'destructive', title: 'Upload Failed' });
      } finally {
          setIsUploading(false);
          if (event.target) event.target.value = '';
      }
  };

  const handleConfirmGdriveLink = async () => {
    if (!gdriveLink || !gdriveName) {
        toast({ variant: 'destructive', title: 'Missing Info', description: 'Please provide both a link and a name.' });
        return;
    }
    if (!firestore || !currentUser) return;
    
    const currentCycle = getCurrentSubmissionCycle(postState);
    const newFile: Attachment = { id: `gdrive-${Date.now()}`, name: gdriveName, type: 'gdrive', url: gdriveLink, submittedAt: new Date().toISOString(), submittedBy: { id: currentUser.id, name: currentUser.name, avatarUrl: currentUser.avatarUrl || '' }, forRevisionCycle: gdriveFileType === 'deliverable' ? currentCycle : undefined };
    const fieldToUpdate = gdriveFileType === 'attachment' ? 'attachments' : 'deliverables';
    await updateDoc(doc(firestore, 'socialMediaPosts', postState.id), { [fieldToUpdate]: [...(postState[fieldToUpdate] || []), newFile] });
    setIsGdriveDialogOpen(false); setGdriveLink(''); setGdriveName('');
  };
  
  const handleRemoveFile = async (id: string, fileType: 'attachment' | 'deliverable') => {
      if (!firestore) return;
      const fieldToUpdate = fileType === 'attachment' ? 'attachments' : 'deliverables';
      const updatedFiles = (postState[fieldToUpdate] as Attachment[] | undefined)?.filter(att => att.id !== id);
      await updateDoc(doc(firestore, 'socialMediaPosts', postState.id), { [fieldToUpdate]: updatedFiles });
  };
  
  const groupedDeliverables = useMemo(() => {
    const groups: Record<number, Attachment[]> = {};
    (postState.deliverables || []).forEach(d => {
        const cycle = d.forRevisionCycle ?? 1;
        if (!groups[cycle]) groups[cycle] = [];
        groups[cycle].push(d);
    });
    return groups;
  }, [postState.deliverables]);


  const PriorityIcon = priorityInfo[postState.priority]?.icon;

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
                          {canDeleteTask && (
                            <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10" onClick={() => setDeleteConfirmOpen(true)}><Trash2 className="mr-2 h-4 w-4"/>Delete Post</DropdownMenuItem>
                          )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </SheetHeader>
            <div className="flex-1 flex min-h-0">
              <Form {...form}>
              <form id="add-post-form" className='flex-1 flex min-h-0' onSubmit={form.handleSubmit(() => {})}>
                <div className="flex-1 grid md:grid-cols-3 min-h-0">
                    <ScrollArea className="md:col-span-2 h-full">
                        <div className="p-6 space-y-6">
                            <FormField control={form.control} name="title" render={({ field }) => ( <Input {...field} readOnly={!canEditContent} className="text-2xl font-bold border-dashed h-auto p-0 border-0 focus-visible:ring-1"/> )}/>
                            <Accordion type="single" collapsible defaultValue="description">
                                <AccordionItem value="description" className="border-none">
                                    <AccordionTrigger className="text-sm font-semibold flex-row-reverse justify-end gap-2 p-0 hover:no-underline">
                                        {postState.caption ? 'View/Edit Caption' : 'Add Caption'}
                                    </AccordionTrigger>
                                    <AccordionContent className="pt-2">
                                        <FormField control={form.control} name="caption" render={({ field }) => ( <FormItem><FormControl><RichTextEditor value={field.value || ''} onChange={field.onChange} placeholder="Write the post caption here..." readOnly={!canEditContent} /></FormControl><FormMessage /></FormItem> )}/>
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                            
                             <Tabs defaultValue="comments" className="w-full">
                                <TabsList className="grid w-full grid-cols-4 gap-1">
                                  <TabsTrigger value="comments"><MessageSquare className="mr-2"/>Comments</TabsTrigger>
                                  <TabsTrigger value="subtasks"><ListTodo className="mr-2"/>Subtasks</TabsTrigger>
                                  <TabsTrigger value="files"><Paperclip className="mr-2"/>Files</TabsTrigger>
                                  <TabsTrigger value="dependencies"><GitMerge className="mr-2"/>Dependencies</TabsTrigger>
                                </TabsList>
                                <TabsContent value="comments" className="mt-4 space-y-4 rounded-lg border p-4">
                                  <p className="text-center text-muted-foreground text-sm py-8">Comments will be available soon.</p>
                                </TabsContent>
                                <TabsContent value="subtasks" className="mt-4 space-y-4 rounded-lg border p-4">
                                  <p className="text-center text-muted-foreground text-sm py-8">Subtasks will be available soon.</p>
                                </TabsContent>
                                <TabsContent value="files" className="mt-4 space-y-6 rounded-lg border p-4">
                                  <div>
                                    <h4 className="font-medium text-sm mb-2">Deliverables</h4>
                                    <div className="space-y-2">
                                      {Object.entries(groupedDeliverables).sort(([a], [b]) => Number(b) - Number(a)).map(([cycleNum, deliverables]) => ( <div key={`del-${cycleNum}`} className="space-y-2"><h4 className="font-semibold text-xs text-muted-foreground">{Number(cycleNum) === 1 ? 'Initial Submission' : `Revision ${Number(cycleNum)-1} Submission`}</h4>{deliverables.map(att => ( <div key={att.id} className="flex items-center justify-between rounded-md bg-secondary/50 p-2 text-sm"><a href={att.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 truncate hover:underline">{getFileIcon(att.name)}<span className="truncate" title={att.name}>{att.name}</span></a>{canUploadDeliverables && ( <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => handleRemoveFile(att.id, 'deliverable')}><X className="h-4 w-4" /></Button> )}</div> ))}</div> ))}
                                      {(postState.deliverables || []).length === 0 && <p className="text-center text-muted-foreground text-sm py-4">No deliverables submitted.</p>}
                                    </div>
                                    {canUploadDeliverables && (
                                        <div className="flex gap-2 mt-2 pt-4 border-t">
                                            <input type="file" ref={deliverableFileInputRef} onChange={(e) => handleFileChange(e, 'deliverable')} multiple className="hidden" />
                                            <Button type="button" size="sm" variant="outline" className="flex-1" onClick={() => deliverableFileInputRef.current?.click()} disabled={isUploading}>{isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Upload className="mr-2 h-4 w-4" />} Upload Deliverable</Button>
                                            <Button type="button" size="sm" variant="outline" className="flex-1" onClick={() => { setGdriveFileType('deliverable'); setIsGdriveDialogOpen(true); }}><LinkIcon className="mr-2 h-4 w-4" /> Link Deliverable</Button>
                                        </div>
                                    )}
                                  </div>
                                  <Separator/>
                                  <div>
                                    <h4 className="font-medium text-sm mb-2">Supporting Materials</h4>
                                    <div className="space-y-2">{postState.attachments?.map((att) => ( <div key={att.id} className="flex items-center justify-between rounded-md bg-secondary/50 p-2 text-sm"><a href={att.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 truncate hover:underline">{getFileIcon(att.name)}<span className="truncate" title={att.name}>{att.name}</span></a><Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => handleRemoveFile(att.id, 'attachment')}><X className="h-4 w-4" /></Button></div> ))}</div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t mt-4"><input type="file" ref={fileInputRef} onChange={(e) => handleFileChange(e, 'attachment')} multiple className="hidden" /><Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>{isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Upload Material</Button><Button type="button" variant="outline" onClick={() => { setGdriveFileType('attachment'); setIsGdriveDialogOpen(true); }}>Link Material</Button></div>
                                  </div>
                                </TabsContent>
                                <TabsContent value="dependencies" className="mt-4 space-y-6 rounded-lg border p-4">
                                  <p className="text-center text-muted-foreground text-sm py-8">Dependencies will be available soon.</p>
                                </TabsContent>
                            </Tabs>
                        </div>
                    </ScrollArea>
                    <ScrollArea className="md:col-span-1 h-full border-l">
                         <div className="p-6 space-y-6">
                            <div className='space-y-4 p-4 rounded-lg border'>
                                <h3 className='font-semibold text-sm'>Social Media Details</h3>
                                <Separator/>
                                <FormItem className="grid grid-cols-3 items-center gap-2"><FormLabel className="text-muted-foreground">Brand</FormLabel><div className="col-span-2 flex items-center gap-2 text-sm font-medium"><Building2 className="h-4 w-4 text-muted-foreground" />{brands?.find(b => b.id === postState.brandId)?.name || 'N/A'}</div></FormItem>
                                <FormItem className="grid grid-cols-3 items-center gap-2"><FormLabel className="text-muted-foreground">Status</FormLabel><div className="col-span-2 text-sm font-medium">{postState.status}</div></FormItem>
                                <FormItem className="grid grid-cols-3 items-center gap-2"><FormLabel className="text-muted-foreground">Priority</FormLabel><div className="col-span-2 flex items-center gap-2 text-sm font-medium">{PriorityIcon && <PriorityIcon className={`h-4 w-4 ${priorityInfo[postState.priority].color}`} />}{postState.priority}</div></FormItem>
                                <FormItem className="grid grid-cols-3 items-center gap-2"><FormLabel className="text-muted-foreground">Due Date</FormLabel><div className="col-span-2 text-sm font-medium">{postState.dueDate ? format(parseISO(postState.dueDate), 'MMM d, yyyy') : 'No due date'}</div></FormItem>
                                <FormItem className="grid grid-cols-3 items-center gap-2"><FormLabel className="text-muted-foreground">Publish Date</FormLabel><div className="col-span-2 text-sm font-medium">{postState.scheduledAt ? format(parseISO(postState.scheduledAt), 'MMM d, yyyy, p') : 'Not scheduled'}</div></FormItem>
                            </div>

                            <div className='space-y-4 p-4 rounded-lg border'>
                                <h3 className='font-semibold text-sm'>People</h3>
                                <Separator/>
                                <FormItem><FormLabel className="text-muted-foreground text-sm">Created by</FormLabel>
                                 <div className="flex items-center justify-between gap-2"><div className="flex items-center gap-3"><Avatar className="h-8 w-8"><AvatarImage src={postState.createdBy.avatarUrl} /><AvatarFallback>{getInitials(postState.createdBy.name)}</AvatarFallback></Avatar><p className="text-sm font-medium">{postState.createdBy.name}</p></div></div>
                                </FormItem>
                                <FormItem><FormLabel className="text-muted-foreground text-sm">Assignees</FormLabel>
                                {postState.assigneeIds.map(id => {
                                  const user = allUsers?.find(u => u.id === id);
                                  if (!user) return null;
                                  return <div key={user.id} className="flex items-center justify-between gap-2"><div className="flex items-center gap-3"><Avatar className="h-8 w-8"><AvatarImage src={user.avatarUrl} alt={user.name} /><AvatarFallback>{user.name?.charAt(0)}</AvatarFallback></Avatar><p className="text-sm font-medium">{user.name}</p></div></div>
                                })}
                                </FormItem>
                            </div>
                        </div>
                    </ScrollArea>
                </div>
               </form>
             </Form>
            </div>
        </SheetContent>
    </Sheet>
    
    <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Post Activity Log: {postState?.title}</DialogTitle><DialogDescription>A complete history of all changes made to this post.</DialogDescription></DialogHeader>
            <ScrollArea className="max-h-[60vh] -mx-6 px-6"><div className="space-y-6 py-4">
                {postState.activities && postState.activities.length > 0 ? (getUniqueActivities(postState.activities).slice().sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map((activity) => ( <div key={activity.id} className="flex items-start gap-4"><Avatar className="h-9 w-9"><AvatarImage src={activity.user.avatarUrl} alt={activity.user.name} /><AvatarFallback>{activity.user.name.charAt(0)}</AvatarFallback></Avatar><div><p className="text-sm"><span className="font-semibold">{activity.user.name}</span> {activity.action}.</p><p className="text-xs text-muted-foreground mt-0.5">{formatDate(activity.timestamp)}</p></div></div> ))) : ( <p className="text-center text-muted-foreground py-8">No activities recorded.</p> )}
            </div></ScrollArea>
        </DialogContent>
       </Dialog>
    
    <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete this post?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the post: <strong className="text-foreground">{postState.title}</strong>. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Yes, Delete Post</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
    </AlertDialog>
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
                <Button onClick={() => handleConfirmGdriveLink(gdriveFileType)}>Add Link</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    </>
  );
}

// Helper to remove duplicate activities by ID, keeping the latest one.
const getUniqueActivities = (activities: Activity[]): Activity[] => {
  if (!activities) return [];
  const activityMap = new Map<string, Activity>();
  activities.forEach(activity => {
      activityMap.set(activity.id, activity);
  });
  return Array.from(activityMap.values());
};

    
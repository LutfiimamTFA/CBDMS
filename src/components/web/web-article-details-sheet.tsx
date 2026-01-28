
'use client';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { WebArticle, User, Brand, WorkflowStatus, RevisionItem, RevisionCycle, Dependencies, Comment, Attachment, Subtask, Notification, Activity } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
} from '@/components/ui/form';
import { priorityInfo, getInitials, getFileIcon } from '@/lib/utils';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Loader2, Plus, XCircle, HelpCircle, History, Link as LinkIcon, Paperclip, MoreHorizontal, Copy, FileImage, FileText, Building2, CheckCircle, AlertCircle, RefreshCcw, UserPlus, Check, ListChecks, Upload, Workflow, Blocks, Send, GitMerge, ListTodo, MessageSquare, Trash, Trash2, CalendarIcon, Clock, Timer, RotateCcw } from 'lucide-react';
import { Separator } from '../ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useCollection, useFirestore, useUserProfile, useStorage } from '@/firebase';
import { collection, serverTimestamp, writeBatch, doc, query, where, orderBy, updateDoc, deleteField } from 'firebase/firestore';
import { RichTextEditor } from '../ui/rich-text-editor';
import { ScrollArea } from '../ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Checkbox } from '../ui/checkbox';
import { Popover, PopoverTrigger, PopoverContent } from '../ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Calendar } from '../ui/calendar';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/context/permissions-provider';

const articleSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  brandId: z.string().min(1, 'Brand is required'),
  content: z.string().optional(),
  priority: z.enum(['Urgent', 'High', 'Medium', 'Low']),
  assigneeIds: z.array(z.string()).min(1, 'At least one assignee is required'),
  startDate: z.date().optional(),
  dueDate: z.date().optional(),
  timeEstimate: z.coerce.number().min(0).optional(),
});

type ArticleFormValues = z.infer<typeof articleSchema>;

interface WebArticleDetailsSheetProps {
  article: WebArticle;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const createActivity = (user: User, action: string): Activity => {
  return {
    id: `act-${crypto.randomUUID()}`,
    user: { id: user.id, name: user.name, avatarUrl: user.avatarUrl || '' },
    action: action,
    timestamp: new Date().toISOString(),
  };
};

const getCurrentSubmissionCycle = (article: WebArticle | null): number => {
    if (!article) return 1;
    const historyLength = article.revisionHistory?.length ?? 0;
    if (article.statusInternal === 'Revisi') {
        return historyLength + 1;
    }
    return historyLength > 0 ? historyLength : 1;
};

interface RevisionState {
  isOpen: boolean;
  item: WebArticle | null;
  items: Omit<RevisionItem, 'id' | 'completed'>[];
  currentItemText: string;
}

export function WebArticleDetailsSheet({ 
  article: initialArticle, 
  open,
  onOpenChange,
}: WebArticleDetailsSheetProps) {
  const { toast } = useToast();
  
  const [articleState, setArticleState] = useState(initialArticle);
  useEffect(() => { setArticleState(initialArticle) }, [initialArticle]);
  
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isDeleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [revisionState, setRevisionState] = useState<RevisionState>({ isOpen: false, item: null, items: [], currentItemText: '' });
  
  const firestore = useFirestore();
  const { user: authUser, profile: currentUser } = useUserProfile();
  const { permissions } = usePermissions();

  const allArticlesQuery = useMemo(() => {
    if (!firestore || !currentUser) return null;
    return query(collection(firestore, 'webArticles'), where('companyId', '==', currentUser.companyId));
  }, [firestore, currentUser]);
  const { data: allArticles } = useCollection<WebArticle>(allArticlesQuery);
  
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

  const statusesQuery = useMemo(() => {
    if(!firestore) return null;
    return query(collection(firestore, 'webStatuses'), orderBy('order'))
  }, [firestore]);
  const { data: statuses } = useCollection<WorkflowStatus>(statusesQuery);
  
  const isAssignee = useMemo(() => !!currentUser && articleState.assigneeIds.includes(currentUser.id), [currentUser, articleState.assigneeIds]);
  const isManagerOrAdmin = useMemo(() => currentUser && (currentUser.role === 'Manager' || currentUser.role === 'Super Admin'), [currentUser]);
  const isEmployeeOrPIC = useMemo(() => currentUser && (currentUser.role === 'Employee' || currentUser.role === 'PIC'), [currentUser]);

  const canEditContent = useMemo(() => {
    if (!currentUser) return false;
    const isCreator = currentUser.id === articleState.createdBy.id;
    const isManagerOfBrand = currentUser.role === 'Manager' && articleState.brandId && (currentUser.brandIds || []).includes(articleState.brandId);
    return currentUser.role === 'Super Admin' || isManagerOfBrand || isCreator;
  }, [currentUser, articleState]);

  const canDelete = useMemo(() => {
    if (!currentUser) return false;
    return currentUser.role === 'Super Admin' || currentUser.role === 'Manager' || currentUser.id === articleState.createdBy.id;
  }, [currentUser, articleState]);

  const handleStatusChange = useCallback(async (newStatus: string) => {
    const oldStatus = articleState.statusInternal;
    if (oldStatus === newStatus || !firestore || !currentUser) return;

    setArticleState(prev => ({ ...prev, statusInternal: newStatus }));

    const batch = writeBatch(firestore);
    const articleRef = doc(firestore, 'webArticles', articleState.id);
    const newActivity = createActivity(currentUser, `changed status from "${oldStatus}" to "${newStatus}"`);
    
    const updates: any = {
      statusInternal: newStatus,
      activities: [...(articleState.activities || []), newActivity],
      lastActivity: newActivity,
      updatedAt: serverTimestamp()
    };
    batch.update(articleRef, updates);

    const notificationTitle = `Status Changed: ${articleState.title}`;
    const notificationMessage = `${currentUser.name} changed status to ${newStatus}.`;
    const notifiedUserIds = new Set<string>();
    articleState.assigneeIds.forEach(id => { if (id !== currentUser.id) notifiedUserIds.add(id); });
    if (articleState.createdBy.id !== currentUser.id) notifiedUserIds.add(articleState.createdBy.id);

    notifiedUserIds.forEach(userId => {
      const notifRef = doc(collection(firestore, `users/${userId}/notifications`));
      batch.set(notifRef, {
        userId,
        title: notificationTitle,
        message: notificationMessage,
        entityId: articleState.id,
        entityType: 'webArticle',
        workstream: 'web',
        isRead: false,
        createdAt: serverTimestamp(),
        createdBy: { id: currentUser.id, name: currentUser.name, avatarUrl: currentUser.avatarUrl || '' }
      });
    });

    try {
      await batch.commit();
      toast({ title: 'Status Updated' });
    } catch (error) {
      console.error('Failed to update status:', error);
      setArticleState(prev => ({ ...prev, statusInternal: oldStatus })); 
      toast({ variant: 'destructive', title: 'Update Failed' });
    }
  }, [firestore, currentUser, articleState, toast]);

  useEffect(() => {
    if (open && isAssignee && articleState.statusInternal === 'To Do') {
      handleStatusChange('Doing');
    }
  }, [open, isAssignee, articleState.statusInternal, handleStatusChange]);


  const handleDelete = () => {
    if (!firestore || !articleState || !canDelete) return;
    deleteDocumentNonBlocking(doc(firestore, 'webArticles', articleState.id));
    toast({ title: "Article Deleted", description: "The article is being removed." });
    onOpenChange(false);
    setDeleteConfirmOpen(false);
  };
  
  const handleConfirmRejection = async () => {
    if (!revisionState.item || revisionState.items.length === 0 || !firestore || !currentUser) {
        toast({ variant: 'destructive', title: 'Checklist Empty', description: 'Please add at least one revision point.' });
        return;
    }
    setIsSaving(true);
    const item = revisionState.item;
    const itemRef = doc(firestore, 'webArticles', item.id);
    const newStatus = 'Revisi';
    
    const newRevisionItems: RevisionItem[] = revisionState.items.map(revItem => ({ id: crypto.randomUUID(), text: revItem.text, completed: false }));
    
    const newRevisionCycle: RevisionCycle = {
        cycleNumber: (item.revisionHistory?.length ?? 0) + 1,
        requestedAt: new Date().toISOString() as any,
        requestedBy: { id: currentUser.id, name: currentUser.name, avatarUrl: currentUser.avatarUrl || '' },
        items: newRevisionItems,
    };
    
    const itemUpdateData: any = {
        statusInternal: newStatus,
        revisionItems: newRevisionItems,
        revisionHistory: [...(item.revisionHistory || []), newRevisionCycle],
        lastActivity: createActivity(currentUser, `requested revisions and moved item to "${newStatus}"`),
        updatedAt: serverTimestamp() as any,
    };
    itemUpdateData['activities'] = [...(item.activities || []), itemUpdateData.lastActivity];
    
    try {
        await updateDoc(itemRef, itemUpdateData);
        toast({ title: 'Revisions Requested', description: 'The item has been sent for revision.' });
    } catch (error) {
        toast({ variant: 'destructive', title: 'Update Failed', description: 'Could not send item for revision.' });
    } finally {
        setIsSaving(false);
        setRevisionState({ isOpen: false, item: null, items: [], currentItemText: '' });
    }
  };

  const handleAddRevisionItem = () => {
    if (revisionState.currentItemText.trim()) {
        setRevisionState(prev => ({
            ...prev,
            items: [...prev.items, { text: prev.currentItemText }],
            currentItemText: '',
        }));
    }
  };

  const PriorityIcon = priorityInfo[articleState.priority]?.icon;
  
  return (
    <>
    <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="flex flex-col p-0 h-screen w-screen max-w-full">
            <SheetHeader className="p-4 border-b flex-shrink-0">
                <SheetTitle className='sr-only'>Article Details for {articleState.title}</SheetTitle>
                <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                        {articleState.createdBy && `Created by ${articleState.createdBy.name}`}
                    </p>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="sm"><MoreHorizontal className="h-4 w-4"/></Button></DropdownMenuTrigger>
                      <DropdownMenuContent>
                          <DropdownMenuItem onClick={() => setIsHistoryOpen(true)}><History className="mr-2 h-4 w-4"/>View History</DropdownMenuItem>
                          {canDelete && (
                            <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10" onClick={() => setDeleteConfirmOpen(true)}><Trash2 className="mr-2 h-4 w-4"/>Delete Article</DropdownMenuItem>
                          )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </SheetHeader>
            <div className="flex-1 flex min-h-0">
              <form id="edit-article-form" className='flex-1 flex min-h-0'>
                <div className="flex-1 grid md:grid-cols-3 min-h-0">
                    <ScrollArea className="md:col-span-2 h-full">
                        <div className="p-6 space-y-6">
                           <Input value={articleState.title} readOnly={!canEditContent} className="text-2xl font-bold border-dashed h-auto p-0 border-0 focus-visible:ring-1"/>
                           {(articleState.statusInternal === 'Revisi') && articleState.revisionItems && articleState.revisionItems.length > 0 && (
                                 <div className="space-y-4 rounded-lg border border-orange-500/50 bg-orange-500/10 p-4">
                                     <h3 className="font-semibold flex items-center gap-2 text-orange-600 dark:text-orange-400"><RefreshCcw className="h-5 w-5"/> Revision Checklist</h3>
                                     <div className="space-y-2">
                                         {articleState.revisionItems.map(item => (
                                             <div key={item.id} className="flex items-center gap-3">
                                                 <Checkbox id={`rev-${item.id}`} checked={item.completed} disabled={!isAssignee} />
                                                 <label htmlFor={`rev-${item.id}`} className={`flex-1 text-sm ${item.completed ? 'line-through text-muted-foreground' : ''}`}>{item.text}</label>
                                             </div>
                                         ))}
                                     </div>
                                 </div>
                             )}
                           <RichTextEditor value={articleState.content || ''} onChange={() => {}} placeholder="Write your article content here..." readOnly={!canEditContent} />
                        </div>
                    </ScrollArea>
                    <ScrollArea className="md:col-span-1 h-full border-l">
                         <div className="p-6 space-y-6">
                            <div className='space-y-4 p-4 rounded-lg border'>
                                <h3 className='font-semibold text-sm'>Article Details</h3>
                                <Separator/>
                                <div className="grid grid-cols-3 items-center gap-2"><Label className="text-muted-foreground">Brand</Label><div className="col-span-2 flex items-center gap-2 text-sm font-medium"><Building2 className="h-4 w-4 text-muted-foreground" />{brands?.find(b => b.id === articleState.brandId)?.name || 'N/A'}</div></div>
                                <div className="grid grid-cols-3 items-center gap-2"><Label className="text-muted-foreground">Status</Label><div className="col-span-2 text-sm font-medium">{articleState.statusInternal}</div></div>
                                <div className="grid grid-cols-3 items-center gap-2">
                                    <Label className="text-muted-foreground">Priority</Label>
                                    <div className="col-span-2 flex items-center gap-2 text-sm font-medium">
                                        {PriorityIcon && <PriorityIcon className={`h-4 w-4 ${priorityInfo[articleState.priority].color}`} />}{' '}
                                        {articleState.priority}
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 items-center gap-2"><Label className="text-muted-foreground">Due Date</Label><div className="col-span-2 text-sm font-medium">{articleState.dueDate ? format(parseISO(articleState.dueDate), 'MMM d, yyyy') : 'No due date'}</div></div>
                            </div>
                         </div>
                    </ScrollArea>
                </div>
               </form>
            </div>
        </SheetContent>
    </Sheet>
    
    <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete this article?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the article: <strong className="text-foreground">{articleState.title}</strong>. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Yes, Delete Article</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
    </AlertDialog>
    
    <Dialog open={revisionState.isOpen} onOpenChange={(open) => !open && setRevisionState({ isOpen: false, item: null, items: [], currentItemText: '' })}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Create Revision Checklist</DialogTitle>
                <DialogDescription>
                  Revisions for item: <span className="font-bold text-foreground">{revisionState.item?.title}</span>
                </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
                <div className="space-y-2">
                    {revisionState.items.map((item, index) => (
                        <div key={index} className="flex items-center gap-2 bg-secondary p-2 rounded-md">
                            <span className="flex-1 text-sm">{item.text}</span>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setRevisionState(prev => ({...prev, items: prev.items.filter((_, i) => i !== index)}))}><XCircle className="h-4 w-4" /></Button>
                        </div>
                    ))}
                </div>
                <div className="flex items-center gap-2">
                    <Input 
                        value={revisionState.currentItemText}
                        onChange={(e) => setRevisionState(prev => ({...prev, currentItemText: e.target.value}))}
                        placeholder="e.g., Fix the typo in paragraph 2"
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddRevisionItem())}
                    />
                    <Button onClick={handleAddRevisionItem} disabled={!revisionState.currentItemText.trim()}>
                        <Plus className="mr-2 h-4 w-4"/> Add
                    </Button>
                </div>
            </div>
            <DialogFooter>
                <Button variant="ghost" onClick={() => setRevisionState({ isOpen: false, item: null, items: [], currentItemText: '' })}>Cancel</Button>
                <Button variant="destructive" onClick={handleConfirmRejection} disabled={isSaving || revisionState.items.length === 0}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Request Revisions
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    </>
  );
}

    
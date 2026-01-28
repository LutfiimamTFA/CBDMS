
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
  DropdownMenuSeparator
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
import { priorityInfo, getInitials, getFileIcon, formatHours } from '@/lib/utils';
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Loader2, Plus, XCircle, HelpCircle, History, Link as LinkIcon, Paperclip, MoreHorizontal, Copy, FileImage, FileText, Building2, CheckCircle, AlertCircle, RefreshCcw, UserPlus, Check, ListChecks, Upload, Workflow, Blocks, Send, GitMerge, ListTodo, MessageSquare, Trash, Trash2, CalendarIcon, Clock, Timer, RotateCcw, X } from 'lucide-react';
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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
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

interface FinalReviewState {
  isOpen: boolean;
  item: WebArticle | null;
}

type BlockingReason = {
  blocked: boolean;
  title: string;
  reasons: string[];
  suggestion?: string;
};

const formatDate = (date: any): string => {
    if (!date) return 'N/A';
    const dateObj = date.toDate ? date.toDate() : new Date(date);
    if (isNaN(dateObj.getTime())) return 'Invalid date';
    return format(dateObj, 'PP, p');
};

// Helper to remove duplicate activities by ID, keeping the latest one.
const getUniqueActivities = (activities: Activity[]): Activity[] => {
  if (!activities) return [];
  const activityMap = new Map<string, Activity>();
  activities.forEach(activity => {
      activityMap.set(activity.id, activity);
  });
  return Array.from(activityMap.values());
};


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
  const [finalReviewState, setFinalReviewState] = useState<FinalReviewState>({ isOpen: false, item: null });
  const [blockingAlert, setBlockingAlert] = useState<BlockingReason>({ isOpen: false, blocked: false, title: '', reasons: [], suggestion: '' });

  const [newComment, setNewComment] = useState('');
  const [isMentioning, setIsMentioning] = useState(false);
  const [mentionSuggestions, setMentionSuggestions] = useState<User[]>([]);
  
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newSubtaskAssignee, setNewSubtaskAssignee] = useState<UserType | null>(null);

  const [isGdriveDialogOpen, setIsGdriveDialogOpen] = useState(false);
  const [gdriveLink, setGdriveLink] = useState('');
  const [gdriveName, setGdriveName] = useState('');
  const [gdriveFileType, setGdriveFileType] = useState<'attachment' | 'deliverable'>('attachment');
  const [isUploading, setIsUploading] = useState(false);

  const firestore = useFirestore();
  const storage = useStorage();
  const { user: authUser, profile: currentUser } = useUserProfile();
  const { permissions, isLoading: arePermsLoading } = usePermissions();
  
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  const { data: brands } = useCollection<Brand>(brandsQuery);

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
  
  const canSubmit = useMemo(() => {
    if (!articleState || !isEmployeeOrPIC) return false;
    
    const allSubtasksCompleted = (articleState.subtasks || []).every(st => st.completed);
    if (!allSubtasksCompleted) return false;
    
    const nonSubmittableStatuses = ['Preview', 'Done'];
    if (nonSubmittableStatuses.includes(articleState.statusInternal)) return false;

    return true;
}, [articleState, isEmployeeOrPIC]);

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

  const handleToggleRevisionItem = async (itemId: string) => {
    if (!isAssignee || !firestore) return;
    const newItems = (articleState.revisionItems || []).map(item =>
      item.id === itemId ? { ...item, completed: !item.completed } : item
    );
    await updateDoc(doc(firestore, 'webArticles', articleState.id), { revisionItems: newItems });
  };
  
  const getBlockingReasonsForStatusChange = (targetStatus: string, currentItem: WebArticle): BlockingReason => {
    const reasons: string[] = [];
    if (targetStatus === 'Preview') {
        if (!currentItem.content || currentItem.content.length < 50) reasons.push("Content is too short or empty.");
        const allSubtasksCompleted = (currentItem.subtasks || []).every(st => st.completed);
        if (!allSubtasksCompleted) reasons.push("Complete all subtasks first.");
        if (reasons.length > 0) {
            return { blocked: true, title: "Not Ready for Review", reasons, suggestion: "Please complete the items above before submitting for review." };
        }
    }
    if (isEmployeeOrPIC && targetStatus === 'Done') {
        return { blocked: true, title: "Action Not Allowed", reasons: ["Only Managers can complete articles."], suggestion: "Change status to 'Preview' for manager review." };
    }
    return { blocked: false, title: '', reasons: [] };
  };

  const handleSubmitForReview = async () => {
    if (!currentUser) return;
    await handleStatusChange('Preview');
  };
  
  const handleRecallSubmission = async () => {
    if (!currentUser) return;
    await handleStatusChange('Doing');
    toast({ title: "Submission Recalled", description: "You can continue working on the article." });
  };
  
  const handleFinalReviewAndComplete = async () => {
    if (!isManagerOrAdmin || !articleState) return;
    await handleStatusChange('Done');
    setFinalReviewState({ isOpen: false, item: null });
  };

  const handleReopenTask = async () => {
    if (!currentUser || !isManagerOrAdmin) return;
    await handleStatusChange('Revisi');
  }

  const PriorityIcon = priorityInfo[articleState.priority]?.icon;

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
      if (!event.target.files || !storage || !articleState?.id || !firestore || !currentUser) return;
      setIsUploading(true);
      try {
          const files = Array.from(event.target.files);
          const uploadPromises = files.map(async (file) => {
              const attachmentId = `${Date.now()}-${file.name}`;
              const storageRef = ref(storage, `attachments/web-articles/${articleState.id}/${attachmentId}`);
              await uploadBytes(storageRef, file);
              const url = await getDownloadURL(storageRef);
              return { id: attachmentId, name: file.name, type: 'local' as const, url, submittedAt: new Date().toISOString(), submittedBy: { id: currentUser.id, name: currentUser.name, avatarUrl: currentUser.avatarUrl || '' }};
          });
          const newFiles = await Promise.all(uploadPromises);
          await updateDoc(doc(firestore, 'webArticles', articleState.id), { attachments: [...(articleState.attachments || []), ...newFiles] });
          toast({ title: 'Upload Successful' });
      } catch (error) {
          toast({ variant: 'destructive', title: 'Upload Failed' });
      } finally {
          setIsUploading(false);
          if (event.target) event.target.value = '';
      }
  };

  const handleConfirmGdriveLink = async () => {
    if (!gdriveLink || !gdriveName) { toast({ variant: 'destructive', title: 'Missing Info' }); return; }
    if (!firestore || !currentUser) return;
    
    const newFile: Attachment = { id: `gdrive-${Date.now()}`, name: gdriveName, type: 'gdrive', url: gdriveLink, submittedAt: new Date().toISOString(), submittedBy: { id: currentUser.id, name: currentUser.name, avatarUrl: currentUser.avatarUrl || '' }};
    await updateDoc(doc(firestore, 'webArticles', articleState.id), { attachments: [...(articleState.attachments || []), newFile] });
    setIsGdriveDialogOpen(false); setGdriveLink(''); setGdriveName('');
  };
  
  const handleRemoveFile = async (id: string) => {
      if (!firestore) return;
      await updateDoc(doc(firestore, 'webArticles', articleState.id), { attachments: articleState.attachments?.filter(att => att.id !== id) });
  };
  
  const handleAddSubtask = async () => {
    if (!newSubtaskTitle.trim() || !firestore) return;
    const newSubtask: Subtask = {
      id: `sub-${Date.now()}`,
      title: newSubtaskTitle,
      completed: false,
      ...(newSubtaskAssignee && { assignee: { id: newSubtaskAssignee.id, name: newSubtaskAssignee.name, avatarUrl: newSubtaskAssignee.avatarUrl || '' } }),
    };
    const updatedSubtasks = [...(articleState.subtasks || []), newSubtask];
    await updateDoc(doc(firestore, 'webArticles', articleState.id), { subtasks: updatedSubtasks });
    setNewSubtaskTitle('');
    setNewSubtaskAssignee(null);
  };

  const handleToggleSubtask = async (subtaskId: string) => {
    if (!firestore) return;
    const updatedSubtasks = (articleState.subtasks || []).map(st => st.id === subtaskId ? { ...st, completed: !st.completed } : st);
    await updateDoc(doc(firestore, 'webArticles', articleState.id), { subtasks: updatedSubtasks });
  };

  const handleRemoveSubtask = async (subtaskId: string) => {
    if (!firestore) return;
    const updatedSubtasks = (articleState.subtasks || []).filter(st => st.id !== subtaskId);
    await updateDoc(doc(firestore, 'webArticles', articleState.id), { subtasks: updatedSubtasks });
  };
  
  const handlePostComment = async () => {
    if (!newComment.trim() || !firestore || !currentUser) return;
    try {
      const newCommentData: Comment = {
        id: crypto.randomUUID(),
        user: {
          id: currentUser.id, name: currentUser.name, avatarUrl: currentUser.avatarUrl || '',
          email: currentUser.email, role: currentUser.role, companyId: currentUser.companyId, createdAt: currentUser.createdAt
        },
        text: newComment,
        timestamp: new Date().toISOString(),
        replies: [],
      };

      const newActivity = createActivity(currentUser, `commented: "${newComment.substring(0, 50)}..."`);
      const updates = {
        comments: [...(articleState.comments || []), newCommentData],
        activities: [...(articleState.activities || []), newActivity],
        lastActivity: newActivity,
      };

      await updateDoc(doc(firestore, 'webArticles', articleState.id), updates);
      toast({ title: 'Comment Posted' });
      setNewComment('');
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Comment Failed', description: error.message });
    }
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

  const handleMentionSelect = (user: User) => {
    const currentComment = newComment;
    const atIndex = currentComment.lastIndexOf('@');
    const newCommentText = `${currentComment.substring(0, atIndex)}@${user.name.split(' ')[0]} `;
    setNewComment(newCommentText);
    setIsMentioning(false);
  };
  
  const handleAddDependency = async (articleId: string, type: keyof Dependencies) => {
    if (!firestore) return;
    const currentDeps = articleState.dependencies?.[type] || [];
    if (!currentDeps.includes(articleId)) {
        await updateDoc(doc(firestore, 'webArticles', articleState.id), { [`dependencies.${type}`]: [...currentDeps, articleId] });
    }
  };
  
  const handleRemoveDependency = async (articleId: string, type: keyof Dependencies) => {
    if (!firestore) return;
    const currentDeps = articleState.dependencies?.[type] || [];
    await updateDoc(doc(firestore, 'webArticles', articleState.id), { [`dependencies.${type}`]: currentDeps.filter(id => id !== articleId) });
  };
  
  const dependencyOptions = useMemo(() => (allArticles || []).filter(p => p.id !== articleState.id), [allArticles, articleState.id]);
  const groupedDependencyOptions = useMemo(() => {
      const grouped: Record<string, WebArticle[]> = {};
      dependencyOptions.forEach(article => {
          const brandName = brands?.find(b => b.id === article.brandId)?.name || 'Unbranded';
          if (!grouped[brandName]) grouped[brandName] = [];
          grouped[brandName].push(article);
      });
      return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
  }, [dependencyOptions, brands]);
  
  const renderDependencyList = (ids: string[], type: keyof Dependencies) => (
    <div className="flex flex-wrap gap-2">
        {(ids || []).map(id => {
            const article = allArticles?.find(p => p.id === id);
            return article ? (
                <Badge key={id} variant="secondary">
                    {article.title}
                    {canEditContent && (
                        <button onClick={() => handleRemoveDependency(id, type)} className="ml-2 rounded-full hover:bg-background/50 p-0.5"><X className="h-3 w-3" /></button>
                    )}
                </Badge>
            ) : null;
        })}
    </div>
  );

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
                                                 <Checkbox id={`rev-${item.id}`} checked={item.completed} disabled={!isAssignee} onCheckedChange={() => handleToggleRevisionItem(item.id)} />
                                                 <label htmlFor={`rev-${item.id}`} className={`flex-1 text-sm ${item.completed ? 'line-through text-muted-foreground' : ''}`}>{item.text}</label>
                                             </div>
                                         ))}
                                     </div>
                                 </div>
                             )}
                           <RichTextEditor value={articleState.content || ''} onChange={() => {}} placeholder="Write your article content here..." readOnly={!canEditContent} />
                             <Tabs defaultValue="comments" className="w-full">
                                <TabsList className="grid w-full grid-cols-4">
                                  <TabsTrigger value="comments"><MessageSquare className="mr-2"/>Comments</TabsTrigger>
                                  <TabsTrigger value="subtasks"><ListTodo className="mr-2"/>Subtasks</TabsTrigger>
                                  <TabsTrigger value="files"><Paperclip className="mr-2"/>Files</TabsTrigger>
                                  <TabsTrigger value="dependencies"><GitMerge className="mr-2"/>Dependencies</TabsTrigger>
                                </TabsList>
                                <TabsContent value="comments" className="mt-4 space-y-4 rounded-lg border p-4 relative">
                                    <ScrollArea className="max-h-48 pr-2">
                                        <div className="space-y-4">
                                            {(articleState.comments || []).map((comment) => ( <div key={comment.id} className="flex items-start gap-3"><Avatar className="h-8 w-8"><AvatarImage src={comment.user.avatarUrl}/><AvatarFallback>{getInitials(comment.user.name)}</AvatarFallback></Avatar><div><p className="text-sm font-medium">{comment.user.name} <span className="text-xs text-muted-foreground font-normal">{formatDistanceToNow(parseISO(comment.timestamp), { addSuffix: true })}</span></p><div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: comment.text }} /></div></div> ))}
                                            {(articleState.comments || []).length === 0 && <p className="text-center text-muted-foreground text-sm py-8">No comments yet. Start the conversation!</p>}
                                        </div>
                                    </ScrollArea>
                                    <div className="flex items-start gap-2 pt-4 border-t">
                                        <Avatar className="h-9 w-9"><AvatarImage src={currentUser?.avatarUrl} /><AvatarFallback>{getInitials(currentUser?.name)}</AvatarFallback></Avatar>
                                        <div className="flex-1 relative">
                                            <RichTextEditor value={newComment} onChange={setNewComment} placeholder="Write a comment... (use '@' to mention)" minHeight={100} />
                                            {isMentioning && ( <div className="absolute bottom-full mb-2 w-full max-h-48 overflow-y-auto border bg-background rounded-md shadow-lg z-10"><Command><CommandList>{mentionSuggestions.map(user => ( <CommandItem key={user.id} onSelect={() => handleMentionSelect(user)}><Avatar className="h-6 w-6 mr-2"><AvatarImage src={user.avatarUrl}/><AvatarFallback>{getInitials(user.name)}</AvatarFallback></Avatar>{user.name}</CommandItem> ))}</CommandList></Command></div> )}
                                        </div>
                                        <Button type="button" onClick={handlePostComment} disabled={!newComment.trim()}><Send className="h-4 w-4"/></Button>
                                    </div>
                                </TabsContent>
                                <TabsContent value="subtasks" className="mt-4 space-y-4 rounded-lg border p-4">
                                  {/* Subtask content here */}
                                </TabsContent>
                                <TabsContent value="files" className="mt-4 space-y-4 rounded-lg border p-4">
                                    {/* Files content here */}
                                </TabsContent>
                                <TabsContent value="dependencies" className="mt-4 space-y-6 rounded-lg border p-4">
                                    {/* Dependencies content here */}
                                </TabsContent>
                            </Tabs>
                        </div>
                    </ScrollArea>
                    <ScrollArea className="md:col-span-1 h-full border-l">
                         <div className="p-6 space-y-6">
                            {/* Action buttons */}
                             {(isAssignee && !isManagerOrAdmin) && (
                                <div className="space-y-2">
                                {articleState.statusInternal === 'Preview' ? ( <Button className="w-full" variant="outline" onClick={handleRecallSubmission} disabled={isSaving}><RotateCcw className="mr-2 h-4 w-4" />Recall Submission</Button> ) : ( <Button className="w-full" onClick={handleSubmitForReview} disabled={!canSubmit || isSaving}><Check className="mr-2 h-4 w-4"/>Submit for Review</Button> )}
                                </div>
                            )}
                             {isManagerOrAdmin && articleState.statusInternal === 'Preview' && ( <div className="flex flex-col w-full gap-2"><Button className="w-full bg-green-600 hover:bg-green-700" onClick={() => setFinalReviewState({ isOpen: true, item: articleState })} disabled={isSaving}><CheckCircle className="mr-2 h-4 w-4"/>Approve and Complete</Button><Button variant="outline" className="w-full text-destructive border-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setRevisionState({ isOpen: true, item: articleState, items: [], currentItemText: '' })} disabled={isSaving}><XCircle className="mr-2 h-4 w-4"/> Request Revisions</Button></div> )}
                             {isManagerOrAdmin && articleState.statusInternal === 'Done' && ( <Button className="w-full" variant="outline" onClick={handleReopenTask} disabled={isSaving}>{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}<RefreshCcw className="mr-2 h-4 w-4" />Reopen Article</Button> )}

                            {/* Details Panel */}
                            <div className='space-y-4 p-4 rounded-lg border'>
                                <h3 className='font-semibold text-sm'>Article Details</h3>
                                <Separator/>
                                <div className="grid grid-cols-3 items-center gap-2"><Label className="text-muted-foreground">Brand</Label><div className="col-span-2 flex items-center gap-2 text-sm font-medium"><Building2 className="h-4 w-4 text-muted-foreground" />{brands?.find(b => b.id === articleState.brandId)?.name || 'N/A'}</div></div>
                                <div className="grid grid-cols-3 items-center gap-2"><Label className="text-muted-foreground">Status</Label><div className="col-span-2"><Select onValueChange={(value) => handleStatusChange(value)} value={articleState.statusInternal}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{statuses?.map(status => <SelectItem key={status.id} value={status.name}>{status.name}</SelectItem>)}</SelectContent></Select></div></div>
                                <div className="grid grid-cols-3 items-center gap-2"><Label className="text-muted-foreground">Priority</Label><div className="col-span-2 flex items-center gap-2 text-sm font-medium">{PriorityIcon && <PriorityIcon className={`h-4 w-4 ${priorityInfo[articleState.priority].color}`} />}{articleState.priority}</div></div>
                                <div className="grid grid-cols-3 items-center gap-2"><Label className="text-muted-foreground">Due Date</Label><div className="col-span-2 text-sm font-medium">{articleState.dueDate ? format(parseISO(articleState.dueDate), 'MMM d, yyyy') : 'No due date'}</div></div>
                            </div>
                            
                            {/* People Panel */}
                            <div className='space-y-4 p-4 rounded-lg border'>
                                <h3 className='font-semibold text-sm'>People</h3>
                                <Separator/>
                                {articleState.createdBy && (
                                  <div><Label className="text-muted-foreground text-sm">Created by</Label><div className="flex items-center gap-3 mt-1"><Avatar className="h-8 w-8"><AvatarImage src={articleState.createdBy.avatarUrl} /><AvatarFallback>{getInitials(articleState.createdBy.name)}</AvatarFallback></Avatar><p className="text-sm font-medium">{articleState.createdBy.name}</p></div></div>
                                )}
                                <div>
                                  <Label className="text-muted-foreground text-sm">Assignees</Label>
                                  {(articleState.assignees || []).map(user => ( <div key={user.id} className="flex items-center gap-3 mt-1"><Avatar className="h-8 w-8"><AvatarImage src={user.avatarUrl} /><AvatarFallback>{getInitials(user.name)}</AvatarFallback></Avatar><p className="text-sm font-medium">{user.name}</p></div> ))}
                                </div>
                            </div>

                         </div>
                    </ScrollArea>
                </div>
               </form>
            </div>
        </SheetContent>
    </Sheet>
    </>
  );
}

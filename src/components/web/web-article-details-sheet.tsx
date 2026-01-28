
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
import { Loader2, Plus, XCircle, HelpCircle, History, Link as LinkIcon, Paperclip, MoreHorizontal, Copy, FileImage, FileText, Building2, CheckCircle, AlertCircle, RefreshCcw, UserPlus, Check, ListChecks, Upload, Workflow, Blocks, Send, GitMerge, ListTodo, MessageSquare, Trash, Trash2, CalendarIcon, Clock, Timer, RotateCcw, X, UploadCloud } from 'lucide-react';
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

const MAX_IMAGE_SIZE_MB = 5;
const MAX_DOC_SIZE_MB = 10;
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;
const MAX_DOC_SIZE_BYTES = MAX_DOC_SIZE_MB * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_DOC_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
];
const ALLOWED_FILE_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_DOC_TYPES].join(',');


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
  isOpen: boolean;
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
  
  const [newComment, setNewComment] = useState('');
  
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isDeleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [revisionState, setRevisionState] = useState<RevisionState>({ isOpen: false, item: null, items: [], currentItemText: '' });
  const [finalReviewState, setFinalReviewState] = useState<FinalReviewState>({ isOpen: false, item: null });
  const [blockingAlert, setBlockingAlert] = useState<BlockingReason>({ isOpen: false, title: '', reasons: [], suggestion: '' });

  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newSubtaskAssignee, setNewSubtaskAssignee] = useState<UserType | null>(null);

  const [isGdriveDialogOpen, setIsGdriveDialogOpen] = useState(false);
  const [gdriveLink, setGdriveLink] = useState('');
  const [gdriveName, setGdriveName] = useState('');
  const [gdriveFileType, setGdriveFileType] = useState<'attachment' | 'deliverable'>('attachment');
  const [isUploading, setIsUploading] = useState(false);
  const [isMentioning, setIsMentioning] = useState(false);
  const [mentionSuggestions, setMentionSuggestions] = useState<User[]>([]);

  const firestore = useFirestore();
  const storage = useStorage();
  const { user: authUser, profile: currentUser } = useUserProfile();
  const { permissions, isLoading: arePermsLoading } = usePermissions();
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const deliverableFileInputRef = useRef<HTMLInputElement>(null);

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

    const currentCycle = getCurrentSubmissionCycle(articleState);
    const hasDeliverableForCycle = (articleState.deliverables || []).some(d => d.forRevisionCycle === currentCycle);
    if (!hasDeliverableForCycle) return false;
    
    const nonSubmittableStatuses = ['Preview', 'Done'];
    if (nonSubmittableStatuses.includes(articleState.statusInternal)) return false;

    return true;
}, [articleState, isEmployeeOrPIC]);

  const handleStatusChange = useCallback(async (newStatus: string) => {
    const oldStatus = articleState.statusInternal;
    if (oldStatus === newStatus || !firestore || !currentUser) return;
    
    const block = getBlockingReasonsForStatusChange(newStatus, articleState);
    if (block.blocked) {
        setBlockingAlert({ isOpen: true, ...block });
        return;
    }
    
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

    if (oldStatus === 'To Do' && newStatus === 'Doing' && !articleState.actualStartDate) {
        updates.actualStartDate = new Date().toISOString();
    }
    if (newStatus === 'Done' && oldStatus !== 'Done') {
        updates.actualCompletionDate = new Date().toISOString();
    }


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
  
  const getBlockingReasonsForStatusChange = (targetStatus: string, currentItem: WebArticle): Omit<BlockingReason, 'isOpen'> => {
    const reasons: string[] = [];
    if (targetStatus === 'Preview') {
        if (!currentItem.content || currentItem.content.length < 50) reasons.push("Content is too short or empty.");
        const allSubtasksCompleted = (currentItem.subtasks || []).every(st => st.completed);
        if (!allSubtasksCompleted) reasons.push("Complete all subtasks first.");
        
        const currentCycle = getCurrentSubmissionCycle(currentItem);
        const hasDeliverableForCycle = (currentItem.deliverables || []).some(d => d.forRevisionCycle === currentCycle);
        if (!hasDeliverableForCycle) reasons.push("Upload at least one new deliverable for this submission cycle.");

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

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>, fileType: 'attachment' | 'deliverable') => {
      if (!event.target.files || !storage || !articleState?.id || !firestore || !currentUser) return;
      setIsUploading(true);
      
      const files = Array.from(event.target.files);

      const validatedFiles = files.filter(file => {
          const isImage = ALLOWED_IMAGE_TYPES.includes(file.type);
          const isDoc = ALLOWED_DOC_TYPES.includes(file.type);
      
          if (!isImage && !isDoc) {
            toast({
              variant: 'destructive',
              title: 'Tipe File Tidak Diizinkan',
              description: `File "${file.name}" tidak dapat diunggah. Hanya gambar dan dokumen yang diizinkan.`,
              duration: 10000,
            });
            return false;
          }
      
          if (isImage && file.size > MAX_IMAGE_SIZE_BYTES) {
            toast({
              variant: 'destructive',
              title: 'Ukuran Gambar Terlalu Besar',
              description: `File "${file.name}" (${(file.size / 1024 / 1024).toFixed(2)} MB) melebihi batas ${MAX_IMAGE_SIZE_MB} MB. Coba kompres file atau gunakan Google Drive.`,
              duration: 10000,
            });
            return false;
          }
      
          if (isDoc && file.size > MAX_DOC_SIZE_BYTES) {
            toast({
              variant: 'destructive',
              title: 'Ukuran Dokumen Terlalu Besar',
              description: `File "${file.name}" (${(file.size / 1024 / 1024).toFixed(2)} MB) melebihi batas ${MAX_DOC_SIZE_MB} MB. Gunakan Google Drive untuk file besar.`,
              duration: 10000,
            });
            return false;
          }
      
          return true;
      });

      if (validatedFiles.length === 0) {
          setIsUploading(false);
          if (event.target) event.target.value = '';
          return;
      }
      
      try {
          const currentCycle = getCurrentSubmissionCycle(articleState);
          const uploadPromises = validatedFiles.map(async (file) => {
              const attachmentId = `${Date.now()}-${file.name}`;
              const storageRef = ref(storage, `attachments/web-articles/${articleState.id}/${attachmentId}`);
              await uploadBytes(storageRef, file);
              const url = await getDownloadURL(storageRef);
              return { id: attachmentId, name: file.name, type: 'local' as const, url, submittedAt: new Date().toISOString(), submittedBy: { id: currentUser.id, name: currentUser.name, avatarUrl: currentUser.avatarUrl || '' }, forRevisionCycle: fileType === 'deliverable' ? currentCycle : undefined };
          });
          const newFiles = await Promise.all(uploadPromises);
          const fieldToUpdate = fileType === 'attachment' ? 'attachments' : 'deliverables';
          const currentFiles = articleState[fieldToUpdate] || [];
          await updateDoc(doc(firestore, 'webArticles', articleState.id), { [fieldToUpdate]: [...currentFiles, ...newFiles] });
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
    
    const currentCycle = getCurrentSubmissionCycle(articleState);
    const newFile: Attachment = { id: `gdrive-${Date.now()}`, name: gdriveName, type: 'gdrive', url: gdriveLink, submittedAt: new Date().toISOString(), submittedBy: { id: currentUser.id, name: currentUser.name, avatarUrl: currentUser.avatarUrl || '' }, forRevisionCycle: gdriveFileType === 'deliverable' ? currentCycle : undefined };
    const fieldToUpdate = gdriveFileType === 'attachment' ? 'attachments' : 'deliverables';
    await updateDoc(doc(firestore, 'webArticles', articleState.id), { [fieldToUpdate]: [...(articleState[fieldToUpdate] || []), newFile] });
    setIsGdriveDialogOpen(false); setGdriveLink(''); setGdriveName('');
  };
  
  const handleRemoveFile = async (id: string, fileType: 'attachment' | 'deliverable') => {
      if (!firestore) return;
      const fieldToUpdate = fileType === 'attachment' ? 'attachments' : 'deliverables';
      await updateDoc(doc(firestore, 'webArticles', articleState.id), { [fieldToUpdate]: articleState[fieldToUpdate]?.filter(att => att.id !== id) });
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
                        <button type="button" onClick={() => handleRemoveDependency(id, type)} className="ml-2 rounded-full hover:bg-background/50 p-0.5"><X className="h-3 w-3" /></button>
                    )}
                </Badge>
            ) : null;
        })}
    </div>
  );
  
  const assigneeIds = articleState.assigneeIds;
  const subtaskAssigneeOptions = useMemo(() => {
    if (!allUsers || !currentUser) return {};
    const mainAssignees = allUsers.filter(u => (assigneeIds || []).includes(u.id));
    const createGroup = (title: string, users: UserType[]) => users.length > 0 ? { [title]: users } : {};

    if (currentUser.role === 'Super Admin') {
        const managers = allUsers.filter(u => u.role === 'Manager' && !mainAssignees.some(a => a.id === u.id));
        const employees = allUsers.filter(u => u.role === 'Employee' && !mainAssignees.some(a => a.id === u.id));
        return { ...createGroup("Task Assignees", mainAssignees), ...createGroup("Managers", managers), ...createGroup("Employees", employees) };
    }
    
    if (currentUser.role === 'Manager') {
        const myTeam = allUsers.filter(u => u.managerId === currentUser.id || u.id === currentUser.id);
        const otherMembers = myTeam.filter(u => !mainAssignees.some(a => a.id === u.id));
        return { ...createGroup("Task Assignees", mainAssignees), ...createGroup("My Team", otherMembers) };
    }
    
    if (currentUser.role === 'Employee') {
        const myTeam = allUsers.filter(u => u.managerId === currentUser.managerId);
        const otherTeamMembers = myTeam.filter(u => !mainAssignees.some(a => a.id === u.id));
        return { ...createGroup("Task Assignees", mainAssignees), ...createGroup("My Team", otherTeamMembers) };
    }
    return {};
  }, [allUsers, currentUser, assigneeIds]);
  
  const groupedDeliverables = useMemo(() => {
    const groups: Record<number, Attachment[]> = {};
    (articleState.deliverables || []).forEach(d => {
        const cycle = d.forRevisionCycle ?? 1;
        if (!groups[cycle]) groups[cycle] = [];
        groups[cycle].push(d);
    });
    return groups;
  }, [articleState.deliverables]);


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
                           {articleState.revisionItems && articleState.revisionItems.length > 0 && (
                                <div className="space-y-4 rounded-lg border border-orange-500/50 bg-orange-500/10 p-4">
                                    <h3 className="font-semibold flex items-center gap-2 text-orange-600 dark:text-orange-400"><RefreshCcw className="h-5 w-5"/> Revision Checklist</h3>
                                    <div className="space-y-2">
                                        {articleState.revisionItems.map(item => (
                                            <div key={item.id} className="flex items-center gap-3">
                                                <Checkbox id={`rev-${item.id}`} checked={item.completed} onCheckedChange={() => handleToggleRevisionItem(item.id)} disabled={!isAssignee} />
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
                                  <TabsTrigger value="attachments"><Paperclip className="mr-2"/>Files</TabsTrigger>
                                  <TabsTrigger value="dependencies"><GitMerge className="mr-2"/>Dependencies</TabsTrigger>
                                </TabsList>
                                <TabsContent value="comments" className="mt-4 space-y-4 rounded-lg border p-4 relative">
                                    <ScrollArea className="max-h-48 pr-2">
                                        <div className="space-y-4">
                                            {(articleState.comments || []).map((comment) => ( <div key={comment.id} className="flex items-start gap-3"><Avatar className="h-8 w-8"><AvatarImage src={comment.user.avatarUrl}/><AvatarFallback>{getInitials(comment.user.name)}</AvatarFallback></Avatar><div><p className="font-semibold text-sm">{comment.user.name} <span className="text-xs text-muted-foreground font-normal">{formatDistanceToNow(parseISO(comment.timestamp), { addSuffix: true })}</span></p><div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: comment.text }} /></div></div> ))}
                                            {(articleState.comments || []).length === 0 && <p className="text-center text-muted-foreground text-sm py-8">No comments yet. Start the conversation!</p>}
                                        </div>
                                    </ScrollArea>
                                    <div className="flex items-start gap-2 pt-4 border-t">
                                        <Avatar className="h-9 w-9"><AvatarImage src={currentUser?.avatarUrl} /><AvatarFallback>{getInitials(currentUser?.name)}</AvatarFallback></Avatar>
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
                                      {(articleState.subtasks || []).map((subtask) => ( <div key={subtask.id} className="flex items-center gap-3 p-2 bg-secondary/50 rounded-md hover:bg-secondary transition-colors"><Checkbox id={`subtask-${subtask.id}`} checked={subtask.completed} onCheckedChange={() => handleToggleSubtask(subtask.id)} /><label htmlFor={`subtask-${subtask.id}`} className={`flex-1 text-sm ${subtask.completed ? 'line-through text-muted-foreground' : ''}`}>{subtask.title}</label><Popover><PopoverTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">{subtask.assignee ? ( <Avatar className="h-6 w-6"><AvatarImage src={subtask.assignee.avatarUrl} /><AvatarFallback>{getInitials(subtask.assignee.name)}</AvatarFallback></Avatar> ) : ( <UserPlus className="h-4 w-4" /> )}</Button></PopoverTrigger><PopoverContent className="w-60 p-1"><ScrollArea className="max-h-60"><div className="space-y-1">{Object.entries(subtaskAssigneeOptions).map(([group, users]) => ( users.length > 0 && ( <React.Fragment key={group}><Separator /><div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{group}</div>{users.map(user => ( <Button key={user.id} variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={() => setNewSubtaskAssignee(user)}><Avatar className="h-6 w-6"><AvatarImage src={user.avatarUrl} /><AvatarFallback>{getInitials(user.name)}</AvatarFallback></Avatar><span className="truncate">{user.name}</span></Button> ))}</React.Fragment> ) ))}</div></ScrollArea></PopoverContent></Popover><Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => handleRemoveSubtask(subtask.id)}><Trash className="h-4 w-4"/></Button></div> ))}
                                  </div>
                                  <div className="flex items-center gap-2"><Input placeholder="Add a new subtask..." value={newSubtaskTitle} onChange={(e) => setNewSubtaskTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddSubtask())} /><Button type="button" onClick={handleAddSubtask}><Plus className="h-4 w-4 mr-2" /> Add</Button></div>
                                </TabsContent>
                                <TabsContent value="attachments" className="mt-4 space-y-4 rounded-lg border p-4">
                                  <div>
                                      <h4 className="font-medium text-sm mb-2">Supporting Materials</h4>
                                      <div className="space-y-2">
                                          {(articleState.attachments || []).map((att) => (
                                              <div key={att.id} className="flex items-center justify-between rounded-md bg-secondary/50 p-2 text-sm">
                                                  <a href={att.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 truncate hover:underline">
                                                  {getFileIcon(att.name)}
                                                  <span className="truncate" title={att.name}>{att.name}</span>
                                                  </a>
                                                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => handleRemoveFile(att.id, 'attachment')}><X className="h-4 w-4" /></Button>
                                              </div>
                                          ))}
                                      </div>
                                      {(articleState.attachments || []).length === 0 && <p className="text-center text-muted-foreground text-sm py-4">No materials attached.</p>}
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 mt-4"><input type="file" ref={fileInputRef} onChange={(e) => handleFileChange(e, 'attachment')} multiple className="hidden" accept={ALLOWED_FILE_TYPES} /><Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>{isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Upload Material</Button><Button type="button" variant="outline" onClick={() => { setGdriveFileType('attachment'); setIsGdriveDialogOpen(true); }}>Link Material</Button></div>
                                  </div>
                                </TabsContent>
                                <TabsContent value="dependencies" className="mt-4 space-y-6 rounded-lg border p-4">
                                    <div className="space-y-3"><h4 className="text-sm font-semibold flex items-center gap-2"><Workflow className="h-4 w-4 text-orange-500" />Waiting On</h4><p className="text-xs text-muted-foreground">These articles must be completed before this one can start.</p>{renderDependencyList(articleState.dependencies?.waitingOn || [], 'waitingOn')}{canEditContent && ( <Popover><PopoverTrigger asChild><Button type="button" variant="outline" size="sm" className="h-7"><Plus className="mr-2 h-3 w-3" />Add...</Button></PopoverTrigger><PopoverContent className="w-80"><Command><CommandInput placeholder="Search articles..." /><CommandList><CommandEmpty>No articles found.</CommandEmpty>{groupedDependencyOptions.map(([brandName, articles]) => (<CommandGroup key={brandName} heading={brandName}>{articles.map(article => (<CommandItem key={article.id} onSelect={() => handleAddDependency(article.id, 'waitingOn')}>{article.title}</CommandItem>))}</CommandGroup>))}</CommandList></Command></PopoverContent></Popover>)}</div>
                                    <Separator/>
                                    <div className="space-y-3"><h4 className="text-sm font-semibold flex items-center gap-2"><Blocks className="h-4 w-4 text-red-500" />Blocking</h4><p className="text-xs text-muted-foreground">This article is blocking the following articles.</p>{renderDependencyList(articleState.dependencies?.blocking || [], 'blocking')}{canEditContent && ( <Popover><PopoverTrigger asChild><Button type="button" variant="outline" size="sm" className="h-7"><Plus className="mr-2 h-3 w-3" />Add...</Button></PopoverTrigger><PopoverContent className="w-80"><Command><CommandInput placeholder="Search articles..." /><CommandList><CommandEmpty>No articles found.</CommandEmpty>{groupedDependencyOptions.map(([brandName, articles]) => (<CommandGroup key={brandName} heading={brandName}>{articles.map(article => (<CommandItem key={article.id} onSelect={() => handleAddDependency(article.id, 'blocking')}>{article.title}</CommandItem>))}</CommandGroup>))}</CommandList></Command></PopoverContent></Popover>)}</div>
                                    <Separator/>
                                    <div className="space-y-3"><h4 className="text-sm font-semibold flex items-center gap-2"><LinkIcon className="h-4 w-4 text-blue-500" />Linked Articles</h4><p className="text-xs text-muted-foreground">Related articles that are not dependent.</p>{renderDependencyList(articleState.dependencies?.linked || [], 'linked')}{canEditContent && ( <Popover><PopoverTrigger asChild><Button type="button" variant="outline" size="sm" className="h-7"><Plus className="mr-2 h-3 w-3" />Add...</Button></PopoverTrigger><PopoverContent className="w-80"><Command><CommandInput placeholder="Search articles..." /><CommandList><CommandEmpty>No articles found.</CommandEmpty>{groupedDependencyOptions.map(([brandName, articles]) => (<CommandGroup key={brandName} heading={brandName}>{articles.map(article => (<CommandItem key={article.id} onSelect={() => handleAddDependency(article.id, 'linked')}>{article.title}</CommandItem>))}</CommandGroup>))}</CommandList></Command></PopoverContent></Popover>)}</div>
                                </TabsContent>
                            </Tabs>
                        </div>
                    </ScrollArea>
                    <ScrollArea className="md:col-span-1 h-full border-l">
                         <div className="p-6 space-y-6">
                            {(isAssignee && !isManagerOrAdmin) && (
                              <div className="space-y-2">
                                {articleState.statusInternal === 'Preview' ? (
                                    <Button type="button" className="w-full" variant="outline" onClick={handleRecallSubmission} disabled={isSaving}>
                                        <RotateCcw className="mr-2 h-4 w-4" />
                                        Recall Submission
                                    </Button>
                                ) : (
                                    <Button
                                        type="button"
                                        className="w-full"
                                        onClick={handleSubmitForReview}
                                        disabled={!canSubmit || isSaving}
                                    >
                                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Check className="mr-2 h-4 w-4"/>}
                                        Submit for Review
                                    </Button>
                                )}
                                {!canSubmit && articleState.statusInternal !== 'Preview' && articleState.statusInternal !== 'Done' && (
                                    <p className="text-xs text-center text-destructive">Selesaikan semua subtugas, poin revisi, dan unggah minimal 1 file deliverable baru untuk submission cycle ini.</p>
                                )}
                              </div>
                            )}

                             {isManagerOrAdmin && articleState.statusInternal === 'Preview' && ( <div className="flex flex-col w-full gap-2"><Button type="button" className="w-full bg-green-600 hover:bg-green-700" onClick={() => setFinalReviewState({ isOpen: true, item: articleState })} disabled={isSaving}><CheckCircle className="mr-2 h-4 w-4"/>Approve and Complete</Button><Button type="button" variant="outline" className="w-full text-destructive border-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setRevisionState({ isOpen: true, item: articleState, items: [], currentItemText: '' })} disabled={isSaving}><XCircle className="mr-2 h-4 w-4"/> Request Revisions</Button></div> )}
                             {isManagerOrAdmin && articleState.statusInternal === 'Done' && ( <Button type="button" className="w-full" variant="outline" onClick={handleReopenTask} disabled={isSaving}>{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}<RefreshCcw className="mr-2 h-4 w-4" />Reopen Article</Button> )}

                            <div className='space-y-4 p-4 rounded-lg border'>
                                <h3 className='font-semibold text-sm'>Article Details</h3>
                                <Separator/>
                                <div className="grid grid-cols-3 items-center gap-2"><Label className="text-muted-foreground">Brand</Label><div className="col-span-2 flex items-center gap-2 text-sm font-medium"><Building2 className="h-4 w-4 text-muted-foreground" />{brands?.find(b => b.id === articleState.brandId)?.name || 'N/A'}</div></div>
                                <div className="grid grid-cols-3 items-center gap-2"><Label className="text-muted-foreground">Status</Label><div className="col-span-2"><Select onValueChange={(value) => handleStatusChange(value)} value={articleState.statusInternal} disabled={isEmployeeOrPIC}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{statuses?.map(status => <SelectItem key={status.id} value={status.name} disabled={isEmployeeOrPIC && (status.name === 'Done' || status.name === 'Revisi')}>{status.name}</SelectItem>)}</SelectContent></Select></div></div>
                                <div className="grid grid-cols-3 items-center gap-2"><Label className="text-muted-foreground">Priority</Label><div className="col-span-2 flex items-center gap-2 text-sm font-medium">{PriorityIcon && <PriorityIcon className={`h-4 w-4 ${priorityInfo[articleState.priority].color}`} />}{articleState.priority}</div></div>
                                <div className="grid grid-cols-3 items-center gap-2"><Label className="text-muted-foreground">Due Date</Label><div className="col-span-2 text-sm font-medium">{articleState.dueDate ? format(parseISO(articleState.dueDate), 'MMM d, yyyy') : 'No due date'}</div></div>
                            </div>
                            
                            <div className='space-y-4 p-4 rounded-lg border'>
                                <h3 className='font-semibold text-sm'>People</h3>
                                <Separator/>
                                {articleState.createdBy && (
                                  <div><Label className="text-muted-foreground text-sm">Created by</Label><div className="flex items-center gap-3 mt-1"><Avatar className="h-8 w-8"><AvatarImage src={articleState.createdBy.avatarUrl} /><AvatarFallback>{getInitials(articleState.createdBy.name)}</AvatarFallback></Avatar><p className="text-sm font-medium">{articleState.createdBy.name}</p></div></div>
                                )}
                                <div>
                                  <Label className="text-muted-foreground text-sm">Assignees</Label>
                                  {(articleState.assigneeIds || []).map(id => {
                                      const user = allUsers?.find(u => u.id === id);
                                      if (!user) return null;
                                      return <div key={user.id} className="flex items-center gap-3 mt-1"><Avatar className="h-8 w-8"><AvatarImage src={user.avatarUrl} /><AvatarFallback>{getInitials(user.name)}</AvatarFallback></Avatar><p className="text-sm font-medium">{user.name}</p></div>
                                  })}
                                </div>
                            </div>

                            <div className='space-y-4 p-4 rounded-lg border'>
                                  <div className="flex justify-between items-center"><h3 className='font-semibold text-sm'>Time Management</h3><div></div></div>
                                  <Separator/>
                                    <div className="grid grid-cols-3 items-center gap-2">
                                        <Label className="text-muted-foreground text-sm">Estimasi (hari)</Label>
                                        <div className="col-span-2">
                                            <Input type="number" step="0.5" value={articleState.timeEstimate || ''} readOnly={!canEditContent} className="text-sm" />
                                        </div>
                                    </div>
                              </div>
                         </div>
                    </ScrollArea>
                </div>
               </form>
            </div>
        </SheetContent>
      </Sheet>
      
      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Article Activity Log: {articleState?.title}</DialogTitle></DialogHeader>
            <ScrollArea className="max-h-[60vh] -mx-6 px-6"><div className="space-y-6 py-4">
                {articleState.activities && articleState.activities.length > 0 ? (getUniqueActivities(articleState.activities).slice().sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map((activity) => ( <div key={activity.id} className="flex items-start gap-4"><Avatar className="h-9 w-9"><AvatarImage src={activity.user.avatarUrl} alt={activity.user.name} /><AvatarFallback>{activity.user.name.charAt(0)}</AvatarFallback></Avatar><div><p className="text-sm"><span className="font-semibold">{activity.user.name}</span> {activity.action}.</p><p className="text-xs text-muted-foreground mt-0.5">{formatDate(activity.timestamp)}</p></div></div> ))) : ( <p className="text-center text-muted-foreground py-8">No activities recorded.</p> )}
            </div></ScrollArea>
        </DialogContent>
       </Dialog>
    
      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete this article?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the article: <strong className="text-foreground">{articleState.title}</strong>. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Yes, Delete Article</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
       <Dialog open={isGdriveDialogOpen} onOpenChange={setIsGdriveDialogOpen}>
          <DialogContent>
              <DialogHeader><DialogTitle>Link Google Drive File</DialogTitle><DialogDescription>Paste the shareable link to your Google Drive file below.</DialogDescription></DialogHeader>
              <div className="space-y-4 py-2">
                  <div className="space-y-2"><Label htmlFor="gdrive-name-details">File Name</Label><Input id="gdrive-name-details" value={gdriveName} onChange={(e) => setGdriveName(e.target.value)} placeholder="e.g., Q3 Marketing Report" /></div>
                  <div className="space-y-2"><Label htmlFor="gdrive-link-details">File Link</Label><Input id="gdrive-link-details" value={gdriveLink} onChange={(e) => setGdriveLink(e.target.value)} placeholder="https://docs.google.com/..." /></div>
              </div>
              <DialogFooter><Button variant="ghost" onClick={() => setIsGdriveDialogOpen(false)}>Cancel</Button><Button onClick={() => handleConfirmGdriveLink()}>Add Link</Button></DialogFooter>
          </DialogContent>
      </Dialog>
       <AlertDialog open={blockingAlert.isOpen} onOpenChange={(open) => setBlockingAlert(prev => ({...prev, isOpen: open}))}>
          <AlertDialogContent>
              <AlertDialogHeader><AlertDialogTitle>{blockingAlert.title}</AlertDialogTitle><AlertDialogDescription>{blockingAlert.suggestion}</AlertDialogDescription>{blockingAlert.reasons.length > 0 && ( <div className="pt-2"><ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">{blockingAlert.reasons.map((reason, index) => <li key={index}>{reason}</li>)}</ul></div> )}</AlertDialogHeader>
              <AlertDialogFooter><AlertDialogAction onClick={() => setBlockingAlert({ isOpen: false, title: '', reasons: [] })}>OK</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>
      <Dialog open={revisionState.isOpen} onOpenChange={(open) => !open && setRevisionState({ isOpen: false, item: null, items: [], currentItemText: '' })}>
          <DialogContent>
              <DialogHeader><DialogTitle>Create Revision Checklist</DialogTitle><DialogDescription>Revisions for article: <span className="font-bold text-foreground">{revisionState.item?.title}</span></DialogDescription></DialogHeader>
              <ScrollArea className="max-h-[60vh] -mx-6 px-6"><div className="py-4 space-y-6 px-6"><div className="space-y-4"><h4 className="font-semibold text-sm">Revision Points</h4><div className="space-y-2">{revisionState.items.map((item, index) => ( <div key={index} className="flex items-center gap-2 bg-secondary p-2 rounded-md"><span className="flex-1 text-sm">{item.text}</span><Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setRevisionState(prev => ({...prev, items: prev.items.filter((_, i) => i !== index)}))}><XCircle className="h-4 w-4" /></Button></div> ))}</div><div className="flex items-center gap-2"><Input value={revisionState.currentItemText} onChange={(e) => setRevisionState(prev => ({...prev, currentItemText: e.target.value}))} placeholder="e.g., Fix the typo in paragraph 2" onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddRevisionItem())} /><Button type="button" onClick={handleAddRevisionItem} disabled={!revisionState.currentItemText.trim()}><Plus className="mr-2 h-4 w-4"/> Add</Button></div></div></div></ScrollArea>
              <DialogFooter className="p-6 pt-4 border-t"><Button variant="ghost" onClick={() => setRevisionState({ isOpen: false, item: null, items: [], currentItemText: '' })}>Cancel</Button><Button type="button" variant="destructive" onClick={handleConfirmRejection} disabled={isSaving || revisionState.items.length === 0}>{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Request Revisions</Button></DialogFooter>
          </DialogContent>
      </Dialog>
      <Dialog open={finalReviewState.isOpen} onOpenChange={(open) => !open && setFinalReviewState({ isOpen: false, item: null })}>
          <DialogContent>
              <DialogHeader><DialogTitle>Final Review & Complete Article</DialogTitle><DialogDescription>You are about to mark this article as "Done". Please review the items below to ensure everything is complete.</DialogDescription></DialogHeader>
              <ScrollArea className="max-h-[60vh] -mx-6 px-6"><div className="py-4 space-y-6 px-6"><div className="space-y-3"><h4 className="font-medium text-sm flex items-center gap-2"><ListChecks className="h-4 w-4" />Sub-tasks</h4><div className="space-y-2 max-h-32 overflow-y-auto pr-2">{finalReviewState.item?.subtasks && finalReviewState.item.subtasks.length > 0 ? ( finalReviewState.item.subtasks.map(subtask => ( <div key={subtask.id} className="flex items-center gap-3"><Checkbox id={`final-review-${subtask.id}`} checked={subtask.completed} disabled /><label htmlFor={`final-review-${subtask.id}`} className={`flex-1 text-sm ${subtask.completed ? 'line-through text-muted-foreground' : ''}`}>{subtask.title}</label></div> )) ) : ( <p className="text-sm text-muted-foreground">No sub-tasks for this item.</p> )}</div></div><div className="space-y-3"><h4 className="font-medium text-sm flex items-center gap-2"><UploadCloud className="h-4 w-4" />Deliverables</h4><div className="space-y-2 max-h-32 overflow-y-auto pr-2">{finalReviewState.item?.deliverables && finalReviewState.item.deliverables.length > 0 ? ( finalReviewState.item.deliverables.map(att => ( <div key={att.id} className="flex items-center gap-2 text-sm"><span>-</span><a href={att.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">{att.name}</a></div> )) ) : ( <p className="text-sm text-muted-foreground">No deliverables for this item.</p> )}</div></div></div></ScrollArea>
              <DialogFooter className="p-6 pt-0"><Button variant="ghost" onClick={() => setFinalReviewState({ isOpen: false, item: null })}>Cancel</Button><Button type="button" variant="default" onClick={handleFinalReviewAndComplete}><Check className="mr-2 h-4 w-4" />Confirm & Complete</Button></DialogFooter>
          </DialogContent>
      </Dialog>
    </>
  );
}

    
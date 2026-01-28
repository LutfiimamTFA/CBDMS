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
import { priorityInfo, formatLateness, getFileIcon, formatHours, getInitials } from '@/lib/utils';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AtSign, CalendarIcon, Clock, Edit, FileUp, GitMerge, History, ListTodo, LogIn, MessageSquare, PauseCircle, PlayCircle, Plus, Repeat, Send, TagIcon, Trash, Trash2, Users, Wand2, X, Share2, Star, Link as LinkIcon, Paperclip, MoreHorizontal, Copy, FileText, Building2, CheckCircle, AlertCircle, RefreshCcw, UserPlus, Check, ListChecks, Upload, Bold, Italic, Table as TableIcon, List as ListIcon, ListOrdered, UploadCloud, Circle, CircleDashed, XCircle, Workflow, Blocks, RotateCcw } from 'lucide-react';
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
  timeEstimate: z.coerce.number().min(0).optional(),
});

type PostDetailsFormValues = z.infer<typeof postDetailsSchema>;


interface SocialMediaPostDetailsSheetProps {
  post: SocialMediaPost;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

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
  

const getCurrentSubmissionCycle = (post: SocialMediaPost | null): number => {
    if (!post) return 1;
    const historyLength = post.revisionHistory?.length ?? 0;
    const currentStatus = post.statusInternal || post.status;
    if (currentStatus === 'Revisi') {
        return historyLength + 1;
    }
    return historyLength > 0 ? historyLength : 1;
};

interface FinalReviewState {
  isOpen: boolean;
  item: SocialMediaPost | null;
}

interface EndOfDayState {
  isOpen: boolean;
}

type BlockingReason = {
  blocked: boolean;
  title: string;
  reasons: string[];
  suggestion?: string;
};

interface TaskDetailsSheetProps {
  task: Task;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function SharedViewLogic({ onDataLoaded }: { onDataLoaded: (data: any) => void }) {
    const { session, isLoading, error } = useSharedSession();

    useEffect(() => {
        if (!isLoading) {
            onDataLoaded({ session, error });
        }
    }, [session, isLoading, error, onDataLoaded]);

    return null;
}


const createActivityServer = (user: User, action: string): Activity => {
    return {
      id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      user: { id: user.id, name: user.name, avatarUrl: user.avatarUrl || '' },
      action: action,
      timestamp: new Date().toISOString() as any,
    };
};

interface RevisionState {
  isOpen: boolean;
  item: SocialMediaPost | null;
  items: Omit<RevisionItem, 'id' | 'completed'>[];
  currentItemText: string;
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
  
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isDeleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [blockingAlert, setBlockingAlert] = useState<{ isOpen: boolean, title: string, reasons: string[], suggestion?: string }>({ isOpen: false, title: '', reasons: [], suggestion: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [revisionState, setRevisionState] = useState<RevisionState>({ isOpen: false, item: null, items: [], currentItemText: '' });
  const [finalReviewState, setFinalReviewState] = useState<FinalReviewState>({ isOpen: false, item: null });

  
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
        timeEstimate: postState.timeEstimate,
    }
  });

  const isAssignee = !!currentUser && postState.assigneeIds.includes(currentUser.id);
  const isManagerOrAdmin = currentUser && (currentUser.role === 'Manager' || currentUser.role === 'Super Admin');
  const isEmployeeOrPIC = currentUser && (currentUser.role === 'Employee' || currentUser.role === 'PIC');

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
  
  const canSubmit = useMemo(() => {
    if (!postState || !isEmployeeOrPIC) return false;
    
    const allSubtasksCompleted = (postState.subtasks || []).every(st => st.completed);
    if (!allSubtasksCompleted) return false;

    const currentCycle = getCurrentSubmissionCycle(postState);
    const hasDeliverableForCycle = (postState.deliverables || []).some(d => d.forRevisionCycle === currentCycle);
    if (!hasDeliverableForCycle) return false;

    const nonSubmittableStatuses = ['Preview', 'Done', 'Scheduled', 'Posted'];
    if (nonSubmittableStatuses.includes(postState.status)) return false;

    return true;
}, [postState, isEmployeeOrPIC]);

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
  const [mentionSuggestions, setMentionSuggestions] = React.useState<User[]>([]);
  const [isMentioning, setIsMentioning] = React.useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newSubtaskAssignee, setNewSubtaskAssignee] = useState<UserType | null>(null);

  
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
    if (!gdriveLink || !gdriveName) { toast({ variant: 'destructive', title: 'Missing Info' }); return; }
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


  const [isUploadingCommentAttachment, setIsUploadingCommentAttachment] = useState(false);

  const handlePostComment = async () => {
    if (!newComment.trim() || !firestore || !currentUser) return;
    setIsUploadingCommentAttachment(true);
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
        comments: [...(postState.comments || []), newCommentData],
        activities: [...(postState.activities || []), newActivity],
        lastActivity: newActivity,
      };

      await updateDoc(doc(firestore, 'socialMediaPosts', postState.id), updates);
      toast({ title: 'Comment Posted' });
      setNewComment('');
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Comment Failed', description: error.message });
    } finally {
      setIsUploadingCommentAttachment(false);
    }
  };

  const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
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
  
  const handleAddDependency = async (postId: string, type: keyof Dependencies) => {
    if (!firestore) return;
    const currentDeps = postState.dependencies?.[type] || [];
    if (!currentDeps.includes(postId)) {
        await updateDoc(doc(firestore, 'socialMediaPosts', postState.id), { [`dependencies.${type}`]: [...currentDeps, postId] });
    }
  };
  
  const handleRemoveDependency = async (postId: string, type: keyof Dependencies) => {
    if (!firestore) return;
    const currentDeps = postState.dependencies?.[type] || [];
    await updateDoc(doc(firestore, 'socialMediaPosts', postState.id), { [`dependencies.${type}`]: currentDeps.filter(id => id !== postId) });
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
                    {canEditContent && (
                        <button onClick={() => handleRemoveDependency(id, type)} className="ml-2 rounded-full hover:bg-background/50 p-0.5"><X className="h-3 w-3" /></button>
                    )}
                </Badge>
            ) : null;
        })}
    </div>
  );

  const handleAddSubtask = async () => {
    if (!newSubtaskTitle.trim() || !firestore) return;
    const newSubtask: Subtask = {
      id: `sub-${Date.now()}`,
      title: newSubtaskTitle,
      completed: false,
    };
    const updatedSubtasks = [...(postState.subtasks || []), newSubtask];
    await updateDoc(doc(firestore, 'socialMediaPosts', postState.id), { subtasks: updatedSubtasks });
    setNewSubtaskTitle('');
  };

  const handleToggleSubtask = async (subtaskId: string) => {
    if (!firestore) return;
    const updatedSubtasks = (postState.subtasks || []).map(st => st.id === subtaskId ? { ...st, completed: !st.completed } : st);
    await updateDoc(doc(firestore, 'socialMediaPosts', postState.id), { subtasks: updatedSubtasks });
  };

  const handleToggleRevisionItem = async (itemId: string) => {
    if (!isAssignee || !firestore) return;
    const newItems = (postState.revisionItems || []).map(item =>
      item.id === itemId ? { ...item, completed: !item.completed } : item
    );
    await updateDoc(doc(firestore, 'socialMediaPosts', postState.id), { revisionItems: newItems });
  };

  const handleRemoveSubtask = async (subtaskId: string) => {
    if (!firestore) return;
    const updatedSubtasks = (postState.subtasks || []).filter(st => st.id !== subtaskId);
    await updateDoc(doc(firestore, 'socialMediaPosts', postState.id), { subtasks: updatedSubtasks });
  };
  
  const subtaskProgress = useMemo(() => {
    if (!postState.subtasks || postState.subtasks.length === 0) return 0;
    const completedCount = postState.subtasks.filter(st => st.completed).length;
    return (completedCount / postState.subtasks.length) * 100;
  }, [postState.subtasks]);

  const PriorityIcon = priorityInfo[postState.priority]?.icon;
  const timeEstimateValue = form.watch('timeEstimate') ?? postState.timeEstimate ?? 0;

  const assigneeIds = form.watch('assigneeIds');
  const subtaskAssigneeOptions = useMemo(() => {
    if (!allUsers || !currentUser) return {};
    const mainAssignees = allUsers.filter(u => (assigneeIds || []).includes(u.id));
    const createGroup = (title: string, users: UserType[]) => users.length > 0 ? { [title]: users } : {};

    if (currentUser.role === 'Super Admin') {
        const managers = allUsers.filter(u => u.role === 'Manager' && !mainAssignees.some(a => a.id === u.id));
        const employees = allUsers.filter(u => u.role === 'Employee' && !mainAssignees.some(a => a.id === u.id));
        return {
            ...createGroup("Task Assignees", mainAssignees),
            ...createGroup("Managers", managers),
            ...createGroup("Employees", employees),
        };
    }
    
    if (currentUser.role === 'Manager') {
        const myTeam = allUsers.filter(u => u.managerId === currentUser.id || u.id === currentUser.id);
        const otherMembers = myTeam.filter(u => !mainAssignees.some(a => a.id === u.id));
        return {
            ...createGroup("Task Assignees", mainAssignees),
            ...createGroup("My Team", otherMembers),
        };
    }
    
    if (currentUser.role === 'Employee') {
        const myTeam = allUsers.filter(u => u.managerId === currentUser.managerId);
        const otherTeamMembers = myTeam.filter(u => !mainAssignees.some(a => a.id === u.id));
        return {
            ...createGroup("Task Assignees", mainAssignees),
            ...createGroup("My Team", otherTeamMembers),
        };
    }
    return {};
  }, [allUsers, currentUser, assigneeIds]);
  
  const getBlockingReasonsForStatusChange = (targetStatus: string, currentItem: SocialMediaPost): { blocked: boolean, title: string, reasons: string[], suggestion?: string } => {
    const reasons: string[] = [];
    const baseResult = { blocked: false, title: '', reasons: [], suggestion: '' };

    if (targetStatus === 'Preview') {
        const allSubtasksCompleted = (currentItem.subtasks || []).every(st => st.completed);
        if (!allSubtasksCompleted) reasons.push("Selesaikan semua subtasks dulu.");

        const isInRevision = currentItem.status === 'Revisi' || (currentItem.revisionItems && currentItem.revisionItems.length > 0);
        if (isInRevision) {
            const allRevisionsCompleted = (currentItem.revisionItems || []).every(item => item.completed);
            if (!allRevisionsCompleted) reasons.push("Checklist revisi belum selesai.");
        }

        const currentCycle = getCurrentSubmissionCycle(currentItem);
        const hasDeliverableForCycle = (currentItem.deliverables || []).some(d => d.forRevisionCycle === currentCycle);
        if (!hasDeliverableForCycle) reasons.push("Upload minimal 1 file BARU di Deliverables untuk submission cycle ini.");

        if (reasons.length > 0) {
            return { blocked: true, title: "Belum Siap untuk Direview", reasons, suggestion: "Mohon lengkapi item di atas sebelum mengirimkan tugas untuk review." };
        }
    }
    
    if (isEmployeeOrPIC && targetStatus === 'Done') {
        return { blocked: true, title: "Aksi Tidak Diizinkan", reasons: ["Hanya Manager yang bisa menyelesaikan tugas."], suggestion: "Ubah status ke 'Preview' agar bisa direview oleh Manager." };
    }

    return baseResult;
  };
  
  const handleStatusChange = async (newStatus: string) => {
    const oldStatus = form.getValues('status');
    if (oldStatus === newStatus) return;

    const block = getBlockingReasonsForStatusChange(newStatus, postState);
    if (block.blocked) {
        setBlockingAlert({ isOpen: true, ...block });
        return;
    }
    
    form.setValue('status', newStatus);
    
    if (!firestore || !currentUser) {
        form.setValue('status', oldStatus);
        return;
    }
    
    const newActivity = createActivity(currentUser, `changed status from "${oldStatus}" to "${newStatus}"`);
    const postRef = doc(firestore, 'socialMediaPosts', postState.id);
    
    try {
        const batch = writeBatch(firestore);
        const updates: any = { // Using any to allow dynamic properties
            status: newStatus, 
            statusInternal: newStatus,
            activities: [...(postState.activities || []), newActivity], 
            lastActivity: newActivity, 
            updatedAt: serverTimestamp() 
        };

        const notificationTitle = `Status Changed: ${postState.title}`;
        const notificationMessage = `${currentUser.name} changed status to ${newStatus}.`;
        
        const notifiedUserIds = new Set<string>();
        postState.assigneeIds.forEach(id => { if (id !== currentUser.id) notifiedUserIds.add(id); });
        if (postState.createdBy.id !== currentUser.id) notifiedUserIds.add(postState.createdBy.id);

        notifiedUserIds.forEach(userId => {
            const notifRef = doc(collection(firestore, `users/${userId}/notifications`));
            batch.set(notifRef, { 
                userId, 
                title: notificationTitle, 
                message: notificationMessage, 
                entityId: postState.id, 
                entityType: 'socialPost', 
                isRead: false, 
                createdAt: serverTimestamp(), 
                createdBy: newActivity.user 
            });
        });
        
        batch.update(postRef, updates);
        await batch.commit();

        toast({ title: 'Status Updated', description: `Post status changed to ${newStatus}.` });
    } catch (error: any) {
        console.error('Failed to update status:', error);
        form.setValue('status', oldStatus);
        toast({ variant: 'destructive', title: 'Update Failed', description: 'Could not update post status.' });
    }
  };
  
  const handleSubmitForReview = async () => {
    if (!currentUser) return;
    setIsSaving(true);
    await handleStatusChange('Preview');
    setIsSaving(false);
  };
  
  const handleRecallSubmission = async () => {
    if (!currentUser) return;
    setIsSaving(true);
    await handleStatusChange('Doing');
    toast({ title: "Submission Recalled", description: "You can continue working on the task." });
    setIsSaving(false);
  };

  const handleFinalReviewAndComplete = async () => {
    if (!isManagerOrAdmin || !postState) return;
    await handleStatusChange('Done');
    setFinalReviewState({ isOpen: false, item: null });
  };

  const handleReopenTask = async () => {
    if (!currentUser || !isManagerOrAdmin) return;
    await handleStatusChange('Revisi');
  }

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
                          {canDelete && (
                            <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10" onClick={() => setDeleteConfirmOpen(true)}><Trash2 className="mr-2 h-4 w-4"/>Delete Post</DropdownMenuItem>
                          )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </SheetHeader>
            <div className="flex-1 flex min-h-0">
              <Form {...form}>
              <form id="add-post-form" className='flex-1 flex min-h-0'>
                <div className="flex-1 grid md:grid-cols-3 min-h-0">
                    <ScrollArea className="md:col-span-2 h-full">
                        <div className="p-6 space-y-6">
                           <FormField control={form.control} name="title" render={({ field }) => ( <Input {...field} readOnly={!canEditContent} className="text-2xl font-bold border-dashed h-auto p-0 border-0 focus-visible:ring-1"/> )}/>
                            {(postState.status === 'Revisi' || postState.statusInternal === 'Revisi') && postState.revisionItems && postState.revisionItems.length > 0 && (
                                <div className="space-y-4 rounded-lg border border-orange-500/50 bg-orange-500/10 p-4">
                                    <h3 className="font-semibold flex items-center gap-2 text-orange-600 dark:text-orange-400"><RefreshCcw className="h-5 w-5"/> Revision Checklist</h3>
                                    <div className="space-y-2">
                                        {postState.revisionItems.map(item => (
                                            <div key={item.id} className="flex items-center gap-3">
                                                <Checkbox id={`rev-${item.id}`} checked={item.completed} onCheckedChange={() => handleToggleRevisionItem(item.id)} disabled={!isAssignee} />
                                                <label htmlFor={`rev-${item.id}`} className={`flex-1 text-sm ${item.completed ? 'line-through text-muted-foreground' : ''}`}>{item.text}</label>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
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
                                <TabsList className="grid w-full grid-cols-4">
                                  <TabsTrigger value="comments"><MessageSquare className="mr-2"/>Comments</TabsTrigger>
                                  <TabsTrigger value="subtasks"><ListTodo className="mr-2"/>Subtasks</TabsTrigger>
                                  <TabsTrigger value="files"><Paperclip className="mr-2"/>Files</TabsTrigger>
                                  <TabsTrigger value="dependencies"><GitMerge className="mr-2"/>Dependencies</TabsTrigger>
                                </TabsList>
                                <TabsContent value="comments" className="mt-4 space-y-4 rounded-lg border p-4 relative">
                                      <ScrollArea className="max-h-48 pr-2">
                                          <div className="space-y-4">
                                              {(postState.comments || []).map((comment) => ( <div key={comment.id} className="flex items-start gap-3"><Avatar className="h-8 w-8"><AvatarImage src={comment.user.avatarUrl}/><AvatarFallback>{getInitials(comment.user.name)}</AvatarFallback></Avatar><div><p className="font-semibold text-sm">{comment.user.name} <span className="text-xs text-muted-foreground font-normal">{formatDistanceToNow(parseISO(comment.timestamp), { addSuffix: true })}</span></p><div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: comment.text }} /></div></div> ))}
                                              {(postState.comments || []).length === 0 && <p className="text-center text-muted-foreground text-sm py-8">No comments yet. Start the conversation!</p>}
                                          </div>
                                      </ScrollArea>
                                      <div className="space-y-2 pt-4 border-t">
                                          <div className="flex-1 relative">
                                              <RichTextEditor value={newComment} onChange={setNewComment} placeholder="Write a comment... (use '@' to mention)" minHeight={100} />
                                              {isMentioning && ( <Card className="absolute bottom-full mb-2 w-full max-h-48 overflow-y-auto"><CardContent className="p-1">{mentionSuggestions.map(user => ( <Button key={user.id} variant="ghost" className="w-full justify-start gap-2" onClick={() => handleMentionSelect(user)}><Avatar className="h-6 w-6"><AvatarImage src={user.avatarUrl}/><AvatarFallback>{getInitials(user.name)}</AvatarFallback></Avatar>{user.name}</Button> ))}</CardContent></Card> )}
                                          </div>
                                          <div className="flex justify-between items-center">
                                              <div className="flex-1"></div>
                                              <Button type="button" onClick={() => handlePostComment()} disabled={!newComment.trim() || isUploadingCommentAttachment}>
                                                    {isUploadingCommentAttachment ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4"/>}
                                                    Post Comment
                                              </Button>
                                          </div>
                                      </div>
                                </TabsContent>
                                <TabsContent value="subtasks" className="mt-4 space-y-4 rounded-lg border p-4">
                                  <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                                      {(postState.subtasks || []).map((subtask) => ( <div key={subtask.id} className="flex items-center gap-3 p-2 bg-secondary/50 rounded-md hover:bg-secondary transition-colors"><Checkbox id={`subtask-${subtask.id}`} checked={subtask.completed} onCheckedChange={() => handleToggleSubtask(subtask.id)} /><label htmlFor={`subtask-${subtask.id}`} className={`flex-1 text-sm ${subtask.completed ? 'line-through text-muted-foreground' : ''}`}>{subtask.title}</label><Popover><PopoverTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">{subtask.assignee ? ( <Avatar className="h-6 w-6"><AvatarImage src={subtask.assignee.avatarUrl} /><AvatarFallback>{getInitials(subtask.assignee.name)}</AvatarFallback></Avatar> ) : ( <UserPlus className="h-4 w-4" /> )}</Button></PopoverTrigger><PopoverContent className="w-60 p-1"><ScrollArea className="max-h-60"><div className="space-y-1">{Object.entries(subtaskAssigneeOptions).map(([group, users]) => ( users.length > 0 && ( <React.Fragment key={group}><Separator /><div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{group}</div>{users.map(user => ( <Button key={user.id} variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={() => setNewSubtaskAssignee(user)}><Avatar className="h-6 w-6"><AvatarImage src={user.avatarUrl} /><AvatarFallback>{getInitials(user.name)}</AvatarFallback></Avatar><span className="truncate">{user.name}</span></Button> ))}</React.Fragment> ) ))}</div></ScrollArea></PopoverContent></Popover><Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => handleRemoveSubtask(subtask.id)}><Trash className="h-4 w-4"/></Button></div> ))}
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
                                <TabsContent value="files" className="mt-4 space-y-6 rounded-lg border p-4">
                                   <div>
                                      <h4 className="font-medium text-sm mb-2">Deliverables</h4>
                                      <div className="space-y-2">
                                        {Object.entries(groupedDeliverables).sort(([a], [b]) => Number(b) - Number(a)).map(([cycleNum, deliverables]) => ( <div key={`del-${cycleNum}`} className="space-y-2"><h4 className="font-semibold text-xs text-muted-foreground">{Number(cycleNum) === 1 ? 'Initial Submission' : `Revision ${Number(cycleNum)-1} Submission`}</h4>{deliverables.map(att => ( <div key={att.id} className="flex items-center justify-between rounded-md bg-secondary/50 p-2 text-sm"><a href={att.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 truncate hover:underline">{getFileIcon(att.name)}<span className="truncate" title={att.name}>{att.name}</span></a>{canUploadDeliverables && ( <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => handleRemoveFile(att.id, 'deliverable')}><X className="h-4 w-4" /></Button> )}</div> ))}</div> ))}
                                        {(postState.deliverables || []).length === 0 && <p className="text-center text-muted-foreground text-sm py-4">No deliverables submitted.</p>}
                                      </div>
                                      {canUploadDeliverables && (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 mt-2 border-t">
                                          <input type="file" ref={deliverableFileInputRef} onChange={(e) => handleFileChange(e, 'deliverable')} multiple className="hidden" />
                                          <Button type="button" variant="outline" onClick={() => deliverableFileInputRef.current?.click()} disabled={isUploading}>{isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Upload className="mr-2 h-4 w-4" />} Upload Deliverable</Button>
                                          <Button type="button" variant="outline" onClick={() => { setGdriveFileType('deliverable'); setIsGdriveDialogOpen(true); }}><LinkIcon className="mr-2 h-4 w-4" /> Link Deliverable</Button>
                                        </div>
                                      )}
                                    </div>
                                    <Separator />
                                    <div>
                                        <h4 className="font-medium text-sm mb-2">Supporting Materials</h4>
                                        <div className="space-y-2">
                                            {(postState.attachments || []).map((att) => (
                                                <div key={att.id} className="flex items-center justify-between rounded-md bg-secondary/50 p-2 text-sm">
                                                    <a href={att.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 truncate hover:underline">
                                                    {getFileIcon(att.name)}
                                                    <span className="truncate" title={att.name}>{att.name}</span>
                                                    </a>
                                                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => handleRemoveFile(att.id, 'attachment')}><X className="h-4 w-4" /></Button>
                                                </div>
                                            ))}
                                        </div>
                                        {(postState.attachments || []).length === 0 && <p className="text-center text-muted-foreground text-sm py-4">No materials attached.</p>}
                                        {canEditContent && (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 mt-4"><input type="file" ref={fileInputRef} onChange={(e) => handleFileChange(e, 'attachment')} multiple className="hidden" /><Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>{isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Upload Material</Button><Button type="button" variant="outline" onClick={() => { setGdriveFileType('attachment'); setIsGdriveDialogOpen(true); }}>Link Material</Button></div>
                                        )}
                                    </div>
                                </TabsContent>
                                <TabsContent value="dependencies" className="mt-4 space-y-6 rounded-lg border p-4">
                                    <div className="space-y-3"><h4 className="text-sm font-semibold flex items-center gap-2"><Workflow className="h-4 w-4 text-orange-500" />Waiting On</h4><p className="text-xs text-muted-foreground">These posts must be completed before this one can start.</p>{renderDependencyList(postState.dependencies?.waitingOn || [], 'waitingOn')}{canEditContent && ( <Popover><PopoverTrigger asChild><Button variant="outline" size="sm" className="h-7"><Plus className="mr-2 h-3 w-3" />Add...</Button></PopoverTrigger><PopoverContent className="w-80"><Command><CommandInput placeholder="Search posts..." /><CommandList><CommandEmpty>No posts found.</CommandEmpty>{groupedDependencyOptions.map(([brandName, posts]) => (<CommandGroup key={brandName} heading={brandName}>{posts.map(post => (<CommandItem key={post.id} onSelect={() => handleAddDependency(post.id, 'waitingOn')}>{post.title}</CommandItem>))}</CommandGroup>))}</CommandList></Command></PopoverContent></Popover>)}</div>
                                    <Separator/>
                                    <div className="space-y-3"><h4 className="text-sm font-semibold flex items-center gap-2"><Blocks className="h-4 w-4 text-red-500" />Blocking</h4><p className="text-xs text-muted-foreground">This post is blocking the following posts.</p>{renderDependencyList(postState.dependencies?.blocking || [], 'blocking')}{canEditContent && ( <Popover><PopoverTrigger asChild><Button variant="outline" size="sm" className="h-7"><Plus className="mr-2 h-3 w-3" />Add...</Button></PopoverTrigger><PopoverContent className="w-80"><Command><CommandInput placeholder="Search posts..." /><CommandList><CommandEmpty>No posts found.</CommandEmpty>{groupedDependencyOptions.map(([brandName, posts]) => (<CommandGroup key={brandName} heading={brandName}>{posts.map(post => (<CommandItem key={post.id} onSelect={() => handleAddDependency(post.id, 'blocking')}>{post.title}</CommandItem>))}</CommandGroup>))}</CommandList></Command></PopoverContent></Popover>)}</div>
                                    <Separator/>
                                    <div className="space-y-3"><h4 className="text-sm font-semibold flex items-center gap-2"><LinkIcon className="h-4 w-4 text-blue-500" />Linked Posts</h4><p className="text-xs text-muted-foreground">Related posts that are not dependent.</p>{renderDependencyList(postState.dependencies?.linked || [], 'linked')}{canEditContent && ( <Popover><PopoverTrigger asChild><Button variant="outline" size="sm" className="h-7"><Plus className="mr-2 h-3 w-3" />Add...</Button></PopoverTrigger><PopoverContent className="w-80"><Command><CommandInput placeholder="Search posts..." /><CommandList><CommandEmpty>No posts found.</CommandEmpty>{groupedDependencyOptions.map(([brandName, posts]) => (<CommandGroup key={brandName} heading={brandName}>{posts.map(post => (<CommandItem key={post.id} onSelect={() => handleAddDependency(post.id, 'linked')}>{post.title}</CommandItem>))}</CommandGroup>))}</CommandList></Command></PopoverContent></Popover>)}</div>
                                </TabsContent>
                                 <TabsContent value="revisions" className="mt-4 space-y-2 rounded-lg border p-4">
                                    {(postState.revisionHistory && postState.revisionHistory.length > 0) ? (
                                        <Accordion type="single" collapsible>
                                            {postState.revisionHistory.slice().sort((a, b) => b.cycleNumber - a.cycleNumber).map(cycle => (
                                                <AccordionItem key={cycle.cycleNumber} value={`cycle-${cycle.cycleNumber}`}>
                                                    <AccordionTrigger>
                                                        <div className="flex flex-col items-start text-left">
                                                            <span className="font-semibold">Revision Cycle {cycle.cycleNumber}</span>
                                                            <span className="text-xs text-muted-foreground">Requested by {cycle.requestedBy.name} on {formatDate(cycle.requestedAt)}</span>
                                                        </div>
                                                    </AccordionTrigger>
                                                    <AccordionContent>
                                                        <ul className="list-disc pl-5 space-y-1">
                                                            {cycle.items.map(item => ( <li key={item.id} className={item.completed ? 'text-muted-foreground line-through' : ''}>{item.text}</li> ))}
                                                        </ul>
                                                    </AccordionContent>
                                                </AccordionItem>
                                            ))}
                                        </Accordion>
                                    ) : (
                                        <p className="text-center text-muted-foreground text-sm py-8">No past revision history for this post.</p> 
                                    )}
                                </TabsContent>
                            </Tabs>
                        </div>
                    </ScrollArea>
                    <ScrollArea className="md:col-span-1 h-full border-l">
                         <div className="p-6 space-y-6">
                            {(isAssignee && !isManagerOrAdmin) && (
                              <div className="space-y-2">
                                {postState.status === 'Preview' ? (
                                    <Button className="w-full" variant="outline" onClick={handleRecallSubmission} disabled={isSaving}>
                                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <RotateCcw className="mr-2 h-4 w-4" />}
                                        Recall Submission
                                    </Button>
                                ) : (
                                    <Button
                                        className="w-full"
                                        onClick={handleSubmitForReview}
                                        disabled={!canSubmit || isSaving}
                                    >
                                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Check className="mr-2 h-4 w-4"/>}
                                        Submit for Review
                                    </Button>
                                )}
                                {!canSubmit && postState.status !== 'Preview' && postState.status !== 'Done' && (
                                    <p className="text-xs text-center text-destructive">Selesaikan semua subtugas dan unggah minimal 1 file deliverable baru untuk submission cycle ini.</p>
                                )}
                              </div>
                            )}

                             {isManagerOrAdmin && postState.status === 'Preview' && ( 
                                <div className="flex flex-col w-full gap-2">
                                    <Button className="w-full bg-green-600 hover:bg-green-700" onClick={() => setFinalReviewState({ isOpen: true, item: postState })} disabled={isSaving}>
                                        <CheckCircle className="mr-2 h-4 w-4"/>Approve and Complete
                                    </Button>
                                    <Button variant="outline" className="w-full text-destructive border-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setRevisionState({ isOpen: true, item: postState, items: [], currentItemText: '' })} disabled={isSaving}>
                                        <XCircle className="mr-2 h-4 w-4"/> Request Revisions
                                    </Button>
                                </div>
                            )}

                             {isManagerOrAdmin && postState.status === 'Done' && ( <Button className="w-full" variant="outline" onClick={handleReopenTask} disabled={isSaving}>{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}<RefreshCcw className="mr-2 h-4 w-4" />Reopen Task</Button> )}


                            <div className='space-y-4 p-4 rounded-lg border'>
                                <h3 className='font-semibold text-sm'>Social Media Details</h3>
                                <Separator/>
                                <FormItem className="grid grid-cols-3 items-center gap-2"><FormLabel className="text-muted-foreground">Brand</FormLabel><div className="col-span-2 flex items-center gap-2 text-sm font-medium"><Building2 className="h-4 w-4 text-muted-foreground" />{brands?.find(b => b.id === postState.brandId)?.name || 'N/A'}</div></FormItem>
                                <FormItem className="grid grid-cols-3 items-center gap-2"><FormLabel className="text-muted-foreground">Status</FormLabel><div className="col-span-2 text-sm font-medium">{postState.status}</div></FormItem>
                                <FormItem className="grid grid-cols-3 items-center gap-2"><FormLabel className="text-muted-foreground">Priority</FormLabel><div className="col-span-2 flex items-center gap-2 text-sm font-medium"><PriorityIcon className={`h-4 w-4 ${priorityInfo[postState.priority].color}`} />{postState.priority}</div></FormItem>
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

                             <div className='space-y-4 p-4 rounded-lg border'>
                                <div className="flex justify-between items-center"><h3 className='font-semibold text-sm'>Time Management</h3><div></div></div>
                                <Separator/>
                                  <FormField
                                      control={form.control}
                                      name="timeEstimate"
                                      render={({ field }) => (
                                          <FormItem className="grid grid-cols-3 items-center gap-2">
                                              <FormLabel className="text-muted-foreground text-sm">Estimasi (hari)</FormLabel>
                                              <div className="col-span-2">
                                                <Input type="number" step="0.5" {...field} onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)} placeholder="e.g. 4" readOnly={!canEditContent} />
                                              </div>
                                          </FormItem>
                                      )}
                                  />
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
                <div className="space-y-2"><Label htmlFor="gdrive-name-details">File Name</Label><Input id="gdrive-name-details" value={gdriveName} onChange={(e) => setGdriveName(e.target.value)} placeholder="e.g., Q3 Marketing Report" /></div>
                <div className="space-y-2"><Label htmlFor="gdrive-link-details">File Link</Label><Input id="gdrive-link-details" value={gdriveLink} onChange={(e) => setGdriveLink(e.target.value)} placeholder="https://docs.google.com/..." /></div>
            </div>
            <DialogFooter>
                <Button variant="ghost" onClick={() => setIsGdriveDialogOpen(false)}>Cancel</Button>
                <Button onClick={() => handleConfirmGdriveLink(gdriveFileType)}>Add Link</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
     <AlertDialog open={blockingAlert.isOpen} onOpenChange={(open) => setBlockingAlert(prev => ({...prev, isOpen: open}))}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>{blockingAlert.title}</AlertDialogTitle>
                <AlertDialogDescription>
                  {blockingAlert.suggestion}
                </AlertDialogDescription>
                  {blockingAlert.reasons.length > 0 && (
                      <div className="pt-2">
                           <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                              {blockingAlert.reasons.map((reason, index) => <li key={index}>{reason}</li>)}
                          </ul>
                      </div>
                  )}
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogAction onClick={() => setBlockingAlert({ isOpen: false, title: '', reasons: [] })}>OK</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    
    <Dialog open={revisionState.isOpen} onOpenChange={(open) => !open && setRevisionState({ isOpen: false, item: null, items: [], currentItemText: '' })}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Create Revision Checklist</DialogTitle>
                <DialogDescription>
                Revisions for item: <span className="font-bold text-foreground">{revisionState.item?.title}</span>
                </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh] -mx-6 px-6">
                <div className="py-4 space-y-6 px-6">
                    <div className="space-y-2">
                        <h4 className="font-semibold text-sm">Files for this Submission Cycle</h4>
                        <div className="space-y-2 max-h-32 overflow-y-auto pr-2">
                            {(() => {
                                const currentCycle = getCurrentSubmissionCycle(revisionState.item);
                                const cycleDeliverables = (revisionState.item?.deliverables || []).filter(d => d.forRevisionCycle === currentCycle);
                                
                                if (cycleDeliverables.length > 0) {
                                    return cycleDeliverables.map(att => (
                                        <div key={att.id} className="flex items-center justify-between rounded-md bg-secondary/50 p-2 text-sm">
                                            <a href={att.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 truncate hover:underline">
                                                {getFileIcon(att.name)}
                                                <span className="truncate" title={att.name}>{att.name}</span>
                                            </a>
                                            <div className="text-xs text-muted-foreground text-right shrink-0 ml-2">
                                                <p>{att.submittedBy?.name}</p>
                                                <p>{att.submittedAt ? formatDistanceToNow(new Date(att.submittedAt), { addSuffix: true }) : ''}</p>
                                            </div>
                                        </div>
                                    ));
                                } else {
                                    return <p className="text-sm text-muted-foreground">No new files were submitted for this cycle.</p>;
                                }
                            })()}
                        </div>
                    </div>
                    <Separator/>
                    <div className="space-y-4">
                        <h4 className="font-semibold text-sm">Revision Points</h4>
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
                                placeholder="e.g., Fix the logo placement"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleAddRevisionItem();
                                  }
                                }}
                            />
                            <Button onClick={handleAddRevisionItem} disabled={!revisionState.currentItemText.trim()}>
                                <Plus className="mr-2 h-4 w-4"/> Add
                            </Button>
                        </div>
                    </div>
                </div>
            </ScrollArea>
            <DialogFooter className="p-6 pt-4 border-t">
                <Button variant="ghost" onClick={() => setRevisionState({ isOpen: false, item: null, items: [], currentItemText: '' })}>Cancel</Button>
                <Button variant="destructive" onClick={handleConfirmRejection} disabled={isSaving || revisionState.items.length === 0}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Request Revisions
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>

    <Dialog open={finalReviewState.isOpen} onOpenChange={(open) => !open && setFinalReviewState({ isOpen: false, item: null })}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Final Review & Complete Task</DialogTitle>
                <DialogDescription>
                    You are about to mark this item as "Done". Please review the items below to ensure everything is complete.
                </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh] -mx-6 px-6">
              <div className="py-4 space-y-6 px-6">
                <div className="space-y-3">
                    <h4 className="font-medium text-sm flex items-center gap-2"><ListChecks className="h-4 w-4" />Sub-tasks</h4>
                     <div className="space-y-2 max-h-32 overflow-y-auto pr-2">
                        {finalReviewState.item?.subtasks && finalReviewState.item.subtasks.length > 0 ? (
                             finalReviewState.item.subtasks.map(subtask => ( 
                                <div key={subtask.id} className="flex items-center gap-3">
                                    <Checkbox id={`final-review-${subtask.id}`} checked={subtask.completed} disabled />
                                    <label htmlFor={`final-review-${subtask.id}`} className={`flex-1 text-sm ${subtask.completed ? 'line-through text-muted-foreground' : ''}`}>{subtask.title}</label>
                                </div> 
                            )) 
                        ) : ( 
                            <p className="text-sm text-muted-foreground">No sub-tasks for this item.</p> 
                        )}
                    </div>
                </div>
                 <div className="space-y-3">
                    <h4 className="font-medium text-sm flex items-center gap-2"><UploadCloud className="h-4 w-4" />Deliverables for this Submission</h4>
                     <div className="space-y-2 max-h-32 overflow-y-auto pr-2">
                         {(() => {
                            const currentCycle = getCurrentSubmissionCycle(finalReviewState.item);
                            const cycleDeliverables = (finalReviewState.item?.deliverables || []).filter(d => d.forRevisionCycle === currentCycle);
                            
                            if (cycleDeliverables.length > 0) {
                                return cycleDeliverables.map(att => ( 
                                    <div key={att.id} className="flex items-center justify-between rounded-md bg-secondary/50 p-2 text-sm">
                                        <a href={att.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 truncate hover:underline">
                                            {getFileIcon(att.name)}
                                            <span className="truncate" title={att.name}>{att.name}</span>
                                        </a>
                                        <div className="text-xs text-muted-foreground text-right shrink-0 ml-2">
                                            <p>{att.submittedBy?.name}</p>
                                            <p>{att.submittedAt ? formatDistanceToNow(new Date(att.submittedAt), { addSuffix: true }) : ''}</p>
                                        </div>
                                    </div>
                                ));
                            } else {
                                return <p className="text-sm text-muted-foreground">No new files submitted for this cycle.</p>;
                            }
                        })()}
                    </div>
                </div>
              </div>
            </ScrollArea>
            <DialogFooter className="p-6 pt-0">
                <Button variant="ghost" onClick={() => setFinalReviewState({ isOpen: false, item: null })}>Cancel</Button>
                <Button variant="default" onClick={handleFinalReviewAndComplete}>
                    <Check className="mr-2 h-4 w-4" />
                    Confirm & Complete
                </Button>
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

const itemType = 'socialMediaPosts'; // Define itemType here or pass as prop if it's dynamic

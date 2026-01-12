'use client';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTrigger,
  SheetFooter,
  SheetTitle,
} from '@/components/ui/sheet';
import type { Task, TimeLog, User, Priority, Tag, Subtask, Comment, Attachment, Notification, Activity, Brand, WorkflowStatus, SharedLink, RevisionItem, RevisionCycle, SharedTask } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
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


const taskDetailsSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  brandId: z.string().min(1, 'Brand is required'),
  description: z.string().optional(),
  status: z.string(),
  priority: z.enum(['Urgent', 'High', 'Medium', 'Low']),
  assigneeIds: z.array(z.string()).optional(),
  timeEstimate: z.coerce.number().min(0).optional(),
  dueDate: z.string().optional(),
});

type TaskDetailsFormValues = z.infer<typeof taskDetailsSchema>;

const formatStopwatch = (time: number) => {
  const hours = Math.floor(time / 3600);
  const minutes = Math.floor((time % 3600) / 60);
  const seconds = time % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const formatHours = (hours: number = 0) => {
    const h = Math.floor(hours);
    const m = Math.floor((hours - h) * 60);
    return `${h}h ${m}m`;
};

type AIValidationState = {
  isOpen: boolean;
  isChecking: boolean;
  reason: string;
  onConfirm: () => void;
};

interface FinalReviewState {
  isOpen: boolean;
  task: Task | null;
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

const getCurrentSubmissionCycle = (task: Task | null): number => {
    if (!task) return 1;
    const historyLength = task.revisionHistory?.length ?? 0;

    if (historyLength > 0) {
        return historyLength + 1;
    }
    
    if (task.status === 'Revisi' && (task.revisionItems?.length ?? 0) > 0) {
        return 2; 
    }

    return 1;
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


const createActivity = (user: User, action: string): Activity => {
    return {
      id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      user: { id: user.id, name: user.name, avatarUrl: user.avatarUrl || '' },
      action: action,
      timestamp: new Date().toISOString() as any,
    };
};

const formatDate = (date: any): string => {
    if (!date) return 'N/A';
    const dateObj = date.toDate ? date.toDate() : new Date(date);
    if (isNaN(dateObj.getTime())) return 'Invalid date';
    return format(dateObj, 'PP, p');
};
  
interface RevisionState {
  isOpen: boolean;
  task: Task | null;
  items: Omit<RevisionItem, 'id' | 'completed'>[];
  currentItemText: string;
}

export function TaskDetailsSheet({ 
  task: initialTask, 
  open,
  onOpenChange,
}: TaskDetailsSheetProps) {
  const { t } = useI18n();
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();

  const isSharedView = !!params.linkId;

  const [sharedData, setSharedData] = useState<any>({ session: null, error: null });
  const { session, error: sharedError } = sharedData;
  const linkId = isSharedView ? (params.linkId as string) : null;
  const sharedTaskConfig = null;
  
  const accessLevel = useMemo(() => {
    if (isSharedView) {
      if (sharedTaskConfig) return sharedTaskConfig.allowedActions.includes('changeStatus') ? 'status' : 'view';
      if (session) return session.accessLevel;
    }
    return 'full';
  }, [isSharedView, session, sharedTaskConfig]);


  const [isUploading, setIsUploading] = React.useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [elapsedTime, setElapsedTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  
  const [newComment, setNewComment] = useState('');
  const [commentAttachment, setCommentAttachment] = useState<File | null>(null);
  const [isUploadingCommentAttachment, setIsUploadingCommentAttachment] = useState(false);
  
  const [currentAssignees, setCurrentAssignees] = useState<User[]>([]);
  const [currentTags, setCurrentTags] = useState<Tag[]>([]);
  
  const [newSubtask, setNewSubtask] = useState('');
  const [newSubtaskAssignee, setNewSubtaskAssignee] = useState<User | null>(null);

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  
  const [isGdriveDialogOpen, setIsGdriveDialogOpen] = useState(false);
  const [gdriveLink, setGdriveLink] = useState('');
  const [gdriveName, setGdriveName] = useState('');
  const [gdriveFileType, setGdriveFileType] = useState<'attachment' | 'deliverable'>('attachment');
  const [isMentioning, setIsMentioning] = React.useState(false);
  const [mentionSuggestions, setMentionSuggestions] = React.useState<User[]>([]);

  const [finalReviewState, setFinalReviewState] = useState<FinalReviewState>({ isOpen: false, task: null });
  const [endOfDayState, setEndOfDayState] = useState<EndOfDayState>({ isOpen: false });
  const [blockingAlert, setBlockingAlert] = useState<{ isOpen: boolean, title: string, reasons: string[], suggestion?: string }>({ isOpen: false, title: '', reasons: [], suggestion: '' });
  const [isDeleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [revisionState, setRevisionState] = useState<RevisionState>({ isOpen: false, task: null, items: [], currentItemText: '' });


  const [taskState, setTaskState] = useState(initialTask);
  useEffect(() => { setTaskState(initialTask) }, [initialTask]);


  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const deliverableFileInputRef = React.useRef<HTMLInputElement>(null);
  const commentFileInputRef = React.useRef<HTMLInputElement>(null);

  const [aiValidation, setAiValidation] = useState<AIValidationState>({ isOpen: false, isChecking: false, reason: '', onConfirm: () => {} });
  
  const form = useForm<TaskDetailsFormValues>({
    resolver: zodResolver(taskDetailsSchema),
  });

  const firestore = useFirestore();
  const storage = useStorage();
  
  const { user: authUser, profile: currentUser } = useUserProfile();
  const { permissions, isLoading: arePermsLoading } = !isSharedView ? usePermissions() : { permissions: null, isLoading: false };


  const allTasksQuery = useMemo(() => {
    if (isSharedView || !firestore || !currentUser) return null;
    return query(collection(firestore, 'tasks'), where('companyId', '==', currentUser.companyId));
  }, [firestore, currentUser, isSharedView]);
  const { data: allTasks, isLoading: areAllTasksLoading } = useCollection<Task>(allTasksQuery);
  
  const usersQuery = useMemo(() => {
    if (isSharedView) return null;
    if (!firestore || !currentUser) return null;
    let q = query(collection(firestore, 'users'), where('companyId', '==', currentUser.companyId));
    
    if (currentUser.role === 'Employee' && currentUser.managerId) {
      q = query(q, where('managerId', '==', currentUser.managerId));
    }
    return q;
  }, [firestore, currentUser, isSharedView]);
  const { data: allUsers } = useCollection<User>(usersQuery);
  
  const { data: allStatusesData } = useCollection<WorkflowStatus>(useMemo(() => 
    !isSharedView && firestore ? query(collection(firestore, 'statuses'), orderBy('order')) : null,
    [firestore, isSharedView]
  ));
  
  const statuses = useMemo(() => {
    if (isSharedView && session) return session.snapshot.statuses || [];
    if (isSharedView && sharedTaskConfig) return sharedTaskConfig.snapshot.statuses || [];
    return allStatusesData || [];
  }, [isSharedView, session, sharedTaskConfig, allStatusesData]);

  const brandsQuery = useMemo(() => {
    if (isSharedView || !firestore || !currentUser) return null;
    if (currentUser.role === 'Super Admin') {
        return query(collection(firestore, 'brands'), orderBy('name'));
    }
    if (currentUser.role === 'Manager') {
        if (!currentUser.brandIds || currentUser.brandIds.length === 0) return null;
        return query(collection(firestore, 'brands'), where('__name__', 'in', currentUser.brandIds), orderBy('name'));
    }
    return query(collection(firestore, 'brands'), orderBy('name'));
  }, [firestore, currentUser, isSharedView]);
  const { data: brands, isLoading: areBrandsLoading } = useCollection<Brand>(brandsQuery);

 const groupedUsers = useMemo(() => {
    if (isSharedView) return { managers: [], employees: [], clients: [] };
    if (!allUsers || !currentUser) return { managers: [], employees: [], clients: [] };
    
    const self = allUsers.find(u => u.id === currentUser.id);

    if (currentUser.role === 'Super Admin') {
      const managers = allUsers.filter(u => u.role === 'Manager');
      const employees = allUsers.filter(u => u.role === 'Employee');
      const clients = allUsers.filter(u => u.role === 'Client');
      return { managers, employees, clients };
    }
    
    if (currentUser.role === 'Manager') {
        const myEmployees = allUsers.filter(u => u.managerId === currentUser.id && u.id !== currentUser.id);
        return { managers: self ? [self] : [], employees: myEmployees, clients: [] };
    }
    
    if (currentUser.role === 'Employee') {
      const myTeam = allUsers.filter(u => u.managerId === currentUser.managerId);
      return { managers: [], employees: myTeam, clients: [] };
    }

    return { managers: [], employees: [], clients: [] };

  }, [allUsers, currentUser, isSharedView]);

  const dependencyOptions = useMemo(() => {
    if (isSharedView || !allTasks || !currentUser) return [];
    
    let relevantTasks = allTasks.filter(task => task.id !== taskState.id);

    if (currentUser.role === 'Manager') {
        relevantTasks = relevantTasks.filter(task => currentUser.brandIds?.includes(task.brandId));
    } else if (currentUser.role === 'Employee' || currentUser.role === 'PIC') {
        const userBrandIds = new Set(
            allTasks.filter(t => t.assigneeIds.includes(currentUser.id)).map(t => t.brandId)
        );
        relevantTasks = relevantTasks.filter(task => userBrandIds.has(task.brandId));
    }
    
    return relevantTasks;
  }, [allTasks, currentUser, taskState, isSharedView]);
  
  const groupedDependencyOptions = useMemo(() => {
      const grouped: Record<string, Task[]> = {};
      dependencyOptions.forEach(task => {
          const brandName = brands?.find(b => b.id === task.brandId)?.name || 'Unbranded';
          if (!grouped[brandName]) {
              grouped[brandName] = [];
          }
          grouped[brandName].push(task);
      });
      return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
  }, [dependencyOptions, brands]);


  const isCreator = currentUser?.id === taskState.createdBy.id;
  const isManagerOfBrand = currentUser?.role === 'Manager' && taskState.brandId && currentUser.brandIds?.includes(taskState.brandId);
  const isAssignee = !!currentUser && taskState.assigneeIds.includes(currentUser.id);
  const isManagerOrAdmin = !isSharedView && currentUser && (currentUser.role === 'Manager' || currentUser.role === 'Super Admin');
  const isEmployeeOrPIC = !isSharedView && currentUser && (currentUser.role === 'Employee' || currentUser.role === 'PIC');

  const creatorIsEmployee = useMemo(() => {
    if (isSharedView) return session?.creatorRole === 'Employee' || session?.creatorRole === 'PIC';
    return false;
  }, [isSharedView, session]);
  
  const taskIsFromManager = useMemo(() => {
    if (isSharedView) return taskState.createdBy.id !== session?.creatorId;
    return false;
  }, [isSharedView, taskState.createdBy.id, session?.creatorId]);


  const canEditContent = useMemo(() => {
    if (isSharedView) return false;
    if (!currentUser) return false;
    // An employee cannot edit a task once it's in review
    if (isEmployeeOrPIC && taskState.status === 'Preview') return false;
    // Otherwise, standard edit permissions apply
    return currentUser.role === 'Super Admin' || isManagerOfBrand || isCreator;
  }, [isSharedView, currentUser, isEmployeeOrPIC, taskState.status, isManagerOfBrand, isCreator]);
      
  const canChangePriority = useMemo(() => {
      if (isSharedView) {
        if (accessLevel !== 'limited-edit') return false;
        return !(creatorIsEmployee && taskIsFromManager);
      }
      if (!currentUser) return false;
      return currentUser.role === 'Super Admin' || currentUser.role === 'Manager';
  }, [currentUser, isSharedView, accessLevel, creatorIsEmployee, taskIsFromManager]);
  
  const canEditDueDate = useMemo(() => {
    if (isSharedView) {
      if (accessLevel !== 'limited-edit') return false;
      return !(creatorIsEmployee && taskIsFromManager);
    }
    return canEditContent;
  }, [isSharedView, accessLevel, canEditContent, creatorIsEmployee, taskIsFromManager]);

  const canComment = useMemo(() => {
    if (isSharedView) return accessLevel !== 'view';
    return !!currentUser;
  }, [isSharedView, accessLevel, currentUser]);
  
  const currentFormStatus = form.watch('status');
  
  const canChangeStatus = useMemo(() => {
    if (isSharedView) return accessLevel === 'status' || accessLevel === 'limited-edit';
    if (!currentUser) return false;
    return true; 
  }, [isSharedView, accessLevel, currentUser]);
  
  const canAssignUsers = isSharedView ? false : canEditContent;
  
  const canManageSubtasks = useMemo(() => {
    if (isSharedView) return false;
    if (!currentUser) return false;
    return isAssignee || isManagerOrAdmin;
  }, [isSharedView, currentUser, isAssignee, isManagerOrAdmin]);

  const canCompleteSubtask = (subtask: Subtask): boolean => {
    if (isSharedView) return false;
    if (!currentUser) return false;

    // The person assigned to the subtask can complete it.
    if (subtask.assignee?.id === currentUser.id) return true;

    // The person who created the main task can complete any subtask.
    if (isCreator) return true;

    // Any manager or admin can complete any subtask.
    if (isManagerOrAdmin) return true;
    
    return false;
  };
  
  const showTimeTracker = useMemo(() => {
      if (isSharedView) return false;
      if (!isAssignee) return false;
      return !['Preview', 'Revisi', 'Done'].includes(form.getValues('status'));
  }, [isAssignee, isSharedView, form]);
  
  const canDeleteTask = useMemo(() => {
    if (isSharedView) return false;
    if (!currentUser || arePermsLoading) return false;
    if (currentUser.role === 'Super Admin') return true;
    if (currentUser.role === 'Manager' && permissions) {
        return permissions.Manager.canDeleteTasks && (currentUser.brandIds || []).includes(taskState.brandId);
    }
    if (currentUser.role === 'Employee' || currentUser.role === 'PIC') {
        return taskState.createdBy?.id === currentUser.id;
    }
    return false;
  }, [currentUser, permissions, arePermsLoading, taskState, isSharedView]);

  const canUploadDeliverables = useMemo(() => {
    if (isSharedView) {
        if (accessLevel === 'view') return false;
    }
    if (!currentUser) return false;
    // An employee cannot upload a deliverable if it is already waiting for review
    if (isEmployeeOrPIC && taskState.status === 'Preview') return false;
    return isAssignee || isManagerOrAdmin;
  }, [isSharedView, accessLevel, isAssignee, isManagerOrAdmin, isEmployeeOrPIC, taskState.status, currentUser]);


  const handlePauseSession = useCallback(async (actionSource: 'auto-pause' | 'manual' = 'manual') => {
      if (!firestore || !currentUser || !taskState.currentSessionStartTime || !isRunning) return;

      const taskRef = doc(firestore, "tasks", taskState.id);
      
      const startTime = parseISO(taskState.currentSessionStartTime).getTime();
      const now = Date.now();
      const sessionDurationInSeconds = (now - startTime) / 1000;
      const newTimeTrackedInHours = (taskState.timeTracked || 0) + (sessionDurationInSeconds / 3600);
      
      const actionText = actionSource === 'auto-pause'
          ? `session auto-paused at end of day`
          : `paused a work session after ${formatStopwatch(Math.round(sessionDurationInSeconds))}`;
      
      const newActivity: Activity = createActivity(currentUser, actionText);
      
      try {
          await updateDoc(taskRef, {
              timeTracked: newTimeTrackedInHours,
              currentSessionStartTime: deleteField(),
              lastActivity: newActivity,
              activities: [...(taskState.activities || []), newActivity]
          });
          setIsRunning(false);
          setElapsedTime(0);
          if (actionSource === 'manual') {
              toast({ title: 'Session Paused', description: 'Your work has been logged.' });
          }
      } catch (error) {
          console.error("Failed to pause session:", error);
          if (actionSource === 'manual') {
              toast({ variant: 'destructive', title: 'Update Failed', description: 'Could not log your work.' });
          }
      }
  }, [firestore, currentUser, taskState, toast, isRunning]);


  const handleStartSession = useCallback(async (actionSource: 'auto-start' | 'manual' = 'manual') => {
      if (isSharedView || !firestore || !currentUser || isRunning) return;

      const taskRef = doc(firestore, "tasks", taskState.id);
      const activitiesToAdd: Activity[] = [];
      const updates: Partial<Task> = { currentSessionStartTime: new Date().toISOString() };

      if (taskState.status === 'To Do') {
          updates.status = 'Doing';
          activitiesToAdd.push(createActivity(currentUser, 'changed status from "To Do" to "Doing"'));
      }
      
      const actionText = actionSource === 'auto-start' 
          ? 'session auto-started on task open' 
          : 'started a work session';
      activitiesToAdd.push(createActivity(currentUser, actionText));
      
      updates.activities = [...(taskState.activities || []), ...activitiesToAdd];
      updates.lastActivity = activitiesToAdd[activitiesToAdd.length - 1];
      if (!taskState.actualStartDate) updates.actualStartDate = new Date().toISOString();
      
      await updateDoc(taskRef, updates);
      setIsRunning(true);
      if (actionSource === 'manual') {
          toast({ title: 'Session Started' });
      }
  }, [firestore, currentUser, taskState, toast, isRunning, isSharedView]);


  useEffect(() => {
      if (open && isAssignee && taskState.status === 'To Do' && !isSharedView) {
          handleStartSession('auto-start');
      }
  }, [open, isAssignee, taskState.status, handleStartSession, isSharedView]);


  useEffect(() => {
    if (isSharedView) return;

    const checkTime = () => {
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();

        if (hours === 12 && minutes === 0 && isRunning) {
            handlePauseSession('auto-pause');
        }
        
        if (hours === 13 && minutes === 0 && !isRunning && taskState.status === 'Doing') {
            const lastActivity = taskState.activities?.[taskState.activities.length - 1];
            if (lastActivity?.action.includes('auto-paused')) {
                handleStartSession('auto-start');
            }
        }

        if (hours === 17 && minutes === 0 && isRunning) {
            setEndOfDayState({ isOpen: true });
        }
    };

    const timer = setInterval(checkTime, 60 * 1000);
    return () => clearInterval(timer);
  }, [isRunning, handlePauseSession, handleStartSession, isSharedView, taskState]);


  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isRunning) {
      interval = setInterval(() => setElapsedTime(prevTime => prevTime + 1), 1000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [isRunning]);
  
  
  useEffect(() => {
    if (taskState && open) {
        form.reset({
            title: taskState.title,
            brandId: taskState.brandId,
            description: taskState.description || '',
            status: taskState.status,
            priority: taskState.priority,
            assigneeIds: taskState.assignees?.map(a => a.id) || [],
            timeEstimate: taskState.timeEstimate,
            dueDate: taskState.dueDate ? format(parseISO(taskState.dueDate), 'yyyy-MM-dd') : undefined,
        });
        
        setCurrentAssignees(taskState.assignees || []);
        setCurrentTags(taskState.tags || []);
        setNewComment('');
        setCommentAttachment(null);
        setNewSubtaskAssignee(null);

        if (taskState.currentSessionStartTime && !isSharedView) {
            const startTime = parseISO(taskState.currentSessionStartTime).getTime();
            const now = Date.now();
            setElapsedTime(Math.floor((now - startTime) / 1000));
            setIsRunning(true);
        } else {
            setElapsedTime(0);
            setIsRunning(false);
        }
    }
  }, [taskState, form, open, isSharedView]);

  const getBlockingReasonsForStatusChange = (targetStatus: string, currentTask: Task): BlockingReason => {
    const reasons: string[] = [];
    const baseResult = { blocked: false, title: '', reasons: [], suggestion: '' };

    if (targetStatus === 'Preview') {
        const allSubtasksCompleted = (currentTask.subtasks || []).every(st => st.completed);
        if (!allSubtasksCompleted) reasons.push("Selesaikan semua subtasks dulu.");

        const isInRevision = currentTask.status === 'Revisi' || (currentTask.revisionItems && currentTask.revisionItems.length > 0);
        if (isInRevision) {
            const allRevisionsCompleted = (currentTask.revisionItems || []).every(item => item.completed);
            if (!allRevisionsCompleted) reasons.push("Checklist revisi belum selesai.");
        }

        const currentCycle = getCurrentSubmissionCycle(currentTask);
        const hasDeliverableForCycle = (currentTask.deliverables || []).some(d => d.forRevisionCycle === currentCycle);
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

    if (!isSharedView) {
      const block = getBlockingReasonsForStatusChange(newStatus, taskState);
      if (block.blocked) {
          setBlockingAlert({ isOpen: true, ...block });
          return;
      }
    }
    
    form.setValue('status', newStatus);

    if (isRunning && !isSharedView) {
        await handlePauseSession();
    }
    
    if (isSharedView) {
        try {
            const response = await fetch('/api/share/update-task', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ linkId, taskId: taskState.id, updates: { status: newStatus } }),
            });
            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.message || 'Failed to update status');
            }
            const data = await response.json();
            if (data.updatedTask) {
              setTaskState(data.updatedTask);
            }
            toast({ title: 'Status Updated', description: `Task status changed to ${newStatus}.` });
        } catch (error: any) {
            form.setValue('status', oldStatus);
            toast({ variant: 'destructive', title: 'Update Failed', description: error.message });
        }
        return;
    }
    
    if (!firestore || !currentUser) {
        form.setValue('status', oldStatus);
        return;
    }
    
    const newActivity = createActivity(currentUser, `changed status from "${oldStatus}" to "${newStatus}"`);
    const taskRef = doc(firestore, 'tasks', taskState.id);
    
    try {
        const batch = writeBatch(firestore);
        const updates: Partial<Task> = { status: newStatus, activities: [...(taskState.activities || []), newActivity], lastActivity: newActivity, updatedAt: serverTimestamp() as any };
        if (oldStatus === 'Revisi' && newStatus === 'Doing') updates.isUnderRevision = true;
        if (newStatus !== 'Doing' && taskState.isUnderRevision) updates.isUnderRevision = deleteField() as any;
        if (oldStatus === 'To Do' && newStatus !== 'To Do' && !taskState.actualStartDate) updates.actualStartDate = new Date().toISOString();
        if (newStatus === 'Done' && oldStatus !== 'Done') updates.actualCompletionDate = new Date().toISOString();
        if (newStatus !== 'Done' && oldStatus === 'Done') updates.actualCompletionDate = deleteField() as any;

        const notificationTitle = `Status Changed: ${taskState.title}`;
        const notificationMessage = `${currentUser.name} changed status to ${newStatus}.`;
        
        const notifiedUserIds = new Set<string>();
        taskState.assigneeIds.forEach(id => { if (id !== currentUser.id) notifiedUserIds.add(id); });
        if (taskState.createdBy.id !== currentUser.id) notifiedUserIds.add(taskState.createdBy.id);

        notifiedUserIds.forEach(userId => {
            const notifRef = doc(collection(firestore, `users/${userId}/notifications`));
            batch.set(notifRef, { userId, title: notificationTitle, message: notificationMessage, taskId: taskState.id, isRead: false, createdAt: serverTimestamp() as any, createdBy: newActivity.user });
        });
        
        batch.update(taskRef, updates);
        await batch.commit();

        toast({ title: 'Status Updated', description: `Task status changed to ${newStatus}.` });
    } catch (error: any) {
        console.error('Failed to update status:', error);
        form.setValue('status', oldStatus);
        toast({ variant: 'destructive', title: 'Update Failed', description: 'Could not update task status.' });
    }
  };


  const handlePriorityChange = async (newPriority: Priority) => {
    const currentPriority = form.getValues('priority');
    if (currentPriority === newPriority) return;

    if (!canChangePriority) {
        toast({ variant: "destructive", title: "Permission Denied", description: "You are not authorized to change the task priority." });
        form.setValue('priority', currentPriority);
        return;
    }
    
    form.setValue('priority', newPriority);

    const applyChange = async (priority: Priority) => {
      const updates = { priority };
      if (isSharedView) {
          try {
              const response = await fetch('/api/share/update-task', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ linkId, taskId: taskState.id, updates })
              });
              if (!response.ok) throw new Error('Failed to update priority.');
              toast({ title: 'Priority Updated', description: `Task priority set to ${priority}.` });
          } catch (error) {
              console.error('Failed to update priority:', error);
              form.setValue('priority', currentPriority); 
              toast({ variant: 'destructive', title: 'Update Failed' });
          }
      } else {
        if (!firestore || !currentUser) return;
        const taskRef = doc(firestore, 'tasks', taskState.id);
        const newActivity = createActivity(currentUser, `set priority from "${currentPriority}" to "${priority}"`);
        try {
            await updateDoc(taskRef, {
                ...updates,
                activities: [...(taskState.activities || []), newActivity],
                lastActivity: newActivity,
                updatedAt: serverTimestamp(),
            });
            toast({ title: 'Priority Updated', description: `Task priority set to ${priority}.` });
        } catch (error: any) {
            console.error('Failed to update priority:', error);
            form.setValue('priority', currentPriority); 
            toast({ variant: 'destructive', title: 'Update Failed', description: 'Could not update task priority.' });
        }
      }
    };
    
    if (isSharedView) { await applyChange(newPriority); return; }
    
    const priorityValues: Record<Priority, number> = { 'Low': 0, 'Medium': 1, 'High': 2, 'Urgent': 3 };
    if (priorityValues[newPriority] <= priorityValues[currentPriority]) {
        await applyChange(newPriority);
        return;
    }

    setAiValidation({ ...aiValidation, isChecking: true });
    try {
        const result = await validatePriorityChange({
            title: form.getValues('title'), description: form.getValues('description'), currentPriority, requestedPriority: newPriority,
        });

        if (result.isApproved) {
            await applyChange(newPriority);
            toast({ title: 'AI Agrees!', description: result.reason });
        } else {
            setAiValidation({ isOpen: true, isChecking: false, reason: result.reason, onConfirm: async () => { await applyChange(newPriority); setAiValidation({ ...aiValidation, isOpen: false }); } });
        }
    } catch (e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'AI Validation Failed', description: 'Applying directly.' });
        await applyChange(newPriority);
    } finally {
        if (aiValidation.isChecking) { setAiValidation(prev => ({ ...prev, isChecking: false })); }
    }
  };

  const handleMentionSelect = (user: User) => {
    const currentComment = newComment;
    const atIndex = currentComment.lastIndexOf('@');
    const newCommentText = `${currentComment.substring(0, atIndex)}@${user.name.split(' ')[0]} `;
    setNewComment(newCommentText);
    setIsMentioning(false);
  };
  
  const handlePostComment = async () => {
    if (!newComment.trim()) return;

    if (isSharedView) {
      if (!linkId) return;
      setIsUploadingCommentAttachment(true);
      try {
        const response = await fetch('/api/share/update-task', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ linkId, taskId: taskState.id, newComment: { text: newComment } }),
        });
        if (!response.ok) { throw new Error((await response.json()).message || 'Failed to post comment.'); }
        const data = await response.json();
        if (data.updatedTask) { setTaskState(data.updatedTask); }
        toast({ title: 'Success', description: 'Your comment has been posted.' });
        setNewComment('');
      } catch (error: any) {
        toast({ variant: "destructive", title: "Comment Failed", description: error.message });
      } finally {
        setIsUploadingCommentAttachment(false);
      }
      return;
    }

    if (!firestore || !currentUser) return;
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
        comments: [...(taskState.comments || []), newCommentData],
        activities: [...(taskState.activities || []), newActivity],
        lastActivity: newActivity,
      };

      await updateDoc(doc(firestore, 'tasks', taskState.id), updates);
      toast({ title: 'Comment Posted' });
      setNewComment('');
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Comment Failed', description: error.message });
    } finally {
      setIsUploadingCommentAttachment(false);
    }
  };

  const handleCommentFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) setCommentAttachment(file);
  };
  
  const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setNewComment(text);
    if (!isSharedView && allUsers) {
      const mentionMatch = text.match(/@(\w*)$/);
      if (mentionMatch) {
        setIsMentioning(true);
        setMentionSuggestions(allUsers.filter(u => u.name.toLowerCase().includes(mentionMatch[1].toLowerCase())));
      } else {
        setIsMentioning(false);
      }
    }
  };


  const handleToggleSubtask = async (subtaskId: string) => {
    if (isSharedView || !firestore) return;
    const newSubtasks = taskState.subtasks?.map(st => st.id === subtaskId ? { ...st, completed: !st.completed } : st) || [];
    await updateDoc(doc(firestore, 'tasks', taskState.id), { subtasks: newSubtasks });
  };
  
  const handleToggleRevisionItem = async (itemId: string) => {
    if (isSharedView || !isAssignee || !firestore) return;
    const newItems = taskState.revisionItems?.map(item => item.id === itemId ? { ...item, completed: !item.completed } : item);
    await updateDoc(doc(firestore, 'tasks', taskState.id), { revisionItems: newItems });
  };


  const handleAddSubtask = async () => {
    if (!newSubtask.trim() || isSharedView || !firestore) return;
    let assignedUser = newSubtaskAssignee || (currentAssignees.length === 1 ? currentAssignees[0] : (!isManagerOrAdmin && currentUser ? currentUser : null));
    const subtask: Subtask = { id: `st-${Date.now()}`, title: newSubtask, completed: false, ...(assignedUser && { assignee: { id: assignedUser.id, name: assignedUser.name, avatarUrl: assignedUser.avatarUrl || '' } }) };
    await updateDoc(doc(firestore, 'tasks', taskState.id), { subtasks: [...(taskState.subtasks || []), subtask] });
    setNewSubtask(''); setNewSubtaskAssignee(null);
  };
  
  const handleRemoveSubtask = async (subtaskId: string) => {
    if (isSharedView || !firestore) return;
    await updateDoc(doc(firestore, 'tasks', taskState.id), { subtasks: taskState.subtasks?.filter(st => st.id !== subtaskId) });
  }
  
  const handleAssignSubtask = async (subtaskId: string, user: User | null) => {
    if (isSharedView || !firestore) return;
    const newSubtasks = taskState.subtasks?.map(st => st.id === subtaskId ? { ...st, assignee: user ? { id: user.id, name: user.name, avatarUrl: user.avatarUrl || '' } : undefined } : st);
    await updateDoc(doc(firestore, 'tasks', taskState.id), { subtasks: newSubtasks });
  };

  const getFileIcon = (fileName: string) => {
    if (fileName.match(/\.(pdf)$/i)) return <FileText className="h-5 w-5 text-red-500" />;
    if (fileName.match(/\.(doc|docx)$/i)) return <FileText className="h-5 w-5 text-blue-500" />;
    if (fileName.match(/\.(jpg|jpeg|png|gif)$/i)) return <FileImage className="h-5 w-5 text-green-500" />;
    return <FileText className="h-5 w-5 text-muted-foreground" />;
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>, fileType: 'attachment' | 'deliverable') => {
      if (isSharedView || !event.target.files || !storage || !taskState?.id || !firestore || !currentUser) return;
      setIsUploading(true);
      try {
          const files = Array.from(event.target.files);
          const currentCycle = getCurrentSubmissionCycle(taskState);
          const uploadPromises = files.map(async (file) => {
              const attachmentId = `${Date.now()}-${file.name}`;
              const storageRef = ref(storage, `attachments/${taskState.id}/${attachmentId}`);
              await uploadBytes(storageRef, file);
              const url = await getDownloadURL(storageRef);
              return { id: attachmentId, name: file.name, type: 'local' as const, url, submittedAt: new Date().toISOString(), submittedBy: { id: currentUser.id, name: currentUser.name, avatarUrl: currentUser.avatarUrl || '' }, forRevisionCycle: fileType === 'deliverable' ? currentCycle : undefined };
          });
          const newFiles = await Promise.all(uploadPromises);
          const currentFiles = fileType === 'attachment' ? (taskState.attachments || []) : (taskState.deliverables || []);
          await updateDoc(doc(firestore, 'tasks', taskState.id), { [fileType === 'attachment' ? 'attachments' : 'deliverables']: [...currentFiles, ...newFiles] });
          toast({ title: 'Upload Successful' });
      } catch (error) {
          toast({ variant: 'destructive', title: 'Upload Failed' });
      } finally {
          setIsUploading(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
          if (deliverableFileInputRef.current) deliverableFileInputRef.current.value = '';
      }
  };

  const handleConfirmGdriveLink = async (fileType: 'attachment' | 'deliverable') => {
      if (!gdriveLink || !gdriveName) {
          toast({ variant: 'destructive', title: 'Missing Info', description: 'Please provide both a link and a name.' });
          return;
      }
      if (isSharedView || !firestore || !currentUser) return;
      
      const currentCycle = getCurrentSubmissionCycle(taskState);
      const newFile: Attachment = { id: `gdrive-${Date.now()}`, name: gdriveName, type: 'gdrive', url: gdriveLink, submittedAt: new Date().toISOString(), submittedBy: { id: currentUser.id, name: currentUser.name, avatarUrl: currentUser.avatarUrl || '' }, forRevisionCycle: fileType === 'deliverable' ? currentCycle : undefined };
      const fieldToUpdate = fileType === 'attachment' ? 'attachments' : 'deliverables';
      await updateDoc(doc(firestore, 'tasks', taskState.id), { [fieldToUpdate]: [...(taskState[fieldToUpdate] || []), newFile] });
      setIsGdriveDialogOpen(false); setGdriveLink(''); setGdriveName('');
  };


  const handleRemoveFile = async (id: string, fileType: 'attachment' | 'deliverable') => {
      if (isSharedView || !firestore) return;
      const fieldToUpdate = fileType === 'attachment' ? 'attachments' : 'deliverables';
      await updateDoc(doc(firestore, 'tasks', taskState.id), { [fieldToUpdate]: taskState[fieldToUpdate]?.filter(att => att.id !== id) });
  };
  
  const handleAddDependency = async (taskId: string, type: 'waitingOnTaskIds' | 'blockingTaskIds' | 'linkedTaskIds') => {
    if (isSharedView || !firestore) return;
    const currentDeps = taskState[type] || [];
    if (!currentDeps.includes(taskId)) {
        await updateDoc(doc(firestore, 'tasks', taskState.id), { [type]: [...currentDeps, taskId] });
    }
  };
  
  const handleRemoveDependency = async (taskId: string, type: 'waitingOnTaskIds' | 'blockingTaskIds' | 'linkedTaskIds') => {
    if (isSharedView || !firestore) return;
    const currentDeps = taskState[type] || [];
    await updateDoc(doc(firestore, 'tasks', taskState.id), { [type]: currentDeps.filter(id => id !== taskId) });
  };


  const subtaskProgress = useMemo(() => {
    if (!taskState.subtasks || taskState.subtasks.length === 0) return 0;
    return (taskState.subtasks.filter(st => st.completed).length / taskState.subtasks.length) * 100;
  }, [taskState.subtasks]);

  const onSubmit = async (data: TaskDetailsFormValues) => {
    if (isSharedView || !firestore || !currentUser) return;
    setIsSaving(true);
    const updates: Partial<Task> = {
      title: data.title,
      description: data.description,
      dueDate: data.dueDate,
      brandId: data.brandId,
      assigneeIds: currentAssignees.map((a) => a.id),
      assignees: currentAssignees,
      tags: currentTags,
      timeEstimate: data.timeEstimate,
    };

    const taskDocRef = doc(firestore, 'tasks', taskState.id);
    const actionDescription = 'updated task details';
    const newActivity: Activity = createActivity(currentUser, actionDescription);

    try {
      await updateDoc(taskDocRef, {
        ...updates,
        lastActivity: newActivity,
        activities: [...(taskState.activities || []), newActivity],
        updatedAt: serverTimestamp(),
      });
      toast({ title: 'Task Updated' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Update Failed' });
    } finally {
      setIsSaving(false);
    }
  };
  
  const timeEstimateValue = form.watch('timeEstimate') ?? taskState.timeEstimate ?? 0;
  const timeTracked = useMemo(() => taskState.timeTracked || 0, [taskState.timeTracked]);
  const timeTrackingProgress = timeEstimateValue > 0 ? (timeTracked / timeEstimateValue) * 100 : 0;
    
  const handleSelectUser = (user: User) => {
    if (!currentAssignees.find((u) => u.id === user.id)) setCurrentAssignees([...currentAssignees, user]);
  };
  const handleRemoveUser = (userId: string) => setCurrentAssignees(currentAssignees.filter((u) => u.id !== userId));
  const handleSelectTag = (tag: Tag) => { if (!currentTags.find(t => t.label === tag.label)) setCurrentTags([...currentTags, tag]); }
  const handleRemoveTag = (tagLabel: string) => setCurrentTags(currentTags.filter(t => t.label !== tagLabel));

  const priorityValue = form.watch('priority');
  const brandId = form.watch('brandId');
  const brand = useMemo(() => {
    if (isSharedView && session) return session.snapshot.brands.find(b => b.id === taskState.brandId);
    return brands?.find(b => b.id === brandId);
  }, [brands, brandId, isSharedView, session, taskState.brandId]);
  
 const canSubmit = useMemo(() => {
    if (!taskState || isSharedView) return false;
    const reasons = getBlockingReasonsForStatusChange('Preview', taskState);
    return !reasons.blocked;
  }, [taskState, isSharedView]);
  
  const handleDelete = () => {
    if (!firestore || !taskState || !canDeleteTask) return;
    deleteDocumentNonBlocking(doc(firestore, 'tasks', taskState.id));
    toast({ title: "Task Deleted", description: "The task is being removed." });
    onOpenChange(false);
    setDeleteConfirmOpen(false);
  };
  
  const handleFinalReviewAndComplete = async () => {
    if (!isManagerOrAdmin || !taskState) return;
    await handleStatusChange('Done');
    setFinalReviewState({ isOpen: false, task: null });
  };
  
  const handleSubmitForReview = async () => {
    if (!currentUser) return;
    await handleStatusChange('Preview');
  };
  
  const handleRecallSubmission = async () => {
    if (!currentUser) return;
    // When recalling, it's logical to move it back to 'Doing' state
    await handleStatusChange('Doing');
    toast({ title: "Submission Recalled", description: "You can continue working on the task." });
  };
  
  const completionStatus = useMemo(() => {
    if (taskState.status !== 'Done' || !taskState.actualCompletionDate || !taskState.dueDate) return null;
    const completionDate = parseISO(taskState.actualCompletionDate);
    const dueDate = endOfDay(parseISO(taskState.dueDate));
    if (isAfter(completionDate, dueDate)) {
        return { status: 'Late', duration: formatLateness(dueDate, completionDate) };
    }
    return { status: 'On Time', duration: null };
  }, [taskState.status, taskState.actualCompletionDate, taskState.dueDate]);
  
  const getUniqueActivities = (activities: Activity[]): Activity[] => {
    if (!activities) return [];
    const seen = new Set();
    return activities.filter(activity => {
        const duplicate = seen.has(activity.id);
        seen.add(activity.id);
        return !duplicate;
    });
  };

  const handleReopenTask = async () => {
    if (!currentUser || !isManagerOrAdmin) return;
    await handleStatusChange('Revisi');
  }

 const subtaskAssigneeOptions = useMemo(() => {
    if (isSharedView) return {};
    if (!allUsers || !currentUser) return {};
    const createGroup = (title: string, users: User[]) => users.length > 0 ? { [title]: users } : {};
    const mainAssignees = currentAssignees;
    if (currentUser.role === 'Super Admin') {
        const otherUsers = allUsers.filter(u => u.role !== 'Client' && !mainAssignees.some(a => a.id === u.id));
        return { ...createGroup("Task Assignees", mainAssignees), ...createGroup("Other Members", otherUsers) };
    }
    if (currentUser.role === 'Manager') {
        const myTeam = allUsers.filter(u => u.managerId === currentUser.id);
        const otherMembers = myTeam.filter(u => !mainAssignees.some(a => a.id === u.id));
        return { ...createGroup("Task Assignees", mainAssignees), ...createGroup("My Team", otherMembers) };
    }
    if (currentUser.role === 'Employee') {
        const manager = allUsers.find(u => u.id === currentUser.managerId);
        const myTeam = allUsers.filter(u => u.managerId === currentUser.managerId);
        
        const teamWithManager = [...myTeam];
        if (manager && !teamWithManager.some(u => u.id === manager.id)) {
            teamWithManager.push(manager);
        }

        const otherTeamMembers = teamWithManager.filter(u => !mainAssignees.some(a => a.id === u.id));

        return {
            ...createGroup("Task Assignees", mainAssignees),
            ...createGroup("My Team", otherTeamMembers),
        };
    }
    return {};
}, [currentAssignees, allUsers, currentUser, isSharedView]);

  const canShareTask = !isSharedView && currentUser && (currentUser.role === 'Employee' || currentUser.role === 'PIC' || currentUser.role === 'Client');
  
  const groupedDeliverables = useMemo(() => {
    const groups: Record<number, Attachment[]> = {};
    (taskState.deliverables || []).forEach(d => {
        const cycle = d.forRevisionCycle ?? 1;
        if (!groups[cycle]) groups[cycle] = [];
        groups[cycle].push(d);
    });
    return groups;
  }, [taskState.deliverables]);

  const handleAddRevisionItem = () => {
    if (revisionState.currentItemText.trim()) {
        setRevisionState(prev => ({
            ...prev,
            items: [...prev.items, { text: prev.currentItemText }],
            currentItemText: '',
        }));
    }
  };

 const handleConfirmRejection = async () => {
    if (!revisionState.task || revisionState.items.length === 0 || !firestore || !currentUser) {
        toast({ variant: 'destructive', title: 'Checklist Empty', description: 'Please add at least one revision point.' });
        return;
    }
    setIsSaving(true);
    const task = revisionState.task;
    const taskRef = doc(firestore, 'tasks', task.id);
    const newStatus = 'Revisi';
    
    const newRevisionItems: RevisionItem[] = revisionState.items.map(item => ({ id: crypto.randomUUID(), text: item.text, completed: false }));
    
    const newRevisionCycle: RevisionCycle = {
        cycleNumber: (task.revisionHistory?.length ?? 0) + 1,
        requestedAt: new Date().toISOString() as any,
        requestedBy: { id: currentUser.id, name: currentUser.name, avatarUrl: currentUser.avatarUrl || '' },
        items: newRevisionItems,
    };
    
    const taskUpdateData: any = {
        status: newStatus,
        revisionItems: newRevisionItems,
        revisionHistory: [...(task.revisionHistory || []), newRevisionCycle],
        lastActivity: createActivity(currentUser, `requested revisions and moved task to "${newStatus}"`),
        updatedAt: serverTimestamp() as any,
        actualCompletionDate: deleteField(),
    };
    taskUpdateData['activities'] = [...(task.activities || []), taskUpdateData.lastActivity];
    
    try {
        await updateDoc(taskRef, taskUpdateData);
        toast({ title: 'Revisions Requested', description: 'The task has been sent for revision.' });
        
        const notificationBatch = writeBatch(firestore);
        const notificationMessage = `${currentUser.name} requested revisions on "${task.title.substring(0, 30)}...".`;
        
        task.assigneeIds.forEach(assigneeId => {
            if (assigneeId !== currentUser.id) {
                const notifRef = doc(collection(firestore, `users/${assigneeId}/notifications`));
                notificationBatch.set(notifRef, {
                    userId: assigneeId,
                    title: 'Revisions Required',
                    message: notificationMessage,
                    taskId: task.id,
                    isRead: false,
                    createdAt: serverTimestamp(),
                    createdBy: { id: currentUser.id, name: currentUser.name, avatarUrl: currentUser.avatarUrl || '' },
                });
            }
        });
        
        await notificationBatch.commit().catch(notifError => {
            console.error('[requestRevisions] Notification failed but task was updated:', notifError);
            toast({ variant: 'destructive', title: 'Task Updated, Notif Failed', description: 'The task was sent for revision, but notifications could not be sent.' });
        });

    } catch (error: any) {
        console.error('[requestRevisions] Critical task update failed:', error);
        setTaskState(task); // Revert UI
        toast({ variant: 'destructive', title: 'Update Failed', description: 'Could not send task for revision. Please try again.' });
    } finally {
        setIsSaving(false);
        setRevisionState({ isOpen: false, task: null, items: [], currentItemText: '' });
    }
  };
  
  const renderDependencyList = (ids: string[], type: 'waitingOnTaskIds' | 'blockingTaskIds' | 'linkedTaskIds') => (
      <div className="flex flex-wrap gap-2">
          {(ids || []).map(id => {
              const task = allTasks?.find(t => t.id === id);
              return task ? (
                  <Badge key={id} variant="secondary">
                      {task.title}
                      {canEditContent && (
                        <button onClick={() => handleRemoveDependency(id, type)} className="ml-2 rounded-full hover:bg-background/50 p-0.5">
                            <X className="h-3 w-3" />
                        </button>
                      )}
                  </Badge>
              ) : null;
          })}
      </div>
  );


  return (
    <>
      {isSharedView && <SharedViewLogic onDataLoaded={setSharedData} />}
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="flex flex-col p-0 h-screen w-screen max-w-full">
          <SheetHeader className="p-4 border-b flex-shrink-0">
             <SheetTitle className='sr-only'>Task Details for {taskState.title}</SheetTitle>
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {taskState.createdBy && (
                        <div className='flex items-center gap-2'>
                           <Avatar className="h-6 w-6"><AvatarImage src={taskState.createdBy.avatarUrl} /><AvatarFallback>{taskState.createdBy.name.charAt(0)}</AvatarFallback></Avatar>
                           <span>Created by {taskState.createdBy.name}</span>
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2">
                  <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm"><MoreHorizontal className="h-4 w-4"/></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                          {!isSharedView && (
                              <ShareTaskDialog task={taskState}>
                                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                      <Share2 className="mr-2 h-4 w-4"/>
                                      Share Task
                                  </DropdownMenuItem>
                              </ShareTaskDialog>
                          )}
                           {!isSharedView && (
                              <DropdownMenuItem onClick={() => setIsHistoryOpen(true)}>
                                  <History className="mr-2 h-4 w-4"/>
                                  View History
                              </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          {canDeleteTask && (
                            <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10" onClick={() => setDeleteConfirmOpen(true)}>
                                <Trash2 className="mr-2 h-4 w-4"/>
                                Delete Task
                            </DropdownMenuItem>
                          )}
                      </DropdownMenuContent>
                  </DropdownMenu>
                </div>
             </div>
          </SheetHeader>
          <div className="flex-1 min-h-0">
          <Form {...form}>
            <form id="task-details-form" onSubmit={form.handleSubmit(onSubmit)}>
              <ScrollArea className="h-full" style={{height: 'calc(100vh - 128px)'}}>
                <div className="grid md:grid-cols-3">
                  <div className="md:col-span-2 p-6 space-y-6">
                      {showTimeTracker && (
                        <div className="p-4 rounded-lg bg-secondary/50 space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <h3 className="font-semibold">Time Tracker</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Total Logged: <span className="font-medium text-foreground">{formatHours(timeTracked)}</span>
                                    </p>
                                </div>
                                {isRunning ? (
                                    <div className="p-3 rounded-md bg-background border border-primary/20 flex items-center gap-4">
                                        <div className="flex items-center gap-2">
                                          <span className="relative flex h-3 w-3">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                                          </span>
                                          <span className="text-sm font-medium text-primary">Session Running</span>
                                        </div>
                                        <span className="font-mono text-lg text-primary">{formatStopwatch(elapsedTime)}</span>
                                    </div>
                                ) : (
                                    <Button onClick={() => handleStartSession('manual')}><PlayCircle className="mr-2"/> Start Session</Button>
                                )}
                            </div>
                        </div>
                      )}
                      
                      <FormField control={form.control} name="title" render={({ field }) => ( <Input {...field} readOnly={!canEditContent} className="text-2xl font-bold border-dashed h-auto p-0 border-0 focus-visible:ring-1"/> )}/>

                      {taskState.revisionItems && taskState.revisionItems.length > 0 && (
                          <div className="space-y-4 rounded-lg border border-orange-500/50 bg-orange-500/10 p-4">
                              <h3 className="font-semibold flex items-center gap-2 text-orange-600 dark:text-orange-400"><RefreshCcw className="h-5 w-5"/> Revision Checklist</h3>
                              <div className="space-y-2">
                                  {taskState.revisionItems.map(item => (
                                      <div key={item.id} className="flex items-center gap-3">
                                          <Checkbox id={`rev-${item.id}`} checked={item.completed} onCheckedChange={() => handleToggleRevisionItem(item.id)} disabled={!isAssignee || isSharedView} />
                                          <label htmlFor={`rev-${item.id}`} className={`flex-1 text-sm ${item.completed ? 'line-through text-muted-foreground' : ''}`}>{item.text}</label>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      )}

                      <div className="space-y-2">
                         <Accordion type="single" collapsible defaultValue={!taskState.description ? "description" : undefined}>
                            <AccordionItem value="description" className="border-none">
                                <AccordionTrigger className="text-sm font-semibold flex-row-reverse justify-end gap-2 p-0 hover:no-underline">
                                    {taskState.description ? 'View/Edit Description' : 'Add Description'}
                                </AccordionTrigger>
                                <AccordionContent className="pt-2">
                                    <FormField
                                        control={form.control}
                                        name="description"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormControl>
                                                    <RichTextEditor
                                                        value={field.value || ''}
                                                        onChange={field.onChange}
                                                        placeholder="Add a more detailed description..."
                                                        readOnly={!canEditContent}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                      </div>

                       <div className="space-y-4 rounded-lg border p-4">
                            <h3 className="font-semibold text-base">Files</h3>
                            <Separator />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                                <div>
                                    <h4 className="font-medium text-sm mb-2">Deliverables</h4>
                                    <div className="space-y-2">
                                        {Object.entries(groupedDeliverables).sort(([a], [b]) => Number(b) - Number(a)).map(([cycleNum, deliverables]) => ( <div key={`del-${cycleNum}`} className="space-y-2"><h4 className="font-semibold text-xs text-muted-foreground">{Number(cycleNum) === 1 ? 'Initial Submission' : `Revision ${Number(cycleNum)-1} Submission`}</h4>{deliverables.map(att => ( <div key={att.id} className="flex items-center justify-between rounded-md bg-secondary/50 p-2 text-sm"><a href={att.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 truncate hover:underline">{getFileIcon(att.name)}<span className="truncate" title={att.name}>{att.name}</span></a>{canUploadDeliverables && ( <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => handleRemoveFile(att.id, 'deliverable')}><X className="h-4 w-4" /></Button> )}</div> ))}</div> ))}
                                        {(taskState.deliverables || []).length === 0 && <p className="text-center text-muted-foreground text-sm py-4">No deliverables submitted.</p>}
                                    </div>
                                    {canUploadDeliverables && (
                                        <div className="flex gap-2 mt-2">
                                            <input type="file" ref={deliverableFileInputRef} onChange={(e) => handleFileChange(e, 'deliverable')} multiple className="hidden" />
                                            <Button type="button" size="sm" variant="outline" className="flex-1" onClick={() => deliverableFileInputRef.current?.click()} disabled={isUploading}>{isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Upload className="mr-2 h-4 w-4" />} Upload Deliverable</Button>
                                            <Button type="button" size="sm" variant="outline" className="flex-1" onClick={() => { setGdriveFileType('deliverable'); setIsGdriveDialogOpen(true); }}><LinkIcon className="mr-2 h-4 w-4" /> Link Deliverable</Button>
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <h4 className="font-medium text-sm mb-2">Supporting Materials</h4>
                                    <div className="space-y-2">
                                    {(taskState.attachments || []).map((att) => ( <div key={att.id} className="flex items-center justify-between rounded-md bg-secondary/50 p-2 text-sm"><a href={att.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 truncate hover:underline">{getFileIcon(att.name)}<span className="truncate" title={att.name}>{att.name}</span></a>{canEditContent && ( <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => handleRemoveFile(att.id, 'attachment')}><X className="h-4 w-4" /></Button> )}</div> ))}
                                    {(taskState.attachments || []).length === 0 && <p className="text-center text-muted-foreground text-sm py-4">No materials attached.</p>}
                                    </div>
                                    {canEditContent && (
                                        <div className="flex gap-2 mt-2">
                                            <input type="file" ref={fileInputRef} onChange={(e) => handleFileChange(e, 'attachment')} multiple className="hidden" />
                                            <Button type="button" size="sm" variant="outline" className="flex-1" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>{isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Upload className="mr-2 h-4 w-4" />} Upload Material</Button>
                                            <Button type="button" size="sm" variant="outline" className="flex-1" onClick={() => { setGdriveFileType('attachment'); setIsGdriveDialogOpen(true); }}><LinkIcon className="mr-2 h-4 w-4" /> Link Material</Button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                      
                      <Tabs defaultValue="comments" className="w-full">
                        <TabsList className="grid w-full grid-cols-4">
                          <TabsTrigger value="comments"><MessageSquare className="mr-2"/>Comments</TabsTrigger>
                          <TabsTrigger value="subtasks"><ListTodo className="mr-2"/>Subtasks</TabsTrigger>
                          <TabsTrigger value="dependencies"><GitMerge className="mr-2"/>Dependencies</TabsTrigger>
                          <TabsTrigger value="revisions"><History className="mr-2"/>Revisions</TabsTrigger>
                        </TabsList>
                         <TabsContent value="comments" className="mt-4 space-y-4 rounded-lg border p-4 relative">
                              <ScrollArea className="max-h-48 pr-2">
                                  <div className="space-y-4">
                                      {(taskState.comments || []).map((comment) => ( <div key={comment.id} className="flex items-start gap-3"><Avatar className="h-8 w-8"><AvatarImage src={comment.user.avatarUrl}/><AvatarFallback>{comment.user.name.charAt(0)}</AvatarFallback></Avatar><div><p className="text-sm font-medium">{comment.user.name} <span className="text-xs text-muted-foreground font-normal">{formatDistanceToNow(parseISO(comment.timestamp), { addSuffix: true })}</span></p><p className="text-sm">{comment.text}</p></div></div> ))}
                                      {(taskState.comments || []).length === 0 && <p className="text-center text-muted-foreground text-sm py-8">No comments yet. Start the conversation!</p>}
                                  </div>
                              </ScrollArea>
                              {canComment && (
                                  <div className="space-y-2 pt-4 border-t">
                                      <div className="flex-1 relative">
                                          <Textarea placeholder="Write a comment... (use '@' to mention)" value={newComment} onChange={handleCommentChange} />
                                          {isMentioning && ( <Card className="absolute bottom-full mb-2 w-full max-h-48 overflow-y-auto"><CardContent className="p-1">{mentionSuggestions.map(user => ( <Button key={user.id} variant="ghost" className="w-full justify-start gap-2" onClick={() => handleMentionSelect(user)}><Avatar className="h-6 w-6"><AvatarImage src={user.avatarUrl}/><AvatarFallback>{user.name.charAt(0)}</AvatarFallback></Avatar>{user.name}</Button> ))}</CardContent></Card> )}
                                      </div>
                                       <div className="flex justify-between items-center">
                                          <div className="flex-1">
                                          </div>
                                          <Button type="button" onClick={() => handlePostComment()} disabled={!newComment.trim() || isUploadingCommentAttachment}>
                                                {isUploadingCommentAttachment ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4"/>}
                                                Post Comment
                                          </Button>
                                       </div>
                                  </div>
                              )}
                        </TabsContent>
                        <TabsContent value="subtasks" className="mt-4 space-y-4 rounded-lg border p-4">
                              <div className="space-y-2"><div className="flex justify-between text-xs text-muted-foreground"><span>Progress</span><span>{(taskState.subtasks || []).filter(st => st.completed).length}/{(taskState.subtasks || []).length}</span></div><Progress value={subtaskProgress} /></div>
                              <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                                  {(taskState.subtasks || []).map((subtask) => ( <div key={subtask.id} className="flex items-center gap-3 p-2 bg-secondary/50 rounded-md hover:bg-secondary transition-colors"><Checkbox id={`subtask-${subtask.id}`} checked={subtask.completed} onCheckedChange={() => handleToggleSubtask(subtask.id)} disabled={!canCompleteSubtask(subtask)} /><label htmlFor={`subtask-${subtask.id}`} className={`flex-1 text-sm ${subtask.completed ? 'line-through text-muted-foreground' : ''}`}>{subtask.title}</label><Popover><PopoverTrigger asChild disabled={!canManageSubtasks}><Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">{subtask.assignee ? <Avatar className="h-6 w-6"><AvatarImage src={subtask.assignee.avatarUrl} /><AvatarFallback>{subtask.assignee.name.charAt(0)}</AvatarFallback></Avatar> : <UserPlus className="h-4 w-4" />}</Button></PopoverTrigger><PopoverContent className="w-60 p-1"><ScrollArea className="max-h-60"><div className="space-y-1"><Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => handleAssignSubtask(subtask.id, null)}>Unassigned</Button>{Object.entries(subtaskAssigneeOptions).map(([group, users]) => ( users.length > 0 && ( <React.Fragment key={group}><Separator /><div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{group}</div>{users.map(user => ( <Button key={user.id} variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={() => handleAssignSubtask(subtask.id, user)}><Avatar className="h-6 w-6"><AvatarImage src={user.avatarUrl} /><AvatarFallback>{user.name.charAt(0)}</AvatarFallback></Avatar><span className="truncate">{user.name}</span></Button> ))}</React.Fragment> ) ))}</div></ScrollArea></PopoverContent></Popover>{canManageSubtasks && <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => handleRemoveSubtask(subtask.id)}><Trash className="h-4 w-4"/></Button>}</div> ))}
                              </div>
                              {canManageSubtasks && ( <div className="flex items-center gap-2"><Input placeholder="Add a new subtask..." value={newSubtask} onChange={(e) => setNewSubtask(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddSubtask())} /><Popover><PopoverTrigger asChild><Button variant="ghost" size="icon" className="text-muted-foreground">{newSubtaskAssignee ? ( <Avatar className="h-6 w-6"><AvatarImage src={newSubtaskAssignee.avatarUrl} /><AvatarFallback>{newSubtaskAssignee.name.charAt(0)}</AvatarFallback></Avatar> ) : ( <UserPlus className="h-4 w-4" /> )}</Button></PopoverTrigger><PopoverContent className="w-60 p-1"><ScrollArea className="max-h-60"><div className="space-y-1"><Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => setNewSubtaskAssignee(null)}>Unassigned</Button>{Object.entries(subtaskAssigneeOptions).map(([group, users]) => ( users.length > 0 && ( <React.Fragment key={group}><Separator /><div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{group}</div>{users.map(user => ( <Button key={user.id} variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={() => setNewSubtaskAssignee(user)}><Avatar className="h-6 w-6"><AvatarImage src={user.avatarUrl} /><AvatarFallback>{user.name.charAt(0)}</AvatarFallback></Avatar><span className="truncate">{user.name}</span></Button> ))}</React.Fragment> ) ))}</div></ScrollArea></PopoverContent></Popover><Button type="button" onClick={handleAddSubtask}><Plus className="h-4 w-4 mr-2" /> Add</Button></div> )}
                        </TabsContent>
                        <TabsContent value="dependencies" className="mt-4 space-y-6 rounded-lg border p-4">
                          <div className="space-y-3">
                              <h4 className="text-sm font-semibold flex items-center gap-2"><Workflow className="h-4 w-4 text-orange-500" />Waiting On</h4>
                              <p className="text-xs text-muted-foreground">Tugas-tugas ini harus selesai sebelum tugas ini bisa dimulai.</p>
                              {renderDependencyList(taskState.waitingOnTaskIds, 'waitingOnTaskIds')}
                              {canEditContent && (
                                <Popover>
                                    <PopoverTrigger asChild><Button variant="outline" size="sm" className="h-7"><Plus className="mr-2 h-3 w-3" />Add...</Button></PopoverTrigger>
                                    <PopoverContent className="w-80"><Command><CommandInput placeholder="Search tasks..." /><CommandList><CommandEmpty>No tasks found.</CommandEmpty>{groupedDependencyOptions.map(([brandName, tasks]) => (<CommandGroup key={brandName} heading={brandName}>{tasks.map(task => (<CommandItem key={task.id} onSelect={() => handleAddDependency(task.id, 'waitingOnTaskIds')}>{task.title}</CommandItem>))}</CommandGroup>))}</CommandList></Command></PopoverContent>
                                </Popover>
                              )}
                          </div>
                          <Separator/>
                          <div className="space-y-3">
                              <h4 className="text-sm font-semibold flex items-center gap-2"><Blocks className="h-4 w-4 text-red-500" />Blocking</h4>
                              <p className="text-xs text-muted-foreground">Tugas ini menghalangi penyelesaian tugas-tugas berikut.</p>
                              {renderDependencyList(taskState.blockingTaskIds, 'blockingTaskIds')}
                              {canEditContent && (
                                <Popover>
                                    <PopoverTrigger asChild><Button variant="outline" size="sm" className="h-7"><Plus className="mr-2 h-3 w-3" />Add...</Button></PopoverTrigger>
                                    <PopoverContent className="w-80"><Command><CommandInput placeholder="Search tasks..." /><CommandList><CommandEmpty>No tasks found.</CommandEmpty>{groupedDependencyOptions.map(([brandName, tasks]) => (<CommandGroup key={brandName} heading={brandName}>{tasks.map(task => (<CommandItem key={task.id} onSelect={() => handleAddDependency(task.id, 'blockingTaskIds')}>{task.title}</CommandItem>))}</CommandGroup>))}</CommandList></Command></PopoverContent>
                                </Popover>
                              )}
                          </div>
                          <Separator/>
                          <div className="space-y-3">
                              <h4 className="text-sm font-semibold flex items-center gap-2"><LinkIcon className="h-4 w-4 text-blue-500" />Linked Tasks</h4>
                              <p className="text-xs text-muted-foreground">Tugas-tugas yang berhubungan tapi tidak saling memblokir.</p>
                              {renderDependencyList(taskState.linkedTaskIds, 'linkedTaskIds')}
                              {canEditContent && (
                                <Popover>
                                    <PopoverTrigger asChild><Button variant="outline" size="sm" className="h-7"><Plus className="mr-2 h-3 w-3" />Add...</Button></PopoverTrigger>
                                    <PopoverContent className="w-80"><Command><CommandInput placeholder="Search tasks..." /><CommandList><CommandEmpty>No tasks found.</CommandEmpty>{groupedDependencyOptions.map(([brandName, tasks]) => (<CommandGroup key={brandName} heading={brandName}>{tasks.map(task => (<CommandItem key={task.id} onSelect={() => handleAddDependency(task.id, 'linkedTaskIds')}>{task.title}</CommandItem>))}</CommandGroup>))}</CommandList></Command></PopoverContent>
                                </Popover>
                              )}
                          </div>
                        </TabsContent>
                        <TabsContent value="revisions" className="mt-4 space-y-2 rounded-lg border p-4">
                            {(taskState.revisionHistory && taskState.revisionHistory.length > 0) ? (
                                <Accordion type="single" collapsible>
                                    {taskState.revisionHistory.slice().sort((a, b) => b.cycleNumber - a.cycleNumber).map(cycle => (
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
                                <p className="text-center text-muted-foreground text-sm py-8">No past revision history for this task.</p> 
                            )}
                        </TabsContent>
                      </Tabs>
                  </div>
                  <div className="md:col-span-1 p-6 space-y-6">
                      {(isAssignee && !isManagerOrAdmin && !isSharedView) && (
                        <div className="space-y-2">
                           {taskState.status === 'Preview' ? (
                                <Button className="w-full" variant="outline" onClick={handleRecallSubmission} disabled={isSaving}>
                                    <RotateCcw className="mr-2 h-4 w-4" />
                                    Recall Submission
                                </Button>
                           ) : (
                                <Button
                                    className="w-full"
                                    onClick={handleSubmitForReview}
                                    disabled={!canSubmit || isSaving || taskState.status === 'Preview'}
                                >
                                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Check className="mr-2 h-4 w-4"/>}
                                    Submit for Review
                                </Button>
                           )}
                           {!canSubmit && taskState.status !== 'Preview' && (
                                <p className="text-xs text-center text-destructive">Selesaikan semua subtugas, poin revisi, dan unggah minimal 1 file deliverable baru untuk submission cycle ini.</p>
                           )}
                        </div>
                      )}
                  
                  {isManagerOrAdmin && taskState.status === 'Preview' && !isSharedView && ( 
                     <div className="flex flex-col w-full gap-2">
                        <Button className="w-full bg-green-600 hover:bg-green-700" onClick={handleFinalReviewAndComplete} disabled={isSaving}>
                            <CheckCircle className="mr-2 h-4 w-4"/>Approve and Complete
                        </Button>
                         <Button variant="outline" className="w-full text-destructive border-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setRevisionState({ isOpen: true, task: taskState, items: [], currentItemText: '' })} disabled={isSaving}>
                            <XCircle className="mr-2 h-4 w-4"/> Request Revisions
                        </Button>
                    </div>
                  )}

                  {isManagerOrAdmin && taskState.status === 'Done' && !isSharedView && ( <Button className="w-full" variant="outline" onClick={handleReopenTask} disabled={isSaving}>{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}<RefreshCcw className="mr-2 h-4 w-4" />Reopen Task</Button> )}

                  <div className='space-y-4 p-4 rounded-lg border'>
                    <h3 className='font-semibold text-sm'>Task Details</h3>
                    <Separator/>
                      <FormField control={form.control} name="brandId" render={({ field }) => ( <FormItem className="grid grid-cols-3 items-center gap-2"><FormLabel className="text-muted-foreground">Brand</FormLabel><div className="col-span-2">{ !canEditContent ? ( <div className="flex items-center gap-2 text-sm font-medium"><Building2 className="h-4 w-4 text-muted-foreground" />{brand?.name || 'N/A'}</div> ) : ( <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a brand" /></SelectTrigger></FormControl><SelectContent>{areBrandsLoading ? ( <div className="flex items-center justify-center p-2"><Loader2 className="h-4 w-4 animate-spin" /></div> ) : ( brands?.map((brand) => ( <SelectItem key={brand.id} value={brand.id}><div className="flex items-center gap-2"><Building2 className="h-4 w-4" />{brand.name}</div></SelectItem> )) )}</SelectContent></Select> )}</div></FormItem> )}/>
                      <FormItem className="grid grid-cols-3 items-center gap-2">
                          <FormLabel className="text-muted-foreground">Status</FormLabel>
                          <div className="col-span-2">
                            <FormField control={form.control} name="status" render={({ field }) => { return ( <Select onValueChange={(value) => handleStatusChange(value)} value={field.value} disabled={!canChangeStatus}><FormControl><SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger></FormControl><SelectContent>{(statuses || []).map(status => ( <SelectItem key={status.id} value={status.name} disabled={!canChangeStatus || (creatorIsEmployee && (status.name === 'Done' || status.name === 'Revisi')) || (isEmployeeOrPIC && (status.name === 'Done' || status.name === 'Revisi')) }>{status.name}</SelectItem> ))}</SelectContent></Select> ) }}/>
                          </div>
                      </FormItem>
                    <FormField control={form.control} name="priority" render={({ field }) => { const priority = priorityInfo[field.value]; return ( <FormItem className="grid grid-cols-3 items-center gap-2"><FormLabel className="text-muted-foreground">Priority</FormLabel><div className="col-span-2 flex items-center gap-2">{ !canChangePriority ? ( <div className="flex items-center gap-2 text-sm font-medium"><priority.icon className={`h-4 w-4 ${priority.color}`} />{priority.label}</div> ) : ( <><Select onValueChange={(v: Priority) => handlePriorityChange(v)} value={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent>{Object.values(priorityInfo).map(p => (<SelectItem key={p.value} value={p.value}><div className="flex items-center gap-2"><p.icon className={`h-4 w-4 ${p.color}`} />{p.label}</div></SelectItem>))}</SelectContent></Select>{aiValidation.isChecking && <Loader2 className="h-5 w-5 animate-spin" />}</> )}</div></FormItem> ) }}/>
                      <FormField control={form.control} name="dueDate" render={({ field }) => ( <FormItem className="grid grid-cols-3 items-center gap-2"><FormLabel className="text-muted-foreground">Due Date</FormLabel><div className="col-span-2">{!canEditDueDate ? ( <div className="text-sm font-medium">{field.value ? format(parseISO(field.value), 'MMM d, yyyy') : 'No due date'}</div> ) : ( <Input type="date" {...field} value={field.value || ''} /> )}</div></FormItem> )}/>
                      {completionStatus && ( <div className="grid grid-cols-3 items-center gap-2"><FormLabel className="text-muted-foreground">Completed</FormLabel><div className="col-span-2 flex items-center gap-2"><span className="text-sm font-medium">{format(parseISO(taskState.actualCompletionDate!), 'MMM d, yyyy')}</span>{completionStatus.status === 'On Time' ? (<Badge variant="secondary" className='bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'>On Time</Badge>) : (<Badge variant="destructive">{completionStatus.duration} late</Badge>)}</div></div> )}
                  </div>

                  <div className='space-y-4 p-4 rounded-lg border'>
                    <h3 className='font-semibold text-sm'>People</h3>
                    <Separator/>
                    <FormItem>
                        <FormLabel className="text-muted-foreground text-sm">Assignees</FormLabel>
                        {currentAssignees.map((user) => ( <div key={user.id} className="flex items-center justify-between gap-2"><div className="flex items-center gap-3"><Avatar className="h-8 w-8"><AvatarImage src={user.avatarUrl} alt={user.name} /><AvatarFallback>{user.name?.charAt(0)}</AvatarFallback></Avatar><p className="text-sm font-medium">{user.name}</p></div>{canAssignUsers && <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => handleRemoveUser(user.id)}><X className="h-4"/></Button>}</div> ))}
                        {canAssignUsers && ( <Popover><PopoverTrigger asChild><Button type="button" variant="outline" className="w-full mt-2"><Plus className="mr-2"/> Add Assignee</Button></PopoverTrigger><PopoverContent className="w-60 p-1"><ScrollArea className="max-h-60"><div className="space-y-1">{groupedUsers.managers.length > 0 && ( <><div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Managers</div>{groupedUsers.managers.map(user => ( <Button key={user.id} variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={() => handleSelectUser(user)}><Avatar className="h-6 w-6"><AvatarImage src={user.avatarUrl} /><AvatarFallback>{user.name.charAt(0)}</AvatarFallback></Avatar><span className="truncate">{user.name}</span></Button> ))}<Separator/></> )}{groupedUsers.employees.length > 0 && ( <><div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Employees</div>{groupedUsers.employees.map(user => ( <Button key={user.id} variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={() => handleSelectUser(user)}><Avatar className="h-6 w-6"><AvatarImage src={user.avatarUrl} /><AvatarFallback>{user.name.charAt(0)}</AvatarFallback></Avatar><span className="truncate">{user.name}</span></Button> ))}</> )}</div></ScrollArea></PopoverContent></Popover> )}
                    </FormItem>
                  </div>

                  <div className='space-y-4 p-4 rounded-lg border'>
                    <h3 className='font-semibold text-sm'>Categorization</h3>
                    <Separator/>
                    <FormItem>
                        <FormLabel className="text-muted-foreground text-sm">Tags</FormLabel>
                        <div className="flex flex-wrap gap-2">
                            {currentTags.map((tag) => ( <div key={tag.label} className={`flex items-center gap-1.5 rounded-full px-2 py-1 text-xs ${tag.color}`}>{tag.label}{canEditContent && <button type="button" onClick={() => handleRemoveTag(tag.label)}><X className="h-3 w-3"/></button>}</div> ))}
                            {canEditContent && ( <Popover><PopoverTrigger asChild><Button type="button" variant="outline" size="sm" className="h-6 rounded-full">+ Add</Button></PopoverTrigger><PopoverContent className="w-auto p-1"><div className="flex flex-col gap-1">{Object.values(allTags).map(tag => (<Button key={tag.label} variant="ghost" size="sm" className="justify-start" onClick={() => handleSelectTag(tag)}><div className="flex items-center gap-2"><div className={`w-3 h-3 rounded-full ${tag.color.split(' ')[0]}`}></div>{tag.label}</div></Button>))}</div></PopoverContent></Popover> )}
                        </div>
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
                                  {!canEditContent ? (
                                      <div className="text-sm font-medium">{timeEstimateValue ? (timeEstimateValue / 8) : 0} hari ({timeEstimateValue || 0} jam)</div>
                                  ) : (
                                      <div className='flex items-center gap-2'>
                                          <Input 
                                              type="number" 
                                              step="0.1"
                                              value={field.value !== undefined ? field.value / 8 : ''} 
                                              onChange={(e) => {
                                                  const days = e.target.value === '' ? undefined : parseFloat(e.target.value);
                                                  const hours = days !== undefined ? days * 8 : undefined;
                                                  field.onChange(hours);
                                              }} 
                                              placeholder="e.g. 1.5" 
                                          />
                                          <span className="text-sm text-muted-foreground whitespace-nowrap">({field.value || 0} jam)</span>
                                      </div>
                                  )}
                              </div>
                          </FormItem>
                      )}
                    />
                    <div className="space-y-2"><div className="grid grid-cols-3 items-center gap-2"><span className="text-sm text-muted-foreground">Total Logged</span><span className="col-span-2 text-sm font-medium">{formatHours(timeTracked)}</span></div><div className="col-span-3"><Progress value={timeTrackingProgress} /></div></div>
                  </div>
                </div>
                </div>
              </ScrollArea>
             </form>
           </Form>
        </div>
          <SheetFooter className="p-4 border-t flex-shrink-0">
              {canEditContent && ( <Button type="submit" form="task-details-form" disabled={isSaving}>{isSaving && <Loader2 className='h-4 w-4 mr-2 animate-spin' />}Save Changes</Button> )}
          </SheetFooter>
        </SheetContent>
      </Sheet>
      <AlertDialog open={aiValidation.isOpen} onOpenChange={(open) => setAiValidation(prev => ({...prev, isOpen: open}))}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>AI Priority Guard</AlertDialogTitle>
                <AlertDialogDescription>{aiValidation.reason}<br/><br/>Do you still want to set this task as Urgent?</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setAiValidation(prev => ({ ...prev, isOpen: false }))}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => { aiValidation.onConfirm(); setAiValidation(prev => ({ ...prev, isOpen: false })); }}>Yes, set as Urgent</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
       <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="max-w-2xl">
            <DialogHeader>
                <DialogTitle>Task Activity Log: {initialTask?.title}</DialogTitle>
                <DialogDescription>A complete history of all changes made to this task.</DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh] -mx-6 px-6">
                <div className="space-y-6 py-4">
                    {initialTask.activities && initialTask.activities.length > 0 ? ( 
                        getUniqueActivities(initialTask.activities).slice().sort((a, b) => { const dateA = a.timestamp ? (a.timestamp.toDate ? a.timestamp.toDate() : new Date(a.timestamp)).getTime() : 0; const dateB = b.timestamp ? (b.timestamp.toDate ? b.timestamp.toDate() : new Date(b.timestamp)).getTime() : 0; return dateB - dateA; }).map((activity) => ( 
                            <div key={activity.id} className="flex items-start gap-4">
                                <Avatar className="h-9 w-9"><AvatarImage src={activity.user.avatarUrl} alt={activity.user.name} /><AvatarFallback>{activity.user.name.charAt(0)}</AvatarFallback></Avatar>
                                <div>
                                    <p className="text-sm"><span className="font-semibold">{activity.user.name}</span> {activity.action}.</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">{formatDate(activity.timestamp)}</p>
                                </div>
                            </div> 
                        )) 
                    ) : ( 
                        <p className="text-center text-muted-foreground py-8">No activities recorded for this task yet.</p> 
                    )}
                </div>
            </ScrollArea>
        </DialogContent>
       </Dialog>
        <Dialog open={isGdriveDialogOpen} onOpenChange={setIsGdriveDialogOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Link Google Drive File</DialogTitle>
                    <DialogDescription>
                        Paste the shareable link to your Google Drive file below.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label htmlFor="gdrive-name-details">File Name</Label>
                        <Input id="gdrive-name-details" value={gdriveName} onChange={(e) => setGdriveName(e.target.value)} placeholder="e.g., Q3 Marketing Report" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="gdrive-link-details">File Link</Label>
                        <Input id="gdrive-link-details" value={gdriveLink} onChange={(e) => setGdriveLink(e.target.value)} placeholder="https://docs.google.com/..." />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => setIsGdriveDialogOpen(false)}>Cancel</Button>
                    <Button onClick={() => handleConfirmGdriveLink(gdriveFileType)}>Add Link</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        
        <AlertDialog open={endOfDayState.isOpen} onOpenChange={(open) => !open && setEndOfDayState({ isOpen: false })}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Jam Kerja Telah Usai</AlertDialogTitle>
                    <AlertDialogDescription>
                        Waktu kerja normal untuk hari ini telah berakhir. Apa yang ingin Anda lakukan untuk tugas ini?
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogAction onClick={() => { handlePauseSession('auto-pause'); setEndOfDayState({ isOpen: false }); }}>
                        Jeda & Lanjutkan Besok
                    </AlertDialogAction>
                    <AlertDialogCancel onClick={() => setEndOfDayState({ isOpen: false })}>
                        Lanjutkan Lembur
                    </AlertDialogCancel>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
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
        <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Hapus tugas ini?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Anda akan menghapus tugas: <strong className="text-foreground">{taskState.title}</strong>
                        <br/><br/>
                        {(['Doing', 'Preview', 'Revisi'].includes(taskState.status)) && (
                            <span className="text-destructive font-semibold">PERINGATAN: Tugas ini sedang berjalan. </span>
                        )}
                        Tindakan ini tidak dapat dibatalkan.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Batal</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
                        Ya, Hapus Tugas
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
         <Dialog open={revisionState.isOpen} onOpenChange={(open) => !open && setRevisionState({ isOpen: false, task: null, items: [], currentItemText: '' })}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create Revision Checklist</DialogTitle>
                    <DialogDescription>
                    Revisions for task: <span className="font-bold text-foreground">{revisionState.task?.title}</span>
                    </DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh] -mx-6 px-6">
                    <div className="space-y-4 px-6 py-4">
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
                </ScrollArea>
                <DialogFooter className="p-6 pt-4 border-t">
                    <Button variant="ghost" onClick={() => setRevisionState({ isOpen: false, task: null, items: [], currentItemText: '' })}>Cancel</Button>
                    <Button variant="destructive" onClick={handleConfirmRejection} disabled={isSaving || revisionState.items.length === 0}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Request Revisions
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <Dialog open={finalReviewState.isOpen} onOpenChange={(open) => !open && setFinalReviewState({ isOpen: false, task: null })}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Final Review & Complete Task</DialogTitle>
                    <DialogDescription>
                        Anda akan menyelesaikan tugas: <strong className="text-foreground">{finalReviewState.task?.title}</strong>. Mohon periksa item di bawah ini sebelum melanjutkan.
                    </DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh] -mx-6 px-6">
                  <div className="py-4 space-y-6 px-6">
                    <div className="space-y-3">
                        <h4 className="font-medium text-sm flex items-center gap-2"><ListChecks className="h-4 w-4" />Sub-tasks</h4>
                         <div className="space-y-2 max-h-32 overflow-y-auto pr-2">
                            {finalReviewState.task?.subtasks && finalReviewState.task.subtasks.length > 0 ? (
                                 finalReviewState.task.subtasks.map(subtask => ( 
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
                        <h4 className="font-medium text-sm flex items-center gap-2"><UploadCloud className="h-4 w-4" />Deliverables</h4>
                         <div className="space-y-2 max-h-32 overflow-y-auto pr-2">
                            {finalReviewState.task?.deliverables && finalReviewState.task.deliverables.length > 0 ? (
                                 finalReviewState.task.deliverables.map(att => ( 
                                    <div key={att.id} className="flex items-center gap-2 text-sm">
                                        <span>-</span>
                                        <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">{att.name}</a>
                                    </div>
                                )) 
                            ) : ( 
                                <p className="text-sm text-muted-foreground">No deliverables for this item.</p> 
                            )}
                        </div>
                    </div>
                  </div>
                </ScrollArea>
                <DialogFooter className="p-6 pt-0">
                    <Button variant="ghost" onClick={() => setFinalReviewState({ isOpen: false, task: null })}>Cancel</Button>
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

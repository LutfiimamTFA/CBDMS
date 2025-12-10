
'use client';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTrigger,
  SheetFooter,
  SheetTitle,
} from '@/components/ui/sheet';
import type { Task, TimeLog, User, Priority, Tag, Subtask, Comment, Attachment, Notification, Activity, Brand, WorkflowStatus, SharedLink } from '@/lib/types';
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
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AtSign, CalendarIcon, Clock, Edit, FileUp, GitMerge, History, ListTodo, LogIn, MessageSquare, PauseCircle, PlayCircle, Plus, Repeat, Send, Tag as TagIcon, Trash, Trash2, Users, Wand2, X, Share2, Star, Link as LinkIcon, Paperclip, MoreHorizontal, Copy, FileImage, FileText, Building2, CheckCircle, AlertCircle, RefreshCcw, UserPlus } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Separator } from '../ui/separator';
import { useI18n } from '@/context/i18n-provider';
import { Progress } from '../ui/progress';
import { format, formatDistanceToNow, parseISO, isAfter } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '../ui/checkbox';
import { ScrollArea } from '../ui/scroll-area';
import { validatePriorityChange } from '@/ai/flows/validate-priority-change';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Loader2 } from 'lucide-react';
import { useCollection, useFirestore, useUserProfile, useStorage } from '@/firebase';
import { collection, doc, writeBatch, serverTimestamp, query, orderBy, updateDoc, deleteField } from 'firebase/firestore';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { tags as allTags } from '@/lib/data';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Badge } from '../ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';


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

interface TaskDetailsSheetProps {
  task: Task;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  permissions?: SharedLink['permissions'] | null;
}

const createActivity = (user: User, action: string): Activity => {
    return {
      id: `act-${crypto.randomUUID()}`,
      user: { id: user.id, name: user.name, avatarUrl: user.avatarUrl || '' },
      action: action,
      timestamp: new Date().toISOString(),
    };
};
  

export function TaskDetailsSheet({ 
  task: initialTask, 
  open,
  onOpenChange,
  permissions = null,
}: TaskDetailsSheetProps) {
  const { t } = useI18n();
  const { toast } = useToast();
  const router = useRouter();
  const [isUploading, setIsUploading] = React.useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [elapsedTime, setElapsedTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [commentAttachment, setCommentAttachment] = useState<File | null>(null);
  const [isUploadingCommentAttachment, setIsUploadingCommentAttachment] = useState(false);
  
  const [currentAssignees, setCurrentAssignees] = useState<User[]>([]);
  const [currentTags, setCurrentTags] = useState<Tag[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [newSubtask, setNewSubtask] = useState('');
  const [newSubtaskAssignee, setNewSubtaskAssignee] = useState<User | null>(null);

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const commentFileInputRef = React.useRef<HTMLInputElement>(null);

  const [aiValidation, setAiValidation] = useState<AIValidationState>({ isOpen: false, isChecking: false, reason: '', onConfirm: () => {} });

  const firestore = useFirestore();
  const storage = useStorage();
  
  const usersCollectionRef = useMemo(() => {
    if (!firestore) return null;
    return collection(firestore, 'users');
  }, [firestore]);
  const { data: allUsers } = useCollection<User>(usersCollectionRef);
  
  const statusesQuery = useMemo(() => 
    firestore ? query(collection(firestore, 'statuses'), orderBy('order')) : null,
    [firestore]
  );
  const { data: allStatuses } = useCollection<WorkflowStatus>(statusesQuery);

  const brandsQuery = useMemo(() =>
    firestore ? query(collection(firestore, 'brands'), orderBy('name')) : null,
  [firestore]);
  const { data: brands, isLoading: areBrandsLoading } = useCollection<Brand>(brandsQuery);

  const { user: authUser, profile: currentUser } = useUserProfile();

  const groupedUsers = useMemo(() => {
    if (!allUsers || !currentUser) return { managers: [], employees: [], clients: [] };
    
    if (currentUser.role === 'Super Admin') {
      const managers = (allUsers || []).filter(u => u.role === 'Manager');
      const employees = (allUsers || []).filter(u => u.role === 'Employee');
      const clients = (allUsers || []).filter(u => u.role === 'Client');
      return { managers, employees, clients };
    }
    
    if (currentUser.role === 'Manager') {
      const managers = (allUsers || []).filter(u => u.role === 'Manager');
      const employees = (allUsers || []).filter(u => u.role === 'Employee');
      return { managers, employees, clients: [] };
    }
    
    if (currentUser.role === 'Employee') {
      const employees = (allUsers || []).filter(u => u.role === 'Employee');
      return { managers: [], employees, clients: [] };
    }

    return { managers: [], employees, clients: [] };

  }, [allUsers, currentUser]);

  const isSharedView = !!permissions;
  const canEditContent = isSharedView ? (permissions.canEditContent || false) : (currentUser && (currentUser.role === 'Super Admin' || currentUser.role === 'Manager'));
  const canComment = isSharedView ? (permissions.canComment || false) : !!currentUser;
  const canChangeStatus = isSharedView ? (permissions.canChangeStatus || false) : !!currentUser;
  const canAssignUsers = isSharedView ? (permissions.canAssignUsers || false) : canEditContent;
  const canManageSubtasks = isSharedView ? (permissions.canEditContent || false) : !!currentUser;
  
  const isAssignee = currentUser && initialTask.assigneeIds.includes(currentUser.id);
  const isEmployee = currentUser?.role === 'Employee';
  const isManagerOrAdmin = currentUser?.role === 'Manager' || currentUser?.role === 'Super Admin';

  const form = useForm<TaskDetailsFormValues>({
    resolver: zodResolver(taskDetailsSchema),
  });
  
  useEffect(() => {
    if (initialTask && open) {
        form.reset({
            title: initialTask.title,
            brandId: initialTask.brandId,
            description: initialTask.description || '',
            status: initialTask.status,
            priority: initialTask.priority,
            assigneeIds: initialTask.assignees?.map(a => a.id) || [],
            timeEstimate: initialTask.timeEstimate,
            dueDate: initialTask.dueDate ? format(parseISO(initialTask.dueDate), 'yyyy-MM-dd') : undefined,
        });
        setSubtasks(initialTask.subtasks || []);
        setComments(initialTask.comments || []);
        setCurrentAssignees(initialTask.assignees || []);
        setCurrentTags(initialTask.tags || []);
        setAttachments(initialTask.attachments || []);
        setNewComment('');
        setCommentAttachment(null);
        setNewSubtaskAssignee(null);

        if (initialTask.currentSessionStartTime) {
            const startTime = parseISO(initialTask.currentSessionStartTime).getTime();
            const now = Date.now();
            setElapsedTime(Math.floor((now - startTime) / 1000));
            setIsRunning(true);
        } else {
            setElapsedTime(0);
            setIsRunning(false);
        }
    }
  }, [initialTask, form, open]);


  const handlePauseSession = useCallback(async () => {
    if (!firestore || !currentUser || !initialTask.currentSessionStartTime) return;
    
    const taskRef = doc(firestore, "tasks", initialTask.id);
    
    const startTime = parseISO(initialTask.currentSessionStartTime).getTime();
    const now = Date.now();
    const sessionDurationInSeconds = (now - startTime) / 1000;
    const newTimeTrackedInHours = (initialTask.timeTracked || 0) + (sessionDurationInSeconds / 3600);
    
    const newActivity: Activity = createActivity(currentUser, `paused a work session after ${formatStopwatch(Math.round(sessionDurationInSeconds))}`);
    
    try {
        await updateDoc(taskRef, {
            timeTracked: newTimeTrackedInHours,
            currentSessionStartTime: deleteField(),
            lastActivity: newActivity,
            activities: [...(initialTask.activities || []), newActivity]
        });
        setIsRunning(false);
        setElapsedTime(0);
        toast({ title: 'Session Paused', description: 'Your work has been logged.' });
    } catch (error) {
        console.error("Failed to pause session:", error);
        toast({ variant: 'destructive', title: 'Update Failed', description: 'Could not log your work.' });
    }
  }, [firestore, currentUser, initialTask, toast]);


  const handleStatusChange = async (newStatus: string) => {
    if (!firestore || !currentUser || !newStatus) return;
    const oldStatus = form.getValues('status');
    if (oldStatus === newStatus) return;

    if (isRunning) {
        await handlePauseSession();
    }
    
    const newActivity = createActivity(currentUser, `changed status from "${oldStatus}" to "${newStatus}"`);

    const taskRef = doc(firestore, 'tasks', initialTask.id);
    
    try {
        const batch = writeBatch(firestore);
        
        const updates: Partial<Task> = {
            status: newStatus,
            activities: [...(initialTask.activities || []), newActivity],
            lastActivity: newActivity,
            updatedAt: serverTimestamp() as any,
        };

        if (newStatus === 'Preview' && allUsers) {
          allUsers.forEach(user => {
              if (user.companyId === currentUser.companyId && (user.role === 'Manager' || user.role === 'Super Admin')) {
                  const notifRef = doc(collection(firestore, `users/${user.id}/notifications`));
                  const newNotification: Omit<Notification, 'id'> = {
                      userId: user.id,
                      title: 'Task Ready for Review',
                      message: `${currentUser.name} has moved the task "${initialTask.title}" to Preview.`,
                      taskId: initialTask.id, 
                      isRead: false,
                      createdAt: serverTimestamp() as any,
                      createdBy: newActivity.user,
                  };
                  batch.set(notifRef, newNotification);
              }
          });
        }
        
        batch.update(taskRef, updates);
        await batch.commit();

        form.setValue('status', newStatus);
        toast({ title: 'Status Updated', description: `Task status changed to ${newStatus}.` });
    } catch (error) {
        console.error('Failed to update status:', error);
        form.setValue('status', oldStatus); // Revert on error
        toast({ variant: 'destructive', title: 'Update Failed', description: 'Could not update task status.' });
    }
  };


  const handlePriorityChange = async (newPriority: Priority) => {
    const currentPriority = form.getValues('priority');
    if (currentPriority === newPriority) return;

    const priorityValues: Record<Priority, number> = { 'Low': 0, 'Medium': 1, 'High': 2, 'Urgent': 3 };

    const applyPriorityChange = async (priority: Priority) => {
        if (!firestore || !currentUser) return;
        form.setValue('priority', priority);
        const taskRef = doc(firestore, 'tasks', initialTask.id);
        const newActivity = createActivity(currentUser, `set priority from "${currentPriority}" to "${priority}"`);
        try {
            await updateDoc(taskRef, {
                priority: priority,
                activities: [...(initialTask.activities || []), newActivity],
                lastActivity: newActivity,
                updatedAt: serverTimestamp(),
            });
            toast({ title: 'Priority Updated', description: `Task priority set to ${priority}.` });
        } catch (error) {
            console.error('Failed to update priority:', error);
            form.setValue('priority', currentPriority); // Revert on error
            toast({ variant: 'destructive', title: 'Update Failed', description: 'Could not update task priority.' });
        }
    };

    if (priorityValues[newPriority] <= priorityValues[currentPriority]) {
        await applyPriorityChange(newPriority);
        return;
    }

    setAiValidation({ ...aiValidation, isChecking: true });
    try {
        const result = await validatePriorityChange({
            title: form.getValues('title'),
            description: form.getValues('description'),
            currentPriority,
            requestedPriority: newPriority,
        });

        if (result.isApproved) {
            await applyPriorityChange(newPriority);
            toast({ title: 'AI Agrees!', description: result.reason });
        } else {
            setAiValidation({
                isOpen: true,
                isChecking: false,
                reason: result.reason,
                onConfirm: async () => {
                    await applyPriorityChange(newPriority); 
                    setAiValidation({ ...aiValidation, isOpen: false });
                }
            });
        }
    } catch (e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'AI Validation Failed', description: 'Could not validate priority change. Applying directly.' });
        await applyPriorityChange(newPriority);
    } finally {
        if (aiValidation.isChecking) {
             setAiValidation(prev => ({ ...prev, isChecking: false }));
        }
    }
  };


  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isRunning) {
      interval = setInterval(() => {
        setElapsedTime(prevTime => prevTime + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning]);
  
  
  const handlePostComment = async () => {
    if ((!newComment.trim() && !commentAttachment) || !currentUser || !firestore || !storage) return;

    setIsUploadingCommentAttachment(true);
    
    let attachmentData;

    try {
        if (commentAttachment) {
            const attachmentId = `${Date.now()}-${commentAttachment.name}`;
            const storageRef = ref(storage, `attachments/${initialTask.id}/comments/${attachmentId}`);
            await uploadBytes(storageRef, commentAttachment);
            const url = await getDownloadURL(storageRef);
            attachmentData = {
                name: commentAttachment.name,
                url: url,
            };
        }

        const comment: Comment = {
          id: `c-${Date.now()}`,
          user: {
            id: currentUser.id,
            name: currentUser.name,
            email: currentUser.email,
            avatarUrl: currentUser.avatarUrl || '',
            role: currentUser.role,
            companyId: currentUser.companyId,
            createdAt: currentUser.createdAt
          },
          text: newComment,
          timestamp: new Date().toISOString(),
          replies: [],
          ...(attachmentData && { attachment: attachmentData }),
        };
        setComments([...comments, comment]);
        setNewComment('');
        setCommentAttachment(null);

        const taskDocRef = doc(firestore, 'tasks', initialTask.id);
        await updateDoc(taskDocRef, { comments: [...comments, comment] });

    } catch (error) {
        console.error("Failed to post comment or upload attachment:", error);
        toast({
            variant: "destructive",
            title: "Comment Failed",
            description: "Could not post your comment. Please try again.",
        });
    } finally {
        setIsUploadingCommentAttachment(false);
    }
  };

  const handleCommentFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setCommentAttachment(file);
    }
  };


  const handleToggleSubtask = async (subtaskId: string) => {
    if (!firestore) return;
    const newSubtasks = subtasks.map(st => st.id === subtaskId ? { ...st, completed: !st.completed } : st);
    setSubtasks(newSubtasks);
    
    const taskDocRef = doc(firestore, 'tasks', initialTask.id);
    try {
        await updateDoc(taskDocRef, { subtasks: newSubtasks });
    } catch (error) {
        console.error("Failed to update subtask:", error);
        toast({ variant: 'destructive', title: 'Update Failed', description: 'Could not save subtask status.' });
        setSubtasks(subtasks);
    }
  };

  const handleAddSubtask = () => {
    if (!newSubtask.trim()) return;
    const subtask: Subtask = {
      id: `st-${Date.now()}`,
      title: newSubtask,
      completed: false,
      ...(newSubtaskAssignee && { assignee: { id: newSubtaskAssignee.id, name: newSubtaskAssignee.name, avatarUrl: newSubtaskAssignee.avatarUrl || '' } }),
    };
    setSubtasks([...subtasks, subtask]);
    setNewSubtask('');
    setNewSubtaskAssignee(null);
  };
  
  const handleRemoveSubtask = (subtaskId: string) => {
    setSubtasks(subtasks.filter(st => st.id !== subtaskId));
  }
  
  const handleAssignSubtask = (subtaskId: string, user: User | null) => {
    const newSubtasks = subtasks.map(st => {
      if (st.id === subtaskId) {
        return { 
          ...st, 
          assignee: user ? { id: user.id, name: user.name, avatarUrl: user.avatarUrl || '' } : undefined 
        };
      }
      return st;
    });
    setSubtasks(newSubtasks);
  };

  const getFileIcon = (fileName: string) => {
    if (fileName.match(/\.(pdf)$/i)) return <FileText className="h-5 w-5 text-red-500" />;
    if (fileName.match(/\.(doc|docx)$/i)) return <FileText className="h-5 w-5 text-blue-500" />;
    if (fileName.match(/\.(jpg|jpeg|png|gif)$/i)) return <FileImage className="h-5 w-5 text-green-500" />;
    return <FileText className="h-5 w-5 text-muted-foreground" />;
  };

const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || !storage || !initialTask?.id) return;

    setIsUploading(true);
    const files = Array.from(event.target.files);

    try {
        const uploadPromises = files.map(async (file) => {
            const attachmentId = `${Date.now()}-${file.name}`;
            const storageRef = ref(storage, `attachments/${initialTask.id}/${attachmentId}`);
            await uploadBytes(storageRef, file);
            const url = await getDownloadURL(storageRef);
            return {
                id: attachmentId,
                name: file.name,
                type: 'local' as const,
                url: url,
            };
        });

        const newAttachments = await Promise.all(uploadPromises);
        setAttachments(prev => [...prev, ...newAttachments]);
        toast({ title: 'Upload Successful', description: `${files.length} file(s) have been attached.` });

    } catch (error) {
        console.error("File upload failed:", error);
        toast({ variant: 'destructive', title: 'Upload Failed', description: 'Could not upload files. Please try again.' });
    } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }
};

  const handleAddGdriveLink = () => {
    const url = prompt('Please enter the Google Drive file link:');
    if (url) {
      const name = prompt('Please enter a name for this link:', 'Google Drive File');
      const newAttachment: Attachment = {
        id: `gdrive-${Date.now()}`,
        name: name || 'Google Drive File',
        type: 'gdrive',
        url: url
      };
      setAttachments(prev => [...prev, newAttachment]);
    }
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments(prev => prev.filter(att => att.id !== id));
  };


  const subtaskProgress = useMemo(() => {
    if (subtasks.length === 0) return 0;
    const completedCount = subtasks.filter(st => st.completed).length;
    return (completedCount / subtasks.length) * 100;
  }, [subtasks]);


  const onSubmit = async (data: TaskDetailsFormValues) => {
    if (!firestore || !currentUser) return;
    setIsSaving(true);
    const batch = writeBatch(firestore);
    const taskDocRef = doc(firestore, 'tasks', initialTask.id);

    const getChangedFields = (oldTask: Task, newData: TaskDetailsFormValues): string | null => {
        const changes: string[] = [];
        const oldDueDate = oldTask.dueDate ? format(parseISO(oldTask.dueDate), 'MMM d, yyyy') : 'no due date';
        const newDueDate = newData.dueDate ? format(parseISO(newData.dueDate), 'MMM d, yyyy') : 'no due date';

        if (oldTask.title !== newData.title) changes.push(`renamed the task to "${newData.title}"`);
        if (oldTask.description !== (newData.description || '')) changes.push('updated the description');
        if (oldDueDate !== newDueDate) changes.push(`changed the due date from ${oldDueDate} to ${newDueDate}`);
        
        return changes.length > 0 ? changes.join(', ') : null;
    };

    const actionDescription = getChangedFields(initialTask, data);
    
    let activityData: Partial<Task> = {};
    if (actionDescription) {
        const newActivity: Activity = createActivity(currentUser, actionDescription);
        activityData = {
            activities: [...(initialTask.activities || []), newActivity],
            lastActivity: newActivity,
        };
    }
    
    const updatedTaskData: Partial<Task> = {
        title: data.title,
        description: data.description,
        dueDate: data.dueDate,
        brandId: data.brandId,
        assignees: currentAssignees,
        assigneeIds: currentAssignees.map((a) => a.id),
        tags: currentTags,
        subtasks: subtasks,
        comments: comments,
        attachments: attachments,
        ...activityData,
        updatedAt: serverTimestamp() as any,
    };
    
    Object.keys(updatedTaskData).forEach(key => {
      const typedKey = key as keyof typeof updatedTaskData;
      if (updatedTaskData[typedKey] === undefined) {
        delete (updatedTaskData as any)[typedKey];
      }
    });

    batch.update(taskDocRef, updatedTaskData);

    try {
        await batch.commit();
        toast({
            title: 'Task Updated',
            description: `"${data.title}" has been saved.`,
        });
    } catch (error) {
        console.error('Failed to update task:', error);
        toast({
            variant: 'destructive',
            title: 'Update Failed',
            description: 'Could not save task changes.',
        });
    } finally {
        setIsSaving(false);
    }
  };
  
  const timeEstimateValue = form.watch('timeEstimate') ?? initialTask.timeEstimate ?? 0;
  
  const timeTracked = useMemo(() => initialTask.timeTracked || 0, [initialTask.timeTracked]);

  const timeTrackingProgress = timeEstimateValue > 0
    ? (timeTracked / timeEstimateValue) * 100
    : 0;
    
  const handleSelectUser = (user: User) => {
    if (!currentAssignees.find((u) => u.id === user.id)) {
      const newSelectedUsers = [...currentAssignees, user];
      setCurrentAssignees(newSelectedUsers);
    }
  };

  const handleRemoveUser = (userId: string) => {
    setCurrentAssignees(currentAssignees.filter((u) => u.id !== userId));
  };
  
  const handleSelectTag = (tag: Tag) => {
    if (!currentTags.find(t => t.label === tag.label)) {
        setCurrentTags([...currentTags, tag]);
    }
  }

  const handleRemoveTag = (tagLabel: string) => {
    setCurrentTags(currentTags.filter(t => t.label !== tagLabel));
  }

  const copyTaskLink = () => {
    const link = `${window.location.origin}/tasks/${initialTask.id}`;
    navigator.clipboard.writeText(link);
    toast({
        title: "Link Copied!",
        description: "Task link has been copied to your clipboard.",
    });
  }

  const priorityValue = form.watch('priority');
  const brandId = form.watch('brandId');
  const brand = useMemo(() => brands?.find(b => b.id === brandId), [brands, brandId]);
  
  const handleStartSession = async () => {
    if (!firestore || !currentUser) return;
    
    const taskRef = doc(firestore, "tasks", initialTask.id);
    
    const activitiesToAdd: Activity[] = [];
    const updates: Partial<Task> = {
        currentSessionStartTime: new Date().toISOString(),
    };

    if (initialTask.status === 'To Do') {
        updates.status = 'Doing';
        activitiesToAdd.push(createActivity(currentUser, 'changed status from "To Do" to "Doing"'));
    }

    activitiesToAdd.push(createActivity(currentUser, 'started a work session'));
    updates.activities = [...(initialTask.activities || []), ...activitiesToAdd];
    updates.lastActivity = activitiesToAdd[activitiesToAdd.length - 1];

    if (!initialTask.actualStartDate) {
        updates.actualStartDate = new Date().toISOString();
    }
    
    try {
        await updateDoc(taskRef, updates);
        setIsRunning(true);
        toast({ title: 'Session Started', description: 'Your work session is now being tracked.' });
    } catch (error) {
        console.error("Failed to start session:", error);
        toast({ variant: 'destructive', title: 'Update Failed', description: 'Could not start the session.' });
    }
  }
  
  const allSubtasksCompleted = useMemo(() => subtasks.every(st => st.completed), [subtasks]);
  
  const handleReopenTask = async () => {
    if (!currentUser || !firestore) return;
    setIsSaving(true);
    
    const taskRef = doc(firestore, "tasks", initialTask.id);
    const newActivity: Activity = createActivity(currentUser, 'reopened the task');

    try {
        await updateDoc(taskRef, {
            status: 'Doing',
            actualCompletionDate: deleteField(),
            lastActivity: newActivity,
            activities: [...(initialTask.activities || []), newActivity],
        });
        
        toast({
            title: 'Task Reopened',
            description: 'You can continue working on this task.',
        });
    } catch (error: any) {
        console.error('Failed to reopen task:', error);
        toast({
            variant: 'destructive',
            title: 'Update Failed',
            description: error.message || 'Could not reopen the task.',
        });
    } finally {
        setIsSaving(false);
    }
  };

  const handleSubmitForReview = async () => {
    await handleStatusChange('Preview');
  };
  
  
  const completionStatus = useMemo(() => {
    if (initialTask.status !== 'Done' || !initialTask.actualCompletionDate || !initialTask.dueDate) return null;
    const isLate = isAfter(parseISO(initialTask.actualCompletionDate), parseISO(initialTask.dueDate));
    return isLate ? 'Late' : 'On Time';
  }, [initialTask.status, initialTask.actualCompletionDate, initialTask.dueDate]);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-4xl grid grid-rows-[auto_1fr_auto] p-0">
          <SheetHeader className="p-4 border-b">
             <SheetTitle className='sr-only'>Task Details for {initialTask.title}</SheetTitle>
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {initialTask.createdBy && (
                        <div className='flex items-center gap-2'>
                           <Avatar className="h-6 w-6"><AvatarImage src={initialTask.createdBy.avatarUrl} /><AvatarFallback>{initialTask.createdBy.name.charAt(0)}</AvatarFallback></Avatar>
                           <span>Created by {initialTask.createdBy.name}</span>
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setIsHistoryOpen(true)}><History className="h-4 w-4 mr-2"/> View History</Button>
                    <Button variant="ghost" size="sm" onClick={copyTaskLink}><LinkIcon className="h-4 w-4 mr-2"/> Copy Link</Button>
                    <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
                </div>
             </div>
          </SheetHeader>
          
          <Form {...form}>
            <form id="task-details-form" onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-3 h-full overflow-hidden">
                {/* Main Content */}
                <ScrollArea className="col-span-2 h-full">
                    <div className="p-6 space-y-6">
                        
                        {isAssignee && !isSharedView && initialTask.status !== 'Done' && (
                          <div className="p-4 rounded-lg bg-secondary/50 space-y-3">
                              <div className="flex items-center justify-between">
                                  <div className="space-y-1">
                                      <h3 className="font-semibold">Time Tracker</h3>
                                      <p className="text-sm text-muted-foreground">
                                          Total Logged: <span className="font-medium text-foreground">{formatHours(timeTracked)}</span>
                                      </p>
                                  </div>
                                  {initialTask.status !== 'Done' && (
                                    isRunning ? (
                                        <Button variant="destructive" onClick={handlePauseSession}>
                                            <PauseCircle className="mr-2"/> Stop Session
                                        </Button>
                                    ) : (
                                        <Button onClick={handleStartSession}>
                                            <PlayCircle className="mr-2"/> Start Session
                                        </Button>
                                    )
                                  )}
                              </div>
                              {isRunning && (
                                <div className="p-3 rounded-md bg-background border border-primary/20">
                                  <div className="flex items-center justify-between">
                                      <span className="text-sm font-medium text-primary">Current Session</span>
                                      <span className="font-mono text-lg text-primary">{formatStopwatch(elapsedTime)}</span>
                                  </div>
                                </div>
                              )}
                          </div>
                        )}
                        
                        <FormField control={form.control} name="title" render={({ field }) => ( <Input {...field} readOnly={!canEditContent} className="text-2xl font-bold border-dashed h-auto p-0 border-0 focus-visible:ring-1"/> )}/>

                        <div className="space-y-2">
                          <h3 className="font-semibold text-sm">Description</h3>
                          <FormField control={form.control} name="description" render={({ field }) => ( <Textarea {...field} readOnly={!canEditContent} placeholder="Add a more detailed description..." className="min-h-24 border-dashed"/> )}/>
                        </div>

                        <div className="space-y-4">
                          <h3 className="font-semibold flex items-center gap-2 text-sm"><Paperclip className='h-4 w-4'/> Attachments</h3>
                           {attachments.length > 0 && (
                            <div className="space-y-2">
                              {attachments.map((att) => (
                                <div key={att.id} className="flex items-center justify-between rounded-md bg-secondary/50 p-2 text-sm">
                                  <a href={att.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 truncate hover:underline">
                                    {getFileIcon(att.name)}
                                    <span className="truncate" title={att.name}>{att.name}</span>
                                  </a>
                                  {canEditContent && (
                                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => handleRemoveAttachment(att.id)}>
                                      <X className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          {canEditContent && (
                            <div className="grid grid-cols-2 gap-4">
                              <input type="file" ref={fileInputRef} onChange={handleFileChange} multiple className="hidden" />
                              <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>{isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Upload from Local</Button>
                              <Button type="button" variant="outline" onClick={handleAddGdriveLink}><svg className="mr-2" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10.5187 5.56875L5.43125 0.48125L0 9.25625L5.0875 14.3438L10.5187 5.56875Z" fill="#34A853"/><path d="M16 9.25625L10.5188 0.48125H5.43125L8.25625 4.8875L13.25 13.9062L16 9.25625Z" fill="#FFC107"/><path d="M2.83125 14.7875L8.25625 5.56875L5.51875 0.81875L0.0375 9.59375L2.83125 14.7875Z" fill="#1A73E8"/><path d="M13.25 13.9062L10.825 9.75L8.25625 4.8875L5.43125 10.1L8.03125 14.7875H13.1562L13.25 13.9062Z" fill="#EA4335"/></svg>Link from Google Drive</Button>
                            </div>
                          )}
                        </div>

                         <Tabs defaultValue="subtasks" className="w-full">
                            <TabsList>
                                <TabsTrigger value="subtasks">Subtasks</TabsTrigger>
                                <TabsTrigger value="comments">Comments</TabsTrigger>
                            </TabsList>
                            <TabsContent value="subtasks" className="mt-4 space-y-4">
                                <div className="space-y-2"><div className="flex justify-between text-xs text-muted-foreground"><span>Progress</span><span>{subtasks.filter(st => st.completed).length}/{subtasks.length}</span></div><Progress value={subtaskProgress} /></div>
                                <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                                    {subtasks.map((subtask) => (
                                        <div key={subtask.id} className="flex items-center gap-3 p-2 bg-secondary/50 rounded-md hover:bg-secondary transition-colors">
                                            <Checkbox id={`subtask-${subtask.id}`} checked={subtask.completed} onCheckedChange={() => handleToggleSubtask(subtask.id)} disabled={!canManageSubtasks} />
                                            <label htmlFor={`subtask-${subtask.id}`} className={`flex-1 text-sm ${subtask.completed ? 'line-through text-muted-foreground' : ''}`}>{subtask.title}</label>
                                            
                                            <Popover>
                                              <PopoverTrigger asChild disabled={!canManageSubtasks}>
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
                                                  {subtask.assignee ? <Avatar className="h-6 w-6"><AvatarImage src={subtask.assignee.avatarUrl} /><AvatarFallback>{subtask.assignee.name.charAt(0)}</AvatarFallback></Avatar> : <UserPlus className="h-4 w-4" />}
                                                </Button>
                                              </PopoverTrigger>
                                              <PopoverContent className="w-60 p-1">
                                                <div className="space-y-1">
                                                  <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => handleAssignSubtask(subtask.id, null)}>Unassigned</Button>
                                                  {(allUsers || []).map(user => (
                                                    <Button key={user.id} variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={() => handleAssignSubtask(subtask.id, user)}>
                                                      <Avatar className="h-6 w-6"><AvatarImage src={user.avatarUrl} /><AvatarFallback>{user.name.charAt(0)}</AvatarFallback></Avatar>
                                                      <span className="truncate">{user.name}</span>
                                                    </Button>
                                                  ))}
                                                </div>
                                              </PopoverContent>
                                            </Popover>

                                            {canManageSubtasks && <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => handleRemoveSubtask(subtask.id)}><Trash className="h-4 w-4"/></Button>}
                                        </div>
                                    ))}
                                </div>
                                {canManageSubtasks && (
                                  <div className="flex items-center gap-2">
                                    <Input placeholder="Add a new subtask..." value={newSubtask} onChange={(e) => setNewSubtask(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddSubtask())} />
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <Button variant="ghost" size="icon" className="text-muted-foreground">
                                          {newSubtaskAssignee ? (
                                            <Avatar className="h-6 w-6"><AvatarImage src={newSubtaskAssignee.avatarUrl} /><AvatarFallback>{newSubtaskAssignee.name.charAt(0)}</AvatarFallback></Avatar>
                                          ) : (
                                            <UserPlus className="h-4 w-4" />
                                          )}
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-60 p-1">
                                        <div className="space-y-1">
                                          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => setNewSubtaskAssignee(null)}>Unassigned</Button>
                                          {(allUsers || []).map(user => (
                                            <Button key={user.id} variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={() => setNewSubtaskAssignee(user)}>
                                              <Avatar className="h-6 w-6"><AvatarImage src={user.avatarUrl} /><AvatarFallback>{user.name.charAt(0)}</AvatarFallback></Avatar>
                                              <span className="truncate">{user.name}</span>
                                            </Button>
                                          ))}
                                        </div>
                                      </PopoverContent>
                                    </Popover>
                                    <Button type="button" onClick={handleAddSubtask}><Plus className="h-4 w-4 mr-2" /> Add</Button>
                                  </div>
                                )}
                            </TabsContent>
                            <TabsContent value="comments" className="mt-4">
                                <div className="space-y-6">
                                    {comments.map(comment => (
                                        <div key={comment.id} className="flex gap-3">
                                            <Avatar className="h-8 w-8"><AvatarImage src={comment.user.avatarUrl} /><AvatarFallback>{comment.user.name?.charAt(0)}</AvatarFallback></Avatar>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2"><span className="font-semibold text-sm">{comment.user.name}</span><span className="text-xs text-muted-foreground">{formatDistanceToNow(parseISO(comment.timestamp), { addSuffix: true })}</span></div>
                                                <div className="text-sm bg-secondary p-3 rounded-lg mt-1 space-y-2">
                                                  <p>{comment.text}</p>
                                                  {comment.attachment && (
                                                    <a href={comment.attachment.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-primary hover:underline">
                                                      <Paperclip className="h-4 w-4" />
                                                      <span>{comment.attachment.name}</span>
                                                    </a>
                                                  )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {canComment && (
                                        <div className="flex gap-3 pt-4 border-t">
                                            <Avatar className="h-8 w-8"><AvatarImage src={currentUser?.avatarUrl} /><AvatarFallback>{currentUser?.name?.charAt(0)}</AvatarFallback></Avatar>
                                            <div className="flex-1 relative">
                                                <Textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Write a comment... use @ to mention" className="pr-24" />
                                                {commentAttachment && (
                                                  <div className="mt-2 flex items-center gap-2 text-sm bg-secondary p-2 rounded-md">
                                                    <Paperclip className="h-4 w-4 text-muted-foreground" />
                                                    <span className="truncate">{commentAttachment.name}</span>
                                                    <Button variant="ghost" size="icon" className="h-6 w-6 ml-auto" onClick={() => setCommentAttachment(null)}>
                                                      <X className="h-4 w-4" />
                                                    </Button>
                                                  </div>
                                                )}
                                                <div className="absolute top-2 right-2 flex items-center gap-1">
                                                    <input type="file" ref={commentFileInputRef} onChange={handleCommentFileSelect} className="hidden"/>
                                                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => commentFileInputRef.current?.click()} disabled={isUploadingCommentAttachment}>
                                                        <Paperclip className="h-4 w-4"/>
                                                    </Button>
                                                    <Button type="button" size="sm" onClick={handlePostComment} disabled={(!newComment.trim() && !commentAttachment) || isUploadingCommentAttachment}>
                                                        {isUploadingCommentAttachment ? <Loader2 className="h-4 w-4 animate-spin"/> : <Send className="h-4 w-4"/>}
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </TabsContent>
                        </Tabs>
                    </div>
                </ScrollArea>

                {/* Sidebar */}
                <ScrollArea className="col-span-1 h-full border-l">
                  <div className="p-6 space-y-6">
                    {isEmployee && initialTask.status === 'Doing' && !isSharedView && (
                         <div className="space-y-2">
                           <Button className="w-full" onClick={() => handleSubmitForReview()} disabled={!allSubtasksCompleted || isSaving}>
                               {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                               Submit for Review
                           </Button>
                           {!allSubtasksCompleted && (
                               <p className="text-xs text-center text-destructive">Selesaikan semua subtask untuk dapat mengirim tugas untuk direview.</p>
                           )}
                         </div>
                    )}
                    
                    {isManagerOrAdmin && initialTask.status === 'Preview' && (
                        <div className="space-y-2">
                           <Button className="w-full bg-green-600 hover:bg-green-700" onClick={() => handleStatusChange('Done')} disabled={isSaving}>
                              <CheckCircle className="mr-2 h-4 w-4"/>Approve and Complete
                           </Button>
                           <Button variant="outline" className="w-full" onClick={() => handleStatusChange('Doing')} disabled={isSaving}>
                              <RefreshCcw className="mr-2 h-4 w-4" />Request Revisions
                           </Button>
                        </div>
                    )}

                    {isAssignee && initialTask.status === 'Done' && !isSharedView && (
                         <Button className="w-full" variant="outline" onClick={handleReopenTask} disabled={isSaving}>
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                             <RefreshCcw className="mr-2 h-4 w-4" />
                            Reopen Task
                        </Button>
                    )}
                    <div className='space-y-4 p-4 rounded-lg border'>
                      <h3 className='font-semibold text-sm'>Task Details</h3>
                      <Separator/>
                        <FormField control={form.control} name="brandId" render={({ field }) => (
                            <FormItem className="grid grid-cols-3 items-center gap-2">
                              <FormLabel className="text-muted-foreground">Brand</FormLabel>
                              <div className="col-span-2">
                                { !canEditContent ? (
                                    <div className="flex items-center gap-2 text-sm font-medium">
                                        <Building2 className="h-4 w-4 text-muted-foreground" />
                                        {brand?.name || 'N/A'}
                                    </div>
                                ) : (
                                <Select onValueChange={field.onChange} value={field.value}>
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
                                )}
                              </div>
                            </FormItem>
                          )}/>
                        <FormItem className="grid grid-cols-3 items-center gap-2">
                            <FormLabel className="text-muted-foreground">Status</FormLabel>
                            <div className="col-span-2">
                               <FormField control={form.control} name="status" render={({ field }) => (
                                <Select onValueChange={(v) => handleStatusChange(v)} value={field.value} disabled={!canChangeStatus}>
                                    <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                                    <SelectContent>
                                    {allStatuses?.map(s => (
                                        <SelectItem key={s.id} value={s.name}>
                                            <div className="flex items-center gap-2">
                                                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }}></span>
                                                {s.name}
                                            </div>
                                        </SelectItem>
                                    ))}
                                    </SelectContent>
                                </Select>
                                )}/>
                            </div>
                        </FormItem>
                       <FormField control={form.control} name="priority" render={({ field }) => {
                          const priority = priorityInfo[field.value];
                          return (
                           <FormItem className="grid grid-cols-3 items-center gap-2">
                              <FormLabel className="text-muted-foreground">Priority</FormLabel>
                              <div className="col-span-2 flex items-center gap-2">
                                  { !(canChangeStatus) ? (
                                    <div className="flex items-center gap-2 text-sm font-medium">
                                      <priority.icon className={`h-4 w-4 ${priority.color}`} />
                                      {priority.label}
                                    </div>
                                  ) : (
                                  <>
                                    <Select onValueChange={(v: Priority) => handlePriorityChange(v)} value={field.value}>
                                        <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                                        <SelectContent>{Object.values(priorityInfo).map(p => (<SelectItem key={p.value} value={p.value}><div className="flex items-center gap-2"><p.icon className={`h-4 w-4 ${p.color}`} />{p.label}</div></SelectItem>))}</SelectContent>
                                    </Select>
                                    {aiValidation.isChecking && <Loader2 className="h-5 w-5 animate-spin" />}
                                  </>
                                  )}
                              </div>
                           </FormItem>
                          )
                       }}/>
                        <FormField control={form.control} name="dueDate" render={({ field }) => (
                            <FormItem className="grid grid-cols-3 items-center gap-2">
                               <FormLabel className="text-muted-foreground">Due Date</FormLabel>
                               <div className="col-span-2">
                                 {!canEditContent ? (
                                     <div className="text-sm font-medium">
                                         {field.value ? format(parseISO(field.value), 'MMM d, yyyy') : 'No due date'}
                                     </div>
                                 ) : (
                                     <Input type="date" {...field} value={field.value || ''} />
                                 )}
                               </div>
                            </FormItem>
                        )}/>
                        {initialTask.actualCompletionDate && (
                             <div className="grid grid-cols-3 items-center gap-2">
                               <FormLabel className="text-muted-foreground">Completed</FormLabel>
                               <div className="col-span-2 flex items-center gap-2">
                                 <span className="text-sm font-medium">
                                    {format(parseISO(initialTask.actualCompletionDate), 'MMM d, yyyy')}
                                 </span>
                                 {completionStatus && (
                                    <Badge variant={completionStatus === 'Late' ? 'destructive' : 'secondary'} className={completionStatus === 'On Time' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' : ''}>
                                        {completionStatus}
                                    </Badge>
                                 )}
                               </div>
                            </div>
                        )}
                    </div>

                    <div className='space-y-4 p-4 rounded-lg border'>
                      <h3 className='font-semibold text-sm'>People</h3>
                      <Separator/>
                      <FormItem>
                          <FormLabel className="text-muted-foreground text-sm">Assignees</FormLabel>
                           {currentAssignees.map((user) => (
                              <div key={user.id} className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-3">
                                      <Avatar className="h-8 w-8"><AvatarImage src={user.avatarUrl} alt={user.name} /><AvatarFallback>{user.name?.charAt(0)}</AvatarFallback></Avatar>
                                      <p className="text-sm font-medium">{user.name}</p>
                                  </div>
                                  {canAssignUsers && <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => handleRemoveUser(user.id)}><X className="h-4"/></Button>}
                              </div>
                           ))}
                          {canAssignUsers && (
                              <Popover>
                                  <PopoverTrigger asChild>
                                      <Button variant="outline" className="w-full mt-2"><Plus className="mr-2"/> Add Assignee</Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-60 p-1">
                                      <div className="space-y-1">
                                        {groupedUsers.managers.length > 0 && (
                                            <>
                                                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Managers</div>
                                                {groupedUsers.managers.map(user => (
                                                  <Button key={user.id} variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={() => handleSelectUser(user)}>
                                                    <Avatar className="h-6 w-6"><AvatarImage src={user.avatarUrl} /><AvatarFallback>{user.name.charAt(0)}</AvatarFallback></Avatar>
                                                    <span className="truncate">{user.name}</span>
                                                  </Button>
                                                ))}
                                                <Separator/>
                                            </>
                                        )}
                                        {groupedUsers.employees.length > 0 && (
                                            <>
                                                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Employees</div>
                                                {groupedUsers.employees.map(user => (
                                                  <Button key={user.id} variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={() => handleSelectUser(user)}>
                                                    <Avatar className="h-6 w-6"><AvatarImage src={user.avatarUrl} /><AvatarFallback>{user.name.charAt(0)}</AvatarFallback></Avatar>
                                                    <span className="truncate">{user.name}</span>
                                                  </Button>
                                                ))}
                                            </>
                                        )}
                                      </div>
                                  </PopoverContent>
                              </Popover>
                          )}
                      </FormItem>
                    </div>

                    <div className='space-y-4 p-4 rounded-lg border'>
                      <h3 className='font-semibold text-sm'>Categorization</h3>
                      <Separator/>
                      <FormItem>
                          <FormLabel className="text-muted-foreground text-sm">Tags</FormLabel>
                           <div className="flex flex-wrap gap-2">
                              {currentTags.map((tag) => (
                                  <div key={tag.label} className={`flex items-center gap-1.5 rounded-full px-2 py-1 text-xs ${tag.color}`}>
                                      {tag.label}
                                      {canEditContent && <button type="button" onClick={() => handleRemoveTag(tag.label)}><X className="h-3 w-3"/></button>}
                                  </div>
                              ))}
                              {canEditContent && (
                                   <Popover>
                                      <PopoverTrigger asChild><Button type="button" variant="outline" size="sm" className="h-6 rounded-full">+ Add</Button></PopoverTrigger>
                                      <PopoverContent className="w-auto p-1"><div className="flex flex-col gap-1">{Object.values(allTags).map(tag => (<Button key={tag.label} variant="ghost" size="sm" className="justify-start" onClick={() => handleSelectTag(tag)}><div className="flex items-center gap-2"><div className={`w-3 h-3 rounded-full ${tag.color.split(' ')[0]}`}></div>{tag.label}</div></Button>))}</div></PopoverContent>
                                  </Popover>
                              )}
                           </div>
                      </FormItem>
                    </div>

                    <div className='space-y-4 p-4 rounded-lg border'>
                      <div className="flex justify-between items-center">
                        <h3 className='font-semibold text-sm'>Time Management</h3>
                      </div>
                      <Separator/>
                       <FormField control={form.control} name="timeEstimate" render={({ field }) => (
                         <FormItem className="grid grid-cols-3 items-center gap-2">
                            <FormLabel className="text-muted-foreground text-sm">Estimate</FormLabel>
                            <div className="col-span-2">
                              {!canEditContent ? (
                                <div className="text-sm font-medium">{timeEstimateValue} hours</div>
                              ) : (
                                <Input type="number" {...field} value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value === '' ? undefined : +e.target.value)} placeholder="Hours" />
                              )}
                            </div>
                         </FormItem>
                       )}/>
                       
                       <div className="space-y-2">
                          <div className="grid grid-cols-3 items-center gap-2">
                              <span className="text-sm text-muted-foreground">Total Logged</span>
                              <span className="col-span-2 text-sm font-medium">{formatHours(timeTracked)}</span>
                          </div>
                          <Progress value={timeTrackingProgress} />
                       </div>

                    </div>

                  </div>
                </ScrollArea>
              </form>
          </Form>
          <SheetFooter className="p-4 border-t flex justify-end items-center w-full">
              {canEditContent && (
                <Button type="submit" form="task-details-form" disabled={isSaving}>
                  {isSaving && <Loader2 className='h-4 w-4 mr-2 animate-spin' />}
                  Save Changes
                </Button>
              )}
          </SheetFooter>
        </SheetContent>
      </Sheet>
      <AlertDialog open={aiValidation.isOpen} onOpenChange={(open) => setAiValidation(prev => ({...prev, isOpen: open}))}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>AI Priority Guard</AlertDialogTitle>
                <AlertDialogDescription>
                    {aiValidation.reason}
                    <br/><br/>
                    Do you still want to set this task as Urgent?
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={aiValidation.onConfirm}>Yes, set as Urgent</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Task Activity Log</DialogTitle>
            <DialogDescription>
              A complete history of all changes made to this task.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] -mx-6 px-6">
            <div className="space-y-6 py-4">
              {initialTask.activities && initialTask.activities.length > 0 ? (
                initialTask.activities
                  .slice()
                  .sort((a, b) => {
                    const dateA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
                    const dateB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
                    return dateB - dateA;
                  })
                  .map((activity) => (
                    <div key={activity.id} className="flex items-start gap-4">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={activity.user.avatarUrl} alt={activity.user.name} />
                        <AvatarFallback>{activity.user.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm">
                          <span className="font-semibold">{activity.user.name}</span> {activity.action}.
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {activity.timestamp ? format(new Date(activity.timestamp), 'PP, HH:mm') : 'just now'}
                        </p>
                      </div>
                    </div>
                  ))
                  
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No activities recorded for this task yet.
                </p>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}

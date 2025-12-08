
'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
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
} from '@/components/ui/form';
import { tags as allTags } from '@/lib/data';
import { priorityInfo } from '@/lib/utils';
import React, { useEffect, useMemo } from 'react';
import { ScrollArea } from '../ui/scroll-area';
import { Calendar, Clock, Copy, Loader2, Mail, Plus, Repeat, Share, Tag, Trash2, UserPlus, Users, Wand2, X, Hash, Calendar as CalendarIcon, Type, List, Paperclip, FileUp, Link as LinkIcon, FileImage, HelpCircle, Star, Timer, Blocks, User, GitMerge, ListTodo, MessageSquare, AtSign, Send, Edit, FileText, Building2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Separator } from '../ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Label } from '../ui/label';
import {
  addDays,
  format,
  formatDistanceToNow,
  parse,
  parseISO,
  startOfWeek,
  nextSaturday
} from 'date-fns';
import { useI18n } from '@/context/i18n-provider';
import { suggestPriority } from '@/ai/flows/suggest-priority';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '../ui/textarea';
import type { Tag as TagType, TimeLog, Task, User as UserType, Subtask, Comment, Attachment, Notification, WorkflowStatus, Brand } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Progress } from '../ui/progress';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Checkbox } from '../ui/checkbox';
import { Switch } from '../ui/switch';
import { useCollection, useFirestore, useUserProfile, useStorage } from '@/firebase';
import { collection, serverTimestamp, writeBatch, doc, query, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Calendar as CalendarComponent } from '../ui/calendar';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '../ui/card';


const taskSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  brandId: z.string().min(1, 'Brand is required'),
  description: z.string().optional(),
  status: z.string().min(1, 'Status is required'),
  priority: z.enum(['Urgent', 'High', 'Medium', 'Low']),
  assigneeIds: z.array(z.string()).min(1, 'At least one assignee is required'),
  timeEstimate: z.coerce.number().min(0, 'Must be a positive number').optional(),
  startDate: z.string().optional(),
  dueDate: z.date().optional(),
  recurring: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

type TaskFormValues = z.infer<typeof taskSchema>;

type ShareSetting = 'public' | 'private';

type CustomFieldType = 'Text' | 'Number' | 'Date' | 'Dropdown';
type CustomField = {
  id: number;
  name: string;
  type: CustomFieldType;
  value: string;
  options?: string; // For dropdown options
};


export function AddTaskDialog({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [selectedUsers, setSelectedUsers] = React.useState<UserType[]>([]);
  const [selectedTags, setSelectedTags] = React.useState<TagType[]>([]);
  const [shareSetting, setShareSetting] = React.useState<ShareSetting>('private');
  const [isSuggesting, setIsSuggesting] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const [suggestionReason, setSuggestionReason] = React.useState<string | null>(null);
  const { t, language } = useI18n();
  const { toast } = useToast();

  const [timeLogs, setTimeLogs] = React.useState<TimeLog[]>([]);
  const [timeTracked, setTimeTracked] = React.useState(0);
  const [logNote, setLogNote] = React.useState('');
  const [logDate, setLogDate] = React.useState(format(new Date(), 'yyyy-MM-dd'));
  const [startTime, setStartTime] = React.useState(format(new Date(), 'HH:mm'));
  const [endTime, setEndTime] = React.useState(format(new Date(), 'HH:mm'));
  
  const [customFields, setCustomFields] = React.useState<CustomField[]>([]);
  const [attachments, setAttachments] = React.useState<Attachment[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const commentFileInputRef = React.useRef<HTMLInputElement>(null);


  const [subtasks, setSubtasks] = React.useState<Subtask[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = React.useState('');
  const [dependencies, setDependencies] = React.useState<string[]>([]);
  const [blocking, setBlocking] = React.useState<string[]>([]);
  const [comments, setComments] = React.useState<Comment[]>([]);
  const [newComment, setNewComment] = React.useState('');
  const [mentionSuggestions, setMentionSuggestions] = React.useState<UserType[]>([]);
  const [isMentioning, setIsMentioning] = React.useState(false);
  
  const firestore = useFirestore();
  const storage = useStorage();

  const usersCollectionRef = React.useMemo(() => 
    firestore ? collection(firestore, 'users') : null, 
  [firestore]);
  const { data: users } = useCollection<UserType>(usersCollectionRef);

  const { user, profile: currentUserProfile } = useUserProfile();

  const tasksCollectionRef = React.useMemo(() => {
    if (!firestore) return null;
    return collection(firestore, 'tasks');
  }, [firestore]);

  const { data: allTasks } = useCollection<Task>(tasksCollectionRef);

  const statusesQuery = React.useMemo(() => 
    firestore ? query(collection(firestore, 'statuses'), orderBy('order')) : null,
    [firestore]
  );
  const { data: statuses, isLoading: areStatusesLoading } = useCollection<WorkflowStatus>(statusesQuery);
  
  const brandsQuery = React.useMemo(() =>
    firestore ? query(collection(firestore, 'brands'), orderBy('name')) : null,
  [firestore]);
  const { data: brands, isLoading: areBrandsLoading } = useCollection<Brand>(brandsQuery);

  const userWorkload = useMemo(() => {
    const workloadMap = new Map<string, number>();
    if (!allTasks || !users) return workloadMap;

    users.forEach(u => workloadMap.set(u.id, 0));

    allTasks.forEach(task => {
        if (task.status !== 'Done') {
            task.assigneeIds.forEach(assigneeId => {
                if (workloadMap.has(assigneeId)) {
                    workloadMap.set(assigneeId, (workloadMap.get(assigneeId) || 0) + 1);
                }
            });
        }
    });

    return workloadMap;
  }, [allTasks, users]);


  const quickDateOptions = [
      { label: t('addtask.form.quickselect.today'), getValue: () => new Date() },
      { label: t('addtask.form.quickselect.tomorrow'), getValue: () => addDays(new Date(), 1) },
      { label: t('addtask.form.quickselect.thisweekend'), getValue: () => nextSaturday(new Date()) },
      { label: t('addtask.form.quickselect.nextweek'), getValue: () => addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), 7) },
      { label: t('addtask.form.quickselect.nextweekend'), getValue: () => addDays(nextSaturday(new Date()), 7) },
      { label: t('addtask.form.quickselect.2weeks'), getValue: () => addDays(new Date(), 14) },
      { label: t('addtask.form.quickselect.4weeks'), getValue: () => addDays(new Date(), 28) },
  ];

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: '',
      brandId: '',
      description: '',
      status: statuses?.[0]?.name || '',
      priority: 'Medium',
      assigneeIds: [],
      recurring: 'never',
      startDate: '',
      dueDate: undefined,
      timeEstimate: undefined,
      tags: [],
    },
  });
  
  useEffect(() => {
    if (statuses && statuses.length > 0 && !form.getValues('status')) {
      form.setValue('status', statuses[0].name);
    }
  }, [statuses, form]);

  useEffect(() => {
    if (open && currentUserProfile && user) {
        if (currentUserProfile.role === 'Employee') {
            const selfUser = {
                id: user.uid,
                name: currentUserProfile.name,
                email: currentUserProfile.email,
                avatarUrl: currentUserProfile.avatarUrl || '',
                role: currentUserProfile.role,
                companyId: currentUserProfile.companyId,
                createdAt: currentUserProfile.createdAt,
            };
            setSelectedUsers([selfUser]);
            form.setValue('assigneeIds', [selfUser.id]);
        } else {
             setSelectedUsers([]);
            form.setValue('assigneeIds', []);
        }
    }
}, [open, currentUserProfile, user, form]);


  const onSubmit = async (data: TaskFormValues) => {
    if (!tasksCollectionRef || !currentUserProfile || !firestore) return;
    
    const batch = writeBatch(firestore);

    const newTaskRef = doc(collection(firestore, 'tasks'));
    const cleanedData = Object.entries(data).reduce((acc, [key, value]) => {
      if (value !== undefined) {
        if (key === 'dueDate' && value instanceof Date) {
          (acc as any)[key] = value.toISOString();
        } else {
          (acc as any)[key] = value;
        }
      }
      return acc;
    }, {} as Partial<TaskFormValues>);

    const newTaskData = {
        ...cleanedData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        assignees: selectedUsers,
        tags: selectedTags,
        timeLogs,
        timeTracked,
        subtasks,
        dependencies,
        blocking,
        comments,
        attachments,
        companyId: currentUserProfile.companyId,
        createdBy: {
          id: currentUserProfile.id,
          name: currentUserProfile.name,
          avatarUrl: currentUserProfile.avatarUrl || '',
        },
    };
    batch.set(newTaskRef, newTaskData);

    selectedUsers.forEach(assignee => {
        if (assignee.id === currentUserProfile.id) return; 
        const notificationRef = doc(collection(firestore, `users/${assignee.id}/notifications`));
        const notification: Omit<Notification, 'id'> = {
            userId: assignee.id,
            title: 'New Task Assigned',
            message: `${currentUserProfile.name} assigned you a new task: "${data.title}"`,
            taskId: newTaskRef.id,
            taskTitle: data.title,
            isRead: false,
            createdAt: new Date().toISOString(),
            createdBy: {
                id: currentUserProfile.id,
                name: currentUserProfile.name,
                avatarUrl: currentUserProfile.avatarUrl || '',
            }
        };
        batch.set(notificationRef, notification);
    });
    
    comments.forEach(comment => {
        const mentionedUsernames = comment.text.match(/@(\w+)/g)?.map(m => m.substring(1));
        if (mentionedUsernames) {
            const mentionedUsers = (users || []).filter(u => mentionedUsernames.includes(u.name.split(' ')[0]));
            mentionedUsers.forEach(mentionedUser => {
                if (mentionedUser.id === currentUserProfile.id) return;
                
                const notifRef = doc(collection(firestore, `users/${mentionedUser.id}/notifications`));
                const notification: Omit<Notification, 'id'> = {
                    userId: mentionedUser.id,
                    title: 'You were mentioned',
                    message: `${comment.user.name} mentioned you in a comment on task: "${data.title}"`,
                    taskId: newTaskRef.id,
                    taskTitle: data.title,
                    isRead: false,
                    createdAt: new Date().toISOString(),
                    createdBy: {
                        id: comment.user.id,
                        name: comment.user.name,
                        avatarUrl: comment.user.avatarUrl,
                    }
                };
                batch.set(notifRef, notification);
            });
        }
    });

    try {
        await batch.commit();
        toast({
            title: 'Task Created',
            description: `${data.title} has been added and relevant users have been notified.`
        });

        setOpen(false);
        form.reset();
        setSelectedUsers([]);
        setSelectedTags([]);
        setTimeLogs([]);
        setTimeTracked(0);
        setLogNote('');
        setCustomFields([]);
        setAttachments([]);
        setSubtasks([]);
        setDependencies([]);
        setBlocking([]);
        setComments([]);
        setSuggestionReason(null);

    } catch (error) {
        console.error("Failed to create task and notifications:", error);
        toast({
            variant: 'destructive',
            title: 'Creation Failed',
            description: 'Could not create the task. Please try again.'
        });
    }
  };
  
  const handleAddLogEntry = () => {
    const startDateTime = parse(`${logDate} ${startTime}`, 'yyyy-MM-dd HH:mm', new Date());
    const endDateTime = parse(`${logDate} ${endTime}`, 'yyyy-MM-dd HH:mm', new Date());

    if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime()) || endDateTime < startDateTime) {
      toast({
        variant: 'destructive',
        title: 'Invalid Time',
        description: 'Please make sure the start and end times are valid.',
      });
      return;
    }

    const durationInSeconds = (endDateTime.getTime() - startDateTime.getTime()) / 1000;
    
    const newLog: TimeLog = {
      id: `log-${Date.now()}`,
      startTime: startDateTime.toISOString(),
      endTime: endDateTime.toISOString(),
      duration: durationInSeconds,
      description: logNote,
    };
    
    setTimeLogs(prevLogs => [...prevLogs, newLog]);
    const newTimeTracked = timeTracked + (durationInSeconds / 3600);
    setTimeTracked(parseFloat(newTimeTracked.toFixed(2)));
    
    setLogNote('');
  };

  const handleSelectUser = (user: UserType) => {
    if (!selectedUsers.find((u) => u.id === user.id)) {
      const newSelectedUsers = [...selectedUsers, user];
      setSelectedUsers(newSelectedUsers);
      form.setValue('assigneeIds', newSelectedUsers.map(u => u.id));
    }
  };

  const handleRemoveUser = (userId: string) => {
    if (currentUserProfile?.role === 'Employee') return;
    
    const newSelectedUsers = selectedUsers.filter((u) => u.id !== userId);
    setSelectedUsers(newSelectedUsers);
    form.setValue('assigneeIds', newSelectedUsers.map(u => u.id));
  };
  
  const handleSelectTag = (tag: TagType) => {
    if (!selectedTags.find(t => t.label === tag.label)) {
      const newTags = [...selectedTags, tag];
      setSelectedTags(newTags);
      form.setValue('tags', newTags.map(t => t.label));
    }
  }

  const handleRemoveTag = (tagLabel: string) => {
    const newTags = selectedTags.filter(t => t.label !== tagLabel);
    setSelectedTags(newTags);
    form.setValue('tags', newTags.map(t => t.label));
  }

  const setDateValue = (field: 'startDate' | 'dueDate', date: Date | undefined) => {
    if (field === 'dueDate') {
      form.setValue('dueDate', date);
    } else {
      form.setValue('startDate', date ? format(date, 'yyyy-MM-dd') : undefined);
    }
  };

  const handleAddCustomField = (type: CustomFieldType) => {
    setCustomFields([...customFields, { id: Date.now(), name: '', type, value: '', options: '' }]);
  };
  
  const handleCustomFieldChange = (id: number, field: 'name' | 'value' | 'options', fieldValue: string) => {
    setCustomFields(customFields.map(cf => cf.id === id ? { ...cf, [field]: fieldValue } : cf));
  };

  const handleRemoveCustomField = (id: number) => {
    setCustomFields(customFields.filter(cf => cf.id !== id));
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

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
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
        
        const newAttachments = await Promise.all(uploadPromises);
        setAttachments(prev => [...prev, ...newAttachments]);
        toast({ title: 'Upload Successful', description: `${files.length} file(s) have been attached.` });

    } catch (error) {
        console.error("File upload failed:", error);
        toast({ variant: 'destructive', title: 'Upload Failed', description: 'Could not upload files. Please try again.' });
    } finally {
        setIsUploading(false);
        if(fileInputRef.current) fileInputRef.current.value = '';
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
        url: url,
      };
      setAttachments(prev => [...prev, newAttachment]);
    }
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments(prev => prev.filter(att => att.id !== id));
  };

  const renderCustomFieldInput = (field: CustomField) => {
    switch (field.type) {
      case 'Number':
        return <Input type="number" placeholder="Value" value={field.value} onChange={(e) => handleCustomFieldChange(field.id, 'value', e.target.value)} className="flex-1" />;
      case 'Date':
        return <Input type="date" placeholder="Value" value={field.value} onChange={(e) => handleCustomFieldChange(field.id, 'value', e.target.value)} className="flex-1" />;
      case 'Dropdown':
        const options = field.options?.split(',').map(o => o.trim()).filter(Boolean) || [];
        return (
          <div className="flex-1 grid grid-cols-2 gap-2">
            <Input 
              placeholder="Options (comma-separated)" 
              value={field.options} 
              onChange={(e) => handleCustomFieldChange(field.id, 'options', e.target.value)}
            />
            <Select onValueChange={(val) => handleCustomFieldChange(field.id, 'value', val)} value={field.value}>
              <SelectTrigger>
                <SelectValue placeholder="Select value" />
              </SelectTrigger>
              <SelectContent>
                {options.map((option, index) => (
                  <SelectItem key={index} value={option}>{option}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      case 'Text':
      default:
        return <Input placeholder="Value" value={field.value} onChange={(e) => handleCustomFieldChange(field.id, 'value', e.target.value)} className="flex-1" />;
    }
  };

  const handleAddSubtask = () => {
    if (newSubtaskTitle.trim()) {
      const newSubtask: Subtask = {
        id: `sub-${Date.now()}`,
        title: newSubtaskTitle,
        completed: false,
      };
      setSubtasks([...subtasks, newSubtask]);
      setNewSubtaskTitle('');
    }
  };

  const handleToggleSubtask = (subtaskId: string) => {
    setSubtasks(
      subtasks.map(st => st.id === subtaskId ? { ...st, completed: !st.completed } : st)
    );
  };
  
  const handleRemoveSubtask = (subtaskId: string) => {
    setSubtasks(subtasks.filter(st => st.id !== subtaskId));
  }
  
  const handlePostComment = () => {
    if (!newComment.trim() || !currentUserProfile || !user) return;
    const comment: Comment = {
      id: `c-${Date.now()}`,
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

  const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setNewComment(text);

    const mentionMatch = text.match(/@(\w*)$/);
    if (mentionMatch) {
      setIsMentioning(true);
      setMentionSuggestions((users || []).filter(u => u.name.toLowerCase().includes(mentionMatch[1].toLowerCase())));
    } else {
      setIsMentioning(false);
    }
  };

  const handleMentionSelect = (user: UserType) => {
    const currentComment = newComment;
    const atIndex = currentComment.lastIndexOf('@');
    const newCommentText = `${currentComment.substring(0, atIndex)}@${user.name.split(' ')[0]} `;
    setNewComment(newCommentText);
    setIsMentioning(false);
  };


  const subtaskProgress = useMemo(() => {
    if (subtasks.length === 0) return 0;
    const completedCount = subtasks.filter(st => st.completed).length;
    return (completedCount / subtasks.length) * 100;
  }, [subtasks]);

  const recurringValue = form.watch('recurring');
  const recurringOptions: Record<string, string> = {
    never: t('addtask.form.recurring.never'),
    daily: t('addtask.form.recurring.daily'),
    weekly: t('addtask.form.recurring.weekly'),
    monthly: t('addtask.form.recurring.monthly'),
  };
  
  const timeEstimateValue = form.watch('timeEstimate') ?? 0;
  const timeTrackingProgress = timeEstimateValue > 0
    ? (timeTracked / timeEstimateValue) * 100
    : 0;

  const handleSuggestPriority = async () => {
    const title = form.getValues('title');
    if (!title) {
      toast({
        variant: 'destructive',
        title: 'Title is required',
        description: 'Please enter a task title before suggesting a priority.',
      });
      return;
    }
    setIsSuggesting(true);
    setSuggestionReason(null);
    try {
      const result = await suggestPriority({
        title,
        description: form.getValues('description'),
        language: language.name,
      });
      form.setValue('priority', result.priority);
      setSuggestionReason(result.reason);
      toast({
        title: `Priority suggested: ${result.priority}`,
      });
    } catch (e) {
      console.error(e);
      toast({
        variant: 'destructive',
        title: 'Suggestion Failed',
        description: 'Could not get an AI suggestion. Please try again.',
      });
    } finally {
      setIsSuggesting(false);
    }
  };

  const isEmployee = currentUserProfile?.role === 'Employee';

  const dueDates = useMemo(() => {
    if (!allTasks) return new Set();
    const dates = new Set<Date>();
    allTasks.forEach(task => {
      if (task.dueDate) {
        dates.add(parseISO(task.dueDate));
      }
    });
    return dates;
  }, [allTasks]);

  const modifiers = {
    due: Array.from(dueDates)
  };

  const modifiersClassNames = {
    due: 'has-due-date',
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-4xl grid-rows-[auto_minmax(0,1fr)_auto] p-0 max-h-[90vh]">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>{t('addtask.title')}</DialogTitle>
          <DialogDescription>
            {t('addtask.description')}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="px-6">
          <div className="pt-4">
            <Accordion type="single" collapsible className="w-full mb-6">
              <AccordionItem value="item-1">
                <AccordionTrigger>
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <HelpCircle className="h-4 w-4"/>
                    Panduan Fitur
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 text-sm text-muted-foreground pt-2">
                  <div className="flex items-start gap-3 p-2 rounded-lg bg-secondary/50">
                    <Star className="h-5 w-5 mt-1 text-primary shrink-0"/>
                    <div>
                      <h4 className="font-semibold text-foreground">Manajemen Tugas</h4>
                      <p>Isi detail dasar tugas. Gunakan tombol <Wand2 className="inline h-3 w-3"/> untuk mendapatkan saran prioritas otomatis dari AI berdasarkan judul.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-2 rounded-lg bg-secondary/50">
                    <Timer className="h-5 w-5 mt-1 text-primary shrink-0"/>
                    <div>
                      <h4 className="font-semibold text-foreground">Manajemen Waktu</h4>
                      <p><b>Time Estimate</b> adalah total perkiraan waktu (dalam jam). <b>Time Tracking</b> digunakan untuk mencatat sesi kerja manual dengan jam mulai/selesai, tanggal, dan catatan untuk setiap sesi.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-2 rounded-lg bg-secondary/50">
                    <Users className="h-5 w-5 mt-1 text-primary shrink-0"/>
                    <div>
                      <h4 className="font-semibold text-foreground">Kolaborasi Tim</h4>
                      <p>Bagikan tugas melalui tautan (publik/privat), undang anggota tim via email, atau tugaskan kepada anggota yang sudah ada. Atur juga izin akses untuk setiap anggota (misal: hanya bisa melihat atau mengedit). Tambahkan juga subtugas, dependensi, dan komentar.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-2 rounded-lg bg-secondary/50">
                    <Blocks className="h-5 w-5 mt-1 text-primary shrink-0"/>
                    <div>
                      <h4 className="font-semibold text-foreground">Kustomisasi & Lampiran</h4>
                      <p>Gunakan <b>Tags</b> untuk kategori. Lampirkan file dari <b>Local</b> atau <b>Google Drive</b>. Tambahkan <b>Custom Fields</b> (Teks, Angka, Tanggal, Dropdown) untuk data tambahan yang spesifik.</p>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <Form {...form}>
              <form
                id="add-task-form"
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-6"
              >
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left Column */}
                  <div className="space-y-6">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('addtask.form.title')}</FormLabel>
                          <FormControl>
                            <Input placeholder={t('addtask.form.title.placeholder')} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="brandId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Brand</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a brand for this task" />
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
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('addtask.form.description')}</FormLabel>
                          <FormControl>
                            <Textarea placeholder={t('addtask.form.description.placeholder')} {...field} rows={5}/>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={form.control} name="status" render={({ field }) => (
                          <FormItem>
                              <FormLabel>{t('addtask.form.status')}</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder={t('addtask.form.status.placeholder')} /></SelectTrigger></FormControl>
                              <SelectContent>
                                {areStatusesLoading ? (
                                    <div className="flex items-center justify-center p-2"><Loader2 className="h-4 w-4 animate-spin" /></div>
                                ) : (
                                    statuses?.map((s) => (<SelectItem key={s.id} value={s.name}><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }}></span>{s.name}</div></SelectItem>))
                                )}
                              </SelectContent>
                              </Select><FormMessage />
                          </FormItem>
                      )}/>
                      <FormField control={form.control} name="priority" render={({ field }) => (
                        <FormItem>
                            <FormLabel>{t('addtask.form.priority')}</FormLabel>
                            <div className="flex items-center gap-2">
                                <Select onValueChange={(value) => { field.onChange(value); setSuggestionReason(null); }} value={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder={t('addtask.form.priority.placeholder')} /></SelectTrigger></FormControl>
                                    <SelectContent>{Object.values(priorityInfo).map((p) => (<SelectItem key={p.value} value={p.value}><div className="flex items-center gap-2"><p.icon className={`h-4 w-4 ${p.color}`} />{t(`priority.${p.value.toLowerCase()}` as any)}</div></SelectItem>))}</SelectContent>
                                </Select>
                                <Button type="button" variant="outline" size="icon" onClick={handleSuggestPriority} disabled={isSuggesting} className="shrink-0">{isSuggesting ? (<Loader2 className="h-4 w-4 animate-spin" />) : (<Wand2 className="h-4 w-4" />)}<span className="sr-only">Suggest Priority</span></Button>
                            </div>
                            {suggestionReason && (
                                <div className="mt-2 text-xs text-muted-foreground p-2 bg-secondary/50 rounded-md animate-in fade-in-0 slide-in-from-top-2">
                                    <span className='font-semibold text-primary'>{t('addtask.form.priority.aisays')}</span> {suggestionReason}
                                </div>
                            )}
                            <FormMessage />
                        </FormItem>
                      )}/>
                    </div>

                    <div className="space-y-4 rounded-lg border p-4">
                        <h3 className="text-sm font-medium flex items-center gap-2"><Calendar className="h-4 w-4" />{t('addtask.form.dates')}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField control={form.control} name="startDate" render={({ field }) => (<FormItem><FormLabel>{t('addtask.form.startdate')}</FormLabel><FormControl><Input type="date" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)}/>
                             <FormField
                                control={form.control}
                                name="dueDate"
                                render={({ field }) => (
                                  <FormItem className="flex flex-col">
                                    <FormLabel>{t('addtask.form.duedate')}</FormLabel>
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <FormControl>
                                          <Button
                                            variant={"outline"}
                                            className={cn(
                                              "w-full pl-3 text-left font-normal",
                                              !field.value && "text-muted-foreground"
                                            )}
                                          >
                                            {field.value ? (
                                              format(field.value, "PPP")
                                            ) : (
                                              <span>Pick a date</span>
                                            )}
                                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                          </Button>
                                        </FormControl>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-auto p-0" align="start">
                                        <CalendarComponent
                                          mode="single"
                                          selected={field.value}
                                          onSelect={field.onChange}
                                          disabled={(date) => date < new Date("1900-01-01")}
                                          initialFocus
                                          modifiers={modifiers}
                                          modifiersClassNames={modifiersClassNames}
                                        />
                                      </PopoverContent>
                                    </Popover>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                        </div>
                        <div className="space-y-2"><Label className="text-xs text-muted-foreground">{t('addtask.form.quickselect')}</Label><div className="flex flex-wrap gap-2">{quickDateOptions.map(option => (<Button key={option.label} type="button" variant="outline" size="sm" onClick={() => setDateValue('dueDate', option.getValue())}>{option.label}</Button>))} <Button type="button" variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => form.setValue('dueDate', undefined)}>{t('addtask.form.quickselect.clear')}</Button></div></div>
                    </div>

                    <div className="space-y-4 rounded-lg border p-4">
                      <h3 className="text-sm font-medium flex items-center gap-2"><Clock className="h-4 w-4" />Time Management</h3>
                      <FormField control={form.control} name="timeEstimate" render={({ field }) => (<FormItem><FormLabel>{t('addtask.form.timeestimate')}</FormLabel><FormControl><Input type="number" placeholder={t('addtask.form.timeestimate.placeholder')} {...field} onChange={(e) => field.onChange(e.target.value === '' ? undefined : +e.target.value)} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)}/>
                      <div className="space-y-2"><div className="flex justify-between text-xs text-muted-foreground"><span>Time Logged</span><span>{timeTracked.toFixed(2)}h / {timeEstimateValue}h</span></div><Progress value={timeTrackingProgress} /></div>
                      <Accordion type="single" collapsible>
                        <AccordionItem value="time-log" className="border-b-0">
                          <AccordionTrigger className="text-xs -mt-2">Log Manual Time</AccordionTrigger>
                          <AccordionContent className="space-y-4">
                            <div className="grid grid-cols-1 gap-4">
                                <div className="grid grid-cols-2 gap-4"><div><Label htmlFor="log-date" className="text-xs">Date</Label><Input id="log-date" type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)} /></div><div><Label htmlFor="log-note" className="text-xs">Note</Label><Input id="log-note" value={logNote} onChange={(e) => setLogNote(e.target.value)} placeholder="What did you work on?"/></div></div>
                                <div className="grid grid-cols-2 gap-4"><div><Label htmlFor="start-time" className="text-xs">Start Time</Label><Input id="start-time" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></div><div><Label htmlFor="end-time" className="text-xs">End Time</Label><Input id="end-time" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></div></div>
                            </div>
                            <Button variant="outline" type="button" onClick={handleAddLogEntry} className="w-full">Add Time Entry</Button>
                            {timeLogs.length > 0 && (<div className="space-y-3 pt-4"><h4 className='text-xs font-semibold text-muted-foreground'>History</h4><div className="max-h-24 overflow-y-auto space-y-2 pr-2">{timeLogs.map(log => (<div key={log.id} className='text-xs flex justify-between items-center bg-secondary/50 p-2 rounded-md'><div><p className='font-medium'>{format(parseISO(log.startTime), 'MMM d, yyyy')}</p><p className='text-muted-foreground'>{log.description ? `${log.description} - ` : ''}{format(parseISO(log.startTime), 'p')} - {format(parseISO(log.endTime), 'p')}</p></div><div className='font-semibold'>{formatDistanceToNow(new Date().getTime() - log.duration * 1000, { includeSeconds: true, addSuffix: false, unit: 'hour' })}</div></div>))}</div></div>)}
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </div>

                  </div>

                  {/* Right Column */}
                  <div className="space-y-6">
                    <div className="space-y-4 rounded-lg border p-4">
                        <div className='flex items-center justify-between'>
                            <h3 className="text-sm font-medium flex items-center gap-2"><Share className="h-4 w-4" />{t('addtask.form.sharelink')}</h3>
                            <div className="flex items-center space-x-2">
                                <Label htmlFor="share-setting" className="text-xs text-muted-foreground">{t(`addtask.form.sharelink.${shareSetting}.option`)}</Label>
                                <Switch id="share-setting" checked={shareSetting === 'public'} onCheckedChange={(checked) => setShareSetting(checked ? 'public' : 'private')} />
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground -mt-2">
                          {t(`addtask.form.sharelink.${shareSetting}`)}
                        </p>
                         {shareSetting === 'public' && (
                            <div className="flex gap-2">
                                <Input value="https://workwise.app/task/share-link-placeholder" readOnly />
                                <Button variant="outline" size="icon" onClick={() => toast({title: "Link copied!"})}>
                                    <Copy className="h-4 w-4" />
                                </Button>
                            </div>
                        )}
                        <Separator />
                        <FormField
                            control={form.control}
                            name="assigneeIds"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t('addtask.form.teammembers')}</FormLabel>
                                  <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                          <Button variant="outline" className="w-full justify-start text-muted-foreground" disabled={isEmployee}>
                                          <UserPlus className="mr-2 h-4 w-4" />{t('addtask.form.selectmembers')}
                                          </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
                                          {(users || []).filter(user => user.role === 'Employee' || user.role === 'Client').map((user) => (
                                              <DropdownMenuItem key={user.id} onSelect={() => handleSelectUser(user)}>
                                                  <div className="flex w-full items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <Avatar className="h-6 w-6 mr-2">
                                                            <AvatarImage src={user.avatarUrl} alt={user.name} />
                                                            <AvatarFallback>{user.name?.charAt(0)}</AvatarFallback>
                                                        </Avatar>
                                                        <span>{user.name}</span>
                                                    </div>
                                                    <span className="text-xs text-muted-foreground">
                                                        {userWorkload.get(user.id) || 0} tugas aktif
                                                    </span>
                                                  </div>
                                              </DropdownMenuItem>
                                          ))}
                                      </DropdownMenuContent>
                                  </DropdownMenu>
                                {selectedUsers.length > 0 && (
                                    <div className="space-y-2 pt-2">
                                        <Label>{t('addtask.form.selectedmembers')}</Label>
                                        {selectedUsers.map((user) => (
                                            <div key={user.id} className="flex items-center justify-between rounded-md bg-secondary/50 p-2">
                                                <div className="flex items-center gap-2">
                                                    <Avatar className="h-7 w-7"><AvatarImage src={user.avatarUrl} alt={user.name} /><AvatarFallback>{user.name?.charAt(0)}</AvatarFallback></Avatar>
                                                    <span className="text-sm font-medium">{user.name}</span>
                                                </div>
                                                {!isEmployee && (
                                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRemoveUser(user.id)}><X className="h-4 w-4" /></Button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                    </div>
                     <Tabs defaultValue="subtasks" className="w-full">
                      <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="subtasks"><ListTodo className="mr-2"/>Subtasks</TabsTrigger>
                        <TabsTrigger value="dependencies"><GitMerge className="mr-2"/>Dependencies</TabsTrigger>
                        <TabsTrigger value="comments"><MessageSquare className="mr-2"/>Comments</TabsTrigger>
                      </TabsList>
                      <TabsContent value="subtasks" className="mt-4 space-y-4 rounded-lg border p-4">
                        <div className="space-y-2"><div className="flex justify-between text-xs text-muted-foreground"><span>Progress</span><span>{subtasks.filter(st => st.completed).length}/{subtasks.length}</span></div><Progress value={subtaskProgress} /></div>
                        <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                            {subtasks.map((subtask) => (
                                <div key={subtask.id} className="flex items-center gap-3 p-2 bg-secondary/50 rounded-md">
                                    <Checkbox id={`subtask-create-${subtask.id}`} checked={subtask.completed} onCheckedChange={() => handleToggleSubtask(subtask.id)} />
                                    <label htmlFor={`subtask-create-${subtask.id}`} className={`flex-1 text-sm ${subtask.completed ? 'line-through text-muted-foreground' : ''}`}>{subtask.title}</label>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleRemoveSubtask(subtask.id)}><Trash2 className="h-4 w-4"/></Button>
                                </div>
                            ))}
                        </div>
                        <div className="flex items-center gap-2">
                            <Input placeholder="Add a new subtask..." value={newSubtaskTitle} onChange={(e) => setNewSubtaskTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSubtask())} />
                            <Button type="button" onClick={handleAddSubtask}><Plus className="h-4 w-4 mr-2"/> Add</Button>
                        </div>
                      </TabsContent>
                       <TabsContent value="dependencies" className="mt-4 space-y-4 rounded-lg border p-4">
                          <div className="space-y-2">
                              <h4 className="font-semibold text-sm flex items-center gap-2">Waiting On ({dependencies.length})</h4>
                              <p className="text-xs text-muted-foreground">This task can't start until these tasks are done.</p>
                               <Popover>
                                <PopoverTrigger asChild><Button variant="outline" className="w-full"><Plus className="h-4 w-4 mr-2"/> Add Dependency</Button></PopoverTrigger>
                                <PopoverContent className="w-80"><div className="space-y-2">{(allTasks || []).map(task => (<Button key={task.id} variant="ghost" size="sm" className="w-full justify-start" onClick={() => setDependencies(d => [...d, task.id])}>{task.title}</Button>))}</div></PopoverContent>
                              </Popover>
                              <div className="space-y-2">{dependencies.map(depId => (<div key={depId} className="flex items-center justify-between p-2 bg-secondary/50 rounded-md text-sm"><span>{allTasks?.find(t=>t.id === depId)?.title}</span><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDependencies(d => d.filter(id => id !== depId))}><X className="h-4 w-4"/></Button></div>))}</div>
                          </div>
                           <div className="space-y-2">
                              <h4 className="font-semibold text-sm flex items-center gap-2">Blocking ({blocking.length})</h4>
                              <p className="text-xs text-muted-foreground">These tasks can't start until this task is done.</p>
                              <Popover>
                                <PopoverTrigger asChild><Button variant="outline" className="w-full"><Plus className="h-4 w-4 mr-2"/> Add Blocking Task</Button></PopoverTrigger>
                                <PopoverContent className="w-80"><div className="space-y-2">{(allTasks || []).map(task => (<Button key={task.id} variant="ghost" size="sm" className="w-full justify-start" onClick={() => setBlocking(b => [...b, task.id])}>{task.title}</Button>))}</div></PopoverContent>
                              </Popover>
                               <div className="space-y-2">{blocking.map(depId => (<div key={depId} className="flex items-center justify-between p-2 bg-secondary/50 rounded-md text-sm"><span>{allTasks?.find(t=>t.id === depId)?.title}</span><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setBlocking(b => b.filter(id => id !== depId))}><X className="h-4 w-4"/></Button></div>))}</div>
                          </div>
                      </TabsContent>
                      <TabsContent value="comments" className="mt-4 space-y-4 rounded-lg border p-4 relative">
                        <div className="space-y-4 max-h-48 overflow-y-auto pr-2">
                          {comments.map(comment => (
                              <div key={comment.id} className="flex gap-3">
                                  <Avatar className="h-8 w-8"><AvatarImage src={comment.user.avatarUrl} /><AvatarFallback>{comment.user.name?.charAt(0)}</AvatarFallback></Avatar>
                                  <div className="flex-1">
                                      <div className="flex items-center gap-2"><span className="font-semibold text-sm">{comment.user.name}</span><span className="text-xs text-muted-foreground">{formatDistanceToNow(parseISO(comment.timestamp), { addSuffix: true })}</span></div>
                                      <p className="text-sm bg-secondary/50 p-3 rounded-lg mt-1">{comment.text}</p>
                                  </div>
                              </div>
                          ))}
                        </div>
                        {isMentioning && (
                          <Card className="absolute bottom-20 w-full max-w-sm shadow-lg">
                            <CardContent className="p-2 max-h-48 overflow-y-auto">
                              {mentionSuggestions.length > 0 ? (
                                mentionSuggestions.map(u => (
                                  <Button key={u.id} variant="ghost" className="w-full justify-start gap-2" onClick={() => handleMentionSelect(u)}>
                                    <Avatar className="h-6 w-6"><AvatarImage src={u.avatarUrl} /><AvatarFallback>{u.name.charAt(0)}</AvatarFallback></Avatar>
                                    {u.name}
                                  </Button>
                                ))
                              ) : (
                                <p className="p-2 text-sm text-muted-foreground">No users found.</p>
                              )}
                            </CardContent>
                          </Card>
                        )}
                        <div className="flex gap-3 pt-4 border-t">
                             <Avatar className="h-8 w-8"><AvatarImage src={currentUserProfile?.avatarUrl} /><AvatarFallback>{currentUserProfile?.name?.charAt(0)}</AvatarFallback></Avatar>
                             <div className="flex-1 relative">
                                <Textarea value={newComment} onChange={handleCommentChange} placeholder="Write a comment... use @ to mention" className="pr-24" />
                                <div className="absolute top-2 right-2 flex gap-1">
                                    <input type="file" ref={commentFileInputRef} onChange={(e) => {}} className="hidden" />
                                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground"><AtSign className="h-4 w-4"/></Button>
                                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => commentFileInputRef.current?.click()}><Paperclip className="h-4 w-4"/></Button>
                                    <Button type="button" size="icon" className="h-7 w-7" onClick={handlePostComment} disabled={!newComment.trim()}><Send className="h-4 w-4"/></Button>
                                </div>
                             </div>
                        </div>
                      </TabsContent>
                    </Tabs>

                    <div className="space-y-2">
                      <Label className="flex items-center gap-2"><Tag className="w-4 h-4" />Tags</Label>
                      <div className="flex flex-wrap gap-2 p-2 border rounded-md min-h-10">
                        {selectedTags.map(tag => (<div key={tag.label} className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${tag.color}`}>{tag.label}<button type="button" onClick={() => handleRemoveTag(tag.label)} className="opacity-70 hover:opacity-100"><X className="h-3 w-3" /></button></div>))}
                        <Popover><PopoverTrigger asChild><Button type="button" variant="outline" size="sm" className="h-6 w-6 p-0">+</Button></PopoverTrigger>
                            <PopoverContent className="w-auto p-1"><div className="flex flex-col gap-1">{Object.values(allTags).map(tag => (<Button key={tag.label} variant="ghost" size="sm" className="justify-start" onClick={() => handleSelectTag(tag)}><div className="flex items-center gap-2"><div className={`w-3 h-3 rounded-full ${tag.color.split(' ')[0]}`}></div>{tag.label}</div></Button>))}</div></PopoverContent>
                        </Popover>
                      </div>
                    </div>

                    <div className="space-y-4 rounded-lg border p-4">
                      <h3 className="text-sm font-medium flex items-center gap-2"><Paperclip className="h-4 w-4" />Attachments</h3>
                      <div className="grid grid-cols-2 gap-2"><input type="file" ref={fileInputRef} onChange={handleFileChange} multiple accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" className="hidden" /><Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>{isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Upload from Local</Button><Button type="button" variant="outline" onClick={handleAddGdriveLink}><svg className="mr-2" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10.5187 5.56875L5.43125 0.48125L0 9.25625L5.0875 14.3438L10.5187 5.56875Z" fill="#34A853"/><path d="M16 9.25625L10.5188 0.48125H5.43125L8.25625 4.8875L13.25 13.9062L16 9.25625Z" fill="#FFC107"/><path d="M2.83125 14.7875L8.25625 5.56875L5.51875 0.81875L0.0375 9.59375L2.83125 14.7875Z" fill="#1A73E8"/><path d="M13.25 13.9062L10.825 9.75L8.25625 4.8875L5.43125 10.1L8.03125 14.7875H13.1562L13.25 13.9062Z" fill="#EA4335"/></svg>Link from Google Drive</Button></div>
                      {attachments.length > 0 && (<div className="space-y-2"><Label>Attached Files</Label><div className="max-h-24 overflow-y-auto space-y-2 pr-2">{attachments.map(att => (<a key={att.id} href={att.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between rounded-md bg-secondary/50 p-2 text-sm hover:bg-secondary"><div className="flex items-center gap-2 truncate">{getFileIcon(att.name)}<span className="truncate" title={att.name}>{att.name}</span></div><Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={(e) => { e.preventDefault(); handleRemoveAttachment(att.id);}}><X className="h-4 w-4" /></Button></a>))}</div></div>)}
                    </div>
                    
                    <div className="space-y-4 rounded-lg border p-4">
                        <div className="flex items-center justify-between"><h3 className="text-sm font-medium flex items-center gap-2"><Plus className="h-4 w-4" />Custom Fields</h3><DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm"><Plus className="mr-2 h-4 w-4" />Add Field</Button></DropdownMenuTrigger><DropdownMenuContent><DropdownMenuItem onSelect={() => handleAddCustomField('Text')}><Type className="mr-2 h-4 w-4" /> Text</DropdownMenuItem><DropdownMenuItem onSelect={() => handleAddCustomField('Number')}><Hash className="mr-2 h-4 w-4" /> Number</DropdownMenuItem><DropdownMenuItem onSelect={() => handleAddCustomField('Date')}><CalendarIcon className="mr-2 h-4 w-4" /> Date</DropdownMenuItem><DropdownMenuItem onSelect={() => handleAddCustomField('Dropdown')}><List className="mr-2 h-4 w-4" /> Dropdown</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>
                        <div className="space-y-2 max-h-32 overflow-y-auto pr-2">{customFields.map((field) => (<div key={field.id} className="flex items-center gap-2"><Input placeholder="Field Name" value={field.name} onChange={(e) => handleCustomFieldChange(field.id, 'name', e.target.value)} className="flex-1" />{renderCustomFieldInput(field)}<Button variant="ghost" size="icon" onClick={() => handleRemoveCustomField(field.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>))}</div>
                    </div>
                  </div>
                </div>
              </form>
            </Form>
          </div>
        </ScrollArea>
        <DialogFooter className="p-6 pt-4 border-t">
          <Button type="submit" form="add-task-form">
            {t('addtask.form.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

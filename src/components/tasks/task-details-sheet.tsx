'use client';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTrigger,
  SheetFooter,
  SheetTitle,
} from '@/components/ui/sheet';
import type { Task, TimeLog, User, Priority, Tag, Subtask, Comment, Attachment } from '@/lib/types';
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
import { priorityInfo, statusInfo } from '@/lib/utils';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AtSign, CalendarIcon, Clock, Edit, FileUp, GitMerge, ListTodo, LogIn, MessageSquare, PauseCircle, PlayCircle, Plus, Repeat, Send, Tag as TagIcon, Trash, Trash2, Users, Wand2, X, Share2, Star, Link as LinkIcon, Paperclip, MoreHorizontal, Copy, FileImage } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Separator } from '../ui/separator';
import { useI18n } from '@/context/i18n-provider';
import { Progress } from '../ui/progress';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '../ui/checkbox';
import { ScrollArea } from '../ui/scroll-area';
import { validatePriorityChange } from '@/ai/flows/validate-priority-change';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { Loader2 } from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase, useUserProfile, useStorage } from '@/firebase';
import { collection, doc, updateDoc } from 'firebase/firestore';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { tags as allTags } from '@/lib/data';
import { updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';


const taskDetailsSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  status: z.enum(['To Do', 'Doing', 'Done']),
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

type Activity = {
    id: string;
    user: User;
    action: string;
    timestamp: string;
};

type AIValidationState = {
  isOpen: boolean;
  isChecking: boolean;
  reason: string;
  onConfirm: () => void;
};

export function TaskDetailsSheet({ 
  task: initialTask, 
  children, 
  open: openProp,
  onOpenChange: onOpenChangeProp 
}: { 
  task: Task; 
  children: React.ReactNode, 
  open?: boolean,
  onOpenChange?: (open: boolean) => void; 
}) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);

  const [elapsedTime, setElapsedTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [timerStartTime, setTimerStartTime] = useState<Date | null>(null);

  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  
  const [currentAssignees, setCurrentAssignees] = useState<User[]>([]);
  const [currentTags, setCurrentTags] = useState<Tag[]>([]);
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([]);
  const [timeTracked, setTimeTracked] = useState(0);
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const [activities, setActivities] = useState<Activity[]>([]);
  
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [newSubtask, setNewSubtask] = useState('');

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [aiValidation, setAiValidation] = useState<AIValidationState>({ isOpen: false, isChecking: false, reason: '', onConfirm: () => {} });

  const firestore = useFirestore();
  const storage = useStorage();
  const usersCollectionRef = useMemoFirebase(() => 
    firestore ? collection(firestore, 'users') : null,
  [firestore]);

  const { data: allUsers } = useCollection<User>(usersCollectionRef);

  const { profile: currentUser } = useUserProfile();

  const form = useForm<TaskDetailsFormValues>({
    resolver: zodResolver(taskDetailsSchema),
  });
  
  // Resets form and all local states when the sheet is opened or the task prop changes.
  useEffect(() => {
    if (initialTask) {
        form.reset({
            title: initialTask.title,
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
        setTimeLogs(initialTask.timeLogs || []);
        setTimeTracked(initialTask.timeTracked || 0);
        setAttachments(initialTask.attachments || []);
        setIsEditing(false); // Always start in read-only mode
    }
  }, [initialTask, form]);


  const handleOpenChange = (isOpen: boolean) => {
    if (onOpenChangeProp) {
        if (!isOpen) {
            setIsEditing(false);
        }
        onOpenChangeProp(isOpen);
    }
  }

  const handlePriorityChange = async (newPriority: Priority) => {
    const currentPriority = form.getValues('priority');
    const priorityValues: Record<Priority, number> = { 'Low': 0, 'Medium': 1, 'High': 2, 'Urgent': 3 };

    if (priorityValues[newPriority] <= priorityValues[currentPriority]) {
        form.setValue('priority', newPriority);
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
            form.setValue('priority', newPriority);
            toast({ title: 'AI Agrees!', description: result.reason });
        } else {
            setAiValidation({
                isOpen: true,
                isChecking: false,
                reason: result.reason,
                onConfirm: () => {
                    form.setValue('priority', newPriority); 
                    setAiValidation({ ...aiValidation, isOpen: false });
                }
            });
        }
    } catch (e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'AI Validation Failed', description: 'Could not validate priority change. Applying directly.' });
        form.setValue('priority', newPriority);
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
  
  const handleStartStop = useCallback(() => {
    if (isRunning) {
      setIsRunning(false);
    } else {
      setIsRunning(true);
      if (!timerStartTime) {
        setTimerStartTime(new Date());
      }
    }
  }, [isRunning, timerStartTime]);

  const handleLogTime = () => {
    if (elapsedTime === 0 && !isRunning) return;
    const endTime = new Date();
    const newLog: TimeLog = {
      id: `log-${Date.now()}`,
      startTime: timerStartTime?.toISOString() || new Date().toISOString(),
      endTime: endTime.toISOString(),
      duration: elapsedTime,
    };
    const newTimeTracked = timeTracked + (elapsedTime / 3600);
    setTimeTracked(parseFloat(newTimeTracked.toFixed(2)));
    setTimeLogs(prev => [...prev, newLog]);
    
    setIsRunning(false);
    setElapsedTime(0);
    setTimerStartTime(null);
  };
  
  const handlePostComment = () => {
    if (!newComment.trim() || !currentUser) return;
    const comment: Comment = {
      id: `c-${Date.now()}`,
      user: {
        id: currentUser.id,
        name: currentUser.name,
        email: currentUser.email,
        avatarUrl: currentUser.avatarUrl || '',
        role: currentUser.role
      },
      text: newComment,
      timestamp: new Date().toISOString(),
      replies: [],
    };
    setComments([...comments, comment]);
    setActivities(prev => [{id: `a-${Date.now()}`, user: comment.user, action: `commented: "${newComment.substring(0, 30)}..."`, timestamp: new Date().toISOString()}, ...prev]);
    setNewComment('');
  };

  const handleToggleSubtask = (subtaskId: string) => {
    const newSubtasks = subtasks.map(st => st.id === subtaskId ? { ...st, completed: !st.completed } : st);
    setSubtasks(newSubtasks);
  };

  const handleAddSubtask = () => {
    if(!newSubtask.trim()) return;
    const subtask: Subtask = { id: `st-${Date.now()}`, title: newSubtask, completed: false };
    setSubtasks([...subtasks, subtask]);
    setNewSubtask('');
  };
  
  const handleRemoveSubtask = (subtaskId: string) => {
    setSubtasks(subtasks.filter(st => st.id !== subtaskId));
  }

  const getFileIcon = (fileName: string) => {
    if (fileName.match(/\.(pdf)$/i)) return <FileImage className="h-5 w-5 text-red-500" />;
    if (fileName.match(/\.(doc|docx)$/i)) return <FileImage className="h-5 w-5 text-blue-500" />;
    if (fileName.match(/\.(jpg|jpeg|png|gif)$/i)) return <FileImage className="h-5 w-5 text-green-500" />;
    return <FileImage className="h-5 w-5 text-muted-foreground" />;
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && storage) {
      const files = Array.from(event.target.files);
      const uploadPromises = files.map(async (file) => {
        const storageRef = ref(storage, `attachments/${initialTask.id}/${file.name}`);
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


  const onSubmit = (data: TaskDetailsFormValues) => {
    if (!firestore) return;
    const taskDocRef = doc(firestore, 'tasks', initialTask.id);
    
    const updatedTaskData = {
        ...data,
        assignees: currentAssignees,
        tags: currentTags,
        subtasks: subtasks,
        comments: comments,
        timeTracked: timeTracked,
        timeLogs: timeLogs,
        attachments: attachments,
    };
    
    updateDocumentNonBlocking(taskDocRef, updatedTaskData);
    
    toast({
        title: 'Task Updated',
        description: `"${data.title}" has been saved.`,
    });
    setIsEditing(false);
  };
  
  const timeEstimateValue = form.watch('timeEstimate') ?? initialTask.timeEstimate ?? 0;
  
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


  return (
    <>
      <Sheet open={openProp} onOpenChange={handleOpenChange}>
        <SheetTrigger asChild>{children}</SheetTrigger>
        <SheetContent className="w-full sm:max-w-4xl grid grid-rows-[auto_1fr_auto] p-0">
          <SheetHeader className="p-4 border-b">
             <SheetTitle className='sr-only'>Task Details for {initialTask.title}</SheetTitle>
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    {/* Placeholder for a task ID or breadcrumb */}
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm"><Star className="h-4 w-4 mr-2"/> Favorite</Button>
                    <Button variant="ghost" size="sm"><Share2 className="h-4 w-4 mr-2"/> Share</Button>
                     <Button variant="ghost" size="sm"><LinkIcon className="h-4 w-4 mr-2"/> Copy Link</Button>
                    <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
                </div>
             </div>
          </SheetHeader>
          
          <Form {...form}>
            <form id="task-details-form" onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-3 h-full overflow-hidden">
                {/* Main Content */}
                <ScrollArea className="col-span-2 h-full">
                    <div className="p-6 space-y-6">
                        {isEditing ? (
                           <FormField control={form.control} name="title" render={({ field }) => ( <Input {...field} className="text-2xl font-bold border-dashed h-auto p-0 border-0 focus-visible:ring-1"/> )}/>
                        ) : (
                           <h2 className="text-2xl font-bold">{form.getValues('title')}</h2>
                        )}

                        {isEditing ? (
                           <FormField control={form.control} name="description" render={({ field }) => ( <Textarea {...field} placeholder="Add a more detailed description..." className="min-h-24 border-dashed"/> )}/>
                        ) : (
                           <p className="text-muted-foreground">{form.getValues('description') || 'No description provided.'}</p>
                        )}

                        <Separator/>
                        
                        <div className="space-y-4">
                          <h3 className="font-semibold flex items-center gap-2"><Paperclip/> Attachments</h3>
                          {attachments.length > 0 && (
                            <div className="space-y-2">
                              {attachments.map(att => (
                                <div key={att.id} className="flex items-center justify-between rounded-md bg-secondary/50 p-2 text-sm">
                                  <a href={att.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 truncate hover:underline">
                                    {getFileIcon(att.name)}
                                    <span className="truncate" title={att.name}>{att.name}</span>
                                  </a>
                                  {isEditing && (
                                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => handleRemoveAttachment(att.id)}>
                                      <X className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          {isEditing && (
                            <div className="grid grid-cols-2 gap-4">
                              <input type="file" ref={fileInputRef} onChange={handleFileChange} multiple className="hidden" />
                              <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}><FileUp className="mr-2 h-4 w-4" />Upload from Local</Button>
                              <Button type="button" variant="outline" onClick={handleAddGdriveLink}><svg className="mr-2" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10.5187 5.56875L5.43125 0.48125L0 9.25625L5.0875 14.3438L10.5187 5.56875Z" fill="#34A853"/><path d="M16 9.25625L10.5188 0.48125H5.43125L8.25625 4.8875L13.25 13.9062L16 9.25625Z" fill="#FFC107"/><path d="M2.83125 14.7875L8.25625 5.56875L5.51875 0.81875L0.0375 9.59375L2.83125 14.7875Z" fill="#1A73E8"/><path d="M13.25 13.9062L10.825 9.75L8.25625 4.8875L5.43125 10.1L8.03125 14.7875H13.1562L13.25 13.9062Z" fill="#EA4335"/></svg>Link from Google Drive</Button>
                            </div>
                          )}
                        </div>

                         <Tabs defaultValue="subtasks" className="w-full">
                            <TabsList>
                                <TabsTrigger value="subtasks">Subtasks</TabsTrigger>
                                <TabsTrigger value="comments">Comments</TabsTrigger>
                                <TabsTrigger value="activity">Activity</TabsTrigger>
                            </TabsList>
                            <TabsContent value="subtasks" className="mt-4 space-y-4">
                                <div className="space-y-2"><div className="flex justify-between text-xs text-muted-foreground"><span>Progress</span><span>{subtasks.filter(st => st.completed).length}/{subtasks.length}</span></div><Progress value={subtaskProgress} /></div>
                                <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                                    {subtasks.map((subtask) => (
                                        <div key={subtask.id} className="flex items-center gap-3 p-2 bg-secondary/50 rounded-md hover:bg-secondary transition-colors">
                                            <Checkbox id={`subtask-${subtask.id}`} checked={subtask.completed} onCheckedChange={() => handleToggleSubtask(subtask.id)} disabled={!isEditing} />
                                            <label htmlFor={`subtask-${subtask.id}`} className={`flex-1 text-sm ${subtask.completed ? 'line-through text-muted-foreground' : ''}`}>{subtask.title}</label>
                                            {isEditing && <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => handleRemoveSubtask(subtask.id)}><Trash className="h-4 w-4"/></Button>}
                                        </div>
                                    ))}
                                </div>
                                {isEditing && <div className="flex items-center gap-2">
                                    <Input placeholder="Add a new subtask..." value={newSubtask} onChange={(e) => setNewSubtask(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddSubtask())}/>
                                    <Button type="button" onClick={handleAddSubtask}><Plus className="h-4 w-4 mr-2"/> Add</Button>
                                </div>}
                            </TabsContent>
                            <TabsContent value="comments" className="mt-4">
                                <div className="space-y-6">
                                    {comments.map(comment => (
                                        <div key={comment.id} className="flex gap-3">
                                            <Avatar className="h-8 w-8"><AvatarImage src={comment.user.avatarUrl} /><AvatarFallback>{comment.user.name?.charAt(0)}</AvatarFallback></Avatar>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2"><span className="font-semibold text-sm">{comment.user.name}</span><span className="text-xs text-muted-foreground">{formatDistanceToNow(parseISO(comment.timestamp), { addSuffix: true })}</span></div>
                                                <p className="text-sm bg-secondary p-3 rounded-lg mt-1">{comment.text}</p>
                                            </div>
                                        </div>
                                    ))}
                                    <div className="flex gap-3 pt-4 border-t">
                                        <Avatar className="h-8 w-8"><AvatarImage src={currentUser?.avatarUrl} /><AvatarFallback>{currentUser?.name?.charAt(0)}</AvatarFallback></Avatar>
                                        <div className="flex-1 relative">
                                            <Textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Write a comment... use @ to mention" className="pr-20" />
                                            <div className="absolute top-2 right-2 flex gap-1">
                                                <Button type="button" variant="ghost" size="icon" className="h-7 w-7"><AtSign className="h-4 w-4"/></Button>
                                                <Button type="button" size="sm" onClick={handlePostComment} disabled={!newComment.trim()}><Send className="h-4 w-4 mr-2"/>Send</Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </TabsContent>
                             <TabsContent value="activity" className="mt-4">
                                <div className="space-y-6">
                                    {activities.map(activity => (
                                        <div key={activity.id} className="flex gap-3 text-sm">
                                            <Avatar className="h-8 w-8"><AvatarImage src={activity.user.avatarUrl}/><AvatarFallback>{activity.user.name?.charAt(0)}</AvatarFallback></Avatar>
                                            <div><span className="font-semibold">{activity.user.name}</span> <span className="text-muted-foreground">{activity.action}</span><p className="text-xs text-muted-foreground mt-1">{formatDistanceToNow(parseISO(activity.timestamp), { addSuffix: true })}</p></div>
                                        </div>
                                    ))}
                                </div>
                            </TabsContent>
                        </Tabs>
                    </div>
                </ScrollArea>

                {/* Sidebar */}
                <ScrollArea className="col-span-1 h-full border-l">
                  <div className="p-6 space-y-6">
                     <FormField control={form.control} name="status" render={({ field }) => (
                         <FormItem className="grid grid-cols-3 items-center gap-2">
                            <FormLabel className="text-muted-foreground">Status</FormLabel>
                            <div className="col-span-2">
                                <Select onValueChange={field.onChange} value={field.value} disabled={!isEditing}>
                                    <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                                    <SelectContent>{Object.values(statusInfo).map(s => (<SelectItem key={s.value} value={s.value}><div className="flex items-center gap-2"><s.icon className="h-4 w-4" />{s.label}</div></SelectItem>))}</SelectContent>
                                </Select>
                            </div>
                         </FormItem>
                     )}/>
                     <FormField control={form.control} name="priority" render={({ field }) => (
                         <FormItem className="grid grid-cols-3 items-center gap-2">
                            <FormLabel className="text-muted-foreground">Priority</FormLabel>
                            <div className="col-span-2 flex items-center gap-2">
                                <Select onValueChange={(v: Priority) => handlePriorityChange(v)} value={field.value} disabled={!isEditing}>
                                    <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                                    <SelectContent>{Object.values(priorityInfo).map(p => (<SelectItem key={p.value} value={p.value}><div className="flex items-center gap-2"><p.icon className={`h-4 w-4 ${p.color}`} />{p.label}</div></SelectItem>))}</SelectContent>
                                </Select>
                                {aiValidation.isChecking && <Loader2 className="h-5 w-5 animate-spin" />}
                            </div>
                         </FormItem>
                     )}/>
                      <FormField control={form.control} name="dueDate" render={({ field }) => (
                          <FormItem className="grid grid-cols-3 items-center gap-2">
                             <FormLabel className="text-muted-foreground">Due Date</FormLabel>
                             <div className="col-span-2">
                                <Input type="date" {...field} value={field.value || ''} readOnly={!isEditing} className={!isEditing ? 'border-none p-0' : ''}/>
                             </div>
                          </FormItem>
                      )}/>
                    <Separator/>
                    
                    <FormItem>
                        <FormLabel className="text-muted-foreground">Assignees</FormLabel>
                         {currentAssignees.map(user => (
                            <div key={user.id} className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-8 w-8"><AvatarImage src={user.avatarUrl} alt={user.name} /><AvatarFallback>{user.name?.charAt(0)}</AvatarFallback></Avatar>
                                    <p className="text-sm font-medium">{user.name}</p>
                                </div>
                                {isEditing && <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => handleRemoveUser(user.id)}><X className="h-4"/></Button>}
                            </div>
                        ))}
                        {isEditing && (
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-full mt-2"><Plus className="mr-2"/> Add Assignee</Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-60">
                                    <div className="space-y-2">
                                        {(allUsers || []).map((user) => (
                                            <Button key={user.id} variant="ghost" size="sm" className="w-full justify-start" onClick={() => handleSelectUser(user)}>
                                                <Avatar className="h-6 w-6 mr-2">
                                                    <AvatarImage src={user.avatarUrl} alt={user.name} />
                                                    <AvatarFallback>{user.name?.charAt(0)}</AvatarFallback>
                                                </Avatar>
                                                <span>{user.name}</span>
                                            </Button>
                                        ))}
                                    </div>
                                </PopoverContent>
                            </Popover>
                        )}
                    </FormItem>
                    
                    <FormItem>
                        <FormLabel className="text-muted-foreground">Tags</FormLabel>
                         <div className="flex flex-wrap gap-2">
                            {currentTags.map(tag => (
                                <div key={tag.label} className={`flex items-center gap-1.5 rounded-full px-2 py-1 text-xs ${tag.color}`}>
                                    {tag.label}
                                    {isEditing && <button type="button" onClick={() => handleRemoveTag(tag.label)}><X className="h-3 w-3"/></button>}
                                </div>
                            ))}
                            {isEditing && (
                                 <Popover>
                                    <PopoverTrigger asChild><Button type="button" variant="outline" size="sm" className="h-6 rounded-full">+ Add</Button></PopoverTrigger>
                                    <PopoverContent className="w-auto p-1"><div className="flex flex-col gap-1">{Object.values(allTags).map(tag => (<Button key={tag.label} variant="ghost" size="sm" className="justify-start" onClick={() => handleSelectTag(tag)}><div className="flex items-center gap-2"><div className={`w-3 h-3 rounded-full ${tag.color.split(' ')[0]}`}></div>{tag.label}</div></Button>))}</div></PopoverContent>
                                </Popover>
                            )}
                         </div>
                    </FormItem>

                    <Separator/>

                     <FormField control={form.control} name="timeEstimate" render={({ field }) => (
                         <FormItem className="grid grid-cols-3 items-center gap-2">
                            <FormLabel className="text-muted-foreground">Estimate</FormLabel>
                            <div className="col-span-2">
                                <Input type="number" {...field} value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value === '' ? undefined : +e.target.value)} readOnly={!isEditing} placeholder="Hours" className={!isEditing ? 'border-none p-0' : ''}/>
                            </div>
                         </FormItem>
                     )}/>
                     
                     <div className="space-y-2">
                        <div className="grid grid-cols-3 items-center gap-2">
                            <span className="text-sm text-muted-foreground">Time Tracked</span>
                            <span className="col-span-2 text-sm font-medium">{timeTracked.toFixed(2)}h</span>
                        </div>
                        <Progress value={timeTrackingProgress} />
                     </div>

                      <div className="space-y-4 rounded-lg border p-4">
                          <div className='flex items-center justify-between'>
                              <h3 className="text-sm font-medium flex items-center gap-2"><Clock className="h-4 w-4" />Time Tracking</h3>
                              <div className='font-mono text-lg font-bold'>{formatStopwatch(elapsedTime)}</div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <Button variant={isRunning ? "destructive" : "outline"} type="button" onClick={handleStartStop}>{isRunning ? <PauseCircle className="mr-2" /> : <PlayCircle className="mr-2" />}{isRunning ? 'Pause' : 'Start'}</Button>
                            <Button variant="outline" type="button" onClick={handleLogTime} disabled={elapsedTime === 0 && !isRunning}><LogIn className="mr-2" />Log Time</Button>
                          </div>
                      </div>

                  </div>
                </ScrollArea>
              </form>
          </Form>
          <SheetFooter className="p-4 border-t flex justify-between">
            <Button variant="destructive" onClick={() => {}} className={isEditing ? 'visible' : 'invisible'}>
                <Trash2 className="mr-2 h-4 w-4"/>
                Delete Task
            </Button>
            {isEditing ? (
              <div className="flex justify-end gap-2">
                  <Button variant="ghost" type="button" onClick={() => setIsEditing(false)}>Cancel</Button>
                  <Button type="submit" form="task-details-form">Save Changes</Button>
              </div>
            ) : (
              <Button type="button" onClick={() => setIsEditing(true)}>
                  <Edit className="mr-2 h-4 w-4"/>
                  Edit Task
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
    </>
  );
}

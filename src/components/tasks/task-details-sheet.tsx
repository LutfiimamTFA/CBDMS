'use client';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTrigger,
  SheetFooter,
  SheetTitle,
} from '@/components/ui/sheet';
import type { Task, TimeLog, User } from '@/lib/types';
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
import { AtSign, CalendarIcon, Check, Clock, Edit, GitMerge, ListTodo, LogIn, MessageSquare, PauseCircle, PlayCircle, Plus, Repeat, Send, Tag, Trash2, Users, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Separator } from '../ui/separator';
import { useI18n } from '@/context/i18n-provider';
import { Progress } from '../ui/progress';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { currentUser, users } from '@/lib/data';
import { Checkbox } from '../ui/checkbox';
import { ScrollArea } from '../ui/scroll-area';
import { useRouter } from 'next/navigation';

const taskDetailsSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  status: z.enum(['To Do', 'Doing', 'Done']),
  priority: z.enum(['Urgent', 'High', 'Medium', 'Low']),
  assignees: z.array(z.string()).optional(),
  timeEstimate: z.coerce.number().min(0).optional(),
});

type TaskDetailsFormValues = z.infer<typeof taskDetailsSchema>;

const formatStopwatch = (time: number) => {
  const hours = Math.floor(time / 3600);
  const minutes = Math.floor((time % 3600) / 60);
  const seconds = time % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

type Comment = {
    id: string;
    user: User;
    text: string;
    timestamp: string;
    replies: Comment[];
};

type Activity = {
    id: string;
    user: User;
    action: string;
    timestamp: string;
};


export function TaskDetailsSheet({ task: initialTask, children, defaultOpen = false, onOpenChange }: { task: Task; children: React.ReactNode, defaultOpen?: boolean, onOpenChange?: (open: boolean) => void; }) {
  const [open, setOpen] = useState(defaultOpen);
  const [task, setTask] = useState(initialTask);
  const { t } = useI18n();
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);

  const [elapsedTime, setElapsedTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [timerStartTime, setTimerStartTime] = useState<Date | null>(null);

  const [comments, setComments] = useState<Comment[]>([
      { id: 'c1', user: users[0], text: 'Can you double-check the mobile responsiveness?', timestamp: new Date(Date.now() - 3600000).toISOString(), replies: [] }
  ]);
  const [newComment, setNewComment] = useState('');

  const [activities, setActivities] = useState<Activity[]>([
      { id: 'a1', user: users[1], action: 'changed status from "To Do" to "Doing"', timestamp: new Date(Date.now() - 7200000).toISOString()},
      { id: 'a2', user: currentUser, action: 'updated the description', timestamp: new Date(Date.now() - 86400000).toISOString()},
  ]);
  
  const [subtasks, setSubtasks] = useState(task.subtasks?.map(st => ({...st, completed: false})) || []);

  const form = useForm<TaskDetailsFormValues>({
    resolver: zodResolver(taskDetailsSchema),
  });
  
  useEffect(() => {
    form.reset({
      title: task.title,
      description: task.description || '',
      status: task.status,
      priority: task.priority,
      assignees: task.assignees.map(a => a.id),
      timeEstimate: task.timeEstimate,
    });
  }, [task, form]);


  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    setIsEditing(false); // Reset to view mode when opening/closing
    if (onOpenChange) {
      onOpenChange(isOpen);
    }
    if (!isOpen && defaultOpen) {
      router.push('/tasks');
    }
  }


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
    
    const newTimeTracked = (task.timeTracked || 0) + (elapsedTime / 3600);

    setTask(prevTask => ({
      ...prevTask,
      timeTracked: parseFloat(newTimeTracked.toFixed(2)),
      timeLogs: [...(prevTask.timeLogs || []), newLog]
    }));
    
    // Reset timer
    setIsRunning(false);
    setElapsedTime(0);
    setTimerStartTime(null);
  };
  
  const handlePostComment = () => {
    if (!newComment.trim()) return;
    const comment: Comment = {
      id: `c-${Date.now()}`,
      user: currentUser,
      text: newComment,
      timestamp: new Date().toISOString(),
      replies: [],
    };
    setComments([...comments, comment]);
    setActivities(prev => [{id: `a-${Date.now()}`, user: currentUser, action: `commented: "${newComment.substring(0, 30)}..."`, timestamp: new Date().toISOString()}, ...prev]);
    setNewComment('');
  };

  const handleToggleSubtask = (subtaskIndex: number) => {
    const newSubtasks = [...subtasks];
    newSubtasks[subtaskIndex].completed = !newSubtasks[subtaskIndex].completed;
    setSubtasks(newSubtasks);
  };

  const subtaskProgress = useMemo(() => {
    if (subtasks.length === 0) return 0;
    const completedCount = subtasks.filter(st => st.completed).length;
    return (completedCount / subtasks.length) * 100;
  }, [subtasks]);


  const onSubmit = (data: TaskDetailsFormValues) => {
    console.log('Updated Task Data:', {...data, timeTracked: task.timeTracked, timeLogs: task.timeLogs, subtasks});
    setTask(currentTask => ({
        ...currentTask,
        ...data,
        assignees: users.filter(u => data.assignees?.includes(u.id))
    }));
    setIsEditing(false); // Exit edit mode on save
  };
  
  const timeEstimateValue = form.watch('timeEstimate') ?? task.timeEstimate ?? 0;
  const timeTrackedValue = task.timeTracked ?? 0;
  
  const timeTrackingProgress = timeEstimateValue > 0
    ? (timeTrackedValue / timeEstimateValue) * 100
    : 0;

  const getStatusDisplay = (status: Task['status']) => {
    const info = statusInfo[status];
    const Icon = info.icon;
    return <div className="flex items-center gap-2"><Icon className="h-4 w-4 text-muted-foreground" />{t(`status.${status.toLowerCase().replace(' ', '')}` as any)}</div>;
  };
  
  const getPriorityDisplay = (priority: Task['priority']) => {
    const info = priorityInfo[priority];
    const Icon = info.icon;
    return <div className="flex items-center gap-2"><Icon className={`h-4 w-4 ${info.color}`} />{t(`priority.${priority.toLowerCase()}` as any)}</div>;
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent className="w-full sm:max-w-3xl grid grid-rows-[auto_1fr_auto] p-0">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full">
            <SheetHeader className="p-6">
                <SheetTitle className="sr-only">{task.title}</SheetTitle>
                 {isEditing ? (
                     <FormField
                        control={form.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input
                                {...field}
                                className="text-2xl font-headline font-bold border-none shadow-none focus-visible:ring-0 p-0"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                 ) : (
                    <h2 className="text-2xl font-headline font-bold">{task.title}</h2>
                 )}
            </SheetHeader>
            <Separator />
            <div className="flex-1 overflow-y-auto px-6">
                <Tabs defaultValue="details" className="pt-4">
                  <TabsList className="grid w-full grid-cols-5">
                    <TabsTrigger value="details">Details</TabsTrigger>
                    <TabsTrigger value="comments">Comments</TabsTrigger>
                    <TabsTrigger value="subtasks">Subtasks</TabsTrigger>
                    <TabsTrigger value="dependencies">Dependencies</TabsTrigger>
                    <TabsTrigger value="activity">Activity</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="details" className="space-y-6 mt-4">
                    <div className="grid grid-cols-2 gap-6">
                        <FormItem>
                            <FormLabel>Status</FormLabel>
                            {isEditing ? (
                                <FormField control={form.control} name="status" render={({ field }) => (
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent>{Object.values(statusInfo).map((s) => (<SelectItem key={s.value} value={s.value}>{getStatusDisplay(s.value)}</SelectItem>))}</SelectContent>
                                    </Select>
                                )}/>
                            ) : (
                                <div className="flex items-center h-10 px-3 py-2 text-sm rounded-md border border-input">{getStatusDisplay(task.status)}</div>
                            )}
                        </FormItem>
                        <FormItem>
                            <FormLabel>{t('addtask.form.priority')}</FormLabel>
                            {isEditing ? (
                                <FormField control={form.control} name="priority" render={({ field }) => (
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent>{Object.values(priorityInfo).map((p) => (<SelectItem key={p.value} value={p.value}>{getPriorityDisplay(p.value)}</SelectItem>))}</SelectContent>
                                    </Select>
                                )}/>
                            ): (
                                <div className="flex items-center h-10 px-3 py-2 text-sm rounded-md border border-input">{getPriorityDisplay(task.priority)}</div>
                            )}
                        </FormItem>
                    </div>

                     <FormItem>
                        <FormLabel>{t('addtask.form.description')}</FormLabel>
                         {isEditing ? (
                            <FormField control={form.control} name="description" render={({ field }) => (
                                <FormControl><Textarea placeholder={t('addtask.form.description.placeholder')} {...field} className="min-h-[100px]" /></FormControl>
                            )}/>
                         ): (
                            <p className="text-sm text-muted-foreground min-h-[100px] p-3 border rounded-md">{task.description || 'No description provided.'}</p>
                         )}
                    </FormItem>

                    {task.tags && task.tags.length > 0 && (
                        <div className="space-y-2">
                        <FormLabel className="flex items-center gap-2"><Tag className="w-4 h-4"/>Tags</FormLabel>
                        <div className="flex flex-wrap gap-2">
                            {task.tags.map((tag) => (
                            <div key={tag.label} className={`px-2.5 py-1 text-sm font-medium rounded-md ${tag.color}`}>
                                {tag.label}
                            </div>
                            ))}
                        </div>
                        </div>
                    )}
                        
                    <div className="space-y-4">
                        <FormLabel className="flex items-center gap-2"><Users className="w-4 h-4"/>{t('addtask.form.teammembers')}</FormLabel>
                        <div className="space-y-3">
                            {task.assignees.map(user => (
                                <div key={user.id} className="flex items-center justify-between gap-2 bg-secondary/50 p-2 rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-8 w-8"><AvatarImage src={user.avatarUrl} alt={user.name} /><AvatarFallback>{user.name.charAt(0)}</AvatarFallback></Avatar>
                                        <div><p className="text-sm font-medium">{user.name}</p><p className="text-xs text-muted-foreground">{user.email}</p></div>
                                    </div>
                                    <Button variant="outline" size="sm" disabled={!isEditing}>Owner</Button>
                                </div>
                            ))}
                        </div>
                        {isEditing && <Button variant="outline" className="w-full">Invite new member</Button>}
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                        <FormItem><FormLabel className="flex items-center gap-2"><CalendarIcon className="w-4 h-4"/>{t('addtask.form.duedate')}</FormLabel><Input type="date" defaultValue={task.dueDate ? task.dueDate.split('T')[0] : ''} readOnly={!isEditing} /></FormItem>
                    </div>
                     <FormItem>
                        <FormLabel>{t('addtask.form.timeestimate')}</FormLabel>
                        {isEditing ? (
                            <FormField control={form.control} name="timeEstimate" render={({ field }) => (
                                <>
                                <FormControl><Input type="number" placeholder={t('addtask.form.timeestimate.placeholder')} {...field} onChange={(e) => field.onChange(e.target.value === '' ? undefined : +e.target.value)} value={field.value ?? ''}/></FormControl>
                                <FormMessage />
                                </>
                            )}/>
                        ) : (
                            <div className="flex items-center h-10 px-3 py-2 text-sm rounded-md border border-input">{task.timeEstimate ? `${task.timeEstimate} hours` : 'Not set'}</div>
                        )}
                    </FormItem>


                    <div className="space-y-4 rounded-lg border p-4">
                        <div className='flex items-center justify-between'>
                            <h3 className="text-sm font-medium flex items-center gap-2"><Clock className="h-4 w-4" />Time Tracking</h3>
                            <div className='font-mono text-lg font-bold'>{formatStopwatch(elapsedTime)}</div>
                        </div>
                        <div className="space-y-2"><div className="flex justify-between text-xs text-muted-foreground"><span>Progress</span><span>{timeTrackedValue}h / {timeEstimateValue}h</span></div><Progress value={timeTrackingProgress} /></div>
                        <div className="grid grid-cols-2 gap-2">
                        <Button variant={isRunning ? "destructive" : "outline"} type="button" onClick={handleStartStop}>{isRunning ? <PauseCircle className="mr-2 h-4 w-4" /> : <PlayCircle className="mr-2 h-4 w-4" />}{isRunning ? 'Pause Timer' : 'Start Timer'}</Button>
                        <Button variant="outline" type="button" onClick={handleLogTime} disabled={elapsedTime === 0 && !isRunning}><LogIn className="mr-2 h-4 w-4" />Log Time</Button>
                        </div>
                        {task.timeLogs && task.timeLogs.length > 0 && (
                            <div className="space-y-3 pt-4">
                                <h4 className='text-xs font-semibold text-muted-foreground'>History</h4>
                                <div className="max-h-40 overflow-y-auto space-y-2 pr-2">
                                {task.timeLogs.map(log => (
                                    <div key={log.id} className='text-xs flex justify-between items-center bg-secondary/50 p-2 rounded-md'>
                                        <div><p className='font-medium'>{format(parseISO(log.startTime), 'MMM d, yyyy')}</p><p className='text-muted-foreground'>{format(parseISO(log.startTime), 'p')} - {format(parseISO(log.endTime), 'p')}</p></div>
                                        <div className='font-semibold'>{formatDistanceToNow(new Date(new Date().getTime() - log.duration * 1000), { includeSeconds: true, addSuffix: false })}</div>
                                    </div>
                                ))}
                                </div>
                            </div>
                        )}
                    </div>
                  </TabsContent>

                  <TabsContent value="comments" className="mt-4">
                    <div className="space-y-6">
                        {comments.map(comment => (
                            <div key={comment.id} className="flex gap-3">
                                <Avatar className="h-8 w-8"><AvatarImage src={comment.user.avatarUrl} /><AvatarFallback>{comment.user.name.charAt(0)}</AvatarFallback></Avatar>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-sm">{comment.user.name}</span>
                                        <span className="text-xs text-muted-foreground">{formatDistanceToNow(parseISO(comment.timestamp), { addSuffix: true })}</span>
                                    </div>
                                    <p className="text-sm bg-secondary/50 p-3 rounded-lg mt-1">{comment.text}</p>
                                </div>
                            </div>
                        ))}
                        <div className="flex gap-3">
                             <Avatar className="h-8 w-8"><AvatarImage src={currentUser.avatarUrl} /><AvatarFallback>{currentUser.name.charAt(0)}</AvatarFallback></Avatar>
                             <div className="flex-1 relative">
                                <Textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Write a comment... use @ to mention" className="pr-10" />
                                <div className="absolute top-2 right-2 flex gap-1">
                                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6"><AtSign className="h-4 w-4"/></Button>
                                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={handlePostComment} disabled={!newComment.trim()}><Send className="h-4 w-4"/></Button>
                                </div>
                             </div>
                        </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="subtasks" className="mt-4">
                     <div className="space-y-4">
                        <div className="space-y-2">
                            <div className="flex justify-between text-xs text-muted-foreground">
                                <span>Progress</span>
                                <span>{subtasks.filter(st => st.completed).length}/{subtasks.length}</span>
                            </div>
                            <Progress value={subtaskProgress} />
                        </div>
                        <div className="space-y-2">
                            {subtasks.map((subtask, index) => (
                                <div key={subtask.id} className="flex items-center gap-3 p-2 bg-secondary/50 rounded-md">
                                    <Checkbox id={`subtask-${subtask.id}`} checked={subtask.completed} onCheckedChange={() => handleToggleSubtask(index)} />
                                    <label htmlFor={`subtask-${subtask.id}`} className={`flex-1 text-sm ${subtask.completed ? 'line-through text-muted-foreground' : ''}`}>{subtask.title}</label>
                                    <Button variant="ghost" size="icon" className="h-7 w-7"><Edit className="h-4 w-4"/></Button>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"><Trash2 className="h-4 w-4"/></Button>
                                </div>
                            ))}
                        </div>
                        <div className="flex items-center gap-2">
                            <Input placeholder="Add a new subtask..." />
                            <Button><Plus className="h-4 w-4 mr-2"/> Add Subtask</Button>
                        </div>
                     </div>
                  </TabsContent>

                  <TabsContent value="dependencies" className="mt-4">
                      <div className="space-y-4">
                          <div>
                              <h4 className="font-semibold mb-2 flex items-center gap-2"><GitMerge className="h-4 w-4"/> Waiting On ({task.dependencies?.length || 0})</h4>
                              <div className="space-y-2">
                                  {task.dependencies?.map(depId => (
                                      <div key={depId} className="flex items-center justify-between p-2 bg-secondary/50 rounded-md text-sm">
                                          <span>Task: {depId}</span>
                                          <Button variant="ghost" size="icon" className="h-7 w-7"><X className="h-4 w-4"/></Button>
                                      </div>
                                  ))}
                                  <Button variant="outline" className="w-full"><Plus className="h-4 w-4 mr-2"/> Add Dependency</Button>
                              </div>
                          </div>
                           <div>
                              <h4 className="font-semibold mb-2 flex items-center gap-2"><GitMerge className="h-4 w-4 text-green-500"/> Blocking (0)</h4>
                              <Button variant="outline" className="w-full"><Plus className="h-4 w-4 mr-2"/> Add Blocking Task</Button>
                          </div>
                      </div>
                  </TabsContent>

                  <TabsContent value="activity" className="mt-4">
                      <ScrollArea className="h-96">
                        <div className="space-y-6">
                            {activities.map(activity => (
                                <div key={activity.id} className="flex gap-3 text-sm">
                                    <Avatar className="h-8 w-8"><AvatarImage src={activity.user.avatarUrl}/><AvatarFallback>{activity.user.name.charAt(0)}</AvatarFallback></Avatar>
                                    <div>
                                        <span className="font-semibold">{activity.user.name}</span>
                                        <span className="text-muted-foreground"> {activity.action}</span>
                                        <p className="text-xs text-muted-foreground mt-1">{formatDistanceToNow(parseISO(activity.timestamp), { addSuffix: true })}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                      </ScrollArea>
                  </TabsContent>

                </Tabs>
            </div>
            <SheetFooter className="p-6 border-t">
              {isEditing ? (
                <div className="flex justify-end gap-2">
                    <Button variant="ghost" type="button" onClick={() => {setIsEditing(false); form.reset();}}>Cancel</Button>
                    <Button type="submit">Save Changes</Button>
                </div>
              ) : (
                <Button type="button" onClick={() => setIsEditing(true)}>
                    <Edit className="mr-2 h-4 w-4"/>
                    Edit Task
                </Button>
              )}
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}

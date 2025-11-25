
'use client';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTrigger,
  SheetFooter,
} from '@/components/ui/sheet';
import type { Task, TimeLog } from '@/lib/types';
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
import React, { useState, useEffect, useCallback } from 'react';
import { CalendarIcon, Clock, LogIn, PauseCircle, PlayCircle, Tag, Users } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Separator } from '../ui/separator';
import { useI18n } from '@/context/i18n-provider';
import { Progress } from '../ui/progress';
import { format, formatDistanceToNow, parseISO } from 'date-fns';

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

export function TaskDetailsSheet({ task: initialTask, children }: { task: Task; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [task, setTask] = useState(initialTask);
  const { t } = useI18n();

  const [elapsedTime, setElapsedTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [timerStartTime, setTimerStartTime] = useState<Date | null>(null);

  const form = useForm<TaskDetailsFormValues>({
    resolver: zodResolver(taskDetailsSchema),
    defaultValues: {
      title: task.title,
      description: task.description || '',
      status: task.status,
      priority: task.priority,
      assignees: task.assignees.map(a => a.id),
      timeEstimate: task.timeEstimate,
    },
  });

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

  const onSubmit = (data: TaskDetailsFormValues) => {
    console.log('Updated Task Data:', {...data, timeTracked: task.timeTracked, timeLogs: task.timeLogs});
    setOpen(false);
  };
  
  const timeEstimateValue = form.watch('timeEstimate') ?? task.timeEstimate ?? 0;
  const timeTrackedValue = task.timeTracked ?? 0;
  
  const timeTrackingProgress = timeEstimateValue > 0
    ? (timeTrackedValue / timeEstimateValue) * 100
    : 0;


  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full">
            <SheetHeader className="p-6">
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
            </SheetHeader>
            <Separator />
            <div className="flex-1 p-6 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.values(statusInfo).map((s) => (
                            <SelectItem key={s.value} value={s.value}>
                                <div className="flex items-center gap-2">
                                  <s.icon className="h-4 w-4" />
                                  {t(`status.${s.value.toLowerCase().replace(' ', '')}` as any)}
                                </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('addtask.form.priority')}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.values(priorityInfo).map((p) => (
                            <SelectItem key={p.value} value={p.value}>
                                <div className="flex items-center gap-2">
                                  <p.icon className={`h-4 w-4 ${p.color}`} />
                                  {t(`priority.${p.value.toLowerCase()}` as any)}
                                </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('addtask.form.description')}</FormLabel>
                    <FormControl>
                      <Textarea placeholder={t('addtask.form.description.placeholder')} {...field} className="min-h-[100px]" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                                <Avatar className="h-8 w-8">
                                    <AvatarImage src={user.avatarUrl} alt={user.name} />
                                    <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="text-sm font-medium">{user.name}</p>
                                    <p className="text-xs text-muted-foreground">{user.email}</p>
                                </div>
                            </div>
                            <Button variant="outline" size="sm">Owner</Button>
                        </div>
                    ))}
                </div>
                 <Button variant="outline" className="w-full">
                    Invite new member
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-6">
                <FormItem>
                    <FormLabel className="flex items-center gap-2"><CalendarIcon className="w-4 h-4"/>{t('addtask.form.duedate')}</FormLabel>
                    <Input type="date" defaultValue={task.dueDate ? task.dueDate.split('T')[0] : ''} />
                </FormItem>
              </div>

               <FormField
                  control={form.control}
                  name="timeEstimate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('addtask.form.timeestimate')}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder={t('addtask.form.timeestimate.placeholder')}
                          {...field}
                          onChange={(e) => field.onChange(e.target.value === '' ? undefined : +e.target.value)}
                          value={field.value ?? ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

              <div className="space-y-4 rounded-lg border p-4">
                <div className='flex items-center justify-between'>
                    <h3 className="text-sm font-medium flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Time Tracking
                    </h3>
                    <div className='font-mono text-lg font-bold'>{formatStopwatch(elapsedTime)}</div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Progress</span>
                    <span>{timeTrackedValue}h / {timeEstimateValue}h</span>
                  </div>
                  <Progress value={timeTrackingProgress} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                   <Button variant={isRunning ? "destructive" : "outline"} type="button" onClick={handleStartStop}>
                      {isRunning ? <PauseCircle className="mr-2 h-4 w-4" /> : <PlayCircle className="mr-2 h-4 w-4" />}
                      {isRunning ? 'Pause Timer' : 'Start Timer'}
                   </Button>
                   <Button variant="outline" type="button" onClick={handleLogTime} disabled={elapsedTime === 0}>
                      <LogIn className="mr-2 h-4 w-4" />
                      Log Time
                   </Button>
                </div>
                {task.timeLogs && task.timeLogs.length > 0 && (
                    <div className="space-y-3 pt-4">
                        <h4 className='text-xs font-semibold text-muted-foreground'>History</h4>
                        <div className="max-h-40 overflow-y-auto space-y-2 pr-2">
                        {task.timeLogs.map(log => (
                            <div key={log.id} className='text-xs flex justify-between items-center bg-secondary/50 p-2 rounded-md'>
                                <div>
                                    <p className='font-medium'>{format(parseISO(log.startTime), 'MMM d, yyyy')}</p>
                                    <p className='text-muted-foreground'>{format(parseISO(log.startTime), 'p')} - {format(parseISO(log.endTime), 'p')}</p>
                                </div>
                                <div className='font-semibold'>
                                    {formatDistanceToNow(new Date().setSeconds(new Date().getSeconds() - log.duration), { includeSeconds: true, addSuffix: false })}
                                </div>
                            </div>
                        ))}
                        </div>
                    </div>
                )}
              </div>
            </div>
            <SheetFooter className="p-6 border-t">
              <Button type="submit">Save Changes</Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}

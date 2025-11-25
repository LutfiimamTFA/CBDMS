
'use client';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
  SheetFooter,
} from '@/components/ui/sheet';
import type { Task, User } from '@/lib/types';
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
import { users } from '@/lib/data';
import { priorityInfo, statusInfo } from '@/lib/utils';
import React from 'react';
import { CalendarIcon, Clock, LogIn, PlayCircle, Users } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Separator } from '../ui/separator';
import { useI18n } from '@/context/i18n-provider';
import { Progress } from '../ui/progress';

const taskDetailsSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  status: z.enum(['To Do', 'Doing', 'Done']),
  priority: z.enum(['Urgent', 'High', 'Medium', 'Low']),
  assignees: z.array(z.string()).optional(),
  timeEstimate: z.number().optional(),
});

type TaskDetailsFormValues = z.infer<typeof taskDetailsSchema>;

export function TaskDetailsSheet({ task, children }: { task: Task; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const { t } = useI18n();

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

  const onSubmit = (data: TaskDetailsFormValues) => {
    console.log('Updated Task Data:', data);
    setOpen(false);
  };
  
  const timeTrackingProgress = task.timeEstimate && task.timeTracked
    ? (task.timeTracked / task.timeEstimate) * 100
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
                      <FormLabel>Priority</FormLabel>
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
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Add a more detailed description..." {...field} className="min-h-[100px]" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
                
              <div className="space-y-4">
                <FormLabel className="flex items-center gap-2"><Users className="w-4 h-4"/> Assignees</FormLabel>
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

              <div className="space-y-4 rounded-lg border p-4">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Time Tracking
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Progress</span>
                    <span>{task.timeTracked || 0}h / {task.timeEstimate || 0}h</span>
                  </div>
                  <Progress value={timeTrackingProgress} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                   <Button variant="outline">
                      <PlayCircle className="mr-2 h-4 w-4" />
                      Start Timer
                   </Button>
                   <Button variant="outline">
                      <LogIn className="mr-2 h-4 w-4" />
                      Log Time
                   </Button>
                </div>
                <div className="text-xs text-muted-foreground">
                  View history
                </div>
              </div>


               <div className="grid grid-cols-1 gap-6">
                <FormItem>
                    <FormLabel className="flex items-center gap-2"><CalendarIcon className="w-4 h-4"/> Due Date</FormLabel>
                    <Input type="date" defaultValue={task.dueDate ? task.dueDate.split('T')[0] : ''} />
                </FormItem>
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

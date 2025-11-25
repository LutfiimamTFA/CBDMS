
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
import { users } from '@/lib/data';
import { priorityInfo, statusInfo } from '@/lib/utils';
import React from 'react';
import { ScrollArea } from '../ui/scroll-area';
import { Calendar, Copy, Loader2, Mail, Repeat, Share, UserPlus, Users, Wand2, X } from 'lucide-react';
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
  endOfWeek,
  format,
  nextSaturday,
  nextSunday,
  startOfWeek,
} from 'date-fns';
import { useI18n } from '@/context/i18n-provider';
import { suggestPriority } from '@/ai/flows/suggest-priority';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '../ui/textarea';

const taskSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  status: z.enum(['To Do', 'Doing', 'Done']),
  priority: z.enum(['Urgent', 'High', 'Medium', 'Low']),
  assignees: z.array(z.string()).optional(),
  timeEstimate: z.coerce.number().min(0, 'Must be a positive number').optional(),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
  recurring: z.string().optional(),
});

type TaskFormValues = z.infer<typeof taskSchema>;

type ShareSetting = 'public' | 'private';



export function AddTaskDialog({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [selectedUsers, setSelectedUsers] = React.useState<typeof users>([]);
  const [shareSetting, setShareSetting] = React.useState<ShareSetting>('public');
  const [isSuggesting, setIsSuggesting] = React.useState(false);
  const { t } = useI18n();
  const { toast } = useToast();

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
      description: '',
      status: 'To Do',
      priority: 'Medium',
      assignees: [],
      recurring: 'never',
      startDate: '',
      dueDate: '',
    },
  });

  const onSubmit = (data: TaskFormValues) => {
    console.log('New Task Data:', data, 'Selected Users:', selectedUsers);
    // Here you would typically call a server action or API to create the task
    setOpen(false);
    form.reset();
    setSelectedUsers([]);
  };

  const handleSelectUser = (user: (typeof users)[0]) => {
    if (!selectedUsers.find((u) => u.id === user.id)) {
      setSelectedUsers([...selectedUsers, user]);
      const currentAssignees = form.getValues('assignees') || [];
      form.setValue('assignees', [...currentAssignees, user.id]);
    }
  };

  const handleRemoveUser = (userId: string) => {
    setSelectedUsers(selectedUsers.filter((u) => u.id !== userId));
     const currentAssignees = form.getValues('assignees') || [];
     form.setValue('assignees', currentAssignees.filter(id => id !== userId));
  };
  
  const setDateValue = (field: 'startDate' | 'dueDate', date: Date) => {
    form.setValue(field, format(date, 'yyyy-MM-dd'));
  };

  const recurringValue = form.watch('recurring');
  const recurringOptions: Record<string, string> = {
    never: t('addtask.form.recurring.never'),
    daily: t('addtask.form.recurring.daily'),
    weekly: t('addtask.form.recurring.weekly'),
    monthly: t('addtask.form.recurring.monthly'),
  };

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
    try {
      const result = await suggestPriority({
        title,
        description: form.getValues('description'),
      });
      form.setValue('priority', result.priority);
      toast({
        title: `Priority set to ${result.priority}`,
        description: result.reason,
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl grid-rows-[auto_minmax(0,1fr)_auto] p-0 max-h-[90vh]">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>{t('addtask.title')}</DialogTitle>
          <DialogDescription>
            {t('addtask.description')}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea>
          <div className="p-6">
            <Form {...form}>
              <form
                id="add-task-form"
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >
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
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('addtask.form.description')}</FormLabel>
                      <FormControl>
                        <Textarea placeholder={t('addtask.form.description.placeholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('addtask.form.status')}</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t('addtask.form.status.placeholder')} />
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
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('addtask.form.priority')}</FormLabel>
                         <div className="flex items-center gap-2">
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={t('addtask.form.priority.placeholder')} />
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
                           <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={handleSuggestPriority}
                            disabled={isSuggesting}
                            className="shrink-0"
                          >
                            {isSuggesting ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Wand2 className="h-4 w-4" />
                            )}
                            <span className="sr-only">Suggest Priority</span>
                          </Button>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-4 rounded-lg border p-4">
                    <h3 className="text-sm font-medium flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {t('addtask.form.dates')}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                        control={form.control}
                        name="startDate"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>{t('addtask.form.startdate')}</FormLabel>
                            <FormControl>
                                <Input type="date" {...field} value={field.value || ''} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                        <FormField
                        control={form.control}
                        name="dueDate"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>{t('addtask.form.duedate')}</FormLabel>
                            <FormControl>
                                <Input type="date" {...field} value={field.value || ''} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                    </div>
                     <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">{t('addtask.form.quickselect')}</Label>
                        <div className="flex flex-wrap gap-2">
                        {quickDateOptions.map(option => (
                            <Button key={option.label} type="button" variant="outline" size="sm" onClick={() => setDateValue('dueDate', option.getValue())}>
                                {option.label}
                            </Button>
                        ))}
                         <Button type="button" variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => form.setValue('dueDate', '')}>
                            {t('addtask.form.quickselect.clear')}
                        </Button>
                        </div>
                    </div>
                    <Separator />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Button type="button" variant="outline">
                            <svg className="mr-2" width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12.25 1.75H11.375V0.875H9.625V1.75H4.375V0.875H2.625V1.75H1.75C1.29688 1.75 1.00094 2.05188 1.00094 2.5L1 12.25C1 12.7 1.29688 13 1.75 13H12.25C12.7031 13 13 12.7 13 12.25V2.5C13 2.05188 12.7031 1.75 12.25 1.75ZM11.375 11.375H2.625V4.375H11.375V11.375Z" fill="#4285F4"/><path d="M4.375 6.125H6.125V7.875H4.375V6.125Z" fill="#34A853"/><path d="M7 6.125H8.75V7.875H7V6.125Z" fill="#FBBC05"/><path d="M9.625 6.125H11.375V7.875H9.625V6.125Z" fill="#EA4335"/><path d="M4.375 8.75H6.125V10.5H4.375V8.75Z" fill="#4285F4"/><path d="M7 8.75H8.75V10.5H7V8.75Z" fill="#34A853"/></svg>
                            {t('addtask.form.addtogoogle')}
                        </Button>
                        <FormField
                            control={form.control}
                            name="recurring"
                            render={({ field }) => (
                                <FormItem>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <Button variant="outline" asChild className="w-full">
                                            <SelectTrigger>
                                                <Repeat className="mr-2" />
                                                <span className="capitalize">
                                                  {recurringValue === 'never'
                                                    ? t('addtask.form.setrecurring')
                                                    : recurringOptions[recurringValue]}
                                                </span>
                                            </SelectTrigger>
                                        </Button>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="never">{recurringOptions['never']}</SelectItem>
                                        <SelectItem value="daily">{recurringOptions['daily']}</SelectItem>
                                        <SelectItem value="weekly">{recurringOptions['weekly']}</SelectItem>
                                        <SelectItem value="monthly">{recurringOptions['monthly']}</SelectItem>
                                    </SelectContent>
                                    </Select>
                                </FormItem>
                            )}
                        />
                    </div>
                </div>


                {/* --- Assignees / Members Section --- */}
                <div className="space-y-4 rounded-lg border p-4">
                  <h3 className="text-sm font-medium flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    {t('addtask.form.teammembers')}
                  </h3>
                  
                   <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-secondary/50 p-3">
                     <div className="flex items-center gap-3">
                        <Share className="h-8 w-8 text-primary" />
                        <div>
                          <p className="text-sm font-medium">{t('addtask.form.sharelink')}</p>
                          <p className="text-xs text-muted-foreground">
                            {shareSetting === 'public'
                              ? t('addtask.form.sharelink.public')
                              : t('addtask.form.sharelink.private')}
                          </p>
                        </div>
                     </div>
                     <div className="flex items-center gap-2">
                        <Select
                          defaultValue={shareSetting}
                          onValueChange={(value: ShareSetting) => setShareSetting(value)}
                        >
                          <SelectTrigger className="h-8 w-[100px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="public">{t('addtask.form.sharelink.public.option')}</SelectItem>
                            <SelectItem value="private">{t('addtask.form.sharelink.private.option')}</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button variant="outline" size="sm" className="h-8" onClick={() => navigator.clipboard.writeText(window.location.href)}>
                            <Copy className="h-3 w-3 mr-2" />
                            {t('addtask.form.copylink')}
                        </Button>
                     </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <Input
                      type="email"
                      placeholder={t('addtask.form.inviteemail')}
                      className="flex-1"
                    />
                    <Button variant="outline" size="sm">
                      <UserPlus className="mr-2 h-4 w-4" />
                      {t('addtask.form.invite')}
                    </Button>
                  </div>
                  <div className="relative">
                    <Separator className="my-3" />
                    <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2 text-xs text-muted-foreground">
                      {t('addtask.form.or')}
                    </span>
                  </div>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-muted-foreground">
                        {t('addtask.form.selectmembers')}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
                      {users.map((user) => (
                        <DropdownMenuItem
                          key={user.id}
                          onSelect={() => handleSelectUser(user)}
                        >
                          <Avatar className="h-6 w-6 mr-2">
                              <AvatarImage src={user.avatarUrl} alt={user.name} />
                              <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <span>{user.name}</span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {selectedUsers.length > 0 && (
                    <div className="space-y-2">
                      <Label>{t('addtask.form.selectedmembers')}</Label>
                      {selectedUsers.map((user) => (
                        <div key={user.id} className="flex items-center justify-between rounded-md bg-secondary/50 p-2">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-7 w-7">
                                <AvatarImage src={user.avatarUrl} alt={user.name} />
                                <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium">{user.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {shareSetting === 'private' && (
                              <Select defaultValue="full-access">
                                <SelectTrigger className="h-8 w-[120px] text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="full-access">{t('addtask.form.access.full')}</SelectItem>
                                  <SelectItem value="edit">{t('addtask.form.access.edit')}</SelectItem>
                                  <SelectItem value="comment">{t('addtask.form.access.comment')}</SelectItem>
                                  <SelectItem value="view">{t('addtask.form.access.view')}</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRemoveUser(user.id)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                 {/* --- End Assignees Section --- */}


                 <FormField
                  control={form.control}
                  name="timeEstimate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('addtask.form.timeestimate')}</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder={t('addtask.form.timeestimate.placeholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </form>
            </Form>
          </div>
        </ScrollArea>
        <DialogFooter className="p-6 pt-0">
          <Button type="submit" form="add-task-form">
            {t('addtask.form.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

    

    
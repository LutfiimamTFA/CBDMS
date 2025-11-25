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
import { Mail, Share, UserPlus, Users, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Separator } from '../ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Label } from '../ui/label';

const taskSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  status: z.enum(['To Do', 'Doing', 'Done']),
  priority: z.enum(['Urgent', 'High', 'Normal', 'Low']),
  assignees: z.array(z.string()).optional(),
  timeEstimate: z.coerce.number().min(0, 'Must be a positive number').optional(),
  dueDate: z.string().optional(),
});

type TaskFormValues = z.infer<typeof taskSchema>;

export function AddTaskDialog({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [selectedUsers, setSelectedUsers] = React.useState<typeof users>([]);

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: '',
      status: 'To Do',
      priority: 'Normal',
      assignees: [],
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl grid-rows-[auto_minmax(0,1fr)_auto] p-0 max-h-[90vh]">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>Add New Task</DialogTitle>
          <DialogDescription>
            Fill in the details below to create a new task.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="overflow-y-auto">
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
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Design landing page" {...field} />
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
                        <FormLabel>Status</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.values(statusInfo).map((s) => (
                              <SelectItem key={s.value} value={s.value}>
                                <div className="flex items-center gap-2">
                                  <s.icon className="h-4 w-4" />
                                  {s.label}
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
                        <FormLabel>Priority</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select priority" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.values(priorityInfo).map((p) => (
                              <SelectItem key={p.value} value={p.value}>
                                <div className="flex items-center gap-2">
                                  <p.icon className={`h-4 w-4 ${p.color}`} />
                                  {p.label}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* --- Assignees / Members Section --- */}
                <div className="space-y-4 rounded-lg border p-4">
                  <h3 className="text-sm font-medium flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Anggota Tim
                  </h3>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <Input
                      type="email"
                      placeholder="Undang dengan email..."
                      className="flex-1"
                    />
                    <Button variant="outline" size="sm">
                      <UserPlus className="mr-2 h-4 w-4" />
                      Undang
                    </Button>
                  </div>
                  <div className="relative">
                    <Separator className="my-3" />
                    <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2 text-xs text-muted-foreground">
                      ATAU
                    </span>
                  </div>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-muted-foreground">
                        Pilih anggota tim...
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
                      <Label>Anggota Terpilih</Label>
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
                            <Select defaultValue="full-access">
                              <SelectTrigger className="h-8 w-[120px] text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="full-access">Akses Penuh</SelectItem>
                                <SelectItem value="edit">Bisa Edit</SelectItem>
                                <SelectItem value="comment">Bisa Komentar</SelectItem>
                                <SelectItem value="view">Lihat Saja</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRemoveUser(user.id)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between rounded-lg bg-secondary/50 p-3 mt-4">
                     <div className="flex items-center gap-3">
                        <Share className="h-8 w-8 text-primary" />
                        <div>
                          <p className="text-sm font-medium">Bagikan Tautan</p>
                          <p className="text-xs text-muted-foreground">Siapa pun dengan tautan dapat melihat</p>
                        </div>
                     </div>
                     <Select defaultValue="public">
                        <SelectTrigger className="h-8 w-[100px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="public">Publik</SelectItem>
                          <SelectItem value="private">Privat</SelectItem>
                        </SelectContent>
                      </Select>
                  </div>
                </div>
                 {/* --- End Assignees Section --- */}


                 <FormField
                  control={form.control}
                  name="timeEstimate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Time Estimate (hours)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="e.g. 8" {...field} />
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
                      <FormLabel>Due Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
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
            Create Task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

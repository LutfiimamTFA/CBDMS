
'use client';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  FormDescription,
} from '@/components/ui/form';
import { tags as allTags } from '@/lib/data';
import { priorityInfo } from '@/lib/utils';
import React, { useEffect, useMemo, useState, useRef } from 'react';
import { ScrollArea } from '../ui/scroll-area';
import { Calendar, Clock, Copy, Loader2, Mail, Plus, Repeat, Share, Tag, Trash, Trash2, User, UserPlus, Users, Wand2, X, Hash, Calendar as CalendarIcon, Type, List, Paperclip, FileUp, Link as LinkIcon, FileImage, HelpCircle, Star, Timer, Blocks, GitMerge, ListTodo, MessageSquare, AtSign, Send, Edit, FileText, Building2, Bold, Italic, List as ListIcon, ListOrdered, Table as TableIcon, Upload, Workflow } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Separator } from '../ui/separator';
import { useI18n } from '@/context/i18n-provider';
import { suggestPriority } from '@/ai/flows/suggest-priority';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '../ui/textarea';
import type { Tag as TagType, TimeLog, Task, User as UserType, Subtask, Comment, Attachment, Notification, WorkflowStatus, Brand, SocialMediaPost } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Progress } from '../ui/progress';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Checkbox } from '../ui/checkbox';
import { Switch } from '../ui/switch';
import { useCollection, useFirestore, useUserProfile, useStorage } from '@/firebase';
import { collection, serverTimestamp, writeBatch, doc, query, orderBy, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Calendar as CalendarComponent } from '../ui/calendar';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '../ui/card';
import { MultiSelect } from '../ui/multi-select';
import { addDays, format, formatDistanceToNow, parse, parseISO, startOfWeek, nextSaturday } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getInitials } from '@/lib/utils';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { RichTextEditor } from '../ui/rich-text-editor';
import { formatHours } from '@/lib/utils';


const postSchema = z.object({
  caption: z.string().min(1, 'Caption is required'),
  brandId: z.string().optional(),
  description: z.string().optional(),
  postType: z.enum(['Upload', 'Branding']),
  platform: z.string().min(1, 'Platform is required'),
  assigneeIds: z.array(z.string()).min(1, 'At least one assignee is required'),
  scheduledAt: z.date().optional(),
});

type PostFormValues = z.infer<typeof postSchema>;

export function CreatePostDialog({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const { toast } = useToast();
  const { t } = useI18n();

  const firestore = useFirestore();
  const { user, profile: currentUserProfile } = useUserProfile();

  const usersQuery = React.useMemo(() => (firestore && currentUserProfile ? query(collection(firestore, 'users'), where('companyId', '==', currentUserProfile.companyId)) : null), [firestore, currentUserProfile]);
  const { data: allUsers, isLoading: areUsersLoading } = useCollection<UserType>(usersQuery);

  const brandsQuery = React.useMemo(() => (firestore && currentUserProfile ? query(collection(firestore, 'brands'), orderBy('name')) : null), [firestore, currentUserProfile]);
  const { data: brands, isLoading: areBrandsLoading } = useCollection<Brand>(brandsQuery);
  
  const userOptions = useMemo(() => (allUsers || []).map(user => ({ value: user.id, label: user.name })), [allUsers]);

  const form = useForm<PostFormValues>({
    resolver: zodResolver(postSchema),
    defaultValues: {
      caption: '',
      brandId: '',
      description: '',
      postType: 'Upload',
      platform: 'Instagram',
      assigneeIds: [],
      scheduledAt: undefined,
    },
  });
  
  useEffect(() => {
    if (open) {
      form.reset({
        caption: '',
        brandId: '',
        description: '',
        postType: 'Upload',
        platform: 'Instagram',
        assigneeIds: [],
        scheduledAt: undefined,
      });
      if (currentUserProfile?.role === 'Employee' && user) {
        form.setValue('assigneeIds', [user.uid]);
      }
    }
  }, [open, currentUserProfile, user, form]);

  const onSubmit = async (data: PostFormValues) => {
    if (!firestore || !currentUserProfile) return;

    const batch = writeBatch(firestore);
    const newPostRef = doc(collection(firestore, 'socialMediaPosts'));

    const newPostData: Omit<SocialMediaPost, 'id'|'status'> = {
      caption: data.caption,
      brandId: data.brandId,
      description: data.description,
      postType: data.postType,
      platform: data.platform,
      assignees: allUsers?.filter(u => data.assigneeIds.includes(u.id)) || [],
      assigneeIds: data.assigneeIds,
      scheduledAt: data.scheduledAt ? data.scheduledAt.toISOString() : new Date().toISOString(),
      companyId: currentUserProfile.companyId,
      createdBy: {
        id: currentUserProfile.id,
        name: currentUserProfile.name,
        avatarUrl: currentUserProfile.avatarUrl || '',
      },
      createdAt: serverTimestamp(),
    };

    batch.set(newPostRef, { ...newPostData, status: 'Draft' });

    data.assigneeIds.forEach(assigneeId => {
      if (assigneeId === currentUserProfile.id) return;
      const notificationRef = doc(collection(firestore, `users/${assigneeId}/notifications`));
      const notification: Omit<Notification, 'id'> = {
        userId: assigneeId,
        title: 'New Social Media Post Assigned',
        message: `${currentUserProfile.name} assigned you a new post: "${data.caption}"`,
        taskId: newPostRef.id,
        isRead: false,
        createdAt: serverTimestamp(),
        createdBy: {
          id: currentUserProfile.id,
          name: currentUserProfile.name,
          avatarUrl: currentUserProfile.avatarUrl || '',
        }
      };
      batch.set(notificationRef, notification);
    });

    try {
      await batch.commit();
      toast({
        title: 'Post Created',
        description: `${data.caption} has been added as a draft.`
      });
      setOpen(false);
    } catch (error) {
      console.error("Failed to create post:", error);
      toast({
        variant: 'destructive',
        title: 'Creation Failed',
        description: 'Could not create the post. Please try again.'
      });
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent className="flex flex-col p-0 h-screen w-screen max-w-full">
        <SheetHeader className="p-6 pb-0">
          <SheetTitle>Create Social Media Post</SheetTitle>
          <SheetDescription>
            Fill in the details for the new social media post.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 min-h-0">
          <ScrollArea className="h-full">
            <div className="p-6">
              <Form {...form}>
                <form
                  id="create-post-form"
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-6"
                >
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="space-y-6 lg:col-span-2">
                      <FormField
                        control={form.control}
                        name="caption"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Caption</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g. Announcing our new summer collection!" {...field} />
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
                            <FormLabel>Internal Notes/Description</FormLabel>
                            <FormControl>
                              <RichTextEditor
                                value={field.value || ''}
                                onChange={field.onChange}
                                placeholder="Add internal notes, links, or further details..."
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="space-y-6 lg:col-span-1">
                      <FormField
                          control={form.control}
                          name="postType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Post Type</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select a post type" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="Upload">Upload</SelectItem>
                                  <SelectItem value="Branding">Branding</SelectItem>
                                </SelectContent>
                              </Select>
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
                                  <SelectValue placeholder="Select a brand" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {areBrandsLoading ? (
                                  <div className="flex items-center justify-center p-2"><Loader2 className="h-4 w-4 animate-spin" /></div>
                                ) : (
                                  brands?.map((brand) => (
                                    <SelectItem key={brand.id} value={brand.id}>
                                      {brand.name}
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
                        name="assigneeIds"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Assign To</FormLabel>
                            {areUsersLoading ? (
                              <Loader2 className="animate-spin h-5 w-5" />
                            ) : (
                              <MultiSelect
                                options={userOptions}
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                                placeholder="Select team members..."
                              />
                            )}
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="scheduledAt"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel>Schedule Date</FormLabel>
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
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </form>
              </Form>
            </div>
          </ScrollArea>
        </div>
        <SheetFooter className="p-6 pt-4 border-t">
          <Button type="submit" form="create-post-form">
            Create Post
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

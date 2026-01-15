
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
import { useForm, useWatch, Controller } from 'react-hook-form';
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
import { priorityInfo } from '@/lib/utils';
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollArea } from '../ui/scroll-area';
import { CalendarIcon, Loader2, Plus, Wand2, Building2 } from 'lucide-react';
import { Separator } from '../ui/separator';
import { useI18n } from '@/context/i18n-provider';
import { suggestPriority } from '@/ai/flows/suggest-priority';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { useCollection, useFirestore, useUserProfile } from '@/firebase';
import { collection, serverTimestamp, writeBatch, doc, query, where } from 'firebase/firestore';
import { Calendar as CalendarComponent } from '../ui/calendar';
import { cn } from '@/lib/utils';
import { MultiSelect } from '../ui/multi-select';
import { format } from 'date-fns';
import { RichTextEditor } from '../ui/rich-text-editor';
import { useSafeBrands } from '@/hooks/use-safe-brands';
import type { SocialMediaPost, User as UserType, Brand, Notification } from '@/lib/types';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';


const postSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  brandId: z.string().min(1, 'Brand is required'),
  caption: z.string().optional(),
  priority: z.enum(['Urgent', 'High', 'Medium', 'Low']),
  assigneeIds: z.array(z.string()).min(1, 'At least one assignee is required'),
  startDate: z.date().optional(),
  dueDate: z.date().optional(),
  scheduledAt: z.date().optional(),
  postType: z.enum(['Upload', 'Branding']).default('Upload'),
  dependencies: z.array(z.string()).optional(),
}).refine((data) => {
    if (data.startDate && data.dueDate) return data.dueDate >= data.startDate;
    return true;
}, { message: "Due date must be after start date.", path: ["dueDate"]})
.refine((data) => {
    if (data.dueDate && data.scheduledAt) return data.scheduledAt >= data.dueDate;
    return true;
}, { message: "Publish date must be on or after the due date.", path: ["scheduledAt"]});


type PostFormValues = z.infer<typeof postSchema>;


export function AddSocialMediaPostDialog({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [isSuggesting, setIsSuggesting] = React.useState(false);
  const [suggestionReason, setSuggestionReason] = React.useState<string | null>(null);
  const { t, language } = useI18n();
  const { toast } = useToast();
  
  const firestore = useFirestore();

  const { user, profile: currentUserProfile, companyId } = useUserProfile();
  const { brands, brandMap, isLoading: areBrandsLoading } = useSafeBrands();
  
  const usersQuery = React.useMemo(() => {
    if (!firestore || !currentUserProfile) return null;
    return query(collection(firestore, 'users'), where('companyId', '==', currentUserProfile.companyId));
  }, [firestore, currentUserProfile]);
  const { data: allUsers, isLoading: areUsersLoading } = useCollection<UserType>(usersQuery);

  const postsQuery = React.useMemo(() => {
    if (!firestore || !companyId) return null;
    return query(collection(firestore, 'socialMediaPosts'), where('companyId', '==', companyId));
  }, [firestore, companyId]);
  const { data: allPosts, isLoading: arePostsLoading } = useCollection<SocialMediaPost>(postsQuery);

  const userOptions = useMemo(() => {
    if (!allUsers || !currentUserProfile) return [];
    if (currentUserProfile.role === 'Super Admin') {
        return allUsers.filter(u => u.role === 'Manager' || u.role === 'Employee').map(user => ({ value: user.id, label: user.name }));
    }
    if (currentUserProfile.role === 'Manager') {
      const team = allUsers.filter(u => u.managerId === currentUserProfile.id);
      const self = allUsers.find(u => u.id === currentUserProfile.id);
      return (self ? [self, ...team] : team).map(user => ({ value: user.id, label: user.name }));
    }
    if (currentUserProfile.role === 'Employee') {
        const myTeam = (allUsers || []).filter(u => u.managerId === currentUserProfile.managerId);
        return myTeam.map(user => ({ value: user.id, label: user.name }));
    }
    return [];
  }, [allUsers, currentUserProfile]);
  
  const dependencyOptions = useMemo(() => {
    if (!allPosts) return [];
    const grouped: Record<string, {label: string; value: string}[]> = {};
    allPosts.forEach(post => {
        const brandName = brandMap.get(post.brandId) || 'Unbranded';
        if (!grouped[brandName]) {
            grouped[brandName] = [];
        }
        grouped[brandName].push({ label: post.title, value: post.id });
    });
    return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
  }, [allPosts, brandMap]);


  const form = useForm<PostFormValues>({
    resolver: zodResolver(postSchema),
    defaultValues: {
      title: '',
      brandId: '',
      caption: '',
      priority: 'Medium',
      assigneeIds: [],
      startDate: undefined,
      dueDate: undefined,
      scheduledAt: undefined,
      postType: 'Upload',
      dependencies: [],
    },
  });
  
  const effectiveBrandId = useMemo(() => {
      if (brands && brands.length === 1) return brands[0].id;
      return null;
  }, [brands]);

  useEffect(() => {
    if (open) {
        form.reset({
          title: '',
          brandId: effectiveBrandId || '',
          caption: '',
          priority: 'Medium',
          assigneeIds: [],
          startDate: undefined,
          dueDate: undefined,
          scheduledAt: undefined,
          postType: 'Upload',
          dependencies: [],
        });
        
        setSuggestionReason(null);
        if (currentUserProfile && user && currentUserProfile.role === 'Employee') {
            form.setValue('assigneeIds', [user.uid]);
        }
        if (effectiveBrandId) {
            form.setValue('brandId', effectiveBrandId);
        }
    }
  }, [open, currentUserProfile, user, form, effectiveBrandId]);

  const handleSuggestPriority = async () => {
    const title = form.getValues('title');
    if (!title) {
      toast({ variant: 'destructive', title: 'Title is required' });
      return;
    }
    setIsSuggesting(true);
    setSuggestionReason(null);
    try {
      const result = await suggestPriority({ title, description: form.getValues('caption'), language: language.name });
      form.setValue('priority', result.priority);
      setSuggestionReason(result.reason);
      toast({ title: `Priority suggested: ${result.priority}` });
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Suggestion Failed' });
    } finally {
      setIsSuggesting(false);
    }
  };

  const onSubmit = async (data: PostFormValues) => {
    if (!firestore || !currentUserProfile) return;
    
    const batch = writeBatch(firestore);
    const newPostRef = doc(collection(firestore, 'socialMediaPosts'));
    
    const newPostData: Omit<SocialMediaPost, 'id' | 'createdAt'> & {createdAt: any} = {
        title: data.title,
        brandId: data.brandId,
        caption: data.caption || '',
        priority: data.priority,
        assigneeIds: data.assigneeIds,
        startDate: data.startDate?.toISOString(),
        dueDate: data.dueDate?.toISOString(),
        scheduledAt: data.scheduledAt?.toISOString(),
        dependencies: data.dependencies || [],
        postType: data.postType,
        status: 'To Do',
        statusInternal: 'To Do',
        platform: 'Instagram', 
        companyId: currentUserProfile.companyId,
        createdAt: serverTimestamp(),
        createdBy: {
          id: currentUserProfile.id,
          name: currentUserProfile.name,
          avatarUrl: currentUserProfile.avatarUrl || '',
        },
    };
    batch.set(newPostRef, newPostData);

    data.assigneeIds.forEach(assigneeId => {
        if (assigneeId === currentUserProfile.id) return; 
        const notificationRef = doc(collection(firestore, `users/${assigneeId}/notifications`));
        const notification: Omit<Notification, 'id'> = {
            userId: assigneeId,
            title: 'New Social Media Post Assigned',
            message: `${currentUserProfile.name} assigned you a new post: "${data.title}"`,
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
            title: 'Social Media Post Created',
            description: `${data.title} has been added.`
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
    <>
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent className="flex flex-col p-0 h-screen w-screen max-w-full">
        <SheetHeader className="p-6 pb-0">
          <SheetTitle>Create Social Media Post</SheetTitle>
          <SheetDescription>Fill in the details for the new social media post.</SheetDescription>
        </SheetHeader>
        <div className="flex-1 min-h-0">
          <ScrollArea className="h-full">
            <div className="p-6">
              <Form {...form}>
                <form id="add-post-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="space-y-6 lg:col-span-2">
                       <FormField control={form.control} name="title" render={({ field }) => ( <FormItem><FormLabel>Internal Title</FormLabel><FormControl><Input placeholder="e.g., Q3 Campaign - Instagram Launch" {...field} /></FormControl><FormMessage /></FormItem> )}/>
                       <FormField control={form.control} name="caption" render={({ field }) => ( <FormItem><FormLabel>Caption</FormLabel><FormControl><RichTextEditor value={field.value || ''} onChange={field.onChange} placeholder="Write the post caption here..." /></FormControl><FormMessage /></FormItem> )}/>
                    </div>
                    <div className="space-y-6 lg:col-span-1">
                      {effectiveBrandId ? (
                        <div className="space-y-2"><FormLabel>Brand</FormLabel><div className="p-2 bg-secondary rounded-md text-sm flex items-center gap-2"><Building2 className="h-4 w-4"/>{brandMap.get(effectiveBrandId) || '...'}</div></div>
                      ) : (
                        <FormField control={form.control} name="brandId" render={({ field }) => ( <FormItem><FormLabel>Brand</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a brand" /></SelectTrigger></FormControl><SelectContent>{areBrandsLoading ? <div className="p-2"><Loader2 className="h-4 w-4 animate-spin"/></div> : brands?.map((brand) => ( <SelectItem key={brand.id} value={brand.id}>{brand.name}</SelectItem> ))}</SelectContent></Select><FormMessage /></FormItem> )}/>
                      )}
                      <FormField control={form.control} name="priority" render={({ field }) => ( <FormItem><FormLabel>Priority</FormLabel><div className="flex gap-2"><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent>{Object.values(priorityInfo).map(p => (<SelectItem key={p.value} value={p.value}><div className="flex gap-2"><p.icon className={`h-4 w-4 ${p.color}`}/>{p.label}</div></SelectItem>))}</SelectContent></Select><Button type="button" variant="outline" size="icon" onClick={handleSuggestPriority} disabled={isSuggesting}><Wand2 className="h-4 w-4"/></Button></div>{suggestionReason && <FormDescription>{suggestionReason}</FormDescription>}<FormMessage/></FormItem> )}/>
                      <FormField control={form.control} name="assigneeIds" render={({ field }) => ( <FormItem><FormLabel>Assign To</FormLabel>{areUsersLoading ? <Loader2 className="h-5 w-5 animate-spin"/> : <MultiSelect options={userOptions} onValueChange={(v) => form.setValue('assigneeIds', v)} defaultValue={field.value || []} placeholder="Select members..."/>}<FormMessage /></FormItem> )}/>
                      
                      <div className="space-y-4 rounded-lg border p-4">
                        <FormField control={form.control} name="startDate" render={({ field }) => ( <FormItem><FormLabel>Start Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4"/>{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><CalendarComponent mode="single" selected={field.value} onSelect={field.onChange} /></PopoverContent></Popover><FormMessage /></FormItem> )}/>
                        <FormField control={form.control} name="dueDate" render={({ field }) => ( <FormItem><FormLabel>Internal Due Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4"/>{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><CalendarComponent mode="single" selected={field.value} onSelect={field.onChange} /></PopoverContent></Popover><FormMessage /></FormItem> )}/>
                        <FormField control={form.control} name="scheduledAt" render={({ field }) => ( <FormItem><FormLabel>Upload/Publish Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4"/>{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><CalendarComponent mode="single" selected={field.value} onSelect={field.onChange} /></PopoverContent></Popover><FormMessage /></FormItem> )}/>
                      </div>

                      <FormField control={form.control} name="dependencies" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Dependencies</FormLabel>
                            <MultiSelect
                              options={dependencyOptions.flatMap(([_, posts]) => posts)}
                              onValueChange={field.onChange}
                              defaultValue={field.value || []}
                              placeholder="Link to other posts..."
                            />
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
          <Button type="submit" form="add-post-form">Create Post</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
    </>
  );
}


    
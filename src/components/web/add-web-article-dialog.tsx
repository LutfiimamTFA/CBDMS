
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
  FormDescription,
} from '@/components/ui/form';
import { priorityInfo } from '@/lib/utils';
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollArea } from '../ui/scroll-area';
import { Loader2, Plus, Wand2, Building2 } from 'lucide-react';

import { useI18n } from '@/context/i18n-provider';
import { suggestPriority } from '@/ai/flows/suggest-priority';
import { useToast } from '@/hooks/use-toast';
import type { User as UserType, Brand, Notification, WebArticle } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { useCollection, useFirestore, useUserProfile } from '@/firebase';
import { collection, serverTimestamp, writeBatch, doc, query, orderBy, where } from 'firebase/firestore';
import { Calendar as CalendarComponent } from '../ui/calendar';
import { cn } from '@/lib/utils';
import { MultiSelect } from '../ui/multi-select';
import { format, parseISO } from 'date-fns';
import { RichTextEditor } from '../ui/rich-text-editor';
import { CalendarIcon } from 'lucide-react';


const articleSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  brandId: z.string().min(1, 'Brand is required'),
  content: z.string().optional(),
  priority: z.enum(['Urgent', 'High', 'Medium', 'Low']),
  assigneeIds: z.array(z.string()).min(1, 'At least one assignee is required'),
  dueDate: z.date().optional(),
});

type ArticleFormValues = z.infer<typeof articleSchema>;


export function AddWebArticleDialog({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [isSuggesting, setIsSuggesting] = React.useState(false);
  const [suggestionReason, setSuggestionReason] = React.useState<string | null>(null);
  const { t, language } = useI18n();
  const { toast } = useToast();
  
  const firestore = useFirestore();
  const { user, profile: currentUserProfile } = useUserProfile();

  const usersQuery = React.useMemo(() => {
    if (!firestore || !currentUserProfile) return null;
    let q = query(collection(firestore, 'users'), where('companyId', '==', currentUserProfile.companyId));
    return q;
  }, [firestore, currentUserProfile]);

  const { data: allUsers, isLoading: areUsersLoading } = useCollection<UserType>(usersQuery);
  
  const userOptions = useMemo(() => {
    if (!allUsers || !currentUserProfile) return [];
    if (currentUserProfile.role === 'Super Admin') {
        return allUsers.filter(u => u.role === 'Manager' || u.role === 'Employee').map(user => ({ value: user.id, label: user.name }));
    }
    if (currentUserProfile.role === 'Manager') {
      const team = allUsers.filter(u => u.managerId === currentUserProfile.id);
      const self = allUsers.find(u => u.id === currentUserProfile.id);
      const options = self ? [self, ...team] : team;
      return options.map(user => ({ value: user.id, label: user.name }));
    }
    if (currentUserProfile.role === 'Employee') {
        const myTeam = (allUsers || []).filter(u => u.managerId === currentUserProfile.managerId);
        return myTeam.map(user => ({ value: user.id, label: user.name }));
    }
    return [];
  }, [allUsers, currentUserProfile]);

  const brandsQuery = React.useMemo(() => {
    if (!firestore || !currentUserProfile) return null;
    if (currentUserProfile.role === 'Manager') {
        if (!currentUserProfile.brandIds || currentUserProfile.brandIds.length === 0) {
            return query(collection(firestore, 'brands'), where('__name__', '==', 'no-brands-for-manager'));
        }
        return query(collection(firestore, 'brands'), where('__name__', 'in', currentUserProfile.brandIds), orderBy('name'));
    }
    return query(collection(firestore, 'brands'), orderBy('name'));
  }, [firestore, currentUserProfile]);

  const { data: brands, isLoading: areBrandsLoading } = useCollection<Brand>(brandsQuery);

  const form = useForm<ArticleFormValues>({
    resolver: zodResolver(articleSchema),
    defaultValues: {
      title: '',
      brandId: '',
      content: '',
      priority: 'Medium',
      assigneeIds: [],
      dueDate: undefined,
    },
  });
  
  const singleBrandId = useMemo(() => {
    if (brands && brands.length === 1) {
        return brands[0].id;
    }
    return null;
  }, [brands]);

  useEffect(() => {
    if (open) {
        form.reset({
          title: '',
          brandId: singleBrandId || '',
          content: '',
          priority: 'Medium',
          assigneeIds: [],
          dueDate: undefined,
        });
        setSuggestionReason(null);
        if (currentUserProfile && user) {
             if (currentUserProfile.role === 'Employee') {
                form.setValue('assigneeIds', [user.uid]);
            }
        }
        if (singleBrandId) {
            form.setValue('brandId', singleBrandId);
        }
    }
  }, [open, currentUserProfile, user, form, singleBrandId]);


  const onSubmit = async (data: ArticleFormValues) => {
    if (!firestore || !currentUserProfile) return;
    
    const batch = writeBatch(firestore);
    const newArticleRef = doc(collection(firestore, 'webArticles'));
    
    const cleanedData = Object.fromEntries(
      Object.entries(data).filter(([_, v]) => v !== undefined)
    );

    const newArticleData: Partial<WebArticle> = {
        ...cleanedData,
        id: newArticleRef.id,
        status: 'To Do',
        statusInternal: 'To Do',
        createdAt: new Date().toISOString(),
        companyId: currentUserProfile.companyId,
        createdBy: {
          id: currentUserProfile.id,
          name: currentUserProfile.name,
          avatarUrl: currentUserProfile.avatarUrl || '',
        },
        dueDate: data.dueDate?.toISOString(),
    };
    batch.set(newArticleRef, newArticleData);

    data.assigneeIds.forEach(assigneeId => {
        if (assigneeId === currentUserProfile.id) return; 
        const notificationRef = doc(collection(firestore, `users/${assigneeId}/notifications`));
        const notification: Omit<Notification, 'id'> = {
            userId: assigneeId,
            title: 'New Web Article Assigned',
            message: `${currentUserProfile.name} assigned you a new article: "${data.title}"`,
            taskId: newArticleRef.id,
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
            title: 'Web Article Created',
            description: `${data.title} has been added.`
        });
        setOpen(false);
    } catch (error) {
        console.error("Failed to create article:", error);
        toast({
            variant: 'destructive',
            title: 'Creation Failed',
            description: 'Could not create the article. Please try again.'
        });
    }
  };

  const handleSuggestPriority = async () => {
    const title = form.getValues('title');
    if (!title) {
      toast({
        variant: 'destructive',
        title: 'Title is required',
        description: 'Please enter an article title before suggesting a priority.',
      });
      return;
    }
    setIsSuggesting(true);
    setSuggestionReason(null);
    try {
      const result = await suggestPriority({
        title,
        description: form.getValues('content'),
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

  return (
    <>
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent className="flex flex-col p-0 h-screen w-screen max-w-full">
        <SheetHeader className="p-6 pb-0">
          <SheetTitle>Create Web Article</SheetTitle>
          <SheetDescription>
            Fill in the details for the new web article.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 min-h-0">
          <ScrollArea className="h-full">
            <div className="p-6">
              <Form {...form}>
                <form
                  id="add-article-form"
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-6"
                >
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="space-y-6 lg:col-span-2">
                       <FormField
                        control={form.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Article Title</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., The Future of AI in Marketing" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                       <FormField
                        control={form.control}
                        name="content"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Content</FormLabel>
                            <FormControl>
                               <RichTextEditor
                                    value={field.value || ''}
                                    onChange={field.onChange}
                                    placeholder="Write your article content here..."
                                />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="space-y-6 lg:col-span-1">
                      {singleBrandId ? (
                         <div className="space-y-2">
                            <FormLabel>Brand</FormLabel>
                            <div className="flex items-center gap-2 text-sm p-2 rounded-md bg-secondary text-secondary-foreground">
                                <Building2 className="h-4 w-4" />
                                <span>{brands?.find(b => b.id === singleBrandId)?.name}</span>
                            </div>
                        </div>
                      ) : (
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
                                        <SelectItem key={brand.id} value={brand.id}>{brand.name}</SelectItem>
                                    ))
                                    )}
                                </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                      )}
                        <FormField
                            control={form.control}
                            name="priority"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Priority</FormLabel>
                                <div className="flex items-center gap-2">
                                <Select onValueChange={field.onChange} value={field.value}>
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
                                <Button type="button" variant="outline" size="icon" onClick={handleSuggestPriority} disabled={isSuggesting} title="Suggest Priority (AI)">
                                    {isSuggesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                                </Button>
                                </div>
                                {suggestionReason && <FormDescription className="text-primary">{suggestionReason}</FormDescription>}
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
                                onValueChange={(value) => form.setValue('assigneeIds', value)}
                                defaultValue={field.value || []}
                                placeholder="Select team members..."
                              />
                            )}
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                       <FormField
                          control={form.control}
                          name="dueDate"
                          render={({ field }) => (
                            <FormItem className="flex flex-col">
                              <FormLabel>Due Date</FormLabel>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <FormControl>
                                    <Button
                                      variant={"outline"}
                                      className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
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
          <Button type="submit" form="add-article-form">
            Create Article
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
    </>
  );
}

    
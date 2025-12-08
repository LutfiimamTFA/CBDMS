'use client';
import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import { useForm, Controller } from 'react-hook-form';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUserProfile, useStorage } from '@/firebase';
import { addDoc, collection, serverTimestamp, doc, updateDoc, writeBatch, getDocs, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { Loader2, Calendar as CalendarIcon, UploadCloud, Image as ImageIcon, XCircle, CheckCircle, FileText, Trash2, Save } from 'lucide-react';
import Image from 'next/image';
import { ScrollArea } from '../ui/scroll-area';
import type { SocialMediaPost, Notification } from '@/lib/types';

const postSchema = z.object({
  platform: z.string().min(1, 'Platform is required'),
  caption: z.string().min(1, 'Caption is required'),
  scheduledAtDate: z.date({ required_error: 'A date is required.'}),
  scheduledAtTime: z.string().min(1, 'A time is required.'),
  media: z.any().optional(),
});

type PostFormValues = z.infer<typeof postSchema>;

interface CreatePostDialogProps {
    children?: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    mode?: 'create' | 'edit';
    post?: SocialMediaPost;
}


export function CreatePostDialog({ children, open: controlledOpen, onOpenChange: setControlledOpen, mode = 'create', post }: CreatePostDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = setControlledOpen ?? setInternalOpen;
  
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const firestore = useFirestore();
  const storage = useStorage();
  const { profile, user } = useUserProfile();
  const { toast } = useToast();

  const form = useForm<PostFormValues>({
    resolver: zodResolver(postSchema),
  });
  
  useEffect(() => {
    if (mode === 'edit' && post) {
        const scheduledDate = parseISO(post.scheduledAt);
        form.reset({
            platform: post.platform,
            caption: post.caption,
            scheduledAtDate: scheduledDate,
            scheduledAtTime: format(scheduledDate, 'HH:mm'),
        });
        setImagePreview(post.mediaUrl || null);
    } else {
        form.reset({
            platform: 'Instagram',
            caption: '',
            scheduledAtDate: new Date(),
            scheduledAtTime: format(new Date(), 'HH:mm'),
            media: undefined,
        });
        setImagePreview(null);
    }
  }, [post, mode, form, open]);


  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      form.setValue('media', e.target.files);
    }
  };

  const handleSubmit = async (data: PostFormValues, status: SocialMediaPost['status']) => {
    if (!firestore || !storage || !profile || !user) return;
    setIsSaving(true);
    
    try {
        let mediaUrl = post?.mediaUrl || '';
        
        const file = data.media?.[0];
        if (file) {
            const storageRef = ref(storage, `social-media/${profile.companyId}/${Date.now()}-${file.name}`);
            await uploadBytes(storageRef, file);
            mediaUrl = await getDownloadURL(storageRef);
        }

        const [hour, minute] = data.scheduledAtTime.split(':').map(Number);
        const scheduledAt = new Date(data.scheduledAtDate);
        scheduledAt.setHours(hour, minute);

        const postData = {
            platform: data.platform,
            caption: data.caption,
            mediaUrl: mediaUrl,
            scheduledAt: scheduledAt.toISOString(),
            companyId: profile.companyId,
            status: status,
        };
        
        const batch = writeBatch(firestore);
        
        const isNewPost = mode === 'create';

        if (isNewPost) {
            const postRef = doc(collection(firestore, 'socialMediaPosts'));
            batch.set(postRef, {
                ...postData,
                createdBy: profile.id,
                createdAt: serverTimestamp(),
            });

            // Notify managers/admins if submitting for approval
            if (status === 'Needs Approval') {
                const usersSnapshot = await getDocs(collection(firestore, 'users'));
                usersSnapshot.forEach(userDoc => {
                    const userData = userDoc.data();
                    if ((userData.role === 'Manager' || userData.role === 'Super Admin') && userData.companyId === profile.companyId) {
                        const notifRef = doc(collection(firestore, `users/${userDoc.id}/notifications`));
                        const newNotification: Omit<Notification, 'id'> = {
                            userId: userDoc.id,
                            title: 'Content for Approval',
                            message: `${profile.name} submitted a new social media post for approval.`,
                            taskId: postRef.id,
                            taskTitle: postData.caption.substring(0, 50),
                            isRead: false,
                            createdAt: serverTimestamp(),
                            createdBy: {
                                id: user.uid,
                                name: profile.name,
                                avatarUrl: profile.avatarUrl || '',
                            },
                        };
                        batch.set(notifRef, newNotification);
                    }
                });
            }
            toast({ title: `Post ${status === 'Draft' ? 'Draft Saved' : 'Submitted'}!`, description: `Your post for ${data.platform} has been saved.` });
        } else if (post) {
            const postRef = doc(firestore, 'socialMediaPosts', post.id);
            batch.update(postRef, {
                ...postData,
                updatedAt: serverTimestamp(),
            });
             toast({ title: 'Post Updated!', description: `Your changes to the post have been saved.` });
        }

        await batch.commit();
        setOpen(false);

    } catch (error: any) {
        console.error("Failed to submit post:", error);
        toast({
            variant: 'destructive',
            title: 'Operation Failed',
            description: error.message || 'Could not save the post. Please try again.',
        });
    } finally {
        setIsSaving(false);
    }
  };
  
  const handleUpdateStatus = async (newStatus: SocialMediaPost['status']) => {
    if (!firestore || !post || !profile || !user) return;
    setIsSaving(true);

    const postRef = doc(firestore, 'socialMediaPosts', post.id);
    const batch = writeBatch(firestore);

    batch.update(postRef, {
        status: newStatus,
        updatedAt: serverTimestamp(),
    });

    // Notify creator if the approver is not the creator
    if (post.createdBy !== profile.id) {
        const notifRef = doc(collection(firestore, `users/${post.createdBy}/notifications`));
        const message = newStatus === 'Scheduled'
            ? `Your post "${post.caption.substring(0, 30)}..." has been approved and scheduled.`
            : `Your post "${post.caption.substring(0, 30)}..." was returned to drafts. Check for comments from the manager.`;

        const newNotification: Omit<Notification, 'id'> = {
            userId: post.createdBy,
            title: newStatus === 'Scheduled' ? 'Post Approved' : 'Post Needs Revision',
            message: message,
            taskId: post.id,
            taskTitle: post.caption.substring(0, 50),
            isRead: false,
            createdAt: serverTimestamp(),
            createdBy: {
                id: user.uid,
                name: profile.name,
                avatarUrl: profile.avatarUrl || '',
            },
        };
        batch.set(notifRef, newNotification);
    }

    try {
      await batch.commit();
      toast({
        title: `Post ${newStatus === 'Scheduled' ? 'Approved' : 'Rejected'}`,
        description: `The post has been marked as ${newStatus}.`,
      });
      setOpen(false);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: error.message || 'Could not update the post status.',
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleDeletePost = async () => {
    if (!firestore || !post) return;
    setIsDeleting(true);

    const postRef = doc(firestore, 'socialMediaPosts', post.id);
    try {
      await deleteDoc(postRef);
      toast({
        title: 'Post Deleted',
        description: 'The social media post has been permanently removed.',
      });
      setDeleteConfirmOpen(false);
      setOpen(false);
    } catch (error: any) {
        toast({
            variant: 'destructive',
            title: 'Deletion Failed',
            description: error.message || 'Could not delete the post.',
        });
    } finally {
        setIsDeleting(false);
    }
  };

  const isManager = profile?.role === 'Manager' || profile?.role === 'Super Admin';
  const isCreator = profile?.id === post?.createdBy;

  const isApproverView = mode === 'edit' && isManager && post?.status === 'Needs Approval';
  
  const isEditable = mode === 'create' || 
    (mode === 'edit' && post?.status !== 'Posted' && (isManager || (isCreator && (post.status === 'Draft' || post.status === 'Needs Approval'))));
  
  const canDelete = mode === 'edit' && post && (isManager || (isCreator && (post.status === 'Draft' || post.status === 'Needs Approval')));

  const onFormSubmit = (status: SocialMediaPost['status']) => {
    form.handleSubmit((data) => handleSubmit(data, status))();
  };


  return (
    <>
    <Dialog open={open} onOpenChange={setOpen}>
      {mode === 'create' && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="sm:max-w-2xl grid-rows-[auto_minmax(0,1fr)_auto] p-0 max-h-[90vh]">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle>{mode === 'create' ? 'Create Social Media Post' : 'Review & Edit Post'}</DialogTitle>
          <DialogDescription>
            {mode === 'create' ? 'Prepare your content and submit it for approval.' : 'Review, edit, or approve this post.'}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className='-mt-4'>
            <div className="px-6 py-4">
                <Form {...form}>
                <form id="create-post-form" className="space-y-6">
                    <FormField
                        control={form.control}
                        name="media"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Media</FormLabel>
                            <FormControl>
                                <div 
                                    className={cn(
                                      "w-full h-48 border-2 border-dashed rounded-lg flex flex-col items-center justify-center",
                                      isEditable && "cursor-pointer hover:bg-muted/50"
                                    )}
                                    onClick={() => isEditable && fileInputRef.current?.click()}
                                >
                                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*" onChange={handleFileChange} disabled={!isEditable} />
                                    {imagePreview ? (
                                        <Image src={imagePreview} alt="Preview" width={192} height={192} className="max-h-full w-auto object-contain rounded-md" />
                                    ) : (
                                        <div className="text-center text-muted-foreground">
                                            <UploadCloud className="mx-auto h-8 w-8" />
                                            <p>Click to upload image or video</p>
                                            <p className="text-xs">PNG, JPG, GIF up to 10MB</p>
                                        </div>
                                    )}
                                </div>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                    control={form.control}
                    name="caption"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Caption</FormLabel>
                        <FormControl>
                            <Textarea placeholder="Write your caption here..." {...field} rows={6} readOnly={!isEditable} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FormField
                            control={form.control}
                            name="platform"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Platform</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value} disabled={!isEditable}>
                                    <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a platform" />
                                    </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="Instagram">Instagram</SelectItem>
                                        <SelectItem value="Facebook" disabled>Facebook (coming soon)</SelectItem>
                                        <SelectItem value="Twitter" disabled>Twitter (coming soon)</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="scheduledAtDate"
                            render={({ field }) => (
                            <FormItem className="flex flex-col">
                                <FormLabel>Schedule Date</FormLabel>
                                <Popover>
                                <PopoverTrigger asChild>
                                    <FormControl>
                                    <Button
                                        variant={"outline"}
                                        className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                                        disabled={!isEditable}
                                    >
                                        {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                    </Button>
                                    </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                    mode="single"
                                    selected={field.value}
                                    onSelect={field.onChange}
                                    disabled={(date) => date < new Date() || !isEditable}
                                    initialFocus
                                    />
                                </PopoverContent>
                                </Popover>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="scheduledAtTime"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Schedule Time</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="time"
                                            className="w-full"
                                            {...field}
                                            readOnly={!isEditable}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                </form>
                </Form>
            </div>
        </ScrollArea>
        <DialogFooter className="p-6 pt-4 border-t flex flex-wrap justify-between gap-2">
            <div>
              {canDelete && (
                <Button variant="destructive" onClick={() => setDeleteConfirmOpen(true)} disabled={isSaving || isDeleting}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              )}
            </div>
          
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>

            {isApproverView ? (
                <>
                  <Button variant="outline" className="text-destructive border-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => handleUpdateStatus('Draft')} disabled={isSaving}>
                      {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <XCircle className="mr-2 h-4 w-4" />}
                      Reject
                  </Button>
                  <Button variant="default" className='bg-green-600 hover:bg-green-700' onClick={() => handleUpdateStatus('Scheduled')} disabled={isSaving}>
                      {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <CheckCircle className="mr-2 h-4 w-4" />}
                      Approve & Schedule
                  </Button>
                </>
            ) : isEditable ? (
              <>
                  {mode === 'create' ? (
                      <>
                          <Button variant="secondary" onClick={() => onFormSubmit('Draft')} disabled={isSaving}>
                              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                              Save as Draft
                          </Button>
                          <Button type="button" onClick={() => onFormSubmit('Needs Approval')} disabled={isSaving}>
                              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                              Submit for Approval
                          </Button>
                      </>
                   ) : (
                      mode === 'edit' && post?.status === 'Draft' ? (
                        <>
                          <Button variant="secondary" onClick={() => onFormSubmit('Draft')} disabled={isSaving}>
                              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                              Save Changes
                          </Button>
                           <Button type="button" onClick={() => onFormSubmit('Needs Approval')} disabled={isSaving}>
                              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                              Submit for Approval
                          </Button>
                        </>
                      ) : (
                         <Button type="button" onClick={() => onFormSubmit(post?.status ?? 'Draft')} disabled={isSaving}>
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Changes
                        </Button>
                      )
                  )}
              </>
            ) : null}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the social media post.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeletePost} className="bg-destructive hover:bg-destructive/90" disabled={isDeleting}>
                  {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Yes, delete post
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
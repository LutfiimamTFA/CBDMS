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
import { addDoc, collection, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { Loader2, Calendar as CalendarIcon, UploadCloud, Image as ImageIcon, XCircle, CheckCircle, FileText } from 'lucide-react';
import Image from 'next/image';
import { ScrollArea } from '../ui/scroll-area';
import type { SocialMediaPost } from '@/lib/types';

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
  const [imagePreview, setImagePreview] = useState<string | null>(post?.mediaUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const firestore = useFirestore();
  const storage = useStorage();
  const { profile } = useUserProfile();
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
        setImagePreview(post.mediaUrl);
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

  const handleSubmit = async (data: PostFormValues) => {
    if (!firestore || !storage || !profile) return;
    setIsSaving(true);
    
    try {
        let mediaUrl = post?.mediaUrl || '';
        
        // 1. Upload Media if a new one is provided
        const file = data.media?.[0];
        if (file) {
            const storageRef = ref(storage, `social-media/${profile.companyId}/${Date.now()}-${file.name}`);
            await uploadBytes(storageRef, file);
            mediaUrl = await getDownloadURL(storageRef);
        }

        // 2. Combine Date and Time
        const [hour, minute] = data.scheduledAtTime.split(':').map(Number);
        const scheduledAt = new Date(data.scheduledAtDate);
        scheduledAt.setHours(hour, minute);

        const postData = {
            platform: data.platform,
            caption: data.caption,
            mediaUrl: mediaUrl,
            scheduledAt: scheduledAt.toISOString(),
            companyId: profile.companyId,
        }

        if (mode === 'create') {
            await addDoc(collection(firestore, 'socialMediaPosts'), {
                ...postData,
                status: 'Needs Approval',
                createdBy: profile.id,
                createdAt: serverTimestamp(),
            });
            toast({
                title: 'Post Submitted!',
                description: `Your post for ${data.platform} has been submitted for approval.`,
            });
        } else if (post) {
            const postRef = doc(firestore, 'socialMediaPosts', post.id);
            await updateDoc(postRef, {
                ...postData,
                updatedAt: serverTimestamp(),
            });
             toast({
                title: 'Post Updated!',
                description: `Your changes to the post have been saved.`,
            });
        }
        
        setOpen(false);

    } catch (error: any) {
        console.error("Failed to submit post:", error);
        toast({
            variant: 'destructive',
            title: 'Submission Failed',
            description: error.message || 'Could not submit the post. Please try again.',
        });
    } finally {
        setIsSaving(false);
    }
  };
  
  const handleUpdateStatus = async (newStatus: SocialMediaPost['status']) => {
    if (!firestore || !post) return;
    setIsSaving(true);

    const postRef = doc(firestore, 'socialMediaPosts', post.id);

    try {
      await updateDoc(postRef, {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });
      toast({
        title: `Post ${newStatus}`,
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
  
  const canApprove = profile?.role === 'Manager' || profile?.role === 'Super Admin';
  const isApproverView = mode === 'edit' && canApprove && post?.status === 'Needs Approval';
  const isEditable = mode === 'create' || (mode === 'edit' && post?.status !== 'Posted');


  return (
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
                <form id="create-post-form" onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                    <FormField
                        control={form.control}
                        name="media"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Media (Optional)</FormLabel>
                            <FormControl>
                                <div 
                                    className="w-full h-48 border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50"
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
        <DialogFooter className="p-6 pt-4 border-t flex-wrap justify-between gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          
          <div className="flex gap-2">
            {isApproverView && (
                <>
                <Button variant="destructive" onClick={() => handleUpdateStatus('Draft')} disabled={isSaving}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <XCircle className="mr-2 h-4 w-4" />}
                    Reject
                </Button>
                <Button variant="default" className='bg-green-600 hover:bg-green-700' onClick={() => handleUpdateStatus('Scheduled')} disabled={isSaving}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <CheckCircle className="mr-2 h-4 w-4" />}
                    Approve & Schedule
                </Button>
                </>
            )}

            {mode === 'create' && (
                 <Button type="submit" form="create-post-form" disabled={isSaving}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                    Submit for Approval
                </Button>
            )}

            {mode === 'edit' && isEditable && !isApproverView && (
                <Button type="submit" form="create-post-form" disabled={isSaving}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                    Save Changes
                </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

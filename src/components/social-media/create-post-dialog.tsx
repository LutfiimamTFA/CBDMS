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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUserProfile, useStorage, useCollection } from '@/firebase';
import { addDoc, collection, serverTimestamp, doc, updateDoc, writeBatch, getDocs, deleteDoc, query, where, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { Loader2, Calendar as CalendarIcon, UploadCloud, Image as ImageIcon, XCircle, CheckCircle, Trash2, AlertCircle, Building2, User, MoveVertical } from 'lucide-react';
import Image from 'next/image';
import { ScrollArea } from '../ui/scroll-area';
import type { SocialMediaPost, Notification, Comment, User as UserType, Brand } from '@/lib/types';
import { Alert, AlertTitle, AlertDescription as AlertDescriptionUI } from '../ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { InstagramPostPreview } from './instagram-post-preview';
import { Label } from '../ui/label';
import { Slider } from '../ui/slider';

const postSchema = z.object({
  platform: z.string().min(1, 'Platform is required'),
  brandId: z.string().optional(),
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
    post?: SocialMediaPost;
}


export function CreatePostDialog({ children, open: controlledOpen, onOpenChange: setControlledOpen, post }: CreatePostDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = setControlledOpen ?? setInternalOpen;
  const mode = post ? 'edit' : 'create';
  
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [objectPosition, setObjectPosition] = useState<number>(50);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isRejectionDialogOpen, setRejectionDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const firestore = useFirestore();
  const storage = useStorage();
  const { profile, user } = useUserProfile();
  const { toast } = useToast();

  const brandsQuery = useMemo(() => {
    if (!firestore || !profile) return null;
    let q = query(collection(firestore, 'brands'), orderBy('name'));
    if (profile.role === 'Manager' && profile.brandIds && profile.brandIds.length > 0) {
        q = query(q, where('__name__', 'in', profile.brandIds));
    }
    return q;
  }, [firestore, profile]);
  const { data: brands, isLoading: areBrandsLoading } = useCollection<Brand>(brandsQuery);

  const form = useForm<PostFormValues>({
    resolver: zodResolver(postSchema),
  });
  
  const caption = form.watch('caption');

  useEffect(() => {
    if (mode === 'edit' && post) {
        const scheduledDate = parseISO(post.scheduledAt);
        form.reset({
            platform: post.platform,
            caption: post.caption,
            scheduledAtDate: scheduledDate,
            scheduledAtTime: format(scheduledDate, 'HH:mm'),
            brandId: post.brandId,
        });
        setImagePreview(post.mediaUrl || null);
        setObjectPosition(post.objectPosition || 50);
        if (post.mediaUrl?.includes('.mp4') || post.mediaUrl?.includes('video')) {
            setMediaType('video');
        } else {
            setMediaType('image');
        }
    } else {
        form.reset({
            platform: 'Instagram',
            caption: '',
            brandId: '',
            scheduledAtDate: new Date(),
            scheduledAtTime: format(new Date(), 'HH:mm'),
            media: undefined,
        });
        setImagePreview(null);
        setObjectPosition(50);
    }
  }, [post, mode, form, open]);


  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setMediaType(file.type.startsWith('video') ? 'video' : 'image');
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

        const postData: Partial<SocialMediaPost> = {
            platform: data.platform,
            caption: data.caption,
            mediaUrl: mediaUrl,
            scheduledAt: scheduledAt.toISOString(),
            companyId: profile.companyId,
            status: status,
            brandId: data.brandId,
            objectPosition: objectPosition,
            creator: {
                name: profile.name,
                avatarUrl: profile.avatarUrl || ''
            }
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

            if (status === 'Needs Approval') {
                const usersSnapshot = await getDocs(collection(firestore, 'users'));
                usersSnapshot.forEach(userDoc => {
                    const userData = userDoc.data();
                    const isManagerForBrand = userData.role === 'Manager' && data.brandId && userData.brandIds?.includes(data.brandId);

                    if ((userData.role === 'Super Admin' || isManagerForBrand) && userData.companyId === profile.companyId) {
                        const notifRef = doc(collection(firestore, `users/${userDoc.id}/notifications`));
                        const newNotification: Omit<Notification, 'id'> = {
                            userId: userDoc.id,
                            title: 'Content for Approval',
                            message: `${profile.name} submitted a new social media post for approval.`,
                            taskId: postRef.id, // Using taskId field to link to the post
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
  
  const handleUpdateStatus = async (newStatus: SocialMediaPost['status'], reason?: string) => {
    if (!firestore || !post || !profile || !user) return;
    setIsSaving(true);
    setRejectionDialogOpen(false);

    const postRef = doc(firestore, 'socialMediaPosts', post.id);
    const batch = writeBatch(firestore);

    batch.update(postRef, {
        status: newStatus,
        updatedAt: serverTimestamp(),
    });

    let notificationMessage: string;
    let notificationTitle: string;
    
    if (newStatus === 'Scheduled') {
        notificationTitle = 'Post Approved';
        notificationMessage = `Your post "${post.caption.substring(0, 30)}..." has been approved and scheduled.`;
    } else { // Rejected, status becomes 'Draft'
        notificationTitle = 'Post Needs Revision';
        notificationMessage = `${profile.name} requested revisions for your post: "${post.caption.substring(0, 30)}...". See comments for details.`;
        
        if (reason) {
            const newComment: Comment = {
                id: `c-${Date.now()}`,
                user: profile as UserType, 
                text: `**Rejection Feedback:** ${reason}`,
                timestamp: new Date().toISOString(),
                replies: [],
            };
            const existingComments = post.comments || [];
            batch.update(postRef, { comments: [...existingComments, newComment] });
        }
    }

    if (post.createdBy !== profile.id) {
        const notifRef = doc(collection(firestore, `users/${post.createdBy}/notifications`));
        const newNotification: Omit<Notification, 'id'> = {
            userId: post.createdBy,
            title: notificationTitle,
            message: notificationMessage,
            taskId: post.id, // Using taskId field to link to the post
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
      setRejectionReason('');
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

  const onFormSubmit = (status: SocialMediaPost['status']) => {
    form.handleSubmit((data) => handleSubmit(data, status))();
  };

  const isManager = profile?.role === 'Manager' || profile?.role === 'Super Admin';
  const isCreator = profile?.id === post?.createdBy;

  const isApproverView = mode === 'edit' && isManager && post?.status === 'Needs Approval';
  const isCreatorEditView = mode === 'edit' && isCreator && (post?.status === 'Draft' || post?.status === 'Error');
  
  const isEditable = mode === 'create' || isCreatorEditView;
  
  const canDelete = mode === 'edit' && post && (isManager || (isCreator && post.status === 'Draft'));

  const rejectionComment = post?.comments?.slice().reverse().find(c => c.text.startsWith('**Rejection Feedback:**'));

  return (
    <>
    <Dialog open={open} onOpenChange={setOpen}>
      {mode === 'create' && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="max-w-4xl grid-rows-[auto_minmax(0,1fr)_auto] p-0 max-h-[90vh]">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle>{mode === 'create' ? 'Create Social Media Post' : 'Review & Edit Post'}</DialogTitle>
          <DialogDescription>
            {mode === 'create' ? 'Prepare your content and submit it for approval.' : 'Review, edit, or approve this post.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid md:grid-cols-2 h-full overflow-hidden">
          <ScrollArea className="md:border-r h-full">
            <div className="p-6 space-y-6">
                {rejectionComment && (
                  <Alert variant="destructive" className="mb-4">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Revisions Requested</AlertTitle>
                      <AlertDescriptionUI>
                        <div className="flex items-start gap-3 mt-2">
                           <Avatar className="h-8 w-8">
                                <AvatarImage src={rejectionComment.user.avatarUrl} alt={rejectionComment.user.name} />
                                <AvatarFallback>{rejectionComment.user.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="text-sm">
                                <p className="font-semibold">{rejectionComment.user.name} <span className="font-normal text-muted-foreground">requested changes:</span></p>
                                <blockquote className="mt-1 italic border-l-2 pl-3 border-destructive/50">
                                {rejectionComment.text.replace('**Rejection Feedback:**', '').trim()}
                                </blockquote>
                            </div>
                        </div>
                      </AlertDescriptionUI>
                  </Alert>
                )}
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
                                        mediaType === 'image' ? (
                                            <Image src={imagePreview} alt="Preview" width={192} height={192} className="max-h-full w-auto object-contain rounded-md" />
                                        ) : (
                                            <video src={imagePreview} controls className="max-h-full w-auto object-contain rounded-md" />
                                        )
                                    ) : (
                                        <div className="text-center text-muted-foreground">
                                            <UploadCloud className="mx-auto h-8 w-8" />
                                            <p>Click to upload image or video</p>
                                            <p className="text-xs">PNG, JPG, MP4 up to 10MB</p>
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
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
                        <div className="grid grid-cols-2 gap-2">
                             <FormField
                                control={form.control}
                                name="scheduledAtDate"
                                render={({ field }) => (
                                <FormItem>
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
                                        disabled={(date) => date < new Date(new Date().setHours(0,0,0,0)) || !isEditable}
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
                    </div>
                     <FormField
                        control={form.control}
                        name="brandId"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Brand</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value} disabled={!isEditable}>
                                <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a brand for this post" />
                                </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {areBrandsLoading ? <SelectItem value="loading" disabled>Loading...</SelectItem> : 
                                    brands?.map(brand => <SelectItem key={brand.id} value={brand.id}><div className="flex items-center gap-2"><Building2 className='h-4 w-4'/>{brand.name}</div></SelectItem>)}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                </form>
                </Form>
            </div>
          </ScrollArea>
          <ScrollArea className="h-full">
            <div className="p-6 bg-secondary/50 flex flex-col items-center justify-center h-full gap-4">
                <InstagramPostPreview 
                    profileName={post?.creator?.name || profile?.name || 'Username'}
                    profileImageUrl={post?.creator?.avatarUrl || profile?.avatarUrl}
                    mediaUrl={imagePreview}
                    mediaType={mediaType}
                    caption={caption}
                    objectPosition={objectPosition}
                />
                {isEditable && mediaType === 'image' && imagePreview && (
                    <div className='space-y-2 text-center w-full max-w-[320px]'>
                        <Label>Edit Angle</Label>
                        <div className="flex items-center gap-4">
                            <span className="text-xs text-muted-foreground">Top</span>
                            <Slider
                                value={[objectPosition]}
                                max={100}
                                step={1}
                                onValueChange={(value) => setObjectPosition(value[0])}
                            />
                            <span className="text-xs text-muted-foreground">Bottom</span>
                        </div>
                    </div>
                )}
            </div>
          </ScrollArea>
        </div>
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
                  <Button variant="outline" className="text-destructive border-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setRejectionDialogOpen(true)} disabled={isSaving}>
                      {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <XCircle className="mr-2 h-4 w-4" />}
                      Reject
                  </Button>
                  <Button variant="default" className='bg-green-600 hover:bg-green-700' onClick={() => handleUpdateStatus('Scheduled')} disabled={isSaving}>
                      {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <CheckCircle className="mr-2 h-4 w-4" />}
                      Approve & Schedule
                  </Button>
                </>
            ) : mode === 'create' ? (
                isManager ? (
                    <>
                        <Button variant="secondary" onClick={() => onFormSubmit('Draft')} disabled={isSaving}>
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save as Draft
                        </Button>
                        <Button type="button" onClick={() => onFormSubmit('Scheduled')} disabled={isSaving}>
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Schedule Directly
                        </Button>
                    </>
                ) : ( 
                    <>
                        <Button variant="secondary" onClick={() => onFormSubmit('Draft')} disabled={isSaving}>
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save as Draft
                        </Button>
                        <Button type="button" onClick={() => onFormSubmit('Needs Approval')} disabled={isSaving}>
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Submit for Approval
                        </Button>
                    </>
                )
            ) : isCreatorEditView ? (
                <>
                    <Button variant="secondary" onClick={() => onFormSubmit('Draft')} disabled={isSaving}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Changes
                    </Button>
                    <Button type="button" onClick={() => onFormSubmit('Needs Approval')} disabled={isSaving}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Submit for Approval
                    </Button>
                </>
            ) : null }
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    
    <Dialog open={isRejectionDialogOpen} onOpenChange={setRejectionDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Reason for Rejection</DialogTitle>
                <DialogDescription>
                    Please provide feedback for the creator on why this post is being rejected. This will be added as a comment.
                </DialogDescription>
            </DialogHeader>
            <Textarea 
                placeholder="e.g., The caption needs to be more engaging, please revise the image..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
            />
            <DialogFooter>
                <Button variant="ghost" onClick={() => setRejectionDialogOpen(false)}>Cancel</Button>
                <Button variant="destructive" onClick={() => handleUpdateStatus('Draft', rejectionReason)} disabled={!rejectionReason.trim() || isSaving}>
                   {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Confirm Rejection
                </Button>
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

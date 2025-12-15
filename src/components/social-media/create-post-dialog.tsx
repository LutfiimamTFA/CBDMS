
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
import { useFirestore, useUserProfile, useStorage, useCollection, useDoc } from '@/firebase';
import { addDoc, collection, serverTimestamp, doc, updateDoc, writeBatch, getDocs, deleteDoc, query, where, orderBy, deleteField } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { Loader2, Calendar as CalendarIcon, UploadCloud, Image as ImageIcon, XCircle, CheckCircle, Trash2, AlertCircle, Building2, User, MoveVertical, Clapperboard, Layers, Plus, RefreshCcw } from 'lucide-react';
import Image from 'next/image';
import { ScrollArea } from '../ui/scroll-area';
import type { SocialMediaPost, Notification, Comment, User as UserType, Brand, RevisionItem } from '@/lib/types';
import { Alert, AlertTitle, AlertDescription as AlertDescriptionUI } from '../ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { InstagramPostPreview } from './instagram-post-preview';
import { Label } from '../ui/label';
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';
import { Slider } from '../ui/slider';
import { Checkbox } from '../ui/checkbox';


const postSchema = z.object({
  platform: z.string().min(1, 'Platform is required'),
  brandId: z.string().optional(),
  caption: z.string().min(1, 'Caption is required'),
  scheduledAtDate: z.date({ required_error: 'A date is required.'}),
  scheduledAtTime: z.string().min(1, 'A time is required.'),
  media: z.any().optional(),
  postType: z.enum(['Post', 'Reels']).default('Post'),
  objectPosition: z.number().min(0).max(100).default(50),
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isRejectionDialogOpen, setRejectionDialogOpen] = useState(false);
  const [rejectionItems, setRejectionItems] = useState<string[]>([]);
  const [currentRejectionItem, setCurrentRejectionItem] = useState('');
  const [revisionItems, setRevisionItems] = useState<RevisionItem[]>([]);

  const firestore = useFirestore();
  const storage = useStorage();
  const { profile, user } = useUserProfile();
  const { toast } = useToast();

  const managerDocRef = useMemo(() => {
    if (!firestore || !profile || profile.role !== 'Employee' || !profile.managerId) {
        return null;
    }
    return doc(firestore, 'users', profile.managerId);
  }, [firestore, profile]);
  const { data: managerProfile, isLoading: isManagerLoading } = useDoc<UserType>(managerDocRef);

  const brandsQuery = useMemo(() => {
    if (!firestore || !profile || (profile.role === 'Employee' && isManagerLoading)) return null;

    let brandIdsToQuery: string[] | undefined = undefined;

    if (profile.role === 'Manager') {
        brandIdsToQuery = profile.brandIds;
    } else if (profile.role === 'Employee' && managerProfile) {
        brandIdsToQuery = managerProfile.brandIds;
    }

    if (brandIdsToQuery && brandIdsToQuery.length === 0) {
        return null;
    }
    
    let q = query(collection(firestore, 'brands'), orderBy('name'));

    if (brandIdsToQuery && brandIdsToQuery.length > 0) {
      q = query(q, where('__name__', 'in', brandIdsToQuery));
    }
    
    return q;
  }, [firestore, profile, managerProfile, isManagerLoading]);
  const { data: brands, isLoading: areBrandsLoading } = useCollection<Brand>(brandsQuery);

  const form = useForm<PostFormValues>({
    resolver: zodResolver(postSchema),
  });
  
  const caption = form.watch('caption');
  const postType = form.watch('postType');
  const objectPosition = form.watch('objectPosition');

  useEffect(() => {
    if (mode === 'edit' && post) {
        const scheduledDate = parseISO(post.scheduledAt);
        form.reset({
            platform: post.platform,
            caption: post.caption,
            scheduledAtDate: scheduledDate,
            scheduledAtTime: format(scheduledDate, 'HH:mm'),
            brandId: post.brandId,
            postType: post.postType || 'Post',
            objectPosition: post.objectPosition || 50,
        });
        setImagePreview(post.mediaUrl || null);
        setRevisionItems(post.revisionItems || []);
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
            postType: 'Post',
            objectPosition: 50,
        });
        setImagePreview(null);
        setRevisionItems([]);
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
            postType: data.postType,
            objectPosition: data.objectPosition,
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
  
  const handleUpdateStatus = async (newStatus: SocialMediaPost['status'], reasonItems?: string[]) => {
    if (!firestore || !post || !profile || !user) return;
    setIsSaving(true);
    setRejectionDialogOpen(false);

    const postRef = doc(firestore, 'socialMediaPosts', post.id);
    const batch = writeBatch(firestore);

    const updateData: any = {
        status: newStatus,
        updatedAt: serverTimestamp(),
    };

    let notificationMessage: string;
    let notificationTitle: string;
    
    if (newStatus === 'Scheduled') {
        notificationTitle = 'Post Approved';
        notificationMessage = `Your post "${post.caption.substring(0, 30)}..." has been approved and scheduled.`;
        // Clear revision items on approval
        updateData.revisionItems = deleteField();
    } else { // Rejected, status becomes 'Draft'
        notificationTitle = 'Post Needs Revision';
        notificationMessage = `${profile.name} requested revisions for your post: "${post.caption.substring(0, 30)}...". See the checklist for details.`;
        
        if (reasonItems && reasonItems.length > 0) {
            updateData.revisionItems = reasonItems.map(item => ({
                id: crypto.randomUUID(),
                text: item,
                completed: false,
            }));
        }
    }
    
    batch.update(postRef, updateData);

    if (post.createdBy !== profile.id) {
        const notifRef = doc(collection(firestore, `users/${post.createdBy}/notifications`));
        const newNotification: Omit<Notification, 'id'> = {
            userId: post.createdBy,
            title: notificationTitle,
            message: notificationMessage,
            taskId: post.id,
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
      setRejectionItems([]);
      setCurrentRejectionItem('');
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
  
  const handleToggleRevisionItem = async (itemId: string) => {
    if (!firestore || !post) return;
    
    const newItems = revisionItems.map(item =>
        item.id === itemId ? { ...item, completed: !item.completed } : item
    );
    setRevisionItems(newItems);
    
    const postRef = doc(firestore, 'socialMediaPosts', post.id);
    try {
        await updateDoc(postRef, { revisionItems: newItems });
    } catch (e) {
        console.error("Failed to update revision item", e);
        setRevisionItems(post.revisionItems || []); // Revert on failure
        toast({ variant: 'destructive', title: 'Update Failed' });
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
  
  const handleAddRejectionItem = () => {
    if (currentRejectionItem.trim()) {
        setRejectionItems(prev => [...prev, currentRejectionItem]);
        setCurrentRejectionItem('');
    }
  };
  
  const allRevisionsCompleted = useMemo(() => {
    if (!revisionItems || revisionItems.length === 0) return true;
    return revisionItems.every(item => item.completed);
  }, [revisionItems]);


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
                {isCreatorEditView && revisionItems && revisionItems.length > 0 && (
                  <div className="space-y-4 rounded-lg border border-orange-500/50 bg-orange-500/10 p-4">
                      <h3 className="font-semibold flex items-center gap-2 text-orange-600 dark:text-orange-400"><RefreshCcw className="h-5 w-5"/> Revisions Requested</h3>
                      <div className="space-y-2">
                          {revisionItems.map(item => (
                              <div key={item.id} className="flex items-center gap-3">
                                  <Checkbox
                                      id={`rev-${item.id}`}
                                      checked={item.completed}
                                      onCheckedChange={() => handleToggleRevisionItem(item.id)}
                                  />
                                  <label htmlFor={`rev-${item.id}`} className={`flex-1 text-sm ${item.completed ? 'line-through text-muted-foreground' : ''}`}>
                                      {item.text}
                                  </label>
                              </div>
                          ))}
                      </div>
                  </div>
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
                            {isEditable && mediaType === 'image' && imagePreview && (
                              <FormField
                                control={form.control}
                                name="objectPosition"
                                render={({ field: { onChange, value } }) => (
                                  <FormItem>
                                    <FormLabel>Image Focus</FormLabel>
                                    <FormControl>
                                      <Slider
                                        min={0}
                                        max={100}
                                        step={1}
                                        value={[value]}
                                        onValueChange={(vals) => onChange(vals[0])}
                                      />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                            )}
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

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                            name="postType"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Post Type</FormLabel>
                                  <ToggleGroup type="single" variant="outline" className="w-full grid grid-cols-2" value={field.value} onValueChange={field.onChange} disabled={!isEditable}>
                                    <ToggleGroupItem value="Post" aria-label="Post type">
                                        <Layers className="mr-2 h-4 w-4"/> Post
                                    </ToggleGroupItem>
                                    <ToggleGroupItem value="Reels" aria-label="Reels type">
                                        <Clapperboard className="mr-2 h-4 w-4"/> Reels
                                    </ToggleGroupItem>
                                  </ToggleGroup>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                     <div className="grid grid-cols-2 gap-4 items-end">
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
                    postType={postType}
                    objectPosition={objectPosition}
                />
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
                    <Button type="button" onClick={() => onFormSubmit('Needs Approval')} disabled={isSaving || !allRevisionsCompleted}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Re-submit for Approval
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
            Provide a clear list of revision points for the creator. This will be added as a comment.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="space-y-2">
            {rejectionItems.map((item, index) => (
              <div key={index} className="flex items-center gap-2 bg-secondary p-2 rounded-md">
                <span className="flex-1 text-sm">{item}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setRejectionItems(prev => prev.filter((_, i) => i !== index))}>
                  <XCircle className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Input
              value={currentRejectionItem}
              onChange={(e) => setCurrentRejectionItem(e.target.value)}
              placeholder="e.g., Fix the logo placement"
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddRejectionItem())}
            />
            <Button onClick={handleAddRejectionItem} disabled={!currentRejectionItem.trim()}>
              <Plus className="mr-2 h-4 w-4" /> Add
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setRejectionDialogOpen(false)}>Cancel</Button>
          <Button variant="destructive" onClick={() => handleUpdateStatus('Draft', rejectionItems)} disabled={rejectionItems.length === 0 || isSaving}>
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


'use client';
import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
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
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { Loader2, Calendar as CalendarIcon, UploadCloud, Image as ImageIcon, XCircle, CheckCircle, Trash2, AlertCircle, Building2, User, MoveVertical, Clapperboard, Layers, Plus, RefreshCcw } from 'lucide-react';
import Image from 'next/image';
import { ScrollArea } from '../ui/scroll-area';
import type { SocialMediaPost, Notification, Comment, User as UserType, Brand, RevisionItem, RevisionCycle } from '@/lib/types';
import { InstagramPostPreview } from './instagram-post-preview';
import { Label } from '../ui/label';
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';
import { Slider } from '../ui/slider';
import { Checkbox } from '../ui/checkbox';
import Cropper, { type Area } from 'react-easy-crop';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';

const postSchema = z.object({
  platform: z.string().min(1, 'Platform is required'),
  brandId: z.string().optional(),
  caption: z.string().min(1, 'Caption is required'),
  scheduledAtDate: z.date({ required_error: 'A date is required.' }),
  scheduledAtTime: z.string().min(1, 'A time is required.'),
  media: z.any().optional(),
  assignedTo: z.string().optional(),
  postType: z.enum(['Post', 'Reels']).default('Post'),
  aspect: z.enum(['1:1', '4:5', '1.91:1', '9:16']).default('4:5'),
});

type PostFormValues = z.infer<typeof postSchema>;

interface CreatePostDialogProps {
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  post?: SocialMediaPost;
}

const formatDate = (date: any): string => {
  if (!date) return 'N/A';
  const dateObj = date.toDate ? date.toDate() : new Date(date);
  if (isNaN(dateObj.getTime())) return 'Invalid date';
  return format(dateObj, 'PP, p');
};

export function CreatePostDialog({ children, open: controlledOpen, onOpenChange: setControlledOpen, post }: CreatePostDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = setControlledOpen ?? setInternalOpen;
  const mode = post ? 'edit' : 'create';

  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isRejectionDialogOpen, setRejectionDialogOpen] = useState(false);
  const [rejectionItems, setRejectionItems] = useState<Omit<RevisionItem, 'id' | 'completed'>[]>([]);
  const [currentItemText, setCurrentItemText] = useState('');
  const [revisionItems, setRevisionItems] = useState<RevisionItem[]>([]);

  // Cropping state
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

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

  const { watch, setValue } = form;
  const caption = watch('caption');
  const postType = watch('postType');
  const aspect = watch('aspect');
  const finalAspect = postType === 'Reels' ? '9:16' : aspect;

  const onCropComplete = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  useEffect(() => {
    if (post) {
      const scheduledDate = parseISO(post.scheduledAt);
      form.reset({
        platform: post.platform,
        caption: post.caption,
        scheduledAtDate: scheduledDate,
        scheduledAtTime: format(scheduledDate, 'HH:mm'),
        brandId: post.brandId,
        assignedTo: post.createdBy,
        postType: post.postType || 'Post',
        aspect: post.crop?.aspect || '4:5',
      });
      setImagePreview(post.mediaUrl || null);
      setMediaType(post.mediaType || null);
      setRevisionItems(post.revisionItems || []);
      if (post.crop) {
        setCrop({ x: post.crop.x, y: post.crop.y });
        setZoom(post.crop.zoom);
      }
    } else {
      form.reset({
        platform: 'Instagram', caption: '', brandId: '',
        scheduledAtDate: new Date(), scheduledAtTime: format(new Date(), 'HH:mm'),
        media: undefined, assignedTo: user?.uid, postType: 'Post', aspect: '4:5',
      });
      setImagePreview(null);
      setMediaType(null);
      setRevisionItems([]);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    }
  }, [post, form, open, user]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
      setMediaType(file.type.startsWith('video') ? 'video' : 'image');
      setValue('media', e.target.files);
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

      const postData: Partial<SocialMediaPost> & { updatedAt?: any } = {
        platform: data.platform, caption: data.caption, mediaUrl, mediaType, scheduledAt: scheduledAt.toISOString(),
        companyId: profile.companyId, status, brandId: data.brandId, postType: data.postType, createdBy: data.assignedTo || user.uid,
        crop: mediaType === 'image' && croppedAreaPixels ? { aspect: finalAspect, zoom, x: croppedAreaPixels.x, y: croppedAreaPixels.y } : undefined,
      };

      const batch = writeBatch(firestore);
      if (mode === 'create') {
        const postRef = doc(collection(firestore, 'socialMediaPosts'));
        batch.set(postRef, { ...postData, createdAt: serverTimestamp() });
        toast({ title: `Post ${status === 'Draft' ? 'Draft Saved' : 'Submitted'}!` });
      } else if (post) {
        const postRef = doc(firestore, 'socialMediaPosts', post.id);
        if (status === 'Needs Approval' && post.status === 'Needs Revision' && post.revisionItems) {
            const completedCycle: RevisionCycle = {
                cycleNumber: (post.revisionHistory || []).length + 1,
                requestedAt: post.updatedAt || serverTimestamp(),
                requestedBy: { id: '', name: 'Manager', avatarUrl: '' },
                items: post.revisionItems,
            };
            postData.revisionHistory = [...(post.revisionHistory || []), completedCycle];
            postData.revisionItems = deleteField() as any;
        }
        batch.update(postRef, { ...postData, updatedAt: serverTimestamp() });
        toast({ title: 'Post Updated!' });
      }

      await batch.commit();
      setOpen(false);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Operation Failed', description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateStatus = async (newStatus: SocialMediaPost['status'], reasonItems?: Omit<RevisionItem, 'id' | 'completed'>[]) => {
    if (!firestore || !post || !profile || !user) return;
    setIsSaving(true);
    setRejectionDialogOpen(false);
    const postRef = doc(firestore, 'socialMediaPosts', post.id);
    try {
      const updateData: Partial<SocialMediaPost> & { updatedAt: any } = { status: newStatus, updatedAt: serverTimestamp() };
      if (newStatus === 'Scheduled') {
        if (post.revisionItems) {
          const completedCycle: RevisionCycle = {
            cycleNumber: (post.revisionHistory || []).length + 1,
            requestedAt: post.updatedAt || serverTimestamp(),
            requestedBy: { id: profile.id, name: profile.name, avatarUrl: profile.avatarUrl || '' },
            items: post.revisionItems,
          };
          updateData.revisionHistory = [...(post.revisionHistory || []), completedCycle];
          updateData.revisionItems = deleteField() as any;
        }
      } else if (newStatus === 'Needs Revision' && reasonItems) {
        updateData.revisionItems = reasonItems.map(item => ({ id: crypto.randomUUID(), text: item.text, completed: false }));
        const newCycle: RevisionCycle = {
            cycleNumber: (post.revisionHistory?.length || 0) + 1,
            requestedAt: new Date().toISOString(),
            requestedBy: { id: profile.id, name: profile.name, avatarUrl: profile.avatarUrl || '' },
            items: updateData.revisionItems,
        };
        updateData.revisionHistory = [...(post.revisionHistory || []), newCycle];
      }

      await updateDoc(postRef, updateData);
      toast({ title: `Post ${newStatus === 'Scheduled' ? 'Approved' : 'Rejected'}` });
      setOpen(false);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Update Failed', description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  const onFormSubmit = (status: SocialMediaPost['status']) => form.handleSubmit((data) => handleSubmit(data, status))();
  const isManager = profile?.role === 'Manager' || profile?.role === 'Super Admin';
  const isCreator = profile?.id === post?.createdBy;
  const isApproverView = mode === 'edit' && isManager && post?.status === 'Needs Approval';
  const isCreatorEditView = mode === 'edit' && isCreator && (post?.status === 'Draft' || post?.status === 'Needs Revision');
  const isEditable = mode === 'create' || isCreatorEditView;
  const allRevisionsCompleted = useMemo(() => revisionItems.every(item => item.completed), [revisionItems]);
  const handleAddRejectionItem = () => { if (currentItemText.trim()) { setRejectionItems(prev => [...prev, { text: currentItemText }]); setCurrentItemText(''); } };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {mode === 'create' && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="max-w-4xl grid-rows-[auto_minmax(0,1fr)_auto] p-0 max-h-[90vh]">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle>{mode === 'create' ? 'Create Social Media Post' : 'Review & Edit Post'}</DialogTitle>
        </DialogHeader>
        <div className="grid md:grid-cols-2 h-full overflow-hidden">
          <ScrollArea className="md:border-r h-full">
            <div className="p-6 space-y-6">
              {isCreatorEditView && revisionItems.length > 0 && (
                <div className="space-y-4 rounded-lg border border-orange-500/50 bg-orange-500/10 p-4">
                  <h3 className="font-semibold flex items-center gap-2 text-orange-600 dark:text-orange-400"><RefreshCcw className="h-5 w-5" /> Revisions Requested</h3>
                  <div className="space-y-2">
                    {revisionItems.map(item => (
                      <div key={item.id} className="flex items-center gap-3">
                        <Checkbox id={`rev-${item.id}`} checked={item.completed} onCheckedChange={() => setRevisionItems(revs => revs.map(r => r.id === item.id ? {...r, completed: !r.completed} : r))} />
                        <label htmlFor={`rev-${item.id}`} className={`flex-1 text-sm ${item.completed ? 'line-through text-muted-foreground' : ''}`}>{item.text}</label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
               {post?.revisionHistory && post.revisionHistory.length > 0 && (
                <Accordion type="single" collapsible>
                  <AccordionItem value="history">
                    <AccordionTrigger>Revision History</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4">
                        {post.revisionHistory.slice().sort((a,b) => b.cycleNumber - a.cycleNumber).map(cycle => (
                          <div key={cycle.cycleNumber} className="text-xs">
                            <p className="font-semibold">Revision {cycle.cycleNumber} - by {cycle.requestedBy.name} on {formatDate(cycle.requestedAt)}</p>
                            <ul className="list-disc pl-5 text-muted-foreground">
                              {cycle.items.map(item => <li key={item.id}>{item.text}</li>)}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              )}

              <Form {...form}>
                <form id="create-post-form" className="space-y-6">
                  <FormField control={form.control} name="media" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Media</FormLabel>
                      <div className="w-full h-48 border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50" onClick={() => isEditable && fileInputRef.current?.click()}>
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*" onChange={handleFileChange} disabled={!isEditable} />
                        {!imagePreview ? (
                          <div className="text-center text-muted-foreground"><UploadCloud className="mx-auto h-8 w-8" /><p>Click to upload</p></div>
                        ) : mediaType === 'image' ? (
                          <div className="relative w-full h-full"><Cropper image={imagePreview} crop={crop} zoom={zoom} aspect={finalAspect === '1:1' ? 1 : finalAspect === '4:5' ? 4/5 : finalAspect === '9:16' ? 9/16 : 1.91/1} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={onCropComplete} /></div>
                        ) : (<video src={imagePreview} controls muted className="max-h-full w-auto" />)}
                      </div>
                      {mediaType === 'image' && imagePreview && <Slider value={[zoom]} min={1} max={3} step={0.1} onValueChange={(val) => setZoom(val[0])} />}
                    </FormItem>
                  )} />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="postType" render={({ field }) => (
                        <FormItem><FormLabel>Post Type</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={!isEditable}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="Post">Post</SelectItem><SelectItem value="Reels">Reels</SelectItem></SelectContent></Select></FormItem>
                    )} />
                    {postType === 'Post' && <FormField control={form.control} name="aspect" render={({ field }) => (
                        <FormItem><FormLabel>Aspect Ratio</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={!isEditable}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="1:1">1:1 (Square)</SelectItem><SelectItem value="4:5">4:5 (Portrait)</SelectItem><SelectItem value="1.91:1">1.91:1 (Landscape)</SelectItem></SelectContent></Select></FormItem>
                    )} />}
                  </div>
                  <FormField control={form.control} name="caption" render={({ field }) => (
                    <FormItem><FormLabel>Caption</FormLabel><FormControl><Textarea placeholder="Write caption..." {...field} rows={6} readOnly={!isEditable} /></FormControl><FormMessage /></FormItem>
                  )} />
                   <FormField control={form.control} name="brandId" render={({ field }) => (
                        <FormItem><FormLabel>Brand</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={!isEditable}><FormControl><SelectTrigger><SelectValue placeholder="Select brand" /></SelectTrigger></FormControl><SelectContent>{areBrandsLoading ? <SelectItem value="loading" disabled>Loading...</SelectItem> : brands?.map(brand => <SelectItem key={brand.id} value={brand.id}>{brand.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                    )} />
                  <div className="grid grid-cols-2 gap-4">
                     <FormField control={form.control} name="scheduledAtDate" render={({ field }) => (
                        <FormItem><FormLabel>Schedule Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")} disabled={!isEditable}>{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))} /></PopoverContent></Popover><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="scheduledAtTime" render={({ field }) => (
                        <FormItem><FormLabel>Time</FormLabel><FormControl><Input type="time" {...field} readOnly={!isEditable} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                </form>
              </Form>
            </div>
          </ScrollArea>
          <ScrollArea className="h-full">
            <div className="p-6 bg-secondary/50 flex flex-col items-center justify-center h-full gap-4">
              {isApproverView && (
                <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                  {(post.revisionHistory?.length || 0) > 0 ? `Revision Cycle #${post.revisionHistory?.length}` : 'Initial Submission'}
                  {' • '}
                  Requested: {post.revisionHistory ? formatDate(post.revisionHistory[post.revisionHistory.length - 1].requestedAt) : '-'}
                </div>
              )}
              <InstagramPostPreview profileName={post?.creator?.name || profile?.name} profileImageUrl={post?.creator?.avatarUrl || profile?.avatarUrl} mediaUrl={imagePreview} caption={caption} postType={postType} mediaType={mediaType} aspect={finalAspect} crop={crop} zoom={zoom} />
            </div>
          </ScrollArea>
        </div>
        <DialogFooter className="p-6 pt-4 border-t flex flex-wrap justify-between gap-2">
          <div>{/* Placeholder for delete button if needed */}</div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            {isApproverView ? (
              <>
                <Button variant="outline" className="text-destructive border-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setRejectionDialogOpen(true)} disabled={isSaving}><XCircle className="mr-2 h-4 w-4" /> Reject</Button>
                <Button variant="default" className='bg-green-600 hover:bg-green-700' onClick={() => handleUpdateStatus('Scheduled')} disabled={isSaving}><CheckCircle className="mr-2 h-4 w-4" /> Approve & Schedule</Button>
              </>
            ) : isEditable ? (
              <>
                <Button variant="secondary" onClick={() => onFormSubmit('Draft')} disabled={isSaving}>Save as Draft</Button>
                <Button onClick={() => onFormSubmit('Needs Approval')} disabled={isSaving || (isCreatorEditView && !allRevisionsCompleted)}>
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : ''}
                  {isCreatorEditView ? 'Re-submit for Approval' : 'Submit for Approval'}
                </Button>
              </>
            ) : null}
          </div>
        </DialogFooter>
      </DialogContent>
      <Dialog open={isRejectionDialogOpen} onOpenChange={setRejectionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reason for Rejection</DialogTitle>
            <DialogDescription>Provide a clear list of revision points for the creator.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">{rejectionItems.map((item, index) => (<div key={index} className="flex items-center gap-2 bg-secondary p-2 rounded-md"><span className="flex-1 text-sm">{item.text}</span><Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setRejectionItems(prev => prev.filter((_, i) => i !== index))}><XCircle className="h-4 w-4" /></Button></div>))}</div>
            <div className="flex items-center gap-2"><Input value={currentItemText} onChange={(e) => setCurrentItemText(e.target.value)} placeholder="e.g., Fix the logo placement" onKeyDown={(e) => {if (e.key === 'Enter') { e.preventDefault(); handleAddRejectionItem(); }}} /><Button onClick={handleAddRejectionItem} disabled={!currentItemText.trim()}><Plus className="mr-2 h-4 w-4" /> Add</Button></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectionDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => handleUpdateStatus('Needs Revision', rejectionItems)} disabled={rejectionItems.length === 0 || isSaving}>Confirm Rejection</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

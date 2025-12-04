'use client';
import React, { useState, useRef, useMemo } from 'react';
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
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Loader2, Calendar as CalendarIcon, UploadCloud, Image as ImageIcon } from 'lucide-react';
import Image from 'next/image';
import { ScrollArea } from '../ui/scroll-area';

const postSchema = z.object({
  platform: z.string().min(1, 'Platform is required'),
  caption: z.string().min(1, 'Caption is required'),
  scheduledAtDate: z.date({ required_error: 'A date is required.'}),
  scheduledAtTime: z.string().min(1, 'A time is required.'),
  media: z.any().refine(file => file?.length == 1, 'An image is required.'),
});

type PostFormValues = z.infer<typeof postSchema>;

export function CreatePostDialog({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const firestore = useFirestore();
  const storage = useStorage();
  const { profile } = useUserProfile();
  const { toast } = useToast();

  const form = useForm<PostFormValues>({
    resolver: zodResolver(postSchema),
    defaultValues: {
      platform: 'Instagram',
      caption: '',
      scheduledAtTime: format(new Date(), 'HH:mm'),
    },
  });
  
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

  const onSubmit = async (data: PostFormValues) => {
    if (!firestore || !storage || !profile) return;
    setIsSaving(true);
    
    try {
        // 1. Upload Media
        const file = data.media[0];
        const storageRef = ref(storage, `social-media/${profile.companyId}/${Date.now()}-${file.name}`);
        await uploadBytes(storageRef, file);
        const mediaUrl = await getDownloadURL(storageRef);

        // 2. Combine Date and Time
        const [hour, minute] = data.scheduledAtTime.split(':').map(Number);
        const scheduledAt = new Date(data.scheduledAtDate);
        scheduledAt.setHours(hour, minute);

        // 3. Create Firestore Document
        await addDoc(collection(firestore, 'socialMediaPosts'), {
            platform: data.platform,
            caption: data.caption,
            mediaUrl: mediaUrl,
            status: 'Scheduled',
            scheduledAt: scheduledAt.toISOString(),
            createdBy: profile.id,
            companyId: profile.companyId,
            createdAt: serverTimestamp(),
        });
        
        toast({
            title: 'Post Scheduled!',
            description: `Your post for ${data.platform} has been scheduled for ${format(scheduledAt, 'PPP p')}.`,
        });

        // 4. Reset form and close dialog
        form.reset();
        setImagePreview(null);
        setOpen(false);

    } catch (error: any) {
        console.error("Failed to schedule post:", error);
        toast({
            variant: 'destructive',
            title: 'Scheduling Failed',
            description: error.message || 'Could not schedule the post. Please try again.',
        });
    } finally {
        setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl grid-rows-[auto_minmax(0,1fr)_auto] p-0 max-h-[90vh]">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle>Create Social Media Post</DialogTitle>
          <DialogDescription>
            Plan and schedule your next social media post.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className='-mt-4'>
            <div className="px-6 py-4">
                <Form {...form}>
                <form id="create-post-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                        control={form.control}
                        name="media"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Media</FormLabel>
                            <FormControl>
                                <div 
                                    className="w-full h-48 border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*" onChange={handleFileChange} />
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
                            <Textarea placeholder="Write your caption here..." {...field} rows={6} />
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
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                                    disabled={(date) => date < new Date()}
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
        <DialogFooter className="p-6 pt-4 border-t">
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="submit" form="create-post-form" disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
            Schedule Post
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

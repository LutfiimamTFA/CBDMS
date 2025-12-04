'use client';

import { useState } from 'react';
import type { SocialMediaPost } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useFirestore, useUserProfile } from '@/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import {
  CheckCircle,
  XCircle,
  Loader2,
  Download,
  Copy,
  Calendar,
  Clock,
  Instagram,
} from 'lucide-react';
import Image from 'next/image';
import { ScrollArea } from '../ui/scroll-area';
import { format } from 'date-fns';
import { parseISO } from 'date-fns';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';

interface SocialPostDialogProps {
  post: SocialMediaPost;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusColors: Record<string, string> = {
    Draft: 'bg-gray-400 border-gray-400',
    'Needs Approval': 'bg-yellow-400 border-yellow-400 text-yellow-900',
    Scheduled: 'bg-blue-500 border-blue-500',
    Posted: 'bg-green-500 border-green-500',
    Error: 'bg-red-500 border-red-500',
};

const platformIcons: Record<string, React.ElementType> = {
    Instagram: Instagram,
};

export function SocialPostDialog({
  post,
  open,
  onOpenChange,
}: SocialPostDialogProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const firestore = useFirestore();
  const { profile } = useUserProfile();
  const { toast } = useToast();

  const handleUpdateStatus = async (newStatus: SocialMediaPost['status']) => {
    if (!firestore) return;
    setIsUpdating(true);

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
      onOpenChange(false);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: error.message || 'Could not update the post status.',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Caption Copied!', description: 'The post caption has been copied to your clipboard.' });
  };

  const canApprove = profile?.role === 'Manager' || profile?.role === 'Super Admin';
  const PlatformIcon = platformIcons[post.platform];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl grid-rows-[auto_minmax(0,1fr)_auto] p-0 max-h-[90vh]">
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-4">
             <Badge variant="outline" className={cn('flex items-center gap-2 text-base', statusColors[post.status])}>
                <div className="h-2 w-2 rounded-full bg-current"></div>
                {post.status}
            </Badge>
            Review Post for Instagram
          </DialogTitle>
        </DialogHeader>

        <div className="grid md:grid-cols-2 h-full overflow-hidden">
            <div className="relative h-full min-h-[300px] md:min-h-0">
                <Image src={post.mediaUrl} alt="Post media" layout="fill" className="object-contain" />
            </div>
            <ScrollArea className="md:border-l">
                <div className="p-6 space-y-6">
                    <div>
                        <h3 className="font-semibold mb-2">Caption</h3>
                        <div className="relative p-4 bg-secondary/50 rounded-md text-sm whitespace-pre-wrap">
                            {post.caption}
                            <Button size="icon" variant="ghost" className="absolute top-2 right-2 h-7 w-7" onClick={() => copyToClipboard(post.caption)}>
                                <Copy className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                    <div className="space-y-4">
                         <h3 className="font-semibold mb-2">Details</h3>
                         <div className="flex items-center gap-4 text-sm">
                            <PlatformIcon className="h-5 w-5 text-muted-foreground"/>
                            <span className='font-medium'>Platform:</span>
                            <span>{post.platform}</span>
                         </div>
                         <div className="flex items-center gap-4 text-sm">
                            <Calendar className="h-5 w-5 text-muted-foreground"/>
                            <span className='font-medium'>Scheduled Date:</span>
                            <span>{format(parseISO(post.scheduledAt), 'PPP')}</span>
                         </div>
                         <div className="flex items-center gap-4 text-sm">
                            <Clock className="h-5 w-5 text-muted-foreground"/>
                            <span className='font-medium'>Scheduled Time:</span>
                            <span>{format(parseISO(post.scheduledAt), 'p')}</span>
                         </div>
                    </div>
                     <div className="space-y-4">
                         <h3 className="font-semibold mb-2">Actions</h3>
                         <Button asChild variant="outline" className="w-full justify-start">
                            <a href={post.mediaUrl} target="_blank" download>
                                <Download className="mr-2 h-4 w-4" />
                                Download Media
                            </a>
                        </Button>
                    </div>
                </div>
            </ScrollArea>
        </div>
        
        <DialogFooter className="p-6 border-t flex justify-between w-full">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
            {canApprove && post.status === 'Needs Approval' && (
                <div className='flex gap-2'>
                    <Button variant="destructive" onClick={() => handleUpdateStatus('Draft')} disabled={isUpdating}>
                        {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <XCircle className="mr-2 h-4 w-4" />}
                        Reject
                    </Button>
                    <Button variant="default" className='bg-green-600 hover:bg-green-700' onClick={() => handleUpdateStatus('Scheduled')} disabled={isUpdating}>
                        {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <CheckCircle className="mr-2 h-4 w-4" />}
                        Approve & Schedule
                    </Button>
                </div>
            )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


'use client';
import type { SocialMediaPost } from '@/lib/types';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { Instagram, FileText, Clapperboard, RefreshCcw, AlertTriangle, HelpCircle, CheckCircle, Clock } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { AddSocialMediaPostDialog as CreatePostDialog } from '@/components/social-media/add-post-dialog';
import { useState } from 'react';
import { SocialMediaPostDetailsSheet } from './social-media-details-sheet';

interface SocialPostCardProps {
  post: SocialMediaPost;
}

const platformIcons: Record<string, React.ElementType> = {
    Instagram: Instagram,
};

const statusConfig: Record<string, { color: string; icon: React.ElementType, label: string }> = {
    Draft: { color: 'bg-gray-400 border-gray-400 text-white', icon: HelpCircle, label: 'Draft' },
    'Needs Approval': { color: 'bg-yellow-500 border-yellow-500 text-yellow-900', icon: HelpCircle, label: 'Needs Approval' },
    'Needs Revision': { color: 'bg-orange-500 border-orange-500 text-white', icon: RefreshCcw, label: 'Needs Revision' },
    Scheduled: { color: 'bg-blue-500 border-blue-500 text-white', icon: Clock, label: 'Scheduled' },
    Publishing: { color: 'bg-blue-400 border-blue-400 text-white animate-pulse', icon: HelpCircle, label: 'Publishing' },
    Posted: { color: 'bg-green-500 border-green-500 text-white', icon: CheckCircle, label: 'Posted' },
    Error: { color: 'bg-red-500 border-red-500 text-white', icon: AlertTriangle, label: 'Error' },
    // Add new statuses from workflow
    'To Do': { color: 'bg-gray-400 border-gray-400 text-white', icon: HelpCircle, label: 'To Do' },
    'Doing': { color: 'bg-blue-500 border-blue-500 text-white', icon: Clock, label: 'Doing' },
    'Preview': { color: 'bg-purple-500 border-purple-500 text-white', icon: Instagram, label: 'Preview' },
    'Revisi': { color: 'bg-orange-500 border-orange-500 text-white', icon: RefreshCcw, label: 'Revisi' },
    'Done': { color: 'bg-green-500 border-green-500 text-white', icon: CheckCircle, label: 'Done' },
};

const StatusIcon = ({ status }: { status: SocialMediaPost['status'] }) => {
    const Icon = statusConfig[status]?.icon || HelpCircle;
    return <Icon className="h-2 w-2" />;
};


export function SocialPostCard({ post }: SocialPostCardProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const statusStyling = statusConfig[post.statusInternal || post.status] || statusConfig['Draft'];
  
  const revisionCycleNumber = (post.revisionHistory?.length || 0) + 1;
  const imageStyle: React.CSSProperties | undefined = post.crop
    ? {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        transform: `translate(${post.crop.x}px, ${post.crop.y}px) scale(${post.crop.zoom})`,
        transformOrigin: 'center center',
      }
    : { objectFit: 'cover' };
    
  const cleanCaption = (html: string | undefined): string => {
      if (!html) return '';
      // This regex removes all HTML tags
      return html.replace(/<[^>]*>?/gm, '');
  };

  const handleOpenChange = (open: boolean) => {
    if (open) {
        setIsDialogOpen(true);
    } else {
        setIsDialogOpen(false);
    }
  };


  return (
    <>
      <div onClick={() => setIsDialogOpen(true)}>
        <Card 
          className="overflow-hidden shadow-md hover:shadow-xl transition-shadow duration-200 cursor-pointer group bg-card"
        >
          <CardContent className="p-3 space-y-2">
             <div className="flex items-start justify-between">
                <p className="font-semibold text-sm line-clamp-2">{post.title}</p>
                 {post.mediaUrl ? (
                    <div className="relative aspect-square w-14 h-14 shrink-0 ml-2 rounded-md overflow-hidden bg-secondary">
                        <img src={post.mediaUrl} alt="media preview" style={imageStyle} className="w-full h-full object-cover"/>
                    </div>
                ) : null}
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2">
                {cleanCaption(post.caption)}
            </p>
          </CardContent>
          <CardFooter className="p-3 flex justify-between items-center bg-card border-t">
            <Badge variant="outline" className={cn('flex items-center gap-1.5 text-xs font-medium', statusStyling.color)}>
                <StatusIcon status={post.statusInternal || post.status} />
                <span>{statusStyling.label}</span>
            </Badge>
            {post.scheduledAt && (
                <span className="text-xs font-semibold text-muted-foreground">
                    {format(parseISO(post.scheduledAt), 'MMM d, p')}
                </span>
            )}
          </CardFooter>
        </Card>
      </div>
      {isDialogOpen && (
        <SocialMediaPostDetailsSheet 
            post={post}
            open={isDialogOpen} 
            onOpenChange={handleOpenChange}
        />
      )}
    </>
  );
}

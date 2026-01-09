
'use client';
import type { SocialMediaPost } from '@/lib/types';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { Instagram, FileText, Clapperboard, RefreshCcw, AlertTriangle, HelpCircle, CheckCircle, Clock } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { CreatePostDialog } from './create-post-dialog';
import { useState } from 'react';

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
};

const StatusIcon = ({ status }: { status: SocialMediaPost['status'] }) => {
    const Icon = statusConfig[status]?.icon || HelpCircle;
    return <Icon className="h-2 w-2" />;
};


export function SocialPostCard({ post }: SocialPostCardProps) {
  const PlatformIcon = platformIcons[post.platform];
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const statusStyling = statusConfig[post.status] || statusConfig['Draft'];
  
  const revisionCycleNumber = (post.revisionHistory?.length || 0) + 1;

  return (
    <>
      <div onClick={() => setIsDialogOpen(true)}>
        <Card 
          className="overflow-hidden shadow-md hover:shadow-xl transition-shadow duration-200 cursor-pointer group"
        >
          <CardContent className="p-0">
            <div className="relative aspect-square w-full">
                {post.mediaUrl ? (
                    <Image src={post.mediaUrl} alt={post.caption.substring(0, 30)} fill className="object-cover group-hover:scale-105 transition-transform duration-300" style={{ objectPosition: `center ${post.objectPosition || 50}%` }}/>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full bg-secondary text-muted-foreground p-2">
                        <FileText className="h-6 w-6 mb-1" />
                        <p className="text-xs text-center line-clamp-3">{post.caption}</p>
                    </div>
                )}

                <div className="absolute inset-0 bg-black/10 group-hover:bg-black/30 transition-colors duration-300"></div>
                <div className="absolute top-2 right-2 flex items-center gap-2">
                    {post.postType === 'Reels' && (
                         <Badge variant="secondary" className="bg-black/50 text-white backdrop-blur-sm">
                            <Clapperboard className="h-3 w-3" />
                         </Badge>
                    )}
                    {PlatformIcon && (
                        <Badge variant="secondary" className="bg-background/70 backdrop-blur-sm">
                            <PlatformIcon className="h-4 w-4" />
                        </Badge>
                    )}
                </div>
                 {post.status === 'Needs Revision' && (
                    <div className="absolute bottom-2 left-2">
                        <Badge className="bg-orange-500 text-white">
                           Rev {revisionCycleNumber-1}
                        </Badge>
                    </div>
                )}
            </div>
          </CardContent>
          <CardFooter className="p-2 flex justify-between items-center bg-background/80">
            <Badge variant="outline" className={cn('flex items-center gap-1.5 text-xs', statusStyling.color)}>
                <StatusIcon status={post.status} />
                <span className="font-medium">{statusStyling.label}</span>
            </Badge>
            <span className="text-xs font-semibold text-muted-foreground">
                {format(parseISO(post.scheduledAt), 'p')}
            </span>
          </CardFooter>
        </Card>
      </div>
      {isDialogOpen && (
        <CreatePostDialog 
            open={isDialogOpen} 
            onOpenChange={setIsDialogOpen}
            post={post}
        />
      )}
    </>
  );
}

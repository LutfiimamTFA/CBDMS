
'use client';
import type { SocialMediaPost } from '@/lib/types';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { Instagram, FileText } from 'lucide-react';
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

const statusColors: Record<string, string> = {
    Draft: 'bg-gray-400 border-gray-400 text-white',
    'Needs Approval': 'bg-yellow-400 border-yellow-400 text-yellow-900',
    Scheduled: 'bg-blue-500 border-blue-500 text-white',
    Posted: 'bg-green-500 border-green-500 text-white',
    Error: 'bg-red-500 border-red-500 text-white',
};

export function SocialPostCard({ post }: SocialPostCardProps) {
  const PlatformIcon = platformIcons[post.platform];
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <>
      <div onClick={() => setIsDialogOpen(true)}>
        <Card 
          className="overflow-hidden shadow-md hover:shadow-xl transition-shadow duration-200 cursor-pointer group"
        >
          <CardContent className="p-0">
            <div className="relative aspect-square w-full">
                {post.mediaUrl ? (
                    <Image src={post.mediaUrl} alt={post.caption.substring(0, 30)} fill className="object-cover group-hover:scale-105 transition-transform duration-300" />
                ) : (
                    <div className="flex flex-col items-center justify-center h-full bg-secondary text-muted-foreground p-2">
                        <FileText className="h-6 w-6 mb-1" />
                        <p className="text-xs text-center line-clamp-3">{post.caption}</p>
                    </div>
                )}

                <div className="absolute inset-0 bg-black/10 group-hover:bg-black/30 transition-colors duration-300"></div>
                <div className="absolute top-2 right-2 flex items-center gap-2">
                    {PlatformIcon && (
                        <Badge variant="secondary" className="bg-background/70 backdrop-blur-sm">
                            <PlatformIcon className="h-4 w-4" />
                        </Badge>
                    )}
                </div>
            </div>
          </CardContent>
          <CardFooter className="p-2 flex justify-between items-center bg-background/80">
            <Badge variant="outline" className={cn('flex items-center gap-1.5 text-xs', statusColors[post.status])}>
                <div className="h-2 w-2 rounded-full bg-current"></div>
                <span className="font-medium">{post.status}</span>
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


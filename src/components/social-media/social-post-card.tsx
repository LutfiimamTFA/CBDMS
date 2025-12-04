'use client';
import type { SocialMediaPost } from '@/lib/types';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { Instagram } from 'lucide-react';
import { format } from 'date-fns';
import { parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

interface SocialPostCardProps {
  post: SocialMediaPost;
}

const platformIcons: Record<string, React.ElementType> = {
    Instagram: Instagram,
};

const statusColors: Record<string, string> = {
    Draft: 'bg-gray-500',
    'Needs Approval': 'bg-yellow-500',
    Scheduled: 'bg-blue-500',
    Posted: 'bg-green-500',
    Error: 'bg-red-500',
};

export function SocialPostCard({ post }: SocialPostCardProps) {
  const PlatformIcon = platformIcons[post.platform];

  return (
    <Card className="overflow-hidden shadow-md hover:shadow-xl transition-shadow duration-200 cursor-pointer">
      <CardContent className="p-0">
        <div className="relative aspect-square w-full">
            <Image src={post.mediaUrl} alt={post.caption.substring(0, 30)} fill className="object-cover" />
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
        <Badge variant="secondary" className='flex items-center gap-2'>
            <div className={cn("h-2 w-2 rounded-full", statusColors[post.status])}></div>
            <span className="text-xs font-medium">{post.status}</span>
        </Badge>
        <span className="text-xs font-semibold text-muted-foreground">
            {format(parseISO(post.scheduledAt), 'p')}
        </span>
      </CardFooter>
    </Card>
  );
}

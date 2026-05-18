'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Heart, MessageCircle, PlayCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface InstagramMedia {
  id: string;
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  media_url: string;
  thumbnail_url?: string;
  permalink: string;
  caption?: string;
  timestamp: string;
  username: string;
  comments_count: number;
  like_count: number;
}

interface PublishedPostCardProps {
  post: InstagramMedia;
}

export function PublishedPostCard({ post }: PublishedPostCardProps) {
  const mediaUrl = post.media_type === 'VIDEO' ? post.thumbnail_url : post.media_url;

  return (
    <Card className="overflow-hidden group relative">
      <Link href={post.permalink} target="_blank" rel="noopener noreferrer">
        <div className="aspect-square w-full bg-muted">
          {mediaUrl && (
            <Image
              src={mediaUrl}
              alt={post.caption || 'Instagram Post'}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          )}
        </div>
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center p-4">
          <div className="flex items-center gap-6 text-white font-bold">
            <div className="flex items-center gap-2">
              <Heart className="h-5 w-5" />
              <span>{post.like_count.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              <span>{post.comments_count.toLocaleString()}</span>
            </div>
          </div>
        </div>
        {post.media_type === 'VIDEO' && (
            <div className="absolute top-2 right-2 bg-black/50 p-1.5 rounded-full">
                <PlayCircle className="h-5 w-5 text-white" />
            </div>
        )}
      </Link>
    </Card>
  );
}

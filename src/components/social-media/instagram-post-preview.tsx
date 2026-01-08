
'use client';

import React from 'react';
import Image from 'next/image';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal, FileText, PlayCircle, Clapperboard, Video } from 'lucide-react';
import type { SocialMediaPost } from '@/lib/types';
import { cn } from '@/lib/utils';
import Cropper from 'react-easy-crop';


interface InstagramPostPreviewProps {
    profileName?: string;
    profileImageUrl?: string;
    mediaUrl?: string | null;
    mediaType?: 'image' | 'video';
    caption?: string;
    postType?: 'Post' | 'Reels';
    aspect?: '1:1' | '4:5' | '1.91:1' | '9:16';
    crop?: { x: number; y: number; };
    zoom?: number;
    objectPosition?: number;
}

export function InstagramPostPreview({ 
    profileName = 'Username', 
    profileImageUrl, 
    mediaUrl, 
    mediaType = 'image',
    caption,
    postType = 'Post',
    aspect = '4:5',
    crop = { x: 0, y: 0 },
    zoom = 1,
    objectPosition, // Fallback for old data
}: InstagramPostPreviewProps) {
  
  const formatCaption = (text = '') => {
    const hashtags = text.match(/#\w+/g) || [];
    const mentions = text.match(/@\w+/g) || [];
    let formattedText = text;

    hashtags.forEach(tag => {
      formattedText = formattedText.replace(tag, `<span class="text-blue-500">${tag}</span>`);
    });
    mentions.forEach(mention => {
      formattedText = formattedText.replace(mention, `<span class="text-blue-500">${mention}</span>`);
    });

    return formattedText;
  };
  
  const aspectRatios = {
    '1:1': 'aspect-square',
    '4:5': 'aspect-[4/5]',
    '1.91:1': 'aspect-[1.91/1]',
    '9:16': 'aspect-[9/16]',
  };

  const finalAspect = postType === 'Reels' ? '9:16' : (aspect || '4:5');
  
  const mediaStyle: React.CSSProperties = crop 
    ? { transform: `translate3d(${-crop.x}px, ${-crop.y}px, 0) scale(${zoom})`, width: '100%', height: '100%', objectFit: 'cover' }
    : { objectFit: 'cover', objectPosition: `center ${objectPosition}%` };

  return (
    <div className="w-full max-w-[320px] bg-white dark:bg-black border border-zinc-300 dark:border-zinc-700 rounded-lg overflow-hidden shadow-xl">
      {/* Header */}
      <div className="flex items-center p-3">
        <Avatar className="h-8 w-8">
          <AvatarImage src={profileImageUrl} />
          <AvatarFallback>{profileName.charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
        <p className="ml-3 font-semibold text-sm text-zinc-900 dark:text-zinc-100">{profileName}</p>
        <MoreHorizontal className="ml-auto h-5 w-5 text-zinc-900 dark:text-zinc-100" />
      </div>

      {/* Media */}
      <div className={cn(
          "relative w-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden",
          aspectRatios[finalAspect]
      )}>
        {mediaUrl ? (
          mediaType === 'image' ? (
            <Image src={mediaUrl} layout="fill" alt="Post preview" style={mediaStyle} />
          ) : (
            <video src={mediaUrl} controls muted className="w-full h-full object-cover" />
          )
        ) : (
            <div className="flex items-center justify-center h-full">
                <FileText className="h-16 w-16 text-zinc-400 dark:text-zinc-600" />
            </div>
        )}
        {postType === 'Reels' && (
             <Clapperboard className="absolute top-2 right-2 h-5 w-5 text-white bg-black/30 p-1 rounded" />
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center p-3 space-x-4">
        <Heart className="h-6 w-6 text-zinc-900 dark:text-zinc-100" />
        <MessageCircle className="h-6 w-6 text-zinc-900 dark:text-zinc-100" />
        <Send className="h-6 w-6 text-zinc-900 dark:text-zinc-100" />
        <Bookmark className="ml-auto h-6 w-6 text-zinc-900 dark:text-zinc-100" />
      </div>

      {/* Likes */}
      <div className="px-3">
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">1,234 likes</p>
      </div>

      {/* Caption */}
      <div className="p-3 text-sm text-zinc-900 dark:text-zinc-100">
        <p>
          <span className="font-semibold">{profileName}</span>{' '}
          <span dangerouslySetInnerHTML={{ __html: formatCaption(caption) }} />
        </p>
        <p className="text-zinc-500 dark:text-zinc-400 mt-2 text-xs">View all 56 comments</p>
      </div>

       {/* Timestamp */}
      <div className="px-3 pb-3">
          <p className="text-zinc-500 dark:text-zinc-400 text-[10px] uppercase">1 HOUR AGO</p>
      </div>
    </div>
  );
}

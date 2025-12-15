
'use client';

import React from 'react';
import Image from 'next/image';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal, FileText, PlayCircle } from 'lucide-react';
import type { SocialMediaPost } from '@/lib/types';

interface InstagramPostPreviewProps {
    profileName?: string;
    profileImageUrl?: string;
    mediaUrl?: string | null;
    mediaType?: 'image' | 'video';
    caption?: string;
    objectPosition?: SocialMediaPost['objectPosition'];
}

export function InstagramPostPreview({ 
    profileName = 'Username', 
    profileImageUrl, 
    mediaUrl, 
    mediaType = 'image',
    caption,
    objectPosition = 'center',
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
  
  const imageStyle: React.CSSProperties = {
      objectPosition: objectPosition,
  };

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
      <div className="relative aspect-square w-full bg-zinc-200 dark:bg-zinc-800">
        {mediaUrl ? (
          mediaType === 'image' ? (
            <Image src={mediaUrl} layout="fill" objectFit="cover" alt="Post preview" style={imageStyle} />
          ) : (
            <>
              <video src={mediaUrl} loop autoPlay muted className="w-full h-full object-cover" />
            </>
          )
        ) : (
            <div className="flex items-center justify-center h-full">
                <FileText className="h-16 w-16 text-zinc-400 dark:text-zinc-600" />
            </div>
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

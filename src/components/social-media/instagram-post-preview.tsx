'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal, Camera, Music2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';
import Cropper from 'react-easy-crop';

const aspectRatios: Record<string, string> = {
  '1:1': 'aspect-square',
  '4:5': 'aspect-[4/5]',
  '1.91:1': 'aspect-[1.91/1]',
  '9:16': 'aspect-[9/16]',
};

interface MediaFrameProps {
  mediaUrl: string | null;
  mediaType: 'image' | 'video' | null;
  aspect: '1:1' | '4:5' | '1.91:1' | '9:16';
  crop: { x: number; y: number };
  zoom: number;
  isEditable?: boolean;
  onCropChange?: (location: {x: number, y: number}) => void;
  onZoomChange?: (zoom: number) => void;
}

function MediaFrame({ 
  mediaUrl, 
  mediaType, 
  aspect, 
  crop, 
  zoom, 
  isEditable,
  onCropChange,
  onZoomChange
}: MediaFrameProps) {

  if (process.env.NODE_ENV === 'development' && mediaType && !mediaUrl) {
    console.warn("InstagramPostPreview DEV-ONLY warning: 'mediaType' is set but 'mediaUrl' is missing. The preview will be blank.");
  }
  
  if (!mediaUrl) {
    return (
      <div className={cn("w-full flex flex-col items-center justify-center bg-zinc-800 text-zinc-600 rounded-lg", aspectRatios[aspect])}>
          <Camera className="h-16 w-16" />
          <p className="mt-2 text-sm">No media selected</p>
      </div>
    );
  }

  if (mediaType === 'video') {
    return (
      <div className={cn("relative w-full overflow-hidden rounded-lg", aspectRatios[aspect])}>
        <video key={mediaUrl} src={mediaUrl} controls muted playsInline className="w-full h-full object-contain" />
      </div>
    );
  }

  // Image type
  if (isEditable && onCropChange && onZoomChange) {
     return (
        <div className={cn("relative w-full rounded-lg", aspectRatios[aspect])}>
            <Cropper
                image={mediaUrl}
                crop={crop}
                zoom={zoom}
                aspect={finalAspectToNumber(aspect)}
                onCropChange={onCropChange}
                onZoomChange={onZoomChange}
                objectFit="contain"
            />
        </div>
     )
  }

  const imageStyle: React.CSSProperties = {
    transform: `translate(${crop.x}px, ${crop.y}px) scale(${zoom})`,
    transformOrigin: 'top left',
  };

  return (
    <div className={cn("relative w-full overflow-hidden rounded-lg", aspectRatios[aspect])}>
      <div style={{ width: '100%', height: '100%', position: 'relative' }}>
          <img src={mediaUrl} alt="Post preview" style={{...imageStyle, position: 'absolute', width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    </div>
  );
}


const finalAspectToNumber = (aspect: string) => {
    switch(aspect) {
        case '1:1': return 1;
        case '4:5': return 4/5;
        case '1.91:1': return 1.91/1;
        case '9:16': return 9/16;
        default: return 4/5;
    }
}

interface InstagramPostPreviewProps {
    mode: 'instagram' | 'editor';
    profileName?: string;
    profileImageUrl?: string;
    mediaUrl?: string | null;
    mediaType?: 'image' | 'video' | null;
    caption?: string;
    postType?: 'Post' | 'Reels';
    aspect?: '1:1' | '4:5' | '1.91:1' | '9:16';
    crop?: { x: number; y: number };
    zoom?: number;
    isEditable?: boolean;
    onCropChange?: (location: {x: number, y: number}) => void;
    onZoomChange?: (zoom: number) => void;
}

export function InstagramPostPreview({ 
    mode = 'instagram',
    profileName = 'Username', 
    profileImageUrl, 
    mediaUrl, 
    mediaType,
    caption,
    postType = 'Post',
    aspect = '4:5',
    crop = { x: 0, y: 0 },
    zoom = 1,
    isEditable = false,
    onCropChange,
    onZoomChange
}: InstagramPostPreviewProps) {
  
  const formatCaption = (text = '') => {
    const hashtags = text.match(/#\w+/g) || [];
    const mentions = text.match(/@\w+/g) || [];
    let formattedText = text;

    hashtags.forEach(tag => {
      formattedText = formattedText.replace(tag, `<span class="text-blue-400">${tag}</span>`);
    });
    mentions.forEach(mention => {
      formattedText = formattedText.replace(mention, `<span class="text-blue-400">${mention}</span>`);
    });

    return formattedText;
  };
  
  const finalAspect = postType === 'Reels' ? '9:16' : (aspect || '4:5');
  
  const mediaFrame = (
      <MediaFrame
          mediaUrl={mediaUrl}
          mediaType={mediaType}
          aspect={finalAspect}
          crop={crop}
          zoom={zoom}
          isEditable={isEditable}
          onCropChange={onCropChange}
          onZoomChange={onZoomChange}
      />
  );

  if (mode === 'editor') {
    return mediaFrame;
  }

  if (postType === 'Reels') {
    return (
      <div className={cn("w-full max-w-[280px] bg-black border border-zinc-700 rounded-2xl overflow-hidden shadow-xl text-white relative", aspectRatios[finalAspect])}>
        <div className="absolute inset-0">
          {mediaFrame}
        </div>
        <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between bg-gradient-to-b from-black/50 to-transparent">
          <span className="font-bold text-lg">Reels</span>
          <Camera className="h-6 w-6" />
        </div>
        <div className="absolute bottom-0 right-0 p-3 flex flex-col items-center gap-5">
            <div className="flex flex-col items-center gap-1"><Heart className="h-7 w-7" /><span className="text-xs font-semibold">12.3k</span></div>
            <div className="flex flex-col items-center gap-1"><MessageCircle className="h-7 w-7" /><span className="text-xs font-semibold">456</span></div>
            <div className="flex flex-col items-center gap-1"><Send className="h-7 w-7" /></div>
            <MoreHorizontal className="h-7 w-7 mt-2" />
            <div className="h-8 w-8 rounded-md border-2 border-white bg-zinc-500 overflow-hidden mt-2"><Music2 className="h-full w-full p-1"/></div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/60 to-transparent">
            <div className="flex items-center gap-2">
                <Avatar className="h-7 w-7"><AvatarImage src={profileImageUrl} /><AvatarFallback>{profileName.charAt(0).toUpperCase()}</AvatarFallback></Avatar>
                <p className="font-semibold text-sm">{profileName}</p>
                <Button variant="outline" size="sm" className="h-7 px-3 text-xs bg-transparent border-white text-white">Follow</Button>
            </div>
             <div className="mt-2 text-sm text-white"><p className="line-clamp-2" dangerouslySetInnerHTML={{ __html: formatCaption(caption) }} /></div>
            <div className="flex items-center gap-2 mt-2 text-xs"><Music2 className="h-3 w-3"/><p className="truncate">{profileName} • Original audio</p></div>
        </div>
      </div>
    )
  }

  // STANDARD POST PREVIEW
  return (
    <div className="w-full max-w-[320px] bg-white dark:bg-black border border-zinc-300 dark:border-zinc-700 rounded-none overflow-hidden shadow-xl">
      <div className="flex items-center p-3">
        <Avatar className="h-8 w-8"><AvatarImage src={profileImageUrl} /><AvatarFallback>{profileName.charAt(0).toUpperCase()}</AvatarFallback></Avatar>
        <p className="ml-3 font-semibold text-sm text-zinc-900 dark:text-zinc-100">{profileName}</p>
        <MoreHorizontal className="ml-auto h-5 w-5 text-zinc-900 dark:text-zinc-100" />
      </div>
      {mediaFrame}
      <div className="flex items-center p-3 space-x-4">
        <Heart className="h-6 w-6 text-zinc-900 dark:text-zinc-100" />
        <MessageCircle className="h-6 w-6 text-zinc-900 dark:text-zinc-100" />
        <Send className="h-6 w-6 text-zinc-900 dark:text-zinc-100" />
        <Bookmark className="ml-auto h-6 w-6 text-zinc-900 dark:text-zinc-100" />
      </div>
      <div className="px-3"><p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">1,234 likes</p></div>
      <div className="p-3 text-sm text-zinc-900 dark:text-zinc-100">
        <p><span className="font-semibold">{profileName}</span>{' '}
          <span dangerouslySetInnerHTML={{ __html: formatCaption(caption) }} />
        </p>
        <p className="text-zinc-500 dark:text-zinc-400 mt-2 text-xs">View all 56 comments</p>
      </div>
       <div className="px-3 pb-3"><p className="text-zinc-500 dark:text-zinc-400 text-[10px] uppercase">1 HOUR AGO</p></div>
    </div>
  );
}

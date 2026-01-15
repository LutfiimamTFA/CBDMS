'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { SocialMediaPostDetailsSheet } from '@/components/social-media/social-media-details-sheet';
import { notFound, useRouter, useParams } from 'next/navigation';
import type { SocialMediaPost } from '@/lib/types';
import { useDoc, useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';

export default function SocialMediaPostPage() {
  const router = useRouter();
  const params = useParams() as { id: string };
  
  const [isOpen, setIsOpen] = useState(true);
  const firestore = useFirestore();

  const postRef = useMemo(() => {
    if (!firestore || !params.id) return null;
    return doc(firestore, 'socialMediaPosts', params.id);
  }, [firestore, params.id]);

  const { data: post, isLoading, error } = useDoc<SocialMediaPost>(postRef);

  useEffect(() => {
    if (!isLoading && (!post || error)) {
      notFound();
    }
  }, [isLoading, post, error]);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      router.back();
    }
  };

  if (isLoading || !post) {
    return (
      <div className="flex h-svh items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-svh w-full bg-background">
        <SocialMediaPostDetailsSheet
            post={post} 
            open={isOpen}
            onOpenChange={handleOpenChange}
        />
    </div>
  );
}
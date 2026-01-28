'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { WebArticleDetailsSheet } from '@/components/web/web-article-details-sheet';
import { notFound, useRouter, useParams } from 'next/navigation';
import type { WebArticle } from '@/lib/types';
import { useDoc, useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';

export default function WebArticlePage() {
  const router = useRouter();
  const params = useParams() as { id: string };
  
  const [isOpen, setIsOpen] = useState(true);
  const firestore = useFirestore();

  const articleRef = useMemo(() => {
    if (!firestore || !params.id) return null;
    return doc(firestore, 'webArticles', params.id);
  }, [firestore, params.id]);

  const { data: article, isLoading, error } = useDoc<WebArticle>(articleRef);

  useEffect(() => {
    if (!isLoading && (!article || error)) {
      notFound();
    }
  }, [isLoading, article, error]);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      router.back();
    }
  };

  if (isLoading || !article) {
    return (
      <div className="flex h-svh items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-svh w-full bg-background">
        <WebArticleDetailsSheet
            article={article} 
            open={isOpen}
            onOpenChange={handleOpenChange}
        />
    </div>
  );
}

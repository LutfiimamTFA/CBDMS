'use client';

import React, { useMemo } from 'react';
import { useCollection, useFirestore, useUserProfile } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { SocialMediaPost } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { ImpressionsCard } from '@/components/social-media/impressions-card';
import { PostTypeChart } from '@/components/social-media/post-type-chart';
import { EngagementCard } from '@/components/social-media/engagement-card';
import { PostPerformanceChart } from '@/components/social-media/post-performance-chart';

export default function SocialMediaAnalyticsPage() {
  const firestore = useFirestore();
  const { profile } = useUserProfile();

  const postsQuery = useMemo(() => {
    if (!firestore || !profile) return null;
    return query(
      collection(firestore, 'socialMediaPosts'),
      where('companyId', '==', profile.companyId)
    );
  }, [firestore, profile]);

  const { data: posts, isLoading: postsLoading } = useCollection<SocialMediaPost>(postsQuery);

  if (postsLoading) {
    return (
      <div className="flex h-svh flex-col bg-background">
        <main className="flex-1 overflow-auto p-4 md:p-6 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-svh flex-col bg-background">
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold tracking-tight">Content Performance</h2>
          <p className="text-muted-foreground">
            An overview of your content pipeline and simulated performance metrics.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-6">
          <ImpressionsCard />
          <PostTypeChart posts={posts || []} />
          <EngagementCard />
          <div className="flex items-center justify-center rounded-lg border-2 border-dashed">
            <Button variant="ghost" className="text-muted-foreground">
                <Plus className="mr-2 h-4 w-4"/>
                Add metric
            </Button>
          </div>
        </div>

        <PostPerformanceChart posts={posts || []} />
      </main>
    </div>
  );
}

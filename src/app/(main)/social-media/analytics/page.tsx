'use client';

import React, { useMemo } from 'react';
import { Header } from '@/components/layout/header';
import { useCollection, useFirestore, useUserProfile } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { SocialMediaPost } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PostStatusChart } from '@/components/social-media/post-status-chart';
import { PostsByPlatformChart } from '@/components/social-media/posts-by-platform-chart';

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

  const totalPosts = posts?.length || 0;
  const scheduledCount = posts?.filter(p => p.status === 'Scheduled').length || 0;
  const needsApprovalCount = posts?.filter(p => p.status === 'Needs Approval').length || 0;

  if (postsLoading) {
    return (
      <div className="flex h-svh flex-col bg-background">
        <Header title="Social Media Analytics" />
        <main className="flex-1 overflow-auto p-4 md:p-6 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-svh flex-col bg-background">
      <Header title="Social Media Analytics" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold tracking-tight">Content Performance</h2>
          <p className="text-muted-foreground">
            An internal overview of your content production pipeline.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Posts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalPosts}</div>
              <p className="text-xs text-muted-foreground">in the system</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Scheduled</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{scheduledCount}</div>
              <p className="text-xs text-muted-foreground">waiting to be published</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Needs Approval</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{needsApprovalCount}</div>
              <p className="text-xs text-muted-foreground">posts in review queue</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>Post Status Distribution</CardTitle>
              <CardDescription>Current status of all posts in the pipeline.</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px]">
              <PostStatusChart posts={posts || []} />
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Posts by Platform</CardTitle>
              <CardDescription>Content distribution across different social media platforms.</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px]">
              <PostsByPlatformChart posts={posts || []} />
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

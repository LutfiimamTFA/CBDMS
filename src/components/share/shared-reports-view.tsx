'use client';
import { Card, CardContent } from '@/components/ui/card';
import { ImpressionsCard } from '../social-media/impressions-card';
import { PostTypeChart } from '../social-media/post-type-chart';
import { EngagementCard } from '../social-media/engagement-card';
import { PostPerformanceChart } from '../social-media/post-performance-chart';
import { Button } from '../ui/button';
import { Plus } from 'lucide-react';
import type { SharedLink, SocialMediaPost } from '@/lib/types';

interface SharedReportsViewProps {
  session: SharedLink;
  posts: SocialMediaPost[] | null;
  isLoading: boolean;
}


export function SharedReportsView({ session, posts, isLoading }: SharedReportsViewProps) {
  return (
    <div className="flex flex-col flex-1 h-full w-full">
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

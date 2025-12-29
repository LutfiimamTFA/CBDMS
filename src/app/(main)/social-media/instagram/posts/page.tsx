'use client';

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, AlertCircle, Instagram } from 'lucide-react';
import { useAuth } from '@/firebase';
import { PublishedPostCard } from '@/components/social-media/published-post-card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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

export default function PublishedPostsPage() {
  const auth = useAuth();
  const [posts, setPosts] = useState<InstagramMedia[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPosts = useCallback(async () => {
    if (!auth?.currentUser) {
      setError('You must be logged in to sync posts.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch('/api/instagram/sync/posts', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch posts.');
      }
      const data = await response.json();
      setPosts(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [auth]);

  return (
    <div className="flex h-svh flex-col bg-background">
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Published Posts</h2>
            <p className="text-muted-foreground">
              Your live feed from Instagram. Click to view on Instagram.
            </p>
          </div>
          <Button onClick={fetchPosts} disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Sync with Instagram
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!isLoading && posts.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 text-center h-96">
            <Instagram className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">No posts synced yet</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Click the "Sync with Instagram" button to fetch your latest posts.
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {posts.map((post) => (
            <PublishedPostCard key={post.id} post={post} />
          ))}
        </div>
      </main>
    </div>
  );
}

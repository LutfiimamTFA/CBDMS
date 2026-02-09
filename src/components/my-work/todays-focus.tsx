
'use client';

import React, { useMemo } from 'react';
import { useCollection, useFirestore, useUserProfile } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Task, User, SocialMediaPost, WebArticle, WorkItem } from '@/lib/types';
import { Loader2, ClipboardList, Share2, Globe } from 'lucide-react';
import { isToday, isPast, parseISO } from 'date-fns';
import { useRouter } from 'next/navigation';
import { TaskCard } from '../tasks/task-card';
import { SocialPostCard } from '../social-media/social-post-card';
import { normalizeSocialPost } from '@/lib/social-media-utils';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

// Type guard to check if an item is a SocialMediaPost
function isSocialMediaPost(item: WorkItem): item is SocialMediaPost {
  return 'platform' in item && 'caption' in item;
}
function isWebArticle(item: WorkItem): item is WebArticle {
  return 'content' in item;
}


// A simple card for web articles, can be expanded later
function WebArticleCard({ article, allUsers }: { article: WebArticle, allUsers: User[] }) {
    const articleWithAssignees = useMemo(() => {
        const assignees = (article.assigneeIds || [])
            .map(id => allUsers.find(u => u.id === id))
            .filter((u): u is User => !!u);
        return { ...article, assignees };
    }, [article, allUsers]);
    
    return (
        <div>
            <TaskCard task={articleWithAssignees as Task} />
        </div>
    )
}

const getFocusItems = (items: WorkItem[] | null | undefined): WorkItem[] => {
    if (!items) return [];

    return items.filter(item => {
        const status = item.statusInternal || item.status;
        // Only filter out items that are explicitly 'Done' or 'Posted'
        if (status === 'Done' || status === 'Posted') {
            return false;
        }
        // Show all other actionable tasks (To Do, Doing, Revisi, Preview, etc.)
        return true;
    }).sort((a, b) => {
        const priorityOrder: Record<string, number> = { 'Urgent': 4, 'High': 3, 'Medium': 2, 'Low': 1, 'Default': 0 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
            return priorityOrder[b.priority] - priorityOrder[a.priority];
        }
        const dateA = a.dueDate || '9999';
        const dateB = b.dueDate || '9999';
        return parseISO(dateA).getTime() - parseISO(dateB).getTime();
    });
};


export function TodaysFocus() {
    const firestore = useFirestore();
    const { user, profile, isLoading: userLoading, companyId } = useUserProfile();
    const router = useRouter();

    const tasksQuery = useMemo(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, 'tasks'), where('assigneeIds', 'array-contains', user.uid));
    }, [firestore, user]);
    const { data: tasks, isLoading: tasksLoading } = useCollection<Task>(tasksQuery);

    const socialPostsQuery = useMemo(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, 'socialMediaPosts'), where('assigneeIds', 'array-contains', user.uid));
    }, [firestore, user]);
    const { data: rawSocialPosts, isLoading: socialPostsLoading } = useCollection<SocialMediaPost>(socialPostsQuery);
    
    const socialPosts = useMemo(() => {
        if (!rawSocialPosts || !profile) return [];
        return rawSocialPosts.map(post => normalizeSocialPost(post, profile));
    }, [rawSocialPosts, profile]);


    const webArticlesQuery = useMemo(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, 'webArticles'), where('assigneeIds', 'array-contains', user.uid));
    }, [firestore, user]);
    const { data: webArticles, isLoading: webArticlesLoading } = useCollection<WebArticle>(webArticlesQuery);
    
    const usersQuery = useMemo(() => {
        if (!firestore || !companyId) return null;
        return query(collection(firestore, 'users'), where('companyId', '==', companyId));
    }, [firestore, companyId]);
    const { data: allUsers, isLoading: usersLoading } = useCollection<User>(usersQuery);

    const todaysTasks = useMemo(() => getFocusItems(tasks), [tasks]);
    const todaysSocialPosts = useMemo(() => getFocusItems(socialPosts), [socialPosts]);
    const todaysWebArticles = useMemo(() => getFocusItems(webArticles), [webArticles]);

    const isLoading = userLoading || tasksLoading || socialPostsLoading || webArticlesLoading || usersLoading;

    const renderSection = (title: string, icon: React.ElementType, items: WorkItem[], emptyMessage: string) => (
      <Card>
          <CardHeader>
              <CardTitle className="flex items-center gap-3 text-xl">
                  {React.createElement(icon, { className: "h-6 w-6 text-primary" })}
                  {title}
                  {items.length > 0 && <Badge variant="secondary">{items.length}</Badge>}
              </CardTitle>
          </CardHeader>
          <CardContent>
              {items.length > 0 ? (
                  <div className="space-y-3">
                      {items.map(item => {
                          if (isSocialMediaPost(item)) {
                              return <SocialPostCard key={item.id} post={item as SocialMediaPost} allUsers={allUsers || []} />;
                          }
                          if (isWebArticle(item)) {
                              return <WebArticleCard key={item.id} article={item as WebArticle} allUsers={allUsers || []} />;
                          }
                          return <TaskCard key={item.id} task={item as Task} />;
                      })}
                  </div>
              ) : (
                  <div className="text-center py-8 px-4 border-2 border-dashed rounded-lg">
                      <p className="text-sm text-muted-foreground">{emptyMessage}</p>
                  </div>
              )}
          </CardContent>
      </Card>
    );

    if (isLoading) {
        return (
             <div className="flex justify-center items-center h-48">
                <Loader2 className="h-6 w-6 animate-spin"/>
            </div>
        )
    }

    return (
        <div className="space-y-8">
            <h3 className="text-xl font-bold tracking-tight mb-4">Today's Focus</h3>
            {renderSection("Project", ClipboardList, todaysTasks, "No regular tasks need your focus today. Great job!")}
            {renderSection("Social Media Posts", Share2, todaysSocialPosts, "No social media posts need your focus today.")}
            {renderSection("Web Articles", Globe, todaysWebArticles, "No web articles need your focus today.")}
        </div>
    );
}

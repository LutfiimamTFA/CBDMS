'use client';

import React, { useMemo } from 'react';
import { useCollection, useFirestore, useUserProfile } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Task, User, SocialMediaPost, WebArticle, WorkItem } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { isToday, isPast, parseISO } from 'date-fns';
import { useRouter } from 'next/navigation';
import { TaskCard } from '../tasks/task-card';
import { SocialPostCard } from '../social-media/social-post-card';

// Type guard to check if an item is a SocialMediaPost
function isSocialMediaPost(item: WorkItem): item is SocialMediaPost {
  return 'platform' in item && 'caption' in item;
}

// A simple card for web articles, can be expanded later
function WebArticleCard({ article, onClick }: { article: WebArticle, onClick: () => void }) {
    return (
        <div onClick={onClick}>
            <TaskCard task={article as Task} />
        </div>
    )
}

export function TodaysFocus() {
    const firestore = useFirestore();
    const { user, profile, isLoading: userLoading } = useUserProfile();
    const router = useRouter();

    // Query for Tasks
    const tasksQuery = useMemo(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, 'tasks'), where('assigneeIds', 'array-contains', user.uid));
    }, [firestore, user]);
    const { data: tasks, isLoading: tasksLoading } = useCollection<Task>(tasksQuery);

    // Query for Social Media Posts
    const socialPostsQuery = useMemo(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, 'socialMediaPosts'), where('assigneeIds', 'array-contains', user.uid));
    }, [firestore, user]);
    const { data: socialPosts, isLoading: socialPostsLoading } = useCollection<SocialMediaPost>(socialPostsQuery);

    // Query for Web Articles
    const webArticlesQuery = useMemo(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, 'webArticles'), where('assigneeIds', 'array-contains', user.uid));
    }, [firestore, user]);
    const { data: webArticles, isLoading: webArticlesLoading } = useCollection<WebArticle>(webArticlesQuery);
    
    const todaysWorkItems = useMemo(() => {
        const allItems = [...(tasks || []), ...(socialPosts || []), ...(webArticles || [])];

        return allItems.filter(item => {
            const status = item.statusInternal || item.status;
            if (status === 'Done' || status === 'Posted') return false;

            const dateField = isSocialMediaPost(item) ? item.scheduledAt : item.dueDate;
            const isDueToday = dateField && isToday(parseISO(dateField));
            const isOverdue = dateField && !isToday(parseISO(dateField)) && isPast(parseISO(dateField));
            const isInProgress = status === 'Doing';
            
            return isDueToday || isOverdue || isInProgress;
        }).sort((a, b) => {
            const priorityOrder = { 'Urgent': 4, 'High': 3, 'Medium': 2, 'Low': 1 };
            if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
                return priorityOrder[b.priority] - priorityOrder[a.priority];
            }
            const dateA = (isSocialMediaPost(a) ? a.scheduledAt : a.dueDate) || '9999';
            const dateB = (isSocialMediaPost(b) ? b.scheduledAt : b.dueDate) || '9999';
            return parseISO(dateA).getTime() - parseISO(dateB).getTime();
        });
    }, [tasks, socialPosts, webArticles]);

    const isLoading = userLoading || tasksLoading || socialPostsLoading || webArticlesLoading;
    
    const handleCardClick = (item: WorkItem) => {
        if (isSocialMediaPost(item)) {
            // SocialPostCard handles its own dialog, but we could navigate if needed
            // For now, we assume the card click is handled within the component itself.
        } else if ('content' in item) { // Web Article
             router.push(`/web/articles/${item.id}`);
        } else { // Task
            router.push(`/tasks/${item.id}`);
        }
    }

    return (
        <div>
            <h3 className="text-xl font-bold tracking-tight mb-4">Today's Focus</h3>
            {isLoading ? (
            <div className="flex justify-center items-center h-48">
                <Loader2 className="h-6 w-6 animate-spin"/>
            </div>
            ) : todaysWorkItems.length > 0 ? (
                <div className="space-y-3">
                    {todaysWorkItems.map(item => {
                        if (isSocialMediaPost(item)) {
                            return <SocialPostCard key={item.id} post={item} />;
                        }
                        if ('content' in item) { // Duck-typing for WebArticle
                            return <WebArticleCard key={item.id} article={item as WebArticle} onClick={() => handleCardClick(item)} />;
                        }
                        return <div key={item.id} onClick={() => handleCardClick(item)}><TaskCard task={item as Task} /></div>;
                    })}
                </div>
            ) : (
                <div className="text-center py-12 px-4 border-2 border-dashed rounded-lg">
                    <h4 className="text-lg font-semibold">All Clear!</h4>
                    <p className="text-sm text-muted-foreground mt-2">You have no overdue items or work scheduled for today. Great job staying on top of things!</p>
                </div>
            )}
        </div>
    );
}

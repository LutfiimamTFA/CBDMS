
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

const getFocusItems = (items: WorkItem[] | null | undefined): WorkItem[] => {
    if (!items) return [];

    return items.filter(item => {
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
};


export function TodaysFocus() {
    const firestore = useFirestore();
    const { user, profile, isLoading: userLoading } = useUserProfile();
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
    const { data: socialPosts, isLoading: socialPostsLoading } = useCollection<SocialMediaPost>(socialPostsQuery);

    const webArticlesQuery = useMemo(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, 'webArticles'), where('assigneeIds', 'array-contains', user.uid));
    }, [firestore, user]);
    const { data: webArticles, isLoading: webArticlesLoading } = useCollection<WebArticle>(webArticlesQuery);
    
    const todaysTasks = useMemo(() => getFocusItems(tasks), [tasks]);
    const todaysSocialPosts = useMemo(() => getFocusItems(socialPosts), [socialPosts]);
    const todaysWebArticles = useMemo(() => getFocusItems(webArticles), [webArticles]);

    const isLoading = userLoading || tasksLoading || socialPostsLoading || webArticlesLoading;
    
    const handleCardClick = (item: WorkItem) => {
        if (isSocialMediaPost(item)) {
            // Handled by SocialPostCard's internal dialog
        } else if ('content' in item) { // Web Article
             router.push(`/web/articles/${item.id}`);
        } else { // Task
            router.push(`/tasks/${item.id}`);
        }
    }

    const renderSection = (title: string, icon: React.ElementType, items: WorkItem[], emptyMessage: string) => (
        <div>
            <h3 className="text-xl font-bold tracking-tight mb-4 flex items-center gap-2">
                {React.createElement(icon, { className: "h-6 w-6 text-primary" })}
                {title}
            </h3>
            {items.length > 0 ? (
                <div className="space-y-3">
                    {items.map(item => {
                        if (isSocialMediaPost(item)) {
                            return <SocialPostCard key={item.id} post={item} />;
                        }
                        if ('content' in item) { // Web Article
                            return <WebArticleCard key={item.id} article={item as WebArticle} onClick={() => handleCardClick(item)} />;
                        }
                        return <div key={item.id} onClick={() => handleCardClick(item)}><TaskCard task={item as Task} /></div>;
                    })}
                </div>
            ) : (
                <div className="text-center py-8 px-4 border-2 border-dashed rounded-lg">
                    <p className="text-sm text-muted-foreground">{emptyMessage}</p>
                </div>
            )}
        </div>
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
            {renderSection("General Tasks", ClipboardList, todaysTasks, "Tidak ada tugas reguler yang perlu jadi fokus hari ini. Kerja bagus!")}
            {renderSection("Social Media Posts", Share2, todaysSocialPosts, "Tidak ada postingan sosial media yang perlu jadi fokus hari ini.")}
            {renderSection("Web Articles", Globe, todaysWebArticles, "Tidak ada artikel web yang perlu jadi fokus hari ini.")}
        </div>
    );
}


'use client';
import type { Task, WorkflowStatus, Brand, User, SharedLink, SocialMediaPost, WebArticle, WorkItem } from '@/lib/types';
import React, { useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { SharedTasksTable } from './shared-tasks-table';
import { TaskDetailsSheet } from '../tasks/task-details-sheet';
import { useParams, useRouter } from 'next/navigation';
import { SocialMediaPostDetailsSheet } from '../social-media/social-media-details-sheet';
import { WebArticleDetailsSheet } from '../web/web-article-details-sheet';
import { normalizeSocialPost } from '@/lib/social-media-utils';

interface SharedTasksViewProps {
  session: SharedLink;
  tasks: Task[] | null;
  socialMediaPosts: SocialMediaPost[] | null;
  webArticles: WebArticle[] | null;
  statuses: WorkflowStatus[] | null;
  brands: Brand[] | null;
  users: User[] | null;
  isLoading: boolean;
  workstream: 'tasks' | 'socialMediaPosts' | 'webArticles';
}

export function SharedTasksView({ session, tasks, socialMediaPosts, webArticles, statuses, brands, users, isLoading, workstream }: SharedTasksViewProps) {
    const params = useParams();
    const router = useRouter();

    const scope = Array.isArray(params.scope) ? params.scope : [];
    const itemId = scope.length > 1 ? scope[scope.length - 1] : null;

    const [sheetOpen, setSheetOpen] = React.useState(!!itemId);
    const [activeItem, setActiveItem] = React.useState<WorkItem | null>(null);

    const items = useMemo(() => {
        let rawItems: WorkItem[] = [];
        if (workstream === 'tasks') {
            rawItems = tasks || [];
        } else if (workstream === 'socialMediaPosts') {
            rawItems = socialMediaPosts || [];
        } else if (workstream === 'webArticles') {
            rawItems = webArticles || [];
        }
        
        // Normalization step
        return rawItems.map(item => {
            if ('platform' in item && session.snapshot.users) { // is SocialMediaPost
                return normalizeSocialPost(item as SocialMediaPost, session.snapshot.users[0]);
            }
            if ('content' in item) { // is WebArticle
                 return { ...item, status: item.statusInternal };
            }
            return item; // is Task
        });

    }, [workstream, tasks, socialMediaPosts, webArticles, session]);


    React.useEffect(() => {
        if(itemId) {
            const item = items?.find(t => t.id === itemId);
            if (item) {
                setActiveItem(item);
                setSheetOpen(true);
            }
        } else {
            setSheetOpen(false);
            setActiveItem(null);
        }
    }, [itemId, items]);

    const handleSheetOpenChange = (open: boolean) => {
      setSheetOpen(open);
      if (!open) {
        const basePath = `/share/${session.id}/${scope.slice(0, -1).join('/')}`;
        window.history.pushState({}, '', basePath);
        setActiveItem(null);
      }
    };

    const renderSheet = () => {
        if (!activeItem) return null;

        if (workstream === 'socialMediaPosts') {
            return <SocialMediaPostDetailsSheet post={activeItem as SocialMediaPost} open={sheetOpen} onOpenChange={handleSheetOpenChange} />;
        }
        if (workstream === 'webArticles') {
            return <WebArticleDetailsSheet article={activeItem as WebArticle} open={sheetOpen} onOpenChange={handleSheetOpenChange} />;
        }
        // Default to Task
        return <TaskDetailsSheet task={activeItem as Task} open={sheetOpen} onOpenChange={handleSheetOpenChange} />;
    }

  return (
    <div className="flex flex-col flex-1 h-full w-full">
      <main className="flex-1 overflow-auto p-4 md:p-6 w-full">
        {isLoading ? (
          <div className="flex h-full w-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : !items || items.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <h3 className="text-lg font-semibold">No Items to Display</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                There are no items associated with this shared view.
              </p>
            </CardContent>
          </Card>
        ) : (
          <SharedTasksTable 
            items={items}
            statuses={statuses || []}
            brands={brands || []}
            users={users || []}
            accessLevel={session.accessLevel}
            workstream={workstream}
          />
        )}
      </main>
      {renderSheet()}
    </div>
  );
}

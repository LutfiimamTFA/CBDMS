
'use client';
import type { Task, SharedLink, WorkflowStatus, SocialMediaPost, WebArticle, WorkItem } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { SharedKanbanBoard } from './shared-kanban-board';
import { useMemo } from 'react';

interface SharedDashboardViewProps {
  session: SharedLink;
  tasks: Task[] | null;
  socialMediaPosts?: SocialMediaPost[] | null;
  webArticles?: WebArticle[] | null;
  statuses: WorkflowStatus[] | null;
  isLoading: boolean;
  workstream?: 'tasks' | 'socialMediaPosts' | 'webArticles';
}

export function SharedDashboardView({ session, tasks, socialMediaPosts, webArticles, statuses, isLoading, workstream = 'tasks' }: SharedDashboardViewProps) {
  
  const items = useMemo(() => {
    switch(workstream) {
      case 'socialMediaPosts': return socialMediaPosts || [];
      case 'webArticles': return webArticles || [];
      case 'tasks':
      default:
        return tasks || [];
    }
  }, [workstream, tasks, socialMediaPosts, webArticles]);

  return (
    <div className="flex flex-col flex-1 h-full w-full">
      <main className="flex-1 overflow-auto p-4 md:p-6">
        {isLoading ? (
          <div className="flex h-full w-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <SharedKanbanBoard
            items={items}
            statuses={statuses || []}
            accessLevel={session.accessLevel}
            linkId={session.id}
            workstream={workstream}
            session={session}
          />
        )}
      </main>
    </div>
  );
}

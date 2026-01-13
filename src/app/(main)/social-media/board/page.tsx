
'use client';
import { GenericKanbanBoard } from '@/components/tasks/generic-kanban-board';

export default function SocialMediaBoardPage() {
  return <GenericKanbanBoard itemType="socialMediaPosts" statusCollection="socialMediaStatuses" />;
}

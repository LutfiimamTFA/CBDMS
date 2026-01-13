
'use client';
import { GenericKanbanBoard } from '@/components/tasks/generic-kanban-board';
import { useUserProfile } from '@/firebase';
import { notFound } from 'next/navigation';

export default function SocialMediaBoardPage() {
  const { profile } = useUserProfile();
  
  if (!profile || profile.role === 'Client') {
      notFound();
  }

  return <GenericKanbanBoard itemType="socialMediaPosts" statusCollection="socialMediaStatuses" />;
}


'use client';
import { GenericKanbanBoard } from '@/components/tasks/generic-kanban-board';
import { useUserProfile } from '@/firebase';
import { notFound } from 'next/navigation';

export default function WebBoardPage() {
  const { profile } = useUserProfile();

  if (!profile || profile.role === 'Client') {
    notFound();
  }
  
  return <GenericKanbanBoard itemType="webArticles" statusCollection="webStatuses" />;
}

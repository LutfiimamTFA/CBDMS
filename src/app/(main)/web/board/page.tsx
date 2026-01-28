'use client';
import { GenericKanbanBoard } from '@/components/tasks/generic-kanban-board';
import { useUserProfile } from '@/firebase';
import { Loader2 } from 'lucide-react';
import { notFound } from 'next/navigation';

export default function WebBoardPage() {
  const { profile, isLoading } = useUserProfile();

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!profile || profile.role === 'Client') {
    notFound();
  }
  
  return <GenericKanbanBoard itemType="webArticles" statusCollection="webStatuses" />;
}

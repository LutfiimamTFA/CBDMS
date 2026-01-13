
'use client';
import { GenericKanbanBoard } from '@/components/tasks/generic-kanban-board';

export default function WebBoardPage() {
  return <GenericKanbanBoard itemType="webArticles" statusCollection="webStatuses" />;
}

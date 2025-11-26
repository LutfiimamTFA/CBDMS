
'use client';

import React, { useEffect, useState, use } from 'react';
import { tasks as allTasks } from '@/lib/data';
import { TaskDetailsSheet } from '@/components/tasks/task-details-sheet';
import { notFound, useRouter } from 'next/navigation';
import type { Task } from '@/lib/types';
import { useI18n } from '@/context/i18n-provider';

export default function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const [task, setTask] = useState<Task | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const { t } = useI18n();
  const resolvedParams = use(params);

  useEffect(() => {
    const foundTask = allTasks.find((t) => t.id === resolvedParams.id);
    if (foundTask) {
      setTask(foundTask);
      setIsOpen(true);
    } else {
      // If no task is found, trigger a 404
      notFound();
    }
  }, [resolvedParams.id]);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      // When the sheet is closed, navigate back to the main tasks list.
      router.push('/tasks');
    }
  };

  // Render a loading state or null while we wait for the client-side effect to run.
  if (!task) {
    return (
      <div className="flex h-svh items-center justify-center">
        <p>{t('tasks.noresults')}</p>
      </div>
    );
  }

  return (
    <TaskDetailsSheet 
        task={task} 
        open={isOpen}
        onOpenChange={handleOpenChange}
    >
        {/* The trigger is visually hidden but required for the Sheet component */}
        <div className="sr-only" />
    </TaskDetailsSheet>
  );
}

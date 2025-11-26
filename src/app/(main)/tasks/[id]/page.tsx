'use client';

import React, { useEffect, useState, use } from 'react';
import { TaskDetailsSheet } from '@/components/tasks/task-details-sheet';
import { notFound, useRouter } from 'next/navigation';
import type { Task } from '@/lib/types';
import { useI18n } from '@/context/i18n-provider';
import { useDoc, useFirebase, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';

export default function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const { t } = useI18n();
  const resolvedParams = use(params);

  const { firestore, user } = useFirebase();

  const taskRef = useMemoFirebase(() => {
    if (!user || !resolvedParams.id) return null;
    return doc(firestore, 'tasks', resolvedParams.id);
  }, [firestore, user, resolvedParams.id]);

  const { data: task, isLoading } = useDoc<Task>(taskRef);

  useEffect(() => {
    if (!isLoading) {
      if (task) {
        setIsOpen(true);
      } else {
        // Only call notFound if loading is complete and there's no task
        notFound();
      }
    }
  }, [isLoading, task]);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      router.push('/dashboard');
    }
  };

  // While loading, show a spinner. Don't call notFound() yet.
  if (isLoading) {
    return (
      <div className="flex h-svh items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // If loading is finished and still no task, it's a true 404.
  if (!task) {
     return notFound();
  }

  // If task is found, render the sheet.
  return (
    <div className="h-svh w-full bg-background">
        <TaskDetailsSheet 
            task={task} 
            open={isOpen}
            onOpenChange={handleOpenChange}
        >
            <div className="sr-only" />
        </TaskDetailsSheet>
    </div>
  );
}

    
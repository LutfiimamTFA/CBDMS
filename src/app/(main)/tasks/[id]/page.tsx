'use client';

import React, { useEffect, useState, use } from 'react';
import { TaskDetailsSheet } from '@/components/tasks/task-details-sheet';
import { notFound, useRouter } from 'next/navigation';
import type { Task } from '@/lib/types';
import { useDoc, useFirebase, useMemoFirebase, useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';

export default function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const resolvedParams = use(params);

  const firestore = useFirestore();

  const taskRef = useMemoFirebase(() => {
    if (!firestore || !resolvedParams.id) return null;
    return doc(firestore, 'tasks', resolvedParams.id);
  }, [firestore, resolvedParams.id]);

  const { data: task, isLoading } = useDoc<Task>(taskRef);

  useEffect(() => {
    if (!isLoading) {
      if (task) {
        setIsOpen(true);
      } else {
        notFound();
      }
    }
  }, [isLoading, task]);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      router.push('/dashboard');
    }
    setIsOpen(open);
  };

  if (isLoading) {
    return (
      <div className="flex h-svh items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!task) {
     return notFound();
  }

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

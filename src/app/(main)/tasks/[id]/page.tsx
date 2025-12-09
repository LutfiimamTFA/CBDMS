
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { TaskDetailsSheet } from '@/components/tasks/task-details-sheet';
import { notFound, useRouter, useSearchParams, useParams } from 'next/navigation';
import type { Task } from '@/lib/types';
import { useDoc, useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';

export default function TaskPage() {
  const router = useRouter();
  const params = useParams() as { id: string };
  const searchParams = useSearchParams();
  const isSharedView = searchParams.get('shared') === 'true';
  
  const [isOpen, setIsOpen] = useState(true);
  const firestore = useFirestore();

  const taskRef = useMemo(() => {
    if (!firestore || !params.id) return null;
    return doc(firestore, 'tasks', params.id);
  }, [firestore, params.id]);

  const { data: task, isLoading, error } = useDoc<Task>(taskRef);

  useEffect(() => {
    if (!isLoading && (!task || error)) {
      notFound();
    }
  }, [isLoading, task, error]);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      router.back();
    }
  };

  if (isLoading || !task) {
    return (
      <div className="flex h-svh items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-svh w-full bg-background">
        <TaskDetailsSheet 
            task={task} 
            open={isOpen}
            onOpenChange={handleOpenChange}
        />
    </div>
  );
}

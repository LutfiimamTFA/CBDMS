
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { TaskDetailsSheet } from '@/components/tasks/task-details-sheet';
import { notFound, useRouter } from 'next/navigation';
import type { Task } from '@/lib/types';
import { useDoc, useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';

export default function TaskPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  
  const [isOpen, setIsOpen] = useState(true); // Always start open
  const firestore = useFirestore();

  const taskRef = useMemo(() => {
    if (!firestore || !params.id) return null;
    return doc(firestore, 'tasks', params.id);
  }, [firestore, params.id]);

  const { data: task, isLoading, error } = useDoc<Task>(taskRef);

  useEffect(() => {
    // If loading completes and there's no task or an error occurred, navigate to not found.
    if (!isLoading && (!task || error)) {
      notFound();
    }
  }, [isLoading, task, error]);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      // When the sheet is closed, navigate back to the main dashboard.
      router.push('/dashboard');
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-svh items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // This check is important for the initial render before the useEffect runs.
  if (!task) {
     return notFound();
  }

  return (
    <div className="h-svh w-full bg-background">
        {/* The sheet is now controlled by this page's state */}
        <TaskDetailsSheet 
            task={task} 
            open={isOpen}
            onOpenChange={handleOpenChange}
        >
            {/* The trigger is now implicit; the page itself controls the sheet */}
            <div className="sr-only">Task details page</div>
        </TaskDetailsSheet>
    </div>
  );
}

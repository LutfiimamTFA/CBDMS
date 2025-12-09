
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { TaskDetailsSheet } from '@/components/tasks/task-details-sheet';
import { notFound, useRouter, useParams } from 'next/navigation';
import type { SharedLink, Task } from '@/lib/types';
import { useDoc, useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';

export default function SharedTaskPage() {
  const router = useRouter();
  const params = useParams() as { linkId: string; taskId: string };
  const { linkId, taskId } = params;

  const [isOpen, setIsOpen] = useState(true);
  const firestore = useFirestore();

  // Fetch the shared link to get permissions
  const linkDocRef = useMemo(() => {
    if (!firestore || !linkId) return null;
    return doc(firestore, 'sharedLinks', linkId);
  }, [firestore, linkId]);
  const { data: sharedLink, isLoading: isLinkLoading, error: linkError } = useDoc<SharedLink>(linkDocRef);

  // Fetch the specific task
  const taskRef = useMemo(() => {
    if (!firestore || !taskId) return null;
    return doc(firestore, 'tasks', taskId);
  }, [firestore, taskId]);
  const { data: task, isLoading: isTaskLoading, error: taskError } = useDoc<Task>(taskRef);

  const isLoading = isLinkLoading || isTaskLoading;

  useEffect(() => {
    if (!isLoading) {
      if (!sharedLink || !task || linkError || taskError || sharedLink.companyId !== task.companyId) {
        notFound();
      }
    }
  }, [isLoading, sharedLink, task, linkError, taskError, router]);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      // Navigate back to the main shared view.
      router.push(`/share/${linkId}`);
    }
  };

  if (isLoading || !task || !sharedLink) {
    return (
      <div className="flex h-svh items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Ensure user has permission to view details
  if (!sharedLink.permissions.canViewDetails) {
    notFound();
  }

  return (
    <div className="h-svh w-full bg-background">
        <TaskDetailsSheet 
            task={task} 
            open={isOpen}
            onOpenChange={handleOpenChange}
            permissions={sharedLink.permissions} // Pass permissions to the sheet
        />
    </div>
  );
}


'use client';

import React, { useEffect, useState } from 'react';
import { tasks as allTasks } from '@/lib/data';
import { TaskDetailsSheet } from '@/components/tasks/task-details-sheet';
import { notFound, useRouter } from 'next/navigation';
import type { Task } from '@/lib/types';

export default function TaskPage({ params }: { params: { id: string } }) {
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const foundTask = allTasks.find((t) => t.id === params.id);
    if (foundTask) {
      setTask(foundTask);
    }
    setLoading(false);
  }, [params.id]);

  if (loading) {
    // Optional: You can return a loading skeleton here
    return null;
  }

  if (!task) {
    notFound();
    return null;
  }

  return (
    <TaskDetailsSheet 
        task={task} 
        defaultOpen={true} 
        onOpenChange={(open) => {
            if (!open) {
                router.back();
            }
        }}
    >
        {/* The trigger is visually hidden but required */}
        <div className="sr-only" />
    </TaskDetailsSheet>
  );
}

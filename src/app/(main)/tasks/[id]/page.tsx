
'use client';

import { tasks } from '@/lib/data';
import { TaskDetailsSheet } from '@/components/tasks/task-details-sheet';
import { notFound, useRouter } from 'next/navigation';

export default function TaskPage({ params }: { params: { id: string } }) {
  const task = tasks.find((t) => t.id === params.id);
  const router = useRouter();

  if (!task) {
    notFound();
  }

  return (
    <TaskDetailsSheet task={task} defaultOpen={true} onOpenChange={(open) => {
        if (!open) {
            router.back();
        }
    }}>
        {/* The trigger is visually hidden but required */}
        <div className="sr-only"></div>
    </TaskDetailsSheet>
  );
}

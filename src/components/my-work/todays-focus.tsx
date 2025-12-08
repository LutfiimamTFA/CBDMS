
'use client';

import React, { useMemo } from 'react';
import { useCollection, useFirestore, useUserProfile } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Task } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { isToday, isPast, parseISO } from 'date-fns';
import { useRouter } from 'next/navigation';
import { TaskCard } from '../tasks/task-card';

export function TodaysFocus() {
    const firestore = useFirestore();
    const { user, isLoading: userLoading } = useUserProfile();
    const router = useRouter();

    const tasksQuery = useMemo(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, 'tasks'), where('assigneeIds', 'array-contains', user.uid));
    }, [firestore, user]);
    const { data: allTasks, isLoading: tasksLoading } = useCollection<Task>(tasksQuery);
    
    const todaysTasks = useMemo(() => {
        if (!allTasks) return [];
        return allTasks.filter(task => {
            if (task.status === 'Done') return false;

            const isDueToday = task.dueDate && isToday(parseISO(task.dueDate));
            const isOverdue = task.dueDate && isPast(parseISO(task.dueDate)) && !isToday(parseISO(task.dueDate));
            const isInProgress = task.status === 'Doing';
            
            return isDueToday || isOverdue || isInProgress;
        }).sort((a,b) => {
            // Sort by priority first (Urgent > High > Medium > Low)
            const priorityOrder = { 'Urgent': 4, 'High': 3, 'Medium': 2, 'Low': 1 };
            if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
                return priorityOrder[b.priority] - priorityOrder[a.priority];
            }
            // Then sort by due date (earliest first)
            if (a.dueDate && b.dueDate) {
                return parseISO(a.dueDate).getTime() - parseISO(b.dueDate).getTime();
            }
            return 0;
        });
    }, [allTasks]);

    const isLoading = userLoading || tasksLoading;

    return (
        <div>
            <h3 className="text-xl font-bold tracking-tight mb-4">Today's Focus</h3>
            {isLoading ? (
            <div className="flex justify-center items-center h-48">
                <Loader2 className="h-6 w-6 animate-spin"/>
            </div>
            ) : todaysTasks.length > 0 ? (
                <div className="space-y-3">
                    {todaysTasks.map(task => (
                        <div key={task.id} onClick={() => router.push(`/tasks/${task.id}`)}>
                            <TaskCard task={task} />
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-12 px-4 border-2 border-dashed rounded-lg">
                    <h4 className="text-lg font-semibold">All Clear!</h4>
                    <p className="text-sm text-muted-foreground mt-2">You have no overdue tasks or tasks due today. Great job staying on top of things!</p>
                </div>
            )}
        </div>
    );
}

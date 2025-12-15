
'use client';

import React, { useMemo } from 'react';
import { useCollection, useFirestore, useUserProfile } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Task, Subtask } from '@/lib/types';
import { Loader2, MessageSquare, User } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { useRouter } from 'next/navigation';
import { Badge } from '../ui/badge';


interface Mention {
    task: Task;
    comment: {
        id: string;
        user: { id: string; name: string; avatarUrl: string; };
        text: string;
        timestamp: string;
    };
}

interface AssignedSubtask {
    task: Task;
    subtask: Subtask;
}

export function ActionItems() {
    const firestore = useFirestore();
    const { user, profile, isLoading: userLoading } = useUserProfile();
    const router = useRouter();

    const tasksQuery = useMemo(() => {
        if (!firestore || !user) return null;
        // This query fetches tasks where the user is an assignee OR is mentioned.
        // It's a bit broad but necessary to catch all relevant items.
        // A more complex backend solution could optimize this.
        return query(collection(firestore, 'tasks'), where('assigneeIds', 'array-contains', user.uid));
    }, [firestore, user]);
    const { data: allTasks, isLoading: tasksLoading } = useCollection<Task>(tasksQuery);
    
    const { mentions, assignedSubtasks } = useMemo(() => {
        const mentions: Mention[] = [];
        const assignedSubtasks: AssignedSubtask[] = [];
        
        if (!allTasks || !user || !profile) return { mentions, assignedSubtasks };

        const userFirstName = profile.name?.split(' ')[0].toLowerCase();
        if (!userFirstName) return { mentions, assignedSubtasks };
        
        const mentionRegex = new RegExp(`@${userFirstName}\\b`, 'i');
        
        allTasks.forEach(task => {
            // Check for mentions in comments
            if (task.comments) {
                task.comments.forEach(comment => {
                    if (mentionRegex.test(comment.text)) {
                        mentions.push({ task, comment });
                    }
                });
            }
            // Check for assigned subtasks
            if (task.subtasks) {
                task.subtasks.forEach(subtask => {
                    if (subtask.assignee?.id === user.uid && !subtask.completed) {
                        assignedSubtasks.push({ task, subtask });
                    }
                })
            }
        });
        
        // Sort mentions by most recent first
        mentions.sort((a,b) => parseISO(b.comment.timestamp).getTime() - parseISO(a.comment.timestamp).getTime());

        return { mentions, assignedSubtasks };

    }, [allTasks, user, profile]);
    
    const isLoading = userLoading || tasksLoading;

    const handleNavigate = (taskId: string) => {
        router.push(`/tasks/${taskId}`);
    };

    return (
        <div>
            <h3 className="text-xl font-bold tracking-tight mb-4">Action Items</h3>
            {isLoading ? (
                <div className="flex justify-center items-center h-24">
                    <Loader2 className="h-6 w-6 animate-spin"/>
                </div>
            ) : (
                <div className="space-y-4">
                    {assignedSubtasks.length === 0 && mentions.length === 0 && (
                        <div className="text-center py-8 px-4 border-2 border-dashed rounded-lg">
                             <h4 className="text-lg font-semibold">Inbox Zero</h4>
                            <p className="text-sm text-muted-foreground mt-2">No mentions or assigned sub-tasks waiting for you. You're all caught up!</p>
                        </div>
                    )}

                    {assignedSubtasks.map(({ task, subtask }) => (
                        <div key={subtask.id} className="p-3 rounded-md bg-secondary/50 hover:bg-secondary cursor-pointer" onClick={() => handleNavigate(task.id)}>
                            <div className='flex items-start gap-3'>
                                <User className="h-5 w-5 mt-1 text-primary shrink-0" />
                                <div>
                                    <p className="font-semibold">{subtask.title}</p>
                                    <p className="text-sm text-muted-foreground">
                                        Sub-task assigned to you in <span className='font-medium text-foreground'>{task.title}</span>
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}

                    {mentions.map(({ task, comment }) => (
                         <div key={comment.id} className="p-3 rounded-md bg-secondary/50 hover:bg-secondary cursor-pointer" onClick={() => handleNavigate(task.id)}>
                            <div className='flex items-start gap-3'>
                                 <MessageSquare className="h-5 w-5 mt-1 text-primary shrink-0" />
                                <div>
                                    <div className='flex items-center gap-2'>
                                        <Avatar className='h-5 w-5'>
                                            <AvatarImage src={comment.user.avatarUrl} />
                                            <AvatarFallback>{comment.user.name.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <span className='font-semibold text-sm'>{comment.user.name}</span>
                                        <span className='text-xs text-muted-foreground'>{formatDistanceToNow(parseISO(comment.timestamp), { addSuffix: true })}</span>
                                    </div>
                                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">"{comment.text}"</p>
                                    <Badge variant="outline" className='mt-2'>in {task.title}</Badge>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

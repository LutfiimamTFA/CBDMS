'use client';

import React, { useMemo } from 'react';
import { useCollection, useFirestore, useUserProfile } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Task, Subtask } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, MessageSquare, CheckCircle, Circle, User } from 'lucide-react';
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
    const { user, isLoading: userLoading } = useUserProfile();
    const router = useRouter();

    const tasksQuery = useMemo(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'tasks'));
    }, [firestore]);
    const { data: allTasks, isLoading: tasksLoading } = useCollection<Task>(tasksQuery);
    
    const { mentions, assignedSubtasks } = useMemo(() => {
        const mentions: Mention[] = [];
        const assignedSubtasks: AssignedSubtask[] = [];
        
        if (!allTasks || !user) return { mentions, assignedSubtasks };

        const userFirstName = user.displayName?.split(' ')[0].toLowerCase();
        const mentionRegex = new RegExp(`@${userFirstName}\\b`, 'i');
        
        allTasks.forEach(task => {
            if (task.comments) {
                task.comments.forEach(comment => {
                    if (mentionRegex.test(comment.text)) {
                        mentions.push({ task, comment });
                    }
                });
            }
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

    }, [allTasks, user]);
    
    const isLoading = userLoading || tasksLoading;

    const handleNavigate = (taskId: string) => {
        router.push(`/tasks/${taskId}`);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Action Items</CardTitle>
                <CardDescription>Mentions and sub-tasks that need your direct attention.</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex justify-center items-center h-24">
                        <Loader2 className="h-6 w-6 animate-spin"/>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {assignedSubtasks.length === 0 && mentions.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-4">No action items right now. Great job!</p>
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
            </CardContent>
        </Card>
    );
}

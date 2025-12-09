
'use client';

import { notFound, useParams, useRouter, useSearchParams } from 'next/navigation';
import { useDoc, useFirestore } from '@/firebase';
import { collection, doc, query, where } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import type { SharedLink, Task } from '@/lib/types';
import { useMemo, useState } from 'react';
import { KanbanBoard } from '@/components/tasks/kanban-board';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCollection } from '@/firebase/firestore/use-collection';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TasksDataTable } from '@/components/tasks/tasks-data-table';
import { KanbanSquare, List } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { TaskDetailsSheet } from '@/components/tasks/task-details-sheet';

export default function SharedLinkPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const linkId = params.linkId as string;
    const firestore = useFirestore();

    const [password, setPassword] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [authError, setAuthError] = useState<string | null>(null);

    const [openedTaskId, setOpenedTaskId] = useState<string | null>(null);

    const linkDocRef = useMemo(() => {
        if (!firestore) return null;
        return doc(firestore, 'sharedLinks', linkId);
    }, [firestore, linkId]);

    const { data: sharedLink, isLoading: isLinkLoading, error: linkError } = useDoc<SharedLink>(linkDocRef);

    const tasksQuery = useMemo(() => {
        if (!firestore || !sharedLink || !isAuthenticated) return null;

        let q = query(collection(firestore, 'tasks'), where('companyId', '==', sharedLink.companyId));
        
        if (sharedLink.targetType && sharedLink.targetId) {
            if (sharedLink.targetType === 'brand') {
                q = query(q, where('brandId', '==', sharedLink.targetId));
            } else if (sharedLink.targetType === 'priority') {
                q = query(q, where('priority', '==', sharedLink.targetId));
            } else if (sharedLink.targetType === 'assignee') {
                q = query(q, where('assigneeIds', 'array-contains', sharedLink.targetId));
            }
        }
        return q;
    }, [firestore, sharedLink, isAuthenticated]);

    const { data: tasks, isLoading: areTasksLoading } = useCollection<Task>(tasksQuery);
    
    const taskForSheet = useMemo(() => {
        if (!openedTaskId || !tasks) return null;
        return tasks.find(t => t.id === openedTaskId) || null;
    }, [openedTaskId, tasks]);


    const handleAuth = () => {
        if (sharedLink?.password === password) {
            setIsAuthenticated(true);
            setAuthError(null);
        } else {
            setAuthError('Invalid password.');
        }
    };
    
    // Auto-authenticate if link has no password
    useMemo(() => {
        if (sharedLink && !sharedLink.password) {
            setIsAuthenticated(true);
        }
    }, [sharedLink]);

    if (isLinkLoading) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }
    
    if (linkError || !sharedLink) {
        return notFound();
    }
    
    if (!isAuthenticated) {
        return (
            <div className="flex h-screen w-full flex-col items-center justify-center bg-secondary p-4">
                <div className="w-full max-w-sm space-y-4">
                     <div className="flex justify-center"><Logo/></div>
                    <h2 className="text-xl font-semibold text-center">Password Required</h2>
                    <p className="text-muted-foreground text-center text-sm">This content is protected. Please enter the password to view.</p>
                    <div className="flex w-full items-center space-x-2">
                        <Input 
                            type="password" 
                            placeholder="Enter password" 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAuth()}
                        />
                        <Button onClick={handleAuth}>Unlock</Button>
                    </div>
                    {authError && <p className="text-sm text-destructive text-center">{authError}</p>}
                </div>
            </div>
        )
    }

    return (
        <div className="flex h-svh flex-col bg-background">
            <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b bg-background/80 px-4 backdrop-blur-sm sm:px-6">
                <div className="flex items-center gap-4">
                    <Logo />
                    <Badge variant="outline">Preview Mode</Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                    Viewing: <span className="font-semibold text-foreground">{sharedLink.targetName}</span>
                </div>
            </header>
            <main className="flex-1 overflow-hidden">
                {areTasksLoading ? (
                     <div className="flex h-full items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                ): (
                    <Tabs defaultValue="board" className="h-full flex flex-col p-4 md:p-6">
                        <TabsList className='mb-4 w-fit self-start'>
                           <TabsTrigger value="board"><KanbanSquare className='h-4 w-4 mr-2'/> Board View</TabsTrigger>
                           <TabsTrigger value="list"><List className='h-4 w-4 mr-2'/> List View</TabsTrigger>
                        </TabsList>
                        <TabsContent value="board" className="flex-1 overflow-hidden">
                            <KanbanBoard tasks={tasks || []} permissions={sharedLink.permissions} />
                        </TabsContent>
                        <TabsContent value="list" className="flex-1 overflow-auto">
                            <TasksDataTable tasks={tasks || []} permissions={sharedLink.permissions} />
                        </TabsContent>
                    </Tabs>
                )}
            </main>
             {taskForSheet && (
                <TaskDetailsSheet 
                    task={taskForSheet}
                    open={!!openedTaskId}
                    onOpenChange={(isOpen) => !isOpen && setOpenedTaskId(null)}
                    permissions={sharedLink.permissions}
                />
            )}
        </div>
    );
}

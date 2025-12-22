'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Loader2, ShieldAlert } from 'lucide-react';
import { TaskDetailsSheet } from '@/components/tasks/task-details-sheet';
import type { SharedTask } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const LinkNotFoundComponent = () => (
    <div className="flex h-full items-center justify-center p-8 w-full">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle className="flex items-center justify-center gap-2 text-destructive">
            <ShieldAlert className="h-6 w-6"/>
            Link Not Found or Expired
          </CardTitle>
        </CardHeader>
        <CardContent>
            <p className="text-muted-foreground">The share link you are trying to access is invalid or has been disabled.</p>
            <Button variant="link" asChild className='mt-4'>
                <a href="/login">Return to Login</a>
            </Button>
        </CardContent>
      </Card>
    </div>
);


export default function ShareTaskPage() {
    const params = useParams();
    const router = useRouter();
    const shareId = params.shareId as string;
    const firestore = useFirestore();

    const [sharedTask, setSharedTask] = useState<SharedTask | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSheetOpen, setIsSheetOpen] = useState(true);

    useEffect(() => {
        if (!firestore || !shareId) return;

        const fetchSharedTask = async () => {
            setIsLoading(true);
            try {
                const docRef = doc(firestore, 'sharedTasks', shareId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setSharedTask({ id: docSnap.id, ...docSnap.data() } as SharedTask);
                } else {
                    setError('Shared task not found.');
                }
            } catch (e: any) {
                setError(e.message || 'Failed to fetch shared task.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchSharedTask();
    }, [firestore, shareId]);
    
    const handleSheetOpenChange = (open: boolean) => {
        setIsSheetOpen(open);
        // In this isolated view, closing the sheet could mean they are "done".
        // We can simply show a blank page or redirect them.
        if (!open) {
            router.push('/login'); 
        }
    };

    if (isLoading) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }
    
    if (error || !sharedTask) {
        return <LinkNotFoundComponent />;
    }

    return (
        <div className="h-screen w-full bg-muted/40">
            <TaskDetailsSheet 
                task={sharedTask.snapshot.task}
                open={isSheetOpen}
                onOpenChange={handleSheetOpenChange}
                isSharedView={true}
                sharedTaskConfig={sharedTask}
            />
        </div>
    )
}

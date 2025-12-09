
'use client';

import { useMemo, useState } from 'react';
import { notFound } from 'next/navigation';
import { useDoc, useFirestore } from '@/firebase';
import { doc, collection, query, where } from 'firebase/firestore';
import type { SharedLink, Task } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { KanbanBoard } from '@/components/tasks/kanban-board';
import { useCollection } from '@/firebase/firestore/use-collection';

export default function SharedLinkPage({ params }: { params: { linkId: string } }) {
  const { linkId } = params;
  const firestore = useFirestore();
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setAuthError] = useState('');

  const linkDocRef = useMemo(() => {
    if (!firestore) return null;
    return doc(firestore, 'sharedLinks', linkId);
  }, [firestore, linkId]);

  const { data: sharedLink, isLoading: isLinkLoading, error: linkError } = useDoc<SharedLink>(linkDocRef);

  const tasksQuery = useMemo(() => {
    if (!firestore || !sharedLink) return null;
    // In a real scenario, you'd have more sophisticated logic based on sharedLink.targetType
    // For now, it shares all tasks for the company
    return query(collection(firestore, 'tasks'), where('companyId', '==', sharedLink.companyId));
  }, [firestore, sharedLink]);

  const { data: tasks, isLoading: areTasksLoading } = useCollection<Task>(tasksQuery, {
    disabled: !sharedLink || (!!sharedLink.password && !isAuthenticated),
  });

  const isLoading = isLinkLoading || areTasksLoading;

  // Handle expired link
  if (sharedLink?.expiresAt && new Date(sharedLink.expiresAt) < new Date()) {
    return (
        <div className="flex h-screen w-full items-center justify-center bg-background">
            <div className="text-center">
                <h1 className="text-2xl font-bold">Link Expired</h1>
                <p className="text-muted-foreground">This share link has expired and is no longer valid.</p>
            </div>
        </div>
    );
  }

  // Handle password protection
  if (sharedLink && sharedLink.password && !isAuthenticated) {
    const handlePasswordSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // In a real app, this would be a server-side check against a hashed password
        if (password === sharedLink.password) {
            setIsAuthenticated(true);
            setAuthError('');
        } else {
            setAuthError('Incorrect password. Please try again.');
        }
    };
    // Render password prompt
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="w-full max-w-sm space-y-4 rounded-lg border p-6">
            <h1 className="text-xl font-bold">Password Required</h1>
            <p className="text-sm text-muted-foreground">This content is password protected. Please enter the password to view.</p>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-md border p-2 bg-secondary" placeholder="Enter password" />
                {error && <p className="text-sm text-destructive">{error}</p>}
                <button type="submit" className="w-full rounded-md bg-primary p-2 text-primary-foreground">Unlock</button>
            </form>
        </div>
      </div>
    )
  }

  if (!isLoading && (!sharedLink || linkError)) {
    return notFound();
  }
  
  if (isLoading && !tasks) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  
  if (!sharedLink) {
    return notFound();
  }

  return (
    <div className="flex h-svh flex-col bg-background">
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b bg-background/80 px-4 backdrop-blur-sm sm:px-6">
        <h1 className="font-headline text-xl font-semibold md:text-2xl">{sharedLink.targetName || 'Shared View'}</h1>
         <span className="text-sm text-muted-foreground">Read-only view</span>
      </header>
      <main className="flex-1 overflow-hidden p-4 md:p-6">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <KanbanBoard tasks={tasks || []} permissions={sharedLink.permissions} />
        )}
      </main>
    </div>
  );
}

'use client';

import { notFound, useParams, useRouter } from 'next/navigation';
import { useDoc, useFirestore } from '@/firebase';
import { collection, doc, query, where } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import type { SharedLink, Task } from '@/lib/types';
import { useMemo, useState, useEffect } from 'react';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MainLayout } from '@/components/share/main-layout';

export default function SharedLinkPage({
  children,
}: {
  children: React.ReactNode;
}) {
    const params = useParams();
    const router = useRouter();
    const linkId = params.linkId as string;
    const firestore = useFirestore();

    const [password, setPassword] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [authError, setAuthError] = useState<string | null>(null);

    const linkDocRef = useMemo(() => {
        if (!firestore) return null;
        return doc(firestore, 'sharedLinks', linkId);
    }, [firestore, linkId]);

    const { data: sharedLink, isLoading: isLinkLoading, error: linkError } = useDoc<SharedLink>(linkDocRef);

    const handleAuth = () => {
        if (sharedLink?.password === password) {
            setIsAuthenticated(true);
            setAuthError(null);
        } else {
            setAuthError('Invalid password.');
        }
    };
    
    useEffect(() => {
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

    // Render the main layout for the shared view
    return <MainLayout />;
}

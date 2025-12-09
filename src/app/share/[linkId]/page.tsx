
'use client';

import { notFound, useParams, useRouter } from 'next/navigation';
import { useDoc, useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import type { SharedLink, NavigationItem } from '@/lib/types';
import { useMemo, useState, useEffect } from 'react';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MainLayout } from '@/components/share/main-layout';
import { useCollection } from '@/firebase/firestore/use-collection';
import { query, orderBy } from 'firebase/firestore';


export default function SharedLinkPage() {
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

    const navItemsQuery = useMemo(
        () =>
        firestore
            ? query(collection(firestore, 'navigationItems'), orderBy('order'))
            : null,
        [firestore]
    );

    const { data: allNavItems, isLoading: isNavItemsLoading } = useCollection<NavigationItem>(navItemsQuery);


    const handleAuth = () => {
        if (sharedLink?.password === password) {
            setIsAuthenticated(true);
            setAuthError(null);
        } else {
            setAuthError('Invalid password.');
        }
    };
    
    useEffect(() => {
        // Automatically authenticate if there's no password or if it's expired
        if (sharedLink) {
            if (sharedLink.expiresAt && new Date(sharedLink.expiresAt) < new Date()) {
                // Link has expired, show not found.
                notFound();
                return;
            }
            if (!sharedLink.password) {
                setIsAuthenticated(true);
            }
        }
    }, [sharedLink]);

    useEffect(() => {
        if (isAuthenticated && sharedLink && allNavItems) {
            const firstAllowedPathId = sharedLink.allowedNavItems[0] || '';
            const navItem = allNavItems.find(item => item.id === firstAllowedPathId);
            if (navItem?.path) {
                router.replace(`/share/${linkId}${navItem.path}`);
            } else {
                 // Fallback if no valid path is found
                router.replace(`/share/${linkId}/dashboard`);
            }
        }
    }, [isAuthenticated, sharedLink, allNavItems, linkId, router]);

    if (isLinkLoading || isNavItemsLoading) {
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

    // Render the main layout for the shared view, which will handle the redirect.
    return (
        <div className="flex h-screen w-full items-center justify-center bg-background">
            <Loader2 className="h-8 w-8 animate-spin" />
        </div>
    );
}

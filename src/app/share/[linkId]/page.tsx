
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useDoc, useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Loader2, FileText, Clock } from 'lucide-react';
import type { SharedLink } from '@/lib/types';
import { useMemo, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PublicLogo } from '@/components/share/public-logo';
import { isAfter } from 'date-fns';

const LinkNotFoundComponent = () => (
    <div className="flex h-screen w-full items-center justify-center bg-secondary p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle className="flex items-center justify-center gap-2 text-destructive">
             <FileText className="h-6 w-6"/>
            Invalid, Disabled, or Misconfigured Link
          </CardTitle>
        </CardHeader>
        <CardContent>
            <p className="text-muted-foreground">The share link you are trying to access is invalid, has been disabled, or is not configured correctly. Please check the link or contact the person who shared it with you.</p>
            <Button variant="link" asChild className='mt-4'>
                <a href="/login">Return to Login</a>
            </Button>
        </CardContent>
      </Card>
    </div>
);

const LinkExpiredComponent = () => (
    <div className="flex h-screen w-full items-center justify-center bg-secondary p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle className="flex items-center justify-center gap-2 text-destructive">
             <Clock className="h-6 w-6"/>
            Link Expired
          </CardTitle>
        </CardHeader>
        <CardContent>
            <p className="text-muted-foreground">This share link was valid, but its access period has ended. Please request a new link from the person who shared it with you.</p>
             <Button variant="link" asChild className='mt-4'>
                <a href="/login">Return to Login</a>
            </Button>
        </CardContent>
      </Card>
    </div>
);


export default function SharedLinkRedirectorPage() {
    const params = useParams();
    const router = useRouter();
    const linkId = params.linkId as string;
    const firestore = useFirestore();

    const [password, setPassword] = useState('');
    const [authError, setAuthError] = useState<string | null>(null);

    const linkDocRef = useMemo(() => {
        if (!firestore || !linkId) return null;
        return doc(firestore, 'sharedLinks', linkId);
    }, [firestore, linkId]);

    const { data: sharedLink, isLoading: isLinkLoading, error: linkError } = useDoc<SharedLink>(linkDocRef);

    useEffect(() => {
        // This effect ONLY handles redirection once all checks have passed and the component re-renders.
        // It's separated to ensure it only runs when it's safe to do so.
        if (isLinkLoading || !sharedLink || linkError) return;
        if (sharedLink.password && typeof window !== 'undefined' && sessionStorage.getItem(`share_token_${linkId}`) !== 'true') return;
        if (sharedLink.expiresAt && isAfter(new Date(), (sharedLink.expiresAt as any).toDate())) return;

        const navIdToScope: { [key: string]: string } = {
            '/dashboard': 'dashboard',
            '/tasks': 'tasks',
            '/calendar': 'calendar',
            '/reports': 'reports'
        };

        const availableNavItems = Array.isArray(sharedLink.navItems) ? sharedLink.navItems : [];
        const allowedNavItems = Array.isArray(sharedLink.allowedNavItems) ? sharedLink.allowedNavItems : [];

        const firstValidNavItem = availableNavItems
            .filter(item => allowedNavItems.includes(item.id) && navIdToScope[item.path])
            .sort((a, b) => a.order - b.order)[0];
        
        if (firstValidNavItem) {
            const scope = navIdToScope[firstValidNavItem.path];
            router.replace(`/share/${linkId}/${scope}`);
        }
        // If no valid page is found, this effect does nothing, and the main return block shows an error.
    }, [sharedLink, isLinkLoading, linkId, router, linkError]);
    
    const handleAuth = () => {
        if (sharedLink?.password === password) {
            sessionStorage.setItem(`share_token_${linkId}`, 'true');
            setAuthError(null);
            router.refresh(); 
        } else {
            setAuthError('Invalid password.');
        }
    };
    
    // --- STAGE 1: LOADING ---
    if (isLinkLoading) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }
    
    // --- STAGE 2: VALIDATION (runs only after loading is complete) ---

    // 2a. Document not found or there was a Firestore error
    if (!sharedLink || linkError) {
        return <LinkNotFoundComponent />;
    }
    
    // 2b. Link is expired
    if (sharedLink.expiresAt && isAfter(new Date(), (sharedLink.expiresAt as any).toDate())) {
        return <LinkExpiredComponent />;
    }
    
    // 2c. Link requires a password and it hasn't been provided yet
    if (sharedLink.password && (typeof window === 'undefined' || sessionStorage.getItem(`share_token_${linkId}`) !== 'true')) {
        return (
            <div className="flex h-screen w-full flex-col items-center justify-center bg-secondary p-4">
                <Card className="w-full max-w-sm">
                     <CardHeader className='text-center'>
                        <div className='flex justify-center mb-4'><PublicLogo company={sharedLink.company || null} isLoading={false} /></div>
                        <CardTitle>Password Required</CardTitle>
                        <CardDescription>This content is protected. Please enter the password to view.</CardDescription>
                     </CardHeader>
                     <CardContent className="space-y-4">
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
                    </CardContent>
                </Card>
            </div>
        )
    }

    // 2d. Link is misconfigured (no valid pages to show)
    const navIdToScope: { [key: string]: string } = {
        '/dashboard': 'dashboard',
        '/tasks': 'tasks',
        '/calendar': 'calendar',
        '/reports': 'reports'
    };
    // Defensive normalization
    const availableNavItems = Array.isArray(sharedLink.navItems) ? sharedLink.navItems : [];
    const allowedNavItems = Array.isArray(sharedLink.allowedNavItems) ? sharedLink.allowedNavItems : [];
    const hasValidPages = availableNavItems.some(item => allowedNavItems.includes(item.id) && navIdToScope[item.path]);
    
    if (!hasValidPages) {
        return <LinkNotFoundComponent />;
    }

    // --- STAGE 3: REDIRECTING ---
    // If all checks pass, show a loader while the useEffect performs the redirect.
    return (
        <div className="flex h-screen w-full items-center justify-center bg-background">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="ml-4">Preparing your shared view...</p>
        </div>
    );
}

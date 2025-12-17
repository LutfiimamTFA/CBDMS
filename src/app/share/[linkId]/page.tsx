
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useDoc, useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Loader2, FileText, Clock } from 'lucide-react';
import type { SharedLink, Company } from '@/lib/types';
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
            Invalid or Disabled Link
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

    const company = sharedLink?.company || null;

    const handleAuth = () => {
        if (sharedLink?.password === password) {
            sessionStorage.setItem(`share_token_${linkId}`, 'true');
            setAuthError(null);
            router.refresh(); 
        } else {
            setAuthError('Invalid password.');
        }
    };
    
    // This effect now ONLY handles redirection after all checks have passed.
    useEffect(() => {
        if (isLinkLoading || !sharedLink || linkError) return;

        // Skip if password protected and not yet authenticated
        if (sharedLink.password && sessionStorage.getItem(`share_token_${linkId}`) !== 'true') {
            return;
        }

        // Skip if expired
        if (sharedLink.expiresAt && isAfter(new Date(), sharedLink.expiresAt.toDate())) {
            return;
        }
        
        const navIdToScope: { [key: string]: string } = {
            '/dashboard': 'dashboard',
            '/tasks': 'tasks',
            '/calendar': 'calendar',
            '/reports': 'reports'
        };

        const allowedNavItems = Array.isArray(sharedLink.allowedNavItems) ? sharedLink.allowedNavItems : [];
        const availableNavItems = Array.isArray(sharedLink.navItems) ? sharedLink.navItems : [];

        const firstValidNavItem = availableNavItems
            .filter(item => allowedNavItems.includes(item.id) && navIdToScope[item.path])
            .sort((a, b) => a.order - b.order)[0];
        
        if (firstValidNavItem) {
            const scope = navIdToScope[firstValidNavItem.path];
            router.replace(`/share/${linkId}/${scope}`);
        } else {
             // If no valid pages, it will be caught by the return statement below.
        }

    }, [sharedLink, isLinkLoading, linkId, router, linkError]);


    if (isLinkLoading) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }
    
    // --- Validation Checks ---

    // 1. Invalid or Deleted Link
    if (!sharedLink || linkError) {
        return <LinkNotFoundComponent />;
    }
    
    // 2. Expired Link
    // Check only if expiresAt exists and is a valid date object.
    if (sharedLink.expiresAt?.toDate && isAfter(new Date(), sharedLink.expiresAt.toDate())) {
        return <LinkExpiredComponent />;
    }
    
    // 3. Link with no accessible pages configured
    const allowedNavItems = Array.isArray(sharedLink.allowedNavItems) ? sharedLink.allowedNavItems : [];
    const availableNavItems = Array.isArray(sharedLink.navItems) ? sharedLink.navItems : [];
    const navIdToScope: { [key: string]: string } = {
        '/dashboard': 'dashboard',
        '/tasks': 'tasks',
        '/calendar': 'calendar',
        '/reports': 'reports'
    };
    const hasValidPages = availableNavItems.some(item => allowedNavItems.includes(item.id) && navIdToScope[item.path]);
    
    if (!hasValidPages) {
        return <LinkNotFoundComponent />;
    }

    // 4. Password Protected Link
    if (sharedLink.password && sessionStorage.getItem(`share_token_${linkId}`) !== 'true') {
        return (
            <div className="flex h-screen w-full flex-col items-center justify-center bg-secondary p-4">
                <Card className="w-full max-w-sm">
                     <CardHeader className='text-center'>
                        <div className='flex justify-center mb-4'><PublicLogo company={company} isLoading={isLinkLoading} /></div>
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

    // If all checks pass, show a loader while redirecting.
    // The useEffect hook will handle the redirect.
    return (
        <div className="flex h-screen w-full items-center justify-center bg-background">
            <Loader2 className="h-8 w-8 animate-spin" />
        </div>
    );
}


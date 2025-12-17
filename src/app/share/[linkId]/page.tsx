
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useDoc, useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Loader2, FileText, Clock } from 'lucide-react';
import type { SharedLink, NavigationItem } from '@/lib/types';
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
        if (isLinkLoading || !sharedLink || linkError) {
             // Wait for loading to finish, or if there's an error/no data, do nothing here.
             // The main return block will handle rendering the correct component.
            return;
        }
        
        // This is a stateless check. If a password is required, the component will render the password form.
        // If the token is present in sessionStorage, the redirect logic will proceed.
        if (sharedLink.password && sessionStorage.getItem(`share_token_${linkId}`) !== 'true') {
            return;
        }
        
        // This check is also stateless. If the link is expired, the component renders the expired message.
        if (sharedLink.expiresAt && isAfter(new Date(), (sharedLink.expiresAt as any).toDate())) {
            return;
        }
        
        const navIdToScope: { [key: string]: string } = {
            '/dashboard': 'dashboard',
            '/tasks': 'tasks',
            '/calendar': 'calendar',
            '/reports': 'reports'
        };

        // Defensive normalization: Ensure navItems and allowedNavItems are arrays.
        const availableNavItems = Array.isArray(sharedLink.navItems) ? sharedLink.navItems : [];
        const allowedNavItems = Array.isArray(sharedLink.allowedNavItems) ? sharedLink.allowedNavItems : [];

        // Find the first valid, routable page based on the intersection of available and allowed items.
        const firstValidNavItem = availableNavItems
            .filter(item => allowedNavItems.includes(item.id) && navIdToScope[item.path])
            .sort((a, b) => a.order - b.order)[0];
        
        // Only redirect if a valid page is found. Otherwise, the main return block shows an error.
        if (firstValidNavItem) {
            const scope = navIdToScope[firstValidNavItem.path];
            router.replace(`/share/${linkId}/${scope}`);
        }
    }, [sharedLink, isLinkLoading, linkId, router, linkError]);


    if (isLinkLoading) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }
    
    // Strict validation order after loading is complete.
    // 1. Check if the document exists.
    if (!sharedLink || linkError) {
        return <LinkNotFoundComponent />;
    }
    
    // 2. Check for expiration (only if the field exists).
    if (sharedLink.expiresAt && isAfter(new Date(), (sharedLink.expiresAt as any).toDate())) {
        return <LinkExpiredComponent />;
    }
    
    // 3. Check for password protection.
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

    // 4. Check for misconfiguration (no valid pages allowed).
    const navIdToScope: { [key: string]: string } = {
        '/dashboard': 'dashboard',
        '/tasks': 'tasks',
        '/calendar': 'calendar',
        '/reports': 'reports'
    };
    const availableNavItems = Array.isArray(sharedLink.navItems) ? sharedLink.navItems : [];
    const allowedNavItems = Array.isArray(sharedLink.allowedNavItems) ? sharedLink.allowedNavItems : [];
    const hasValidPages = availableNavItems.some(item => allowedNavItems.includes(item.id) && navIdToScope[item.path]);
    
    if (!hasValidPages) {
        return <LinkNotFoundComponent />;
    }

    // If all checks pass, show a loader while the useEffect performs the redirect.
    return (
        <div className="flex h-screen w-full items-center justify-center bg-background">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="ml-4">Preparing your shared view...</p>
        </div>
    );
}

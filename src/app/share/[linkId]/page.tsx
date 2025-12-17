
'use client';

import { useParams, useRouter, usePathname } from 'next/navigation';
import { useDoc, useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Loader2, FileText } from 'lucide-react';
import type { SharedLink, Company } from '@/lib/types';
import { useMemo, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PublicLogo } from '@/components/share/public-logo';

const LinkNotFoundComponent = () => (
    <div className="flex h-screen w-full items-center justify-center bg-secondary p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle className="flex items-center justify-center gap-2 text-destructive">
             <FileText className="h-6 w-6"/>
            Invalid or Expired Link
          </CardTitle>
        </CardHeader>
        <CardContent>
            <p className="text-muted-foreground">The share link you are trying to access is invalid, has expired, or has been disabled. Please check the link or contact the person who shared it with you.</p>
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
    const pathname = usePathname();
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

    // This maps the navigation item ID (e.g., 'nav_task_board') to the URL scope ('dashboard')
    const navIdToScope: { [key: string]: string } = {
        'nav_task_board': 'dashboard',
        'nav_list': 'tasks',
        'nav_calendar': 'calendar',
        'nav_performance_analysis': 'reports'
    };

    const handleAuth = () => {
        if (sharedLink?.password === password) {
            sessionStorage.setItem(`share_token_${linkId}`, 'true');
            setAuthError(null);
            router.refresh(); // Refresh the page to trigger the redirect logic
        } else {
            setAuthError('Invalid password.');
        }
    };
    
    // This effect handles the redirect logic once the link data is available.
    useEffect(() => {
        if (isLinkLoading || !sharedLink) return;

        // Condition 1: Check for expiration
        if (sharedLink.expiresAt && new Date(sharedLink.expiresAt) < new Date()) {
            return; // Don't redirect, let the component render notFound.
        }

        // Condition 2: Check for password protection
        const hasPassword = !!sharedLink.password;
        const isAuthenticated = sessionStorage.getItem(`share_token_${linkId}`) === 'true';

        if (hasPassword && !isAuthenticated) {
            return; // Don't redirect, let the component render the password form.
        }

        // Condition 3: Proceed with redirect if not password protected or already authenticated
        if (pathname === `/share/${linkId}`) {
            const allowedNavItems = Array.isArray(sharedLink.allowedNavItems) ? sharedLink.allowedNavItems : [];
            const availableNavItems = Array.isArray(sharedLink.navItems) ? sharedLink.navItems : [];

            const firstValidNavItem = availableNavItems
                .filter(item => allowedNavIds.includes(item.id) && navIdToScope[item.id])
                .sort((a, b) => a.order - b.order)[0];
            
            if (firstValidNavItem) {
                const scope = navIdToScope[firstValidNavItem.id];
                router.replace(`/share/${linkId}/${scope}`);
            }
            // If no valid nav item, the component will render the notFound component below.
        }

    }, [sharedLink, isLinkLoading, linkId, router, pathname, navIdToScope]);


    if (isLinkLoading) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }
    
    // Handle cases where the link is not found, expired, or has no valid pages.
    if (
        !sharedLink || 
        linkError || 
        (sharedLink.expiresAt && new Date(sharedLink.expiresAt) < new Date())
    ) {
        return <LinkNotFoundComponent />;
    }

    const allowedNavIds = Array.isArray(sharedLink.allowedNavItems) ? sharedLink.allowedNavItems : [];
    const availableNavItems = Array.isArray(sharedLink.navItems) ? sharedLink.navItems : [];
    const hasValidPages = availableNavItems.some(item => allowedNavIds.includes(item.id) && navIdToScope[item.id]);

    if (!hasValidPages) {
        return <LinkNotFoundComponent />;
    }

    // If password is required and user is not authenticated via session, show password form.
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

    // If all checks pass but redirect hasn't happened, show a loading spinner.
    return (
        <div className="flex h-screen w-full items-center justify-center bg-background">
            <Loader2 className="h-8 w-8 animate-spin" />
        </div>
    );
}


'use client';

import React, { useMemo, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDoc, useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Loader2, FileWarning, Clock } from 'lucide-react';
import type { SharedLink, NavigationItem } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PublicLogo } from '@/components/share/public-logo';
import { isAfter } from 'date-fns';
import { shareableNavItems, getScopeFromPath } from '@/lib/share-nav-config';

// --- Fallback Components ---

const LinkNotFoundComponent = ({ isMisconfigured = false }: { isMisconfigured?: boolean }) => (
    <div className="flex h-screen w-full items-center justify-center bg-secondary p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle className="flex items-center justify-center gap-2 text-destructive">
             <FileWarning className="h-6 w-6"/>
             {isMisconfigured ? "Link is Misconfigured" : "Link Not Found or Disabled"}
          </CardTitle>
        </CardHeader>
        <CardContent>
            <p className="text-muted-foreground">
                {isMisconfigured 
                    ? "This link is valid, but no accessible pages have been configured for viewing. Please contact the sender."
                    : "The share link you are trying to access is invalid, has been disabled, or does not exist."
                }
            </p>
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

const PasswordFormComponent = ({ company, linkId }: { company: SharedLink['company'] | null, linkId: string }) => {
    const [password, setPassword] = useState('');
    const [authError, setAuthError] = useState<string | null>(null);
    const [isChecking, setIsChecking] = useState(false);
    const router = useRouter();
    const firestore = useFirestore();

    const handleAuth = async () => {
        if (!firestore) return;
        setIsChecking(true);
        setAuthError(null);

        const linkDocRef = doc(firestore, 'sharedLinks', linkId);
        try {
            const docSnap = await (await import('firebase/firestore')).getDoc(linkDocRef);
            if (docSnap.exists() && docSnap.data().password === password) {
                if (typeof window !== 'undefined') {
                    sessionStorage.setItem(`share_token_${linkId}`, 'true');
                }
                router.refresh(); 
            } else {
                setAuthError('Invalid password.');
            }
        } catch (error) {
            setAuthError('An error occurred. Please try again.');
        } finally {
            setIsChecking(false);
        }
    };

    return (
        <div className="flex h-screen w-full flex-col items-center justify-center bg-secondary p-4">
            <Card className="w-full max-w-sm">
                 <CardHeader className='text-center'>
                    <div className='flex justify-center mb-4'><PublicLogo company={company} isLoading={false} /></div>
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
                            disabled={isChecking}
                        />
                        <Button onClick={handleAuth} disabled={isChecking}>
                            {isChecking && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            Unlock
                        </Button>
                    </div>
                    {authError && <p className="text-sm text-destructive text-center">{authError}</p>}
                </CardContent>
            </Card>
        </div>
    );
};

export default function SharedLinkRedirectorPage() {
    const params = useParams();
    const router = useRouter();
    const linkId = params.linkId as string;
    const firestore = useFirestore();

    const linkDocRef = useMemo(() => {
        if (!firestore || !linkId) return null;
        return doc(firestore, 'sharedLinks', linkId);
    }, [firestore, linkId]);

    const { data: sharedLink, isLoading: isLinkLoading, error: linkError } = useDoc<SharedLink>(linkDocRef);

    // --- Validation and Redirect Logic ---
    // This effect runs only when loading is complete and we have a definitive result.
    useEffect(() => {
        if (isLinkLoading || !linkId) return;

        // Condition 1: Document doesn't exist or there was a Firestore error.
        if (!sharedLink || linkError) {
            return; // Render will handle showing the NotFound component.
        }

        // Condition 2: Link is expired.
        if (sharedLink.expiresAt && isAfter(new Date(), (sharedLink.expiresAt as any).toDate())) {
            return; // Render will handle showing the Expired component.
        }
        
        // Condition 3: Password protection is active and user is not authenticated for this link.
        const isAuthenticated = typeof window !== 'undefined' && sessionStorage.getItem(`share_token_${linkId}`) === 'true';
        if (sharedLink.password && !isAuthenticated) {
            return; // Render will handle showing the PasswordForm component.
        }

        // Condition 4: Find the first valid page to redirect to.
        const allowedNavIds = Array.isArray(sharedLink.allowedNavItems) ? sharedLink.allowedNavItems : [];
        const availableNavItems = Array.isArray(sharedLink.navItems) ? sharedLink.navItems : shareableNavItems;

        const firstValidItem = availableNavItems
            .filter(item => allowedNavIds.includes(item.id)) // Filter by allowed IDs
            .sort((a, b) => a.order - b.order)[0]; // Get the first one by order

        if (firstValidItem) {
            const scope = getScopeFromPath(firstValidItem.path);
            if (scope) {
                router.replace(`/share/${linkId}/${scope}`);
            } else {
                // This case should be rare if config is correct, but we handle it.
                // It means an allowed page has no valid scope.
                return; // Render will handle showing Misconfigured error.
            }
        } else {
            // No valid/allowed pages found in the snapshot.
            return; // Render will handle showing Misconfigured error.
        }
    }, [sharedLink, isLinkLoading, linkError, linkId, router]);


    // --- Render Logic: Renders based on the validation status ---

    if (isLinkLoading) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }
    
    if (!sharedLink || linkError) {
        return <LinkNotFoundComponent />;
    }
    
    if (sharedLink.expiresAt && isAfter(new Date(), (sharedLink.expiresAt as any).toDate())) {
        return <LinkExpiredComponent />;
    }
    
    if (sharedLink.password && (typeof window === 'undefined' || sessionStorage.getItem(`share_token_${linkId}`) !== 'true')) {
        return <PasswordFormComponent company={sharedLink.company || null} linkId={linkId} />;
    }

    // After password check, validate if there's any content to show.
    const allowedNavIds = Array.isArray(sharedLink.allowedNavItems) ? sharedLink.allowedNavItems : [];
    const availableNavItems = Array.isArray(sharedLink.navItems) ? sharedLink.navItems : shareableNavItems;
    const hasValidPages = availableNavItems.some(item => allowedNavIds.includes(item.id) && getScopeFromPath(item.path));
    
    if (!hasValidPages) {
        return <LinkNotFoundComponent isMisconfigured={true} />;
    }

    // If all checks pass, show a loader while useEffect performs the redirect.
    return (
        <div className="flex h-screen w-full items-center justify-center bg-background">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="ml-4">Preparing your shared view...</p>
        </div>
    );
}

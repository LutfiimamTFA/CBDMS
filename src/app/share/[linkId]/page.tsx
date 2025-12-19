
'use client';

import React, { useMemo, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getFirestore, getDoc, type Firestore } from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { Loader2, FileWarning, Clock } from 'lucide-react';
import type { SharedLink, Company } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PublicLogo } from '@/components/share/public-logo';
import { isAfter } from 'date-fns';

const getScopeFromPath = (path: string): string | undefined => {
    if (!path) return undefined;
    const cleanPath = path.startsWith('/') ? path.substring(1) : path;
    // Don't generate a scope for paths that are just group folders
    if (cleanPath === 'admin' || cleanPath === 'admin/settings' || cleanPath === 'social-media') {
        return undefined;
    }
    return cleanPath;
};


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

const PasswordFormComponent = ({ company, linkId, onAuthenticated }: { company: Company | null, linkId: string, onAuthenticated: () => void }) => {
    const [password, setPassword] = useState('');
    const [authError, setAuthError] = useState<string | null>(null);
    const [isChecking, setIsChecking] = useState(false);
    const router = useRouter();
    const [firestore, setFirestore] = useState<Firestore | null>(null);

    useEffect(() => {
        setFirestore(getFirestore(initializeFirebase().firebaseApp));
    }, []);

    const handleAuth = async () => {
        if (!firestore) return;
        setIsChecking(true);
        setAuthError(null);

        const linkDocRef = doc(firestore, 'sharedLinks', linkId);
        try {
            const docSnap = await getDoc(linkDocRef);
            if (docSnap.exists() && docSnap.data().password === password) {
                if (typeof window !== 'undefined') {
                    sessionStorage.setItem(`share_token_${linkId}`, 'true');
                }
                onAuthenticated(); // Signal successful authentication
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

    const [isLoading, setIsLoading] = useState(true);
    const [sharedLink, setSharedLink] = useState<SharedLink | null>(null);
    const [company, setCompany] = useState<Company | null>(null);
    const [error, setError] = useState<string | null>(null);
    
    // New state to track authentication status
    const [isAuthenticated, setIsAuthenticated] = useState(() => {
        if (typeof window === 'undefined') return false;
        return sessionStorage.getItem(`share_token_${linkId}`) === 'true';
    });

    useEffect(() => {
        if (!linkId) {
            setError("Link ID is missing.");
            setIsLoading(false);
            return;
        }

        const fetchInitialData = async () => {
            try {
                const db = getFirestore(initializeFirebase().firebaseApp);
                
                const linkDocRef = doc(db, 'sharedLinks', linkId);
                const linkSnap = await getDoc(linkDocRef);

                if (!linkSnap.exists()) {
                    throw new Error("Link not found");
                }
                const linkData = { ...linkSnap.data(), id: linkSnap.id } as SharedLink;
                setSharedLink(linkData);

                // If link doesn't require a password, it's authenticated by default
                if (!linkData.password) {
                    setIsAuthenticated(true);
                }

                if (linkData.companyId) {
                    const companyDocRef = doc(db, 'companies', linkData.companyId);
                    const companySnap = await getDoc(companyDocRef);
                    if (companySnap.exists()) {
                        setCompany({ ...companySnap.data(), id: companySnap.id } as Company);
                    }
                }
            } catch (e: any) {
                console.error("Error fetching shared link data:", e);
                setError(e.message || "An unknown error occurred.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchInitialData();

    }, [linkId]);


    useEffect(() => {
        // Now depends on isAuthenticated state
        if (isLoading || !linkId || !sharedLink || error || !isAuthenticated) return;

        if (sharedLink.expiresAt && isAfter(new Date(), (sharedLink.expiresAt as any).toDate())) {
            return;
        }
        
        const allowedNavIds = new Set(sharedLink.allowedNavItems || []);
        
        const redirectableItems = (sharedLink.navItems || [])
            .filter(item => allowedNavIds.has(item.id) && getScopeFromPath(item.path))
            .sort((a, b) => a.order - b.order);

        const firstValidItem = redirectableItems[0];
        
        if (firstValidItem) {
            const scope = getScopeFromPath(firstValidItem.path);
            if (scope) {
                router.replace(`/share/${linkId}/${scope}`);
            }
        }
    }, [sharedLink, isLoading, error, linkId, router, isAuthenticated]); // Added isAuthenticated dependency


    if (isLoading) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }
    
    if (!sharedLink || error) {
        return <LinkNotFoundComponent />;
    }
    
    if (sharedLink.expiresAt && isAfter(new Date(), (sharedLink.expiresAt as any).toDate())) {
        return <LinkExpiredComponent />;
    }
    
    if (sharedLink.password && !isAuthenticated) {
        return <PasswordFormComponent company={company} linkId={linkId} onAuthenticated={() => setIsAuthenticated(true)} />;
    }

    const hasValidPages = (sharedLink.allowedNavItems || []).some(id => {
        const item = sharedLink.navItems?.find(nav => nav.id === id);
        return item && getScopeFromPath(item.path);
    });
    
    if (!hasValidPages) {
        return <LinkNotFoundComponent isMisconfigured={true} />;
    }

    return (
        <div className="flex h-screen w-full items-center justify-center bg-background">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="ml-4">Preparing your shared view...</p>
        </div>
    );
}


'use client';

import { notFound, useParams, useRouter, usePathname } from 'next/navigation';
import { useDoc, useFirestore, useCollection } from '@/firebase';
import { doc, collection, query, orderBy } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import type { SharedLink, NavigationItem } from '@/lib/types';
import { useMemo, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Logo } from '@/components/logo';

export default function SharedLinkRedirectorPage() {
    const params = useParams();
    const router = useRouter();
    const pathname = usePathname();
    const linkId = params.linkId as string;
    const firestore = useFirestore();

    const [password, setPassword] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [authError, setAuthError] = useState<string | null>(null);

    const linkDocRef = useMemo(() => {
        if (!firestore || !linkId) return null;
        return doc(firestore, 'sharedLinks', linkId);
    }, [firestore, linkId]);

    const { data: sharedLink, isLoading: isLinkLoading, error: linkError } = useDoc<SharedLink>(linkDocRef);

    const navItemsQuery = useMemo(
        () => firestore ? query(collection(firestore, 'navigationItems'), orderBy('order')) : null,
        [firestore]
    );
    const { data: allNavItems, isLoading: isNavItemsLoading } = useCollection<NavigationItem>(navItemsQuery);
    
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
            setIsAuthenticated(true);
            setAuthError(null);
        } else {
            setAuthError('Invalid password.');
        }
    };
    
    useEffect(() => {
        if (sharedLink) {
            if (sharedLink.expiresAt && new Date(sharedLink.expiresAt) < new Date()) {
                notFound();
                return;
            }
            if (!sharedLink.password || sessionStorage.getItem(`share_token_${linkId}`) === 'true') {
                 setIsAuthenticated(true);
            }
        }
    }, [sharedLink, linkId]);
    
    useEffect(() => {
        if (isAuthenticated && sharedLink && allNavItems && pathname === `/share/${linkId}`) {
            const firstValidNavItem = allNavItems
                .filter(item => sharedLink.allowedNavItems.includes(item.id) && navIdToScope[item.id])
                .sort((a, b) => a.order - b.order)[0];

            if (firstValidNavItem) {
                const scope = navIdToScope[firstValidNavItem.id];
                router.replace(`/share/${linkId}/${scope}`);
            } else {
                 notFound();
            }
        }
    }, [isAuthenticated, sharedLink, allNavItems, linkId, router, pathname]);

    const isLoading = isLinkLoading || isNavItemsLoading;
    const isRedirecting = isAuthenticated && pathname === `/share/${linkId}` && !!sharedLink && !!allNavItems;

    if (isLoading || isRedirecting) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }
    
    if (!isLoading && (linkError || !sharedLink)) {
        return notFound();
    }
    
    if (!isAuthenticated) {
        return (
            <div className="flex h-screen w-full flex-col items-center justify-center bg-secondary p-4">
                <Card className="w-full max-w-sm">
                     <CardHeader className='text-center'>
                        <div className='flex justify-center mb-4'><Logo/></div>
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

    return null;
}

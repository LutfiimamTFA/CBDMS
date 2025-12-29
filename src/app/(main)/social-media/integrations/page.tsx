
'use client';

import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Instagram, CheckCircle, AlertCircle, Loader2, PowerOff, Edit } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useUserProfile, useCollection, useFirestore } from '@/firebase';
import { collection, query, where, doc, deleteDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { formatDistanceToNow, isAfter } from 'date-fns';
import type { SocialMediaConnection } from '@/lib/types';

const InstagramIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8">
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5"></rect>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"></line>
  </svg>
);


export default function SocialMediaIntegrationsPage() {
    const { profile, isLoading: profileLoading } = useUserProfile();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isDisconnecting, setIsDisconnecting] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0); 

    const connectionsQuery = useMemo(() => {
        if (!firestore || !profile) return null;
        return query(
            collection(firestore, 'socialMediaConnections'),
            where('companyId', '==', profile.companyId)
        )
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [firestore, profile, refreshKey]);
    
    const { data: connections, isLoading: connectionsLoading } = useCollection<SocialMediaConnection>(connectionsQuery);

    const instagramConnection = useMemo(() => {
        return connections?.find(c => c.platform === 'instagram');
    }, [connections]);
    
    const isLoading = profileLoading || connectionsLoading;

    const isTokenExpired = useMemo(() => {
        if (!instagramConnection?.expiresAt) return false;
        const expiryDate = instagramConnection.expiresAt.toDate();
        return isAfter(new Date(), expiryDate);
    }, [instagramConnection]);
    
    const handleInstagramConnect = () => {
        const clientId = process.env.NEXT_PUBLIC_META_APP_ID;
        const redirectUri = `${window.location.origin}/social-media/integrations/instagram/callback`;
        const scope = 'pages_show_list,instagram_basic,instagram_content_publish,pages_read_engagement';
        const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&response_type=code&state=${profile?.id}`;
        window.location.href = authUrl;
    };


    const handleDisconnect = async () => {
        if (!firestore || !instagramConnection) return;
        setIsDisconnecting(true);
        const connectionRef = doc(firestore, 'socialMediaConnections', instagramConnection.id);
        try {
            await deleteDoc(connectionRef);
            toast({
                title: 'Disconnected',
                description: 'Your Instagram account has been disconnected.',
            });
            setRefreshKey(k => k + 1);
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Could not disconnect the account. Please try again.',
            });
        } finally {
            setIsDisconnecting(false);
        }
    };
    
    const isManagerOrAdmin = profile?.role === 'Super Admin' || profile?.role === 'Manager';

    return (
        <div className="flex h-svh flex-col bg-background">
            <main className="flex-1 overflow-auto p-4 md:p-6">
                <div className="mb-6">
                    <h2 className="text-2xl font-bold tracking-tight">Platform Integrations</h2>
                    <p className="text-muted-foreground">
                        Connect your social media accounts to enable direct publishing and analytics.
                    </p>
                </div>

                <div className="max-w-2xl mx-auto">
                    {isLoading ? (
                        <div className="flex justify-center items-center h-48">
                            <Loader2 className="h-8 w-8 animate-spin" />
                        </div>
                    ) : (
                        <Card>
                            <CardHeader className="flex flex-row items-start justify-between">
                            <div className="flex items-center gap-4">
                                    <InstagramIcon />
                                    <div>
                                        <CardTitle>Instagram</CardTitle>
                                        <CardDescription>Connect your professional Instagram account to publish content and track insights.</CardDescription>
                                    </div>
                            </div>
                                {instagramConnection ? (
                                    isTokenExpired ? (
                                        <Badge variant="destructive">
                                            <AlertCircle className="mr-2 h-4 w-4"/>
                                            Expired
                                        </Badge>
                                    ) : (
                                        <Badge variant="secondary" className="text-green-600 border-green-600 bg-green-100 dark:bg-green-900/50">
                                            <CheckCircle className="mr-2 h-4 w-4"/>
                                            Connected
                                        </Badge>
                                    )
                                ) : (
                                     <Badge variant="outline">
                                        <AlertCircle className="mr-2 h-4 w-4"/>
                                        Not Connected
                                    </Badge>
                                )}
                            </CardHeader>
                            <CardContent>
                            {instagramConnection ? (
                                    <div className="space-y-4">
                                        <div className="p-4 bg-secondary/50 rounded-lg border">
                                            <p className="text-sm font-semibold">Account: <span className="font-bold text-foreground">@{instagramConnection.instagramUsername}</span></p>
                                            <p className="text-xs text-muted-foreground">
                                                Connected {instagramConnection.connectedAt ? formatDistanceToNow(instagramConnection.connectedAt.toDate(), { addSuffix: true }) : 'N/A'}
                                            </p>
                                             {instagramConnection.expiresAt && (
                                                <p className="text-xs text-muted-foreground">
                                                    Token expires {formatDistanceToNow(instagramConnection.expiresAt.toDate(), { addSuffix: true })}
                                                </p>
                                            )}
                                        </div>
                                        
                                        <div className="flex flex-wrap items-center gap-4">
                                           {isManagerOrAdmin && (
                                               <Button onClick={handleInstagramConnect}>
                                                    <Instagram className="mr-2 h-4 w-4"/>
                                                    Reconnect Account
                                               </Button>
                                            )}
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="destructive" disabled={isDisconnecting}>
                                                        {isDisconnecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <PowerOff className="mr-2 h-4 w-4" />}
                                                        Disconnect Account
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            This will disconnect your Instagram account. You will need to reconnect to continue publishing posts.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction onClick={handleDisconnect}>Confirm Disconnect</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                        {isTokenExpired && <p className="text-sm text-destructive mt-2">Your connection token has expired. Please use "Reconnect Account" to refresh it.</p>}
                                    </div>
                            ) : (
                                    <div className="space-y-4">
                                        {isManagerOrAdmin ? (
                                            <>
                                                <p className="text-sm text-muted-foreground">
                                                    Connect your Instagram Business account to get started. You'll be redirected to Facebook to grant permissions.
                                                </p>
                                                <Button onClick={handleInstagramConnect}>
                                                    <Instagram className="mr-2 h-4 w-4"/>
                                                    Connect Instagram Account
                                                </Button>
                                            </>
                                        ) : (
                                            <div className="text-sm text-muted-foreground">
                                                Please ask a Manager or Super Admin to connect the company's Instagram account.
                                            </div>
                                        )}
                                </div>
                            )}
                            </CardContent>
                        </Card>
                    )}
                </div>
            </main>
        </div>
    );
}

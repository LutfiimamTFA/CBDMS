
'use client';

import React, { useMemo, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Instagram, CheckCircle, AlertCircle, Loader2, PowerOff, Link as LinkIcon, RefreshCw, Edit } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { useUserProfile, useCollection, useFirestore, useAuth } from '@/firebase';
import { collection, query, where, doc, deleteDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { formatDistanceToNow, addSeconds } from 'date-fns';
import type { SocialMediaConnection } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const META_APP_ID = process.env.NEXT_PUBLIC_META_APP_ID;
const REDIRECT_URI = process.env.NEXT_PUBLIC_INSTAGRAM_REDIRECT_URI;
const INSTAGRAM_AUTH_URL = `https://api.instagram.com/oauth/authorize?client_id=${META_APP_ID}&redirect_uri=${REDIRECT_URI}&scope=user_profile,user_media&response_type=code`;

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
        if (!instagramConnection?.connectedAt || !instagramConnection?.expiresIn) {
            return false;
        }
        const expiryDate = addSeconds(instagramConnection.connectedAt.toDate(), instagramConnection.expiresIn);
        return new Date() > expiryDate;
    }, [instagramConnection]);

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
    const isConfigMissing = !META_APP_ID || !REDIRECT_URI;

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
                                        </div>
                                        
                                        <div className="flex flex-wrap items-center gap-4">
                                           {isManagerOrAdmin && (
                                                <Button asChild>
                                                    <a href={INSTAGRAM_AUTH_URL}>
                                                        <RefreshCw className="mr-2 h-4 w-4" />
                                                        Reconnect Account
                                                    </a>
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
                                        {isTokenExpired && <p className="text-sm text-destructive mt-2">Your connection token has expired. Please reconnect the account.</p>}
                                    </div>
                            ) : (
                                    <div className="space-y-4">
                                        {isManagerOrAdmin ? (
                                            isConfigMissing ? (
                                                <Alert variant="destructive">
                                                    <AlertCircle className="h-4 w-4" />
                                                    <AlertTitle>Configuration Required</AlertTitle>
                                                    <AlertDescription>
                                                        The Instagram App ID and/or Redirect URI are missing from the environment variables. Please contact support to configure this integration.
                                                    </AlertDescription>
                                                </Alert>
                                            ) : (
                                                <>
                                                    <p className="text-sm text-muted-foreground">
                                                        No account is connected. Connect your account to get started.
                                                    </p>
                                                    <Button asChild>
                                                        <a href={INSTAGRAM_AUTH_URL}>
                                                            <LinkIcon className="mr-2 h-4 w-4" />
                                                            Connect Instagram Account
                                                        </a>
                                                    </Button>
                                                </>
                                            )
                                        ) : (
                                            <Alert variant="default">
                                                <AlertCircle className="h-4 w-4" />
                                                <AlertTitle>Not Connected</AlertTitle>
                                                <AlertDescription>
                                                    Please ask a Manager or Super Admin to connect the company's Instagram account.
                                                </AlertDescription>
                                            </Alert>
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

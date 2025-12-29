
'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Instagram, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { useUserProfile, useCollection, useFirestore } from '@/firebase';
import { collection, query, where, doc, deleteDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';


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

    const connectionsQuery = useMemo(() => {
        if (!firestore || !profile) return null;
        return query(
            collection(firestore, 'socialMediaConnections'),
            where('companyId', '==', profile.companyId)
        )
    }, [firestore, profile]);
    
    const { data: connections, isLoading: connectionsLoading } = useCollection(connectionsQuery);

    const instagramConnection = useMemo(() => {
        return connections?.find(c => c.platform === 'instagram');
    }, [connections]);
    
    const isLoading = profileLoading || connectionsLoading;

    // Replace with your actual App ID and Redirect URI
    const META_APP_ID = process.env.NEXT_PUBLIC_META_APP_ID || 'your-app-id';
    const REDIRECT_URI = process.env.NEXT_PUBLIC_INSTAGRAM_REDIRECT_URI || 'http://localhost:3000/social-media/integrations/instagram/callback';

    const instagramAuthUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${META_APP_ID}&redirect_uri=${REDIRECT_URI}&scope=instagram_basic,pages_show_list,instagram_content_publish,instagram_manage_insights&response_type=code`;

    const handleDisconnect = async () => {
        if (!firestore || !instagramConnection) return;

        const connectionRef = doc(firestore, 'socialMediaConnections', instagramConnection.id);
        try {
            await deleteDoc(connectionRef);
            toast({
                title: 'Disconnected',
                description: 'Your Instagram account has been disconnected.',
            });
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Could not disconnect the account. Please try again.',
            });
        }
    };


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
                                <Badge variant={instagramConnection ? "secondary" : "outline"} className={instagramConnection ? "text-green-600 border-green-600 bg-green-100 dark:bg-green-900/50" : ""}>
                                    {instagramConnection ? <CheckCircle className="mr-2 h-4 w-4"/> : <AlertCircle className="mr-2 h-4 w-4"/>}
                                    {instagramConnection ? 'Connected' : 'Not Connected'}
                                </Badge>
                            </CardHeader>
                            <CardContent>
                            {instagramConnection ? (
                                    <div className="space-y-4">
                                        <p className="text-sm text-muted-foreground">
                                            Connected as <span className="font-bold text-foreground">@{instagramConnection.instagramUsername}</span>. You can now schedule posts directly to Instagram.
                                        </p>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="destructive">Disconnect Account</Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        This will disconnect your Instagram account. You will need to reconnect it to continue publishing posts.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={handleDisconnect}>Confirm Disconnect</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                            ) : (
                                    <div className="space-y-4">
                                        <p className="text-sm text-muted-foreground">
                                        Click the button below to go through the Meta OAuth flow and securely connect your account.
                                        </p>
                                        <Button asChild>
                                            <Link href={instagramAuthUrl}>Connect Instagram Account</Link>
                                        </Button>
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

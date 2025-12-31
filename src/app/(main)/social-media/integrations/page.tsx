
'use client';
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Instagram, CheckCircle, AlertCircle, Loader2, PowerOff, Edit, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useUserProfile, useCollection, useFirestore, useAuth } from '@/firebase';
import { collection, query, where, doc, deleteDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { formatDistanceToNow, isAfter, isBefore, subDays, parseISO } from 'date-fns';
import type { SocialMediaConnection } from '@/lib/types';
import Link from 'next/link';
import { Textarea } from '@/components/ui/textarea';
import { useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const InstagramIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8">
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5"></rect>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"></line>
  </svg>
);

function ManualUpdateDialog({ onTokenUpdated, children }: { onTokenUpdated: () => void, children: React.ReactNode }) {
    const [open, setOpen] = useState(false);
    const [token, setToken] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();
    const { user } = useUserProfile();

    const handleUpdate = async () => {
        if (!token.trim()) {
            toast({ variant: 'destructive', title: 'Token is required' });
            return;
        }
        if (!user) {
            toast({ variant: 'destructive', title: 'Authentication Error' });
            return;
        }
        setIsLoading(true);
        try {
            const idToken = await user.getIdToken();
            const response = await fetch('/api/instagram/token/manual', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`
                },
                body: JSON.stringify({ manualToken: token }),
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Failed to validate and save the token.');
            toast({ title: 'Success!', description: data.message });
            onTokenUpdated();
            setOpen(false);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Update Failed', description: error.message });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Emergency: Update Instagram Access Token</DialogTitle>
                    <DialogDescription>
                        This is a fallback method. Paste your new long-lived access token below.
                        For help, consult the <Link href="/guide" target='_blank' className='text-primary underline'>official guide</Link>.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-2">
                    <Label htmlFor="token-input">Long-Lived Access Token</Label>
                    <Textarea id="token-input" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Paste your token here..." rows={5}/>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button onClick={handleUpdate} disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        Validate & Save Token
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

type ConfigStatus = {
    isConfigured: boolean;
    missing?: string[];
    appIdMasked?: string;
};

function ConfigDialog({ onConfigSaved, children }: { onConfigSaved: () => void, children: React.ReactNode }) {
    const [open, setOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [errorMessage, setFormErrorMessage] = useState<string | null>(null);
    const [appIdInput, setAppIdInput] = useState('');
    const [appSecretInput, setAppSecretInput] = useState('');
    const { auth } = useAuth();
    const { toast } = useToast();
    
    const handleSaveConfig = async () => {
        setFormErrorMessage(null);
        if (!/^\d+$/.test(appIdInput)) {
            setFormErrorMessage("App ID must only contain numbers.");
            return;
        }
        if (appSecretInput.trim().length < 10) {
            setFormErrorMessage("App Secret seems too short. Please double-check.");
            return;
        }
        if (!auth?.currentUser) return;

        setIsSaving(true);
        try {
            const idToken = await auth.currentUser.getIdToken();
            const response = await fetch('/api/admin/instagram-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
                body: JSON.stringify({ appId: appIdInput, appSecret: appSecretInput }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Failed to save configuration.');
            
            toast({ title: 'Configuration Saved', description: 'You can now connect your Instagram account.' });
            onConfigSaved();
            setOpen(false);
        } catch (error: any) {
            setFormErrorMessage(error.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Instagram API Setup</DialogTitle>
                    <DialogDescription>Provide your Instagram App credentials. This is a one-time setup.</DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="app-id">App ID</Label>
                        <Input id="app-id" value={appIdInput} onChange={(e) => setAppIdInput(e.target.value)} placeholder="Enter your Instagram App ID" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="app-secret">App Secret</Label>
                        <Input id="app-secret" type="password" value={appSecretInput} onChange={(e) => setAppSecretInput(e.target.value)} placeholder="Enter your Instagram App Secret" />
                    </div>
                    {errorMessage && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Save Failed</AlertTitle>
                            <AlertDescription>{errorMessage}</AlertDescription>
                        </Alert>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button onClick={handleSaveConfig} disabled={isSaving}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Configuration
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default function SocialMediaIntegrationsPage() {
    const { profile, isLoading: profileLoading } = useUserProfile();
    const firestore = useFirestore();
    const auth = useAuth();
    const { toast } = useToast();
    const searchParams = useSearchParams();

    const [isDisconnecting, setIsDisconnecting] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0); 

    const [configStatus, setConfigStatus] = useState<ConfigStatus | null>(null);
    const [statusLoading, setStatusLoading] = useState(true);
    const [statusError, setStatusError] = useState<string | null>(null);
    
    const connectionsQuery = useMemo(() => {
        if (!firestore || !profile) return null;
        return query(
            collection(firestore, 'socialMediaConnections'),
            where('companyId', '==', profile.companyId)
        )
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [firestore, profile, refreshKey]);
    
    const { data: connections, isLoading: connectionsLoading } = useCollection<SocialMediaConnection>(connectionsQuery);
    const instagramConnection = useMemo(() => connections?.find(c => c.platform === 'instagram'), [connections]);

    const checkConfig = useCallback(async () => {
        if (!auth?.currentUser) return;
        setStatusLoading(true);
        setStatusError(null);
        try {
            const idToken = await auth.currentUser.getIdToken();
            const response = await fetch('/api/admin/instagram-config', {
                headers: { 'Authorization': `Bearer ${idToken}` }
            });
            const data = await response.json();
             if (!response.ok) {
                throw new Error(data.message || 'Failed to check server configuration.');
            }
            setConfigStatus(data);
        } catch (error: any) {
            console.error("Failed to fetch config status:", error);
            setStatusError(error.message);
        } finally {
            setStatusLoading(false);
        }
    }, [auth]);

    useEffect(() => {
        checkConfig();
    }, [checkConfig]);

    useEffect(() => {
        const error = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');
        if (error) {
            toast({
                variant: 'destructive',
                title: `Connection Failed: ${error.replace(/_/g, ' ')}`,
                description: errorDescription || 'An unknown error occurred during the Instagram connection process.',
                duration: 10000,
            });
        }
    }, [searchParams, toast]);

    const { isTokenExpiring, isTokenExpired } = useMemo(() => {
        if (!instagramConnection?.expiresAt) return { isTokenExpiring: false, isTokenExpired: false };
        const expiryDate = instagramConnection.expiresAt.toDate();
        const tenDaysFromNow = subDays(expiryDate, 10);
        const now = new Date();
        return {
            isTokenExpired: isAfter(now, expiryDate),
            isTokenExpiring: isAfter(now, tenDaysFromNow) && isBefore(now, expiryDate)
        };
    }, [instagramConnection]);
    
    const handleConnectOrRenew = () => {
        setIsConnecting(true);
        window.location.href = "/api/instagram/oauth/start";
    };
    
    const handleDisconnect = async () => {
        if (!firestore || !instagramConnection) return;
        setIsDisconnecting(true);
        const connectionRef = doc(firestore, 'socialMediaConnections', instagramConnection.id);
        try {
            await deleteDoc(connectionRef);
            toast({ title: 'Disconnected', description: 'Your Instagram account has been disconnected.' });
            setRefreshKey(k => k + 1);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not disconnect the account.' });
        } finally {
            setIsDisconnecting(false);
        }
    };
    
    const isManagerOrAdmin = profile?.role === 'Super Admin' || profile?.role === 'Manager';
    const isLoading = profileLoading || connectionsLoading || statusLoading;

    const renderConnectionStatus = () => {
        if (instagramConnection) {
            return (
                <div className="space-y-4">
                    <div className="p-4 bg-secondary/50 rounded-lg border">
                        <p className="text-sm font-semibold">Account: <span className="font-bold text-foreground">@{instagramConnection.instagramUsername}</span></p>
                        <p className="text-xs text-muted-foreground">Connected {instagramConnection.connectedAt ? formatDistanceToNow(parseISO(instagramConnection.connectedAt), { addSuffix: true }) : 'N/A'}</p>
                        {instagramConnection.expiresAt && <p className={`text-xs ${isTokenExpired ? 'text-destructive' : 'text-muted-foreground'}`}>Token expires {formatDistanceToNow(instagramConnection.expiresAt.toDate(), { addSuffix: true })}</p>}
                    </div>
                    {(isTokenExpired || isTokenExpiring) && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Attention Required</AlertTitle>
                            <AlertDescription>Your connection token is {isTokenExpired ? 'expired' : 'expiring soon'}. Please renew it to ensure uninterrupted service.</AlertDescription>
                        </Alert>
                    )}
                </div>
            );
        }
        return <p className="text-sm text-muted-foreground">No account connected. Connect an account to start auto-posting.</p>;
    }
    
    const renderActionButtons = () => {
        if (isManagerOrAdmin) {
            return (
                <div className="flex flex-wrap gap-4 items-center">
                    <Button onClick={handleConnectOrRenew} disabled={isConnecting || !configStatus?.isConfigured}>
                        {isConnecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Instagram className="mr-2 h-4 w-4" />}
                        {instagramConnection ? 'Renew Connection' : 'Connect with Instagram'}
                    </Button>
                    <ConfigDialog onConfigSaved={checkConfig}>
                        <Button variant="outline"><Edit className="mr-2 h-4 w-4" /> Change Configuration</Button>
                    </ConfigDialog>
                    {instagramConnection && (
                         <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" disabled={isDisconnecting}>
                                    {isDisconnecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <PowerOff className="mr-2 h-4 w-4" />}
                                    Disconnect
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                    <AlertDialogDescription>This will disconnect your Instagram account. You will need to reconnect to continue publishing posts.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleDisconnect}>Confirm Disconnect</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    )}
                </div>
            );
        }
        return <p className="text-sm text-muted-foreground">Configuration and connection management can only be performed by a Manager or Administrator.</p>
    }

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
                    {isLoading && !configStatus ? (
                        <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin" /></div>
                    ) : (
                        <Card>
                            <CardHeader className="flex flex-row items-start justify-between">
                                <div className="flex items-center gap-4">
                                    <InstagramIcon />
                                    <div>
                                        <CardTitle>Instagram Business</CardTitle>
                                        <CardDescription>Connect your professional account to publish content and track insights.</CardDescription>
                                    </div>
                                </div>
                                {instagramConnection ? (
                                    isTokenExpired ? (
                                        <Badge variant="destructive"><AlertCircle className="mr-2 h-4 w-4"/>Expired</Badge>
                                    ) : (
                                        <Badge variant="secondary" className="text-green-600 border-green-600 bg-green-100 dark:bg-green-900/50"><CheckCircle className="mr-2 h-4 w-4"/>Connected</Badge>
                                    )
                                ) : (
                                     <Badge variant="outline"><AlertCircle className="mr-2 h-4 w-4"/>Not Connected</Badge>
                                )}
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {statusLoading && (
                                     <div className="flex items-center gap-2 p-4 text-muted-foreground">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <span>Checking configuration...</span>
                                    </div>
                                )}
                                {statusError && (
                                    <Alert variant="destructive">
                                        <AlertCircle className="h-4 w-4" />
                                        <AlertTitle>Could Not Check Status</AlertTitle>
                                        <AlertDescription>
                                            {statusError}
                                            <Button variant="link" onClick={checkConfig} className="p-0 h-auto ml-2">Try again</Button>
                                        </AlertDescription>
                                    </Alert>
                                )}
                                {!statusLoading && !statusError && (
                                    <>
                                        {renderConnectionStatus()}
                                        <Separator/>
                                        {renderActionButtons()}
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </div>
            </main>
        </div>
    );
}


    
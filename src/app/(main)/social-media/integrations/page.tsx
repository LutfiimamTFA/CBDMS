
'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Instagram, CheckCircle, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const InstagramIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8">
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5"></rect>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"></line>
  </svg>
);


export default function SocialMediaIntegrationsPage() {

    const isInstagramConnected = false; // Placeholder state

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
                    <Card>
                        <CardHeader className="flex flex-row items-start justify-between">
                           <div className="flex items-center gap-4">
                                <InstagramIcon />
                                <div>
                                    <CardTitle>Instagram</CardTitle>
                                    <CardDescription>Connect your professional Instagram account to publish content and track insights.</CardDescription>
                                </div>
                           </div>
                             <Badge variant={isInstagramConnected ? "secondary" : "outline"} className={isInstagramConnected ? "text-green-600 border-green-600 bg-green-100 dark:bg-green-900/50" : ""}>
                                {isInstagramConnected ? <CheckCircle className="mr-2 h-4 w-4"/> : <AlertCircle className="mr-2 h-4 w-4"/>}
                                {isInstagramConnected ? 'Connected' : 'Not Connected'}
                            </Badge>
                        </CardHeader>
                        <CardContent>
                           {isInstagramConnected ? (
                                <div className="space-y-4">
                                    <p className="text-sm text-muted-foreground">
                                        Your account is connected. You can now schedule posts directly to Instagram.
                                    </p>
                                    <Button variant="destructive">Disconnect Account</Button>
                                </div>
                           ) : (
                                <div className="space-y-4">
                                    <p className="text-sm text-muted-foreground">
                                       Click the button below to go through the Meta OAuth flow and securely connect your account.
                                    </p>
                                    <Button>Connect Instagram Account</Button>
                               </div>
                           )}
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    );
}

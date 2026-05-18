
'use client';

import { useMemo } from 'react';
import { useDoc, useFirestore, useUserProfile } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { CompanySettings } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Wrench } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function MaintenancePage() {
    const firestore = useFirestore();
    const { profile, isLoading: isProfileLoading } = useUserProfile();
    const router = useRouter();

    const companySettingsDocRef = useMemo(() => {
        if (!firestore || !profile?.companyId) return null;
        return doc(firestore, 'companySettings', profile.companyId);
    }, [firestore, profile?.companyId]);
    
    const { data: companySettings, isLoading: isSettingsLoading } = useDoc<CompanySettings>(companySettingsDocRef);

    const isLoading = isProfileLoading || isSettingsLoading;

    if (!isLoading && profile?.role === 'Super Admin') {
        router.replace('/dashboard');
        return <div className="flex h-svh w-full items-center justify-center bg-background"><Loader2 className="animate-spin h-8 w-8" /></div>;
    }

    if (!isLoading && !companySettings?.maintenanceSettings?.isEnabled) {
        router.replace('/dashboard');
        return <div className="flex h-svh w-full items-center justify-center bg-background"><Loader2 className="animate-spin h-8 w-8" /></div>;
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-secondary p-4">
            <Card className="w-full max-w-lg text-center">
                <CardHeader>
                     <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                        <Wrench className="h-8 w-8 text-primary" />
                    </div>
                    <CardTitle className="mt-4 text-2xl">Under Maintenance</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {isLoading ? (
                        <Loader2 className="h-6 w-6 animate-spin mx-auto"/>
                    ) : (
                        <>
                            <p className="text-base text-muted-foreground">
                                {companySettings?.maintenanceSettings?.message || 'The application is currently undergoing scheduled maintenance. We will be back online shortly.'}
                            </p>
                            {companySettings?.maintenanceSettings?.estimatedCompletion && (
                                <div className="rounded-md bg-secondary p-3">
                                    <p className="text-sm font-medium">Estimated Completion: <span className="font-bold">{companySettings.maintenanceSettings.estimatedCompletion}</span></p>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

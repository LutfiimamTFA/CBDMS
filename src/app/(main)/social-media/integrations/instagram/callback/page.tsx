'use client';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { XCircle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

// This page is part of the automated OAuth flow, which is being replaced by the manual token flow.
// This simplified page will show an error and direct the user back, in case they land here by mistake.
export default function InstagramCallbackPage() {
    return (
        <div className="flex h-svh w-full items-center justify-center bg-background">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center items-center">
                    <XCircle className="h-12 w-12 text-destructive" />
                    <CardTitle className="mt-4">Endpoint Deprecated</CardTitle>
                    <CardDescription>This page is part of a deprecated authentication flow. Please use the manual token update method instead.</CardDescription>
                    <Button asChild variant="link" className="mt-4">
                        <Link href="/social-media/integrations">Back to Integrations</Link>
                    </Button>
                </CardHeader>
            </Card>
        </div>
    );
}

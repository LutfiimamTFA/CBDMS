
'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

function InstagramCallback() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error_description');

    if (error) {
      setErrorMessage(error);
      setStatus('error');
      return;
    }

    if (code) {
      // Exchange the code for an access token
      fetch('/api/instagram/auth/callback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      })
      .then(async (res) => {
        if (res.ok) {
          setStatus('success');
          // Redirect back to integrations page after a short delay
          setTimeout(() => router.push('/social-media/integrations'), 2000);
        } else {
          const data = await res.json();
          throw new Error(data.message || 'Failed to get access token.');
        }
      })
      .catch((err) => {
        setErrorMessage(err.message);
        setStatus('error');
      });
    } else {
        setErrorMessage('No authorization code provided.');
        setStatus('error');
    }
  }, [searchParams, router]);

  const renderStatus = () => {
    switch (status) {
      case 'loading':
        return (
          <>
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <CardTitle className="mt-4">Connecting your Account</CardTitle>
            <CardDescription>Please wait while we securely connect to your Instagram account. Do not close this window.</CardDescription>
          </>
        );
      case 'success':
        return (
          <>
            <CheckCircle className="h-12 w-12 text-green-500" />
            <CardTitle className="mt-4">Connection Successful!</CardTitle>
            <CardDescription>Your account has been connected. You will be redirected shortly.</CardDescription>
          </>
        );
      case 'error':
        return (
          <>
            <XCircle className="h-12 w-12 text-destructive" />
            <CardTitle className="mt-4">Connection Failed</CardTitle>
            <CardDescription>{errorMessage || 'An unknown error occurred.'}</CardDescription>
            <Button onClick={() => router.push('/social-media/integrations')} className="mt-6">Back to Integrations</Button>
          </>
        );
    }
  };

  return (
    <div className="flex h-svh w-full items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center items-center">
            {renderStatus()}
        </CardHeader>
      </Card>
    </div>
  );
}

export default function InstagramCallbackPage() {
    return (
        <Suspense fallback={<Loader2 className="h-12 w-12 animate-spin text-primary" />}>
            <InstagramCallback />
        </Suspense>
    )
}

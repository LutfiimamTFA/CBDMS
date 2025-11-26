'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Logo } from '@/components/logo';
import { MailCheck } from 'lucide-react';
import Link from 'next/link';

export default function CheckEmailPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/50">
            <MailCheck className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <CardTitle className="mt-4 text-2xl">Check Your Email</CardTitle>
          <CardDescription className="mt-2 text-base text-muted-foreground">
            We've sent a verification link to your email address. Please click
            the link in the email to continue.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-sm text-muted-foreground">
            Didn't receive the email? Check your spam folder or wait a few
            minutes.
          </p>
          <Button asChild variant="link" className="mt-4">
            <Link href="/login">Back to Login</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

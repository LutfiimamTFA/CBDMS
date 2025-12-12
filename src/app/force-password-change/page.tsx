
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useUserProfile, useAuth, initiateSignOut } from '@/firebase';
import { KeyRound, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ForcePasswordChangePage() {
  const router = useRouter();
  const auth = useAuth();
  const { user, isLoading: isProfileLoading } = useUserProfile();
  const [isSaving, setIsSaving] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const { toast } = useToast();

  const handlePasswordChange = async () => {
    if (!user) return;
    if (password.length < 6) {
        toast({
            variant: "destructive",
            title: "Password Too Short",
            description: "Your new password must be at least 6 characters long.",
        });
        return;
    }
    if (password !== confirmPassword) {
        toast({
            variant: "destructive",
            title: "Passwords Do Not Match",
            description: "Please ensure both password fields are identical.",
        });
        return;
    }

    setIsSaving(true);
    
    try {
      const response = await fetch('/api/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user.uid, password: password }),
      });

      if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Server failed to set new password.');
      }
      
      toast({
          title: "Password Changed Successfully",
          description: "Please log in again with your new password.",
      });
      
      // Force sign out to complete the process
      if (auth) {
        await initiateSignOut(auth);
      }
      router.push('/login');

    } catch (error: any) {
      console.error("API call to set-password failed:", error);
      toast({
          variant: "destructive",
          title: "Update Failed",
          description: error.message || "Could not set new password. Please try again.",
      });
      setIsSaving(false);
    }
  };
  
  const isLoading = isProfileLoading;

  if (isLoading) {
      return (
         <div className="flex min-h-screen items-center justify-center bg-secondary/50 p-4">
            <Loader2 className="h-10 w-10 animate-spin" />
        </div>
      )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <KeyRound className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="mt-4 text-2xl">Set Your New Password</CardTitle>
          <CardDescription className="mt-2 text-base text-muted-foreground">
            For security, your password has been reset. Please create a new, secure password to continue.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input 
                id="new-password" 
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Must be at least 6 characters"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your new password"
               />
            </div>
        </CardContent>
        <CardFooter>
          <Button
            onClick={handlePasswordChange}
            disabled={isSaving || isLoading || !password || !confirmPassword}
            className="w-full"
          >
            {isSaving && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Save New Password & Continue
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

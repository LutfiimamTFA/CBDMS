'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { initiateEmailSignIn, initiateEmailSignUp } from '@/firebase';
import { useAuth, useFirebase, useFirestore } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Logo } from '@/components/logo';
import { Separator } from '@/components/ui/separator';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { user, isUserLoading } = useFirebase();

  useEffect(() => {
    if (!isUserLoading && user) {
      router.push('/dashboard');
    }
  }, [user, isUserLoading, router]);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const {
    formState: { isSubmitting },
    getValues,
    handleSubmit,
    setError,
    clearErrors
  } = form;

  const onSignIn = (values: LoginFormValues) => {
    const { email, password } = values;
    if (!auth) {
      toast({
        variant: 'destructive',
        title: 'Initialization Error',
        description: 'Firebase is not ready. Please try again in a moment.',
      });
      return;
    }
    clearErrors();
    initiateEmailSignIn(auth, email, password)
      .catch((error) => {
        console.error("Sign-in Error:", error.code, error.message);
        toast({
            variant: "destructive",
            title: "Sign-in Failed",
            description: "Invalid credentials. Please check your email and password.",
        });
        setError("root", { type: "manual", message: "Invalid credentials" });
      });
  };

  const onSignUp = (values: LoginFormValues) => {
     const { email, password } = values;
     if (!auth || !firestore) {
      toast({
        variant: 'destructive',
        title: 'Initialization Error',
        description: 'Firebase is not ready. Please try again in a moment.',
      });
      return;
    }
    clearErrors();
    initiateEmailSignUp(auth, firestore, email, password)
     .catch((error) => {
        console.error("Sign-up Error:", error.code, error.message);
         toast({
            variant: "destructive",
            title: "Sign-up Failed",
            description: error.code === 'auth/email-already-in-use' 
                ? "This email is already registered. Please sign in."
                : "An unexpected error occurred during sign-up.",
        });
        setError("root", { type: "manual", message: "Sign-up failed" });
      });
  }

  if (isUserLoading || user) {
     return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/50 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mb-4 flex justify-center">
             <Logo />
          </div>
          <CardTitle className="text-2xl">Welcome</CardTitle>
          <CardDescription>
            Sign in or create an account to continue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form id="login-form">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  {...form.register('email')}
                  disabled={isSubmitting}
                />
                {form.formState.errors.email && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.email.message}
                  </p>
                )}
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password">Password</Label>
                </div>
                <Input
                  id="password"
                  type="password"
                  {...form.register('password')}
                  disabled={isSubmitting}
                />
                 {form.formState.errors.password && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.password.message}
                  </p>
                )}
              </div>
            </div>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button onClick={handleSubmit(onSignIn)} className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Sign In
          </Button>
           <div className="relative w-full">
            <Separator />
            <span className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2 text-xs text-muted-foreground">OR</span>
          </div>
          <Button variant="secondary" onClick={handleSubmit(onSignUp)} className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Sign Up
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

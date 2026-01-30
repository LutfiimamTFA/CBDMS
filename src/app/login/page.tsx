'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ArrowUpRight, Loader2, Eye, EyeOff } from 'lucide-react';
import {
  initiateEmailSignIn,
} from '@/firebase/non-blocking-login';
import { useAuth, useUserProfile } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  FormLabel,
} from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';


const signInSchema = z.object({
  email: z.string().email({ message: 'Invalid email address.' }),
  password: z
    .string()
    .min(6, { message: 'Password must be at least 6 characters.' }),
  rememberMe: z.boolean().default(true),
});

type SignInFormValues = z.infer<typeof signInSchema>;

export default function LoginPage() {
  const router = useRouter();
  const auth = useAuth();
  const { user, profile, isUserLoading } = useUserProfile();
  const { toast } = useToast();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const signInForm = useForm<SignInFormValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '', rememberMe: true },
  });

  // Effect to handle redirection after user state changes
  useEffect(() => {
    // If the profile is loaded and the user is authenticated
    if (!isUserLoading && user && profile) {
      if (profile.role === 'Employee' || profile.role === 'PIC') {
        router.replace('/my-work');
      } else {
        router.replace('/dashboard');
      }
    }
  }, [user, profile, isUserLoading, router]);

  const onSignIn = async (data: SignInFormValues) => {
    if (!auth) return;
    setIsSigningIn(true);
    try {
      await initiateEmailSignIn(auth, data.email, data.password, data.rememberMe);
      // After sign-in is initiated, the useEffect above will handle the redirect
      // when the `user` and `profile` states are updated by the auth listener.
    } catch (error: any) {
      let description = 'Invalid credentials. Please check your email and password.';
      toast({
        variant: 'destructive',
        title: 'Sign-in Failed',
        description,
      });
      setIsSigningIn(false);
    }
  };
  
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
            <div className="flex items-center gap-2">
              <ArrowUpRight className="h-7 w-7 text-primary" />
              <h1 className="font-headline text-xl font-bold truncate">CBDMS Workspace</h1>
            </div>
          </div>
          <CardTitle className="text-2xl">Welcome Back</CardTitle>
          <CardDescription>
            Sign in to access your dashboard. Accounts are created by an administrator.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...signInForm}>
            <form
              onSubmit={signInForm.handleSubmit(onSignIn)}
              className="space-y-4 pt-4"
            >
              <FormField
                control={signInForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <Label htmlFor="email-signin">Email</Label>
                    <Input
                      id="email-signin"
                      type="email"
                      placeholder="m@example.com"
                      {...field}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={signInForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <Label htmlFor="password-signin">Password</Label>
                    <div className="relative">
                      <Input id="password-signin" type={showPassword ? 'text' : 'password'} {...field} />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff /> : <Eye />}
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={signInForm.control}
                name="rememberMe"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-2">
                    <FormControl>
                      <Checkbox
                        id="remember-me"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <Label htmlFor="remember-me" className="cursor-pointer font-normal">
                      Remember me
                    </Label>
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full"
                disabled={isSigningIn}
              >
                {isSigningIn && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Sign In
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter>
          <p className="w-full text-center text-xs text-muted-foreground">
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Logo } from '@/components/logo';
import { Briefcase, Building, Shield, User as UserIcon, Loader2 } from 'lucide-react';
import { initiateEmailSignIn, useUserProfile } from '@/firebase';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const roles = [
  {
    icon: Shield,
    title: 'Super Admin',
    description: 'Manages the entire application, including system settings and database operations.',
  },
  {
    icon: Briefcase,
    title: 'Manager / Admin',
    description: 'Oversees users, roles, and tasks within their company. Monitors progress and accesses reports.',
  },
  {
    icon: UserIcon,
    title: 'Employee / Staff',
    description: 'Works on assigned tasks, tracks time, and communicates with the team.',
  },
  {
    icon: Building,
    title: 'Client',
    description: 'Views specific tasks, provides feedback, and approves final deliverables for their company.',
  },
];


export default function LoginPage() {
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  // Use the main user profile hook to get the global auth state
  const { auth, user, isLoading: isUserLoading, error: userError } = useUserProfile();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  // Effect to handle login errors from the global state
  useEffect(() => {
    if (userError) {
      toast({
        variant: 'destructive',
        title: 'Login Failed',
        description: 'Invalid credentials. Please check your email and password.',
      });
      setIsAuthLoading(false); // Stop loading on error
    }
  }, [userError, toast]);

  // Effect to handle successful login based on the global user profile state
  // This ensures we only redirect when the entire app knows the user is logged in
  useEffect(() => {
    if (user && !isUserLoading) {
      router.push('/dashboard');
    }
  }, [user, isUserLoading, router]);

  const onSubmit = (data: LoginFormValues) => {
    setIsAuthLoading(true);
    // The initiateEmailSignIn function handles sign-in or sign-up.
    // We don't need a try-catch here, as errors are caught by the hook.
    initiateEmailSignIn(auth, data.email, data.password);
  };
  
  // While checking auth state on initial load, show a loading screen.
  if (isUserLoading) {
    return (
      <div className="flex h-svh items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }


  return (
    <div className="w-full h-svh lg:grid lg:min-h-[600px] lg:grid-cols-2 xl:min-h-[800px]">
      <div className="hidden bg-muted lg:flex flex-col items-center justify-center p-10">
         <div className="flex items-center gap-4 self-start">
            <Logo />
         </div>
         <div className="mt-12 w-full max-w-md">
            <h2 className="text-3xl font-bold font-headline">Welcome to WorkWise</h2>
            <p className="text-muted-foreground mt-2">The all-in-one platform for modern team collaboration.</p>
         </div>
         <div className="mt-10 grid gap-6 w-full max-w-md">
            {roles.map((role) => (
                <div key={role.title} className="flex items-start gap-4">
                    <div className="bg-primary/10 text-primary p-3 rounded-full">
                        <role.icon className="h-5 w-5"/>
                    </div>
                    <div>
                        <h3 className="font-semibold">{role.title}</h3>
                        <p className="text-sm text-muted-foreground">{role.description}</p>
                    </div>
                </div>
            ))}
         </div>
         <p className="self-start mt-auto text-sm text-muted-foreground">© 2024 WorkWise Inc.</p>
      </div>
      <div className="flex items-center justify-center py-12">
        <div className="mx-auto grid w-[350px] gap-6">
          <div className="grid gap-2 text-center">
            <h1 className="text-3xl font-bold font-headline">Login or Sign Up</h1>
            <p className="text-balance text-muted-foreground">
              Enter your details to sign in or create a new account.
            </p>
          </div>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="grid gap-2">
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="m@example.com"
                        {...field}
                        disabled={isAuthLoading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem className="grid gap-2">
                    <div className="flex items-center">
                      <FormLabel>Password</FormLabel>
                      <Link
                        href="#"
                        className="ml-auto inline-block text-sm underline"
                      >
                        Forgot your password?
                      </Link>
                    </div>
                    <FormControl>
                      <Input type="password" {...field} disabled={isAuthLoading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isAuthLoading}>
                {isAuthLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign In / Sign Up
              </Button>
            </form>
          </Form>
          <div className="mt-4 text-center text-sm">
             By signing in, you agree to our terms of service.
          </div>
        </div>
      </div>
    </div>
  );
}

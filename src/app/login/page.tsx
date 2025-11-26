'use client';

import { useState } from 'react';
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
import { Briefcase, Building, Shield, User as UserIcon, Users, Loader2 } from 'lucide-react';
import { initiateEmailSignIn, useAuth } from '@/firebase';

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
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const auth = useAuth();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    try {
      // We are not awaiting this, the onAuthStateChanged listener in the layout will handle the redirect
      initiateEmailSignIn(auth, data.email, data.password);
      
      // We can't immediately check for the user, so we optimistically assume login will succeed
      // and let the listener handle the redirect. We can show a toast.
       toast({
        title: 'Logging in...',
        description: 'You will be redirected shortly.',
      });
      // The router.push will be handled by the MainLayout's useEffect
      
    } catch (error: any) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Login Failed',
        description: error.message || 'An unexpected error occurred.',
      });
      setIsLoading(false);
    }
    // Don't set isLoading to false here if login is successful,
    // as the page will be redirected.
  };

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
            <h1 className="text-3xl font-bold font-headline">Login</h1>
            <p className="text-balance text-muted-foreground">
              Enter your email below to login to your account
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
                        disabled={isLoading}
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
                      <Input type="password" {...field} disabled={isLoading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Login
              </Button>
            </form>
          </Form>
          <div className="mt-4 text-center text-sm">
            Don&apos;t have an account?{' '}
            <Link href="#" className="underline">
              Sign up
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

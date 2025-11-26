'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
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
import { useUserProfile } from '@/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';


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
  const router = useRouter();
  const { toast } = useToast();
  const { auth, firestore, user, isUserLoading } = useUserProfile();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });
  
  const { formState: { isSubmitting } } = form;

  useEffect(() => {
    if (!isUserLoading && user) {
      router.push('/dashboard');
    }
  }, [user, isUserLoading, router]);


  const onSubmit = async (data: LoginFormValues) => {
    if (!auth || !firestore) {
        toast({
            variant: "destructive",
            title: "Initialization Error",
            description: "Firebase services are not ready. Please try again in a moment.",
        });
        return;
    }

    try {
        await signInWithEmailAndPassword(auth, data.email, data.password);
        // Successful login is handled by the useEffect redirecting to /dashboard
    } catch (error: any) {
        if (error.code === 'auth/user-not-found') {
            try {
                const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
                const newUser = userCredential.user;
                const userProfileRef = doc(firestore, 'users', newUser.uid);
                await setDoc(userProfileRef, {
                    name: data.email.split('@')[0],
                    email: newUser.email,
                    role: 'Employee',
                    companyId: 'company-a',
                    avatarUrl: `https://i.pravatar.cc/150?u=${newUser.uid}`
                });
                // After user creation, the onAuthStateChanged listener will trigger the redirect
            } catch (createError: any) {
                toast({
                    variant: "destructive",
                    title: "Sign Up Failed",
                    description: createError.message || "Could not create a new account.",
                });
            }
        } else {
            toast({
                variant: "destructive",
                title: "Login Failed",
                description: error.code === 'auth/invalid-credential' 
                    ? 'Invalid email or password. Please try again.'
                    : error.message || "An unexpected error occurred.",
            });
        }
    }
  };
  
  if (isUserLoading) {
    return (
      <div className="flex h-svh items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // If user is already logged in, they will be redirected by the useEffect.
  // This prevents the login form from flashing.
  if (user) {
    return null;
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
            <h1 className="text-3xl font-bold font-headline">Login</h1>
            <p className="text-balance text-muted-foreground">
              Enter your credentials to access your dashboard.
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
                        disabled={isSubmitting}
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
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign In
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

'use client';

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowRight, Briefcase, Loader2 } from "lucide-react";
import { format } from 'date-fns';
import { useUserProfile } from "@/firebase";
import { useRouter } from "next/navigation";

export default function RootPage() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const { user, profile, isLoading } = useUserProfile();
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  // This effect handles the redirection logic once the authentication state is determined.
  useEffect(() => {
    // Only run the redirection logic when loading is complete.
    if (!isLoading) {
      if (user && profile) {
        // User is logged in, redirect them to the appropriate dashboard
        const destination = (profile.role === 'Employee' || profile.role === 'PIC') ? '/my-work' : '/dashboard';
        router.replace(destination);
      }
      // If not logged in, do nothing and let the landing page render.
    }
  }, [isLoading, user, profile, router]);

  // While loading auth state, show a loader. Also, if a user is found,
  // continue showing the loader to prevent a flicker of the landing page
  // before the redirection happens.
  if (isLoading || user) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Render the landing page only if the user is confirmed to be not logged in.
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background">
      <div className="text-center space-y-8">
        <div className="flex justify-center">
            <div className="flex items-center gap-2">
              <div className="bg-primary p-2 rounded-lg">
                <Briefcase className="h-5 w-5 text-primary-foreground" />
              </div>
              <h1 className="font-headline text-xl font-bold truncate">WorkWise</h1>
            </div>
        </div>

        <div className="space-y-4">
          <div className="text-lg font-medium text-muted-foreground">
              {format(currentTime, 'eeee, d MMMM yyyy, HH:mm:ss')}
          </div>
          <div className="space-y-2">
              <h1 className="text-4xl font-bold tracking-tight">Welcome to WorkWise</h1>
              <p className="text-lg text-muted-foreground">
                  Collaborate, manage projects, and reach new productivity peaks.
              </p>
          </div>
          <blockquote className="border-l-2 pl-6 italic text-muted-foreground">
              "The secret of getting ahead is getting started."
          </blockquote>
        </div>

        <Button asChild size="lg">
            <Link href="/login">
                Get Started <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
        </Button>
      </div>
    </div>
  );
}

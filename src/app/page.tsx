
'use client';

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowRight, Briefcase } from "lucide-react";
import { format } from 'date-fns';

export default function RootPage() {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
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

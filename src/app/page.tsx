'use client';

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowRight, Briefcase } from "lucide-react";

export default function RootPage() {
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
        <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight">Welcome to WorkWise</h1>
            <p className="text-lg text-muted-foreground">
                Collaborate, manage projects, and reach new productivity peaks.
            </p>
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

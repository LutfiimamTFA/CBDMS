
'use client';

import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function RootPage() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="text-center space-y-8">
        <div className="flex justify-center">
            <Logo />
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


'use client';

import React from 'react';
import { Header } from '@/components/layout/header';
import { useUserProfile } from '@/firebase';
import { Loader2, HelpCircle, Star, User } from 'lucide-react';
import { ActionItems } from '@/components/my-work/action-items';
import { TodaysFocus } from '@/components/my-work/todays-focus';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

export default function MyWorkPage() {
  const { profile, isLoading } = useUserProfile();

  if (isLoading) {
    return (
      <div className="flex h-svh items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-svh flex-col bg-background">
      <Header title="My Work" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold tracking-tight">
            Welcome, {profile?.name}!
          </h2>
          <p className="text-muted-foreground">
            Here's what's on your plate. Let's make it a productive day.
          </p>
        </div>

        <Accordion type="single" collapsible className="w-full mb-6">
            <AccordionItem value="item-1">
            <AccordionTrigger>
                <div className="flex items-center gap-2 text-sm font-medium">
                <HelpCircle className="h-4 w-4"/>
                Panduan Halaman "My Work"
                </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 text-sm text-muted-foreground pt-2">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50">
                <Star className="h-5 w-5 mt-1 text-primary shrink-0"/>
                <div>
                    <h4 className="font-semibold text-foreground">Action Items (Segera Kerjakan)</h4>
                    <p>Ini adalah daftar prioritas tertinggi Anda. Berisi hal-hal yang secara spesifik membutuhkan respons atau tindakan langsung dari Anda, seperti mention di komentar atau sub-tugas yang ditugaskan kepada Anda.</p>
                </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50">
                <User className="h-5 w-5 mt-1 text-primary shrink-0"/>
                <div>
                    <h4 className="font-semibold text-foreground">Today's Focus (Fokus Hari Ini)</h4>
                    <p>Berisi tugas-tugas utama yang sedang aktif Anda kerjakan, yang jatuh tempo hari ini, atau yang sudah terlewat. Ini juga mencakup ceklis tugas harian rutin Anda.</p>
                </div>
                </div>
            </AccordionContent>
            </AccordionItem>
        </Accordion>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
            <div className="space-y-6">
                <ActionItems />
            </div>
            <div className="space-y-6">
                <TodaysFocus />
            </div>
        </div>
      </main>
    </div>
  );
}

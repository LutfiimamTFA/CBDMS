'use client';

import React, { useMemo } from 'react';
import { Header } from '@/components/layout/header';
import { useUserProfile } from '@/firebase';
import { Loader2, HelpCircle, Eye, ClipboardList, Calendar } from 'lucide-react';
import { ActionItems } from '@/components/my-work/action-items';
import { TodaysFocus } from '@/components/my-work/todays-focus';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { MyTasksDataTable } from '@/components/my-work/my-tasks-data-table';
import { Card, CardContent } from '@/components/ui/card';
import { DailyChecklist } from '@/components/my-work/daily-checklist';

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
                    <Eye className="h-5 w-5 mt-1 text-primary shrink-0"/>
                    <div>
                        <h4 className="font-semibold text-foreground">Fokus Hari Ini</h4>
                        <p>Tab default yang berisi Action Items (mention & sub-tugas untuk Anda) dan Today's Focus (tugas yang relevan hari ini). Gunakan ini untuk prioritas harian.</p>
                    </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50">
                    <ClipboardList className="h-5 w-5 mt-1 text-primary shrink-0"/>
                    <div>
                        <h4 className="font-semibold text-foreground">Semua Tugas Saya</h4>
                        <p>Tampilan "mata elang" dari SEMUA tugas yang di-assign kepada Anda, tidak peduli status atau tenggat waktunya. Gunakan tab ini untuk memastikan tidak ada pekerjaan yang terlewat.</p>
                    </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50">
                    <Calendar className="h-5 w-5 mt-1 text-primary shrink-0"/>
                    <div>
                        <h4 className="font-semibold text-foreground">Akan Datang (Upcoming)</h4>
                        <p>Tampilan kalender atau daftar tugas yang akan jatuh tempo dalam 7 atau 30 hari ke depan. Gunakan ini untuk merencanakan pekerjaan minggu depan.</p>
                    </div>
                </div>
            </AccordionContent>
            </AccordionItem>
        </Accordion>

        <Tabs defaultValue="today" className="w-full">
          <TabsList className="grid w-full grid-cols-3 md:w-[400px]">
            <TabsTrigger value="today">Fokus Hari Ini</TabsTrigger>
            <TabsTrigger value="all">Semua Tugas Saya</TabsTrigger>
            <TabsTrigger value="upcoming">Akan Datang</TabsTrigger>
          </TabsList>
          <TabsContent value="today" className="mt-6">
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full">
                {/* Main content column */}
                <div className="lg:col-span-2 space-y-6">
                    <TodaysFocus />
                </div>
                {/* Right sidebar column */}
                <div className="space-y-6">
                    <ActionItems />
                    <DailyChecklist />
                </div>
            </div>
          </TabsContent>
          <TabsContent value="all" className="mt-6">
            <MyTasksDataTable />
          </TabsContent>
          <TabsContent value="upcoming" className="mt-6">
            <Card>
                <CardContent className="p-12 text-center">
                    <h3 className="text-lg font-semibold">Coming Soon!</h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Tampilan kalender untuk tugas-tugas mendatang akan segera hadir.
                    </p>
                </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

      </main>
    </div>
  );
}

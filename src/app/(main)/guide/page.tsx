
'use client';

import React from 'react';
import { Header } from '@/components/layout/header';
import { useUserProfile } from '@/firebase';
import { guideContent, type GuideTopic } from '@/lib/guide-content';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Loader2, BookOpen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const RoleBadge = ({ role }: { role: string }) => {
  const roleColors: Record<string, string> = {
    'Super Admin': 'bg-red-500 text-white',
    Manager: 'bg-blue-500 text-white',
    Employee: 'bg-green-500 text-white',
    Client: 'bg-gray-500 text-white',
  };
  return <Badge className={roleColors[role] || 'bg-gray-500'}>{role}</Badge>;
};

export default function GuidePage() {
  const { profile, isLoading } = useUserProfile();

  const renderContent = (content: string) => {
    return { __html: content };
  };
  
  let roleKey: keyof typeof guideContent = 'employee';
  let relevantGuides: GuideTopic[] = [];

  if (profile) {
    switch (profile.role) {
      case 'Super Admin':
        roleKey = 'super_admin';
        break;
      case 'Manager':
        roleKey = 'manager';
        break;
      case 'Employee':
        roleKey = 'employee';
        break;
      case 'Client':
        roleKey = 'client';
        break;
    }
    relevantGuides = guideContent[roleKey];
  }


  return (
    <div className="flex h-svh flex-col bg-background">
      <Header title="Pusat Panduan" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div className="mx-auto max-w-4xl">
            <div className="mb-8 text-center">
              <BookOpen className="mx-auto h-12 w-12 text-primary" />
              <h1 className="mt-4 text-3xl font-bold tracking-tight">
                Selamat Datang di Pusat Panduan, {profile?.name}!
              </h1>
              <div className="mt-2 text-lg text-muted-foreground flex items-center justify-center gap-2">
                Anda login sebagai <RoleBadge role={profile?.role || ''} />. Berikut adalah panduan yang dirancang untuk Anda.
              </div>
            </div>

            <Accordion type="multiple" className="w-full">
              {relevantGuides.map((topic, index) => (
                <AccordionItem value={`item-${index}`} key={topic.id}>
                  <AccordionTrigger className="text-lg font-semibold hover:no-underline">
                    {topic.title}
                  </AccordionTrigger>
                  <AccordionContent className="prose prose-sm dark:prose-invert max-w-none px-2 text-base"
                    dangerouslySetInnerHTML={renderContent(topic.content)}
                   />
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        )}
      </main>
    </div>
  );
}

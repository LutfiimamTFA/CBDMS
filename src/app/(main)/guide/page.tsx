
'use client';

import React from 'react';
import { useUserProfile } from '@/firebase';
import { guideContent, type GuideContent } from '@/lib/guide-content';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Loader2, BookOpen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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

  if (isLoading || !profile) {
    return (
        <div className="flex h-svh items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
        </div>
    );
  }

  const roleKey = profile.role.toLowerCase().replace(' ', '_') as keyof GuideContent;
  const topicsForRole = guideContent[roleKey] || [];

  return (
    <div className="flex h-svh flex-col bg-background">
      <main className="flex-1 overflow-auto p-4 md:p-6">
          <div className="mx-auto max-w-4xl">
            <div className="mb-8 text-center">
              <BookOpen className="mx-auto h-12 w-12 text-primary" />
              <h1 className="mt-4 text-3xl font-bold tracking-tight">
                Selamat Datang di CBDMS Workspace!
              </h1>
              <div className="mt-2 text-lg text-muted-foreground flex items-center justify-center gap-2">
                Ini adalah panduan yang disesuaikan untuk peran Anda sebagai <RoleBadge role={profile.role} />
              </div>
            </div>

            <Accordion type="single" collapsible defaultValue={topicsForRole[0]?.id} className="w-full">
              {topicsForRole.map((topic) => (
                <AccordionItem key={topic.id} value={topic.id}>
                  <AccordionTrigger className="text-lg font-semibold hover:no-underline">
                    {topic.title}
                  </AccordionTrigger>
                  <AccordionContent>
                    <div
                        className="prose prose-sm dark:prose-invert max-w-none px-2 text-base"
                    >
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {topic.content}
                      </ReactMarkdown>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
      </main>
    </div>
  );
}

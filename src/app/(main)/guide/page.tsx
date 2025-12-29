
'use client';

import React from 'react';
import { useUserProfile } from '@/firebase';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Loader2, BookOpen, ExternalLink, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';

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
  
  if (isLoading) {
    return (
        <div className="flex h-svh items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
        </div>
    );
  }

  return (
    <div className="flex h-svh flex-col bg-background">
      <main className="flex-1 overflow-auto p-4 md:p-6">
          <div className="mx-auto max-w-4xl">
            <div className="mb-8 text-center">
              <BookOpen className="mx-auto h-12 w-12 text-primary" />
              <h1 className="mt-4 text-3xl font-bold tracking-tight">
                Panduan Integrasi Instagram
              </h1>
              <div className="mt-2 text-lg text-muted-foreground flex items-center justify-center gap-2">
                SOP Teknis untuk Mendapatkan Access Token yang Valid
              </div>
            </div>

            <Accordion type="single" collapsible defaultValue="item-1" className="w-full">
                <AccordionItem value="item-1">
                    <AccordionTrigger className="text-lg font-semibold hover:no-underline">
                        Langkah 1: Buka Graph API Explorer
                    </AccordionTrigger>
                    <AccordionContent className="prose prose-sm dark:prose-invert max-w-none px-2 text-base">
                        <p>Ini adalah alat utama dari Meta untuk menguji dan mendapatkan token. Pastikan Anda login ke akun Facebook yang memiliki akses ke Aplikasi Meta 'WorkWise'.</p>
                        <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-white no-underline hover:bg-blue-700">
                            Buka Graph API Explorer <ExternalLink className="h-4 w-4" />
                        </a>
                    </AccordionContent>
                </AccordionItem>
                 <AccordionItem value="item-2">
                    <AccordionTrigger className="text-lg font-semibold hover:no-underline">
                        Langkah 2: Konfigurasi Aplikasi dan Izin
                    </AccordionTrigger>
                    <AccordionContent className="prose prose-sm dark:prose-invert max-w-none px-2 text-base">
                        <p>Di halaman Graph API Explorer, lakukan konfigurasi berikut secara berurutan:</p>
                        <ol>
                            <li>Di pojok kanan atas, pada dropdown <strong>"Aplikasi Meta"</strong>, pastikan Anda memilih aplikasi <strong>WorkWise</strong>.</li>
                            <li>Pada dropdown di sebelahnya (<strong>"Token"</strong>), pilih <strong>"Dapatkan Token Pengguna"</strong> (Get User Token).</li>
                            <li>Sebuah popup akan muncul. Di sini, klik <strong>"Tambahkan Izin"</strong> (Add a Permission).</li>
                            <li>Anda **WAJIB** menambahkan izin-izin berikut:
                                <ul className='my-2'>
                                    <li><code>pages_show_list</code></li>
                                    <li><code>instagram_basic</code></li>
                                    <li><code>instagram_content_publish</code></li>
                                    <li><code>pages_read_engagement</code></li>
                                </ul>
                            </li>
                            <li>Setelah semua izin ditambahkan, klik tombol biru <strong>"Hasilkan Token Akses"</strong> (Generate Access Token) di bagian bawah popup.</li>
                        </ol>
                         <Image src="https://storage.googleapis.com/studio-hosting-assets/story-architect/cbdms-2/graph-api-permissions.png" alt="Graph API Permissions" width={700} height={500} className="rounded-md border" />
                    </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-3">
                    <AccordionTrigger className="text-lg font-semibold hover:no-underline">
                       Langkah 3: Jadikan Token Berlaku Lama (Long-Lived)
                    </AccordionTrigger>
                    <AccordionContent className="prose prose-sm dark:prose-invert max-w-none px-2 text-base">
                        <p>Token yang baru Anda buat hanya berlaku selama 1 jam. Kita perlu menukarkannya dengan token yang berlaku selama 60 hari.</p>
                        <ol>
                            <li>Salin (copy) token yang baru saja dibuat dari kolom "Token Akses".</li>
                            <li>Buka alat <strong>"Access Token Debugger"</strong> melalui link di bawah ini.
                                <a href="https://developers.facebook.com/tools/debug/accesstoken/" target="_blank" rel="noopener noreferrer" className="my-2 inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-white no-underline hover:bg-blue-700">
                                    Buka Access Token Debugger <ExternalLink className="h-4 w-4" />
                                </a>
                            </li>
                            <li>Tempel (paste) token Anda ke dalam kolom input dan klik tombol <strong>"Debug"</strong>.</li>
                            <li>Informasi tentang token akan muncul. Cari dan klik tombol <strong>"Perpanjang Token Akses"</strong> (Extend Access Token) di bagian bawah.</li>
                            <li>Sebuah token baru yang jauh lebih panjang akan muncul. <strong>INILAH TOKEN FINAL ANDA</strong>. Salin token ini.</li>
                        </ol>
                        <Image src="https://storage.googleapis.com/studio-hosting-assets/story-architect/cbdms-2/extend-token.png" alt="Extend Access Token" width={700} height={300} className="rounded-md border" />
                    </AccordionContent>
                </AccordionItem>
                 <AccordionItem value="item-4">
                    <AccordionTrigger className="text-lg font-semibold hover:no-underline">
                        Langkah 4: Input Token ke Aplikasi WorkWise
                    </AccordionTrigger>
                    <AccordionContent className="prose prose-sm dark:prose-invert max-w-none px-2 text-base">
                        <p>Sekarang, kembali ke aplikasi WorkWise:</p>
                        <ol>
                            <li>Buka halaman <strong>Social Media &rarr; Integrations</strong>.</li>
                            <li>Klik tombol <strong>"Manual Update"</strong>.</li>
                            <li>Tempel (paste) token yang sudah Anda perpanjang (dari Langkah 3) ke dalam kolom input.</li>
                            <li>Klik <strong>"Validate & Save Token"</strong>.</li>
                        </ol>
                        <p className='flex items-center gap-2 mt-4'><CheckCircle className='text-green-500'/>Jika tidak ada error, integrasi Anda sekarang sudah berhasil dan siap digunakan untuk auto-posting.</p>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
          </div>
      </main>
    </div>
  );
}

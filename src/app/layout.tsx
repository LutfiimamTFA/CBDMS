import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { ThemeProvider } from '@/components/theme-provider';
import { I18nProvider } from '@/context/i18n-provider';
import { FirebaseClientProvider } from '@/firebase';
import { PermissionsProvider } from '@/context/permissions-provider';
import { CompanyProvider } from '@/context/company-provider';

export const metadata: Metadata = {
  title: 'WorkWise',
  description: 'Collaborate, manage projects, and reach new productivity peaks.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&family=PT+Sans:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <I18nProvider>
            <FirebaseClientProvider>
                <CompanyProvider>
                  <PermissionsProvider>
                    {children}
                  </PermissionsProvider>
                </CompanyProvider>
            </FirebaseClientProvider>
            <Toaster />
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

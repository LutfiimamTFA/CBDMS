'use client';
import { SharedSessionProvider } from '@/context/shared-session-provider';

export default function ShareLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SharedSessionProvider>{children}</SharedSessionProvider>;
}

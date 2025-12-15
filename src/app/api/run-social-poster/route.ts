
import { NextResponse } from 'next/server';
import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { serviceAccount } from '@/firebase/service-account';
import type { SocialMediaPost } from '@/lib/types';

// This file is now deprecated and its logic is merged into /api/run-scheduler.
// It is kept for historical purposes but should not be used directly.

// Initialize Firebase Admin
function initializeAdminApp(): App {
  if (getApps().length > 0) {
    return getApps()[0];
  }
  return initializeApp({
    credential: cert(serviceAccount),
  });
}

export async function GET(request: Request) {
  
  return NextResponse.json(
    {
      message: `This endpoint is deprecated. Please use /api/run-scheduler to run all scheduled jobs.`,
    },
    { status: 410 } // 410 Gone
  );
}

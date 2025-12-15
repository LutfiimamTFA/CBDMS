
import { NextResponse } from 'next/server';
import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { serviceAccount } from '@/firebase/service-account';
import type { SocialMediaPost } from '@/lib/types';

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
  // Optional: Add a secret key to prevent unauthorized runs
  // const { searchParams } = new URL(request.url);
  // if (searchParams.get('secret') !== process.env.SCHEDULER_SECRET) {
  //   return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  // }

  try {
    const app = initializeAdminApp();
    const firestore = getFirestore(app);
    const now = new Date().toISOString();

    const postsToPublishSnapshot = await firestore
      .collection('socialMediaPosts')
      .where('status', '==', 'Scheduled')
      .where('scheduledAt', '<=', now)
      .get();

    if (postsToPublishSnapshot.empty) {
      return NextResponse.json({ message: 'No posts to publish at this time.' }, { status: 200 });
    }

    const batch = firestore.batch();
    let postsPublishedCount = 0;

    postsToPublishSnapshot.forEach(doc => {
      const postRef = doc.ref;
      batch.update(postRef, {
        status: 'Posted',
        postedAt: Timestamp.now(),
      });
      postsPublishedCount++;
    });

    await batch.commit();

    return NextResponse.json(
      {
        message: `Successfully published ${postsPublishedCount} posts.`,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error in social media poster:', error);
    let errorMessage = 'An unexpected error occurred.';
     if (error.message?.includes('FIREBASE_SERVICE_ACCOUNT_KEY') || error.code === 'app/invalid-credential') {
        errorMessage = 'Firebase Admin SDK initialization failed. Check server credentials.';
    }
    return NextResponse.json(
      { message: errorMessage, error: error.message },
      { status: 500 }
    );
  }
}

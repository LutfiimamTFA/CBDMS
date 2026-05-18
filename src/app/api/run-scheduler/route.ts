'use server';

import { NextResponse } from 'next/server';
import { serverTimestamp } from 'firebase-admin/firestore';
import { SocialMediaPost } from '@/lib/types-backend';
import { adminDb } from '@/lib/firebase-admin';

async function runSocialMediaPoster(firestore: FirebaseFirestore.Firestore) {
  const now = new Date().toISOString();
  const postsToPublishSnapshot = await firestore
    .collection('socialMediaPosts')
    .where('status', '==', 'Scheduled')
    .where('scheduledAt', '<=', now)
    .get();

  if (postsToPublishSnapshot.empty) {
    return 0; // No posts to publish
  }

  let postsPublishedCount = 0;

  for (const doc of postsToPublishSnapshot.docs) {
    const postRef = doc.ref;

    // Idempotency check: Ensure we only process 'Scheduled' posts.
    // This prevents a post being published twice if the job runs again before the first one completes.
    const currentDoc = await postRef.get();
    if (currentDoc.data()?.status !== 'Scheduled') {
      continue;
    }

    try {
      // Atomic update to 'Publishing' status
      await postRef.update({ status: 'Publishing' });

      // The actual publishing logic is now in a separate, more focused API route.
      // This scheduler just acts as a trigger.
      const publishResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/instagram/publish`, {
          method: 'POST',
          headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.SCHEDULER_SECRET}`,
          },
          body: JSON.stringify({ postId: doc.id }),
      });
      
      const result = await publishResponse.json();

      if (publishResponse.ok) {
        await postRef.update({
          status: 'Posted',
          postedAt: serverTimestamp(),
        });
        postsPublishedCount++;
      } else {
        console.error(`Failed to publish post ${doc.id}:`, result.message);
        await postRef.update({
          status: 'Error',
          errorDetails: result.message || 'Unknown publishing error',
        });
      }

    } catch (error: any) {
      console.error(`Exception while publishing post ${doc.id}:`, error);
      // Revert status to 'Scheduled' on exception so it can be retried.
      await postRef.update({
        status: 'Error',
        errorDetails: error.message || 'An exception occurred during the trigger process.',
      });
    }
  }

  return postsPublishedCount;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('Authorization');
  const schedulerSecret = request.headers.get('x-scheduler-secret');

  if (authHeader !== `Bearer ${process.env.SCHEDULER_SECRET}` && schedulerSecret !== process.env.SCHEDULER_SECRET) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const firestore = adminDb;
    const socialResult = await runSocialMediaPoster(firestore);

    const messages = [];
    if (socialResult > 0) {
      messages.push(`Published ${socialResult} social media post(s).`);
    } else {
      messages.push('No social media posts were due for publishing.');
    }

    return NextResponse.json(
      {
        message: `Scheduler finished. ${messages.join(' ')}`,
      },
      { status: 200 }
    );

  } catch (error: any) {
    console.error('Error in main scheduler:', error);
    let errorMessage = 'An unexpected error occurred during scheduled job execution.';
     if (error.message?.includes('FIREBASE_SERVICE_ACCOUNT_KEY') || error.code === 'app/invalid-credential') {
        errorMessage = 'Firebase Admin SDK initialization failed. Check server credentials.';
    }
    return NextResponse.json(
      { message: errorMessage, error: error.message },
      { status: 500 }
    );
  }
}

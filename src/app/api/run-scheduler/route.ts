
import { NextResponse } from 'next/server';
import { getFirestore, Timestamp, serverTimestamp } from 'firebase-admin/firestore';
import { RecurringTaskTemplate, Task, SocialMediaPost } from '@/lib/types-backend';
import { adminDb, adminAuth } from '@/lib/firebase-admin';

async function runSocialMediaPoster(firestore: FirebaseFirestore.Firestore) {
    const now = new Date().toISOString();
    const postsToPublishSnapshot = await firestore
      .collection('socialMediaPosts')
      .where('status', '==', 'Scheduled')
      .where('scheduledAt', '<=', now)
      .get();

    if (postsToPublishSnapshot.empty) {
      return 0; // No posts published
    }

    let postsPublishedCount = 0;

    for (const doc of postsToPublishSnapshot.docs) {
      const postRef = doc.ref;

      try {
        await postRef.update({ status: 'Publishing' });

        const publishResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/instagram/publish`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                // This relies on the function being called securely (e.g., via Cloud Scheduler with auth header)
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
        await postRef.update({
            status: 'Error',
            errorDetails: error.message || 'An exception occurred.',
        });
      }
    }

    return postsPublishedCount;
}

export async function GET(request: Request) {
  const secretHeader = request.headers.get('x-scheduler-secret');
  if (secretHeader !== process.env.SCHEDULER_SECRET) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const firestore = adminDb;
    const socialResult = await runSocialMediaPoster(firestore);

    const messages = [];
    if (socialResult > 0) {
      messages.push(`Published ${socialResult} social media post(s).`);
    } else {
      messages.push('No social media posts to publish.');
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

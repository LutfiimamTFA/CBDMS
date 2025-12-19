
import { NextResponse } from 'next/server';
import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { serviceAccount } from '@/firebase/service-account';
import type { SharedLink, WorkflowStatus } from '@/lib/types';

function initializeAdminApp(): App {
  if (getApps().length > 0) {
    return getApps()[0];
  }
  return initializeApp({
    credential: cert(serviceAccount),
  });
}

export async function POST(request: Request) {
  try {
    const app = initializeAdminApp();
    const db = getFirestore(app);

    const { linkId } = await request.json();

    if (!linkId) {
      return NextResponse.json({ message: 'Missing linkId.' }, { status: 400 });
    }

    const linkRef = db.collection('sharedLinks').doc(linkId);
    const linkSnap = await linkRef.get();

    if (!linkSnap.exists) {
      return NextResponse.json({ message: 'Share link not found.' }, { status: 404 });
    }

    const sharedLink = linkSnap.data() as SharedLink;

    // Check if migration is needed (statuses are missing or empty)
    if (!sharedLink.snapshot.statuses || sharedLink.snapshot.statuses.length === 0) {
        
        const statusesQuery = db.collection('statuses').where('companyId', '==', sharedLink.companyId);
        const statusesSnap = await statusesQuery.get();

        if (statusesSnap.empty) {
             return NextResponse.json({ message: 'Workflow statuses for this company could not be found.' }, { status: 404 });
        }
        
        const fullWorkflow = statusesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkflowStatus));
        
        // Update the snapshot within the sharedLink document
        await linkRef.update({
            'snapshot.statuses': fullWorkflow,
        });

        return NextResponse.json({ message: 'Link migrated successfully.' }, { status: 200 });
    }
    
    // If statuses already exist, no action is needed
    return NextResponse.json({ message: 'Link is already up-to-date.' }, { status: 200 });

  } catch (error: any) {
    console.error('Error migrating shared link:', error);
    return NextResponse.json({ message: 'An internal server error occurred.', error: error.message }, { status: 500 });
  }
}

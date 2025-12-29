
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { Timestamp, serverTimestamp } from 'firebase-admin/firestore';
import { SocialMediaConnection } from '@/lib/types-backend';

// This function now directly uses the provided token to get user info.
async function getInstagramUser(accessToken: string): Promise<{ id: string; username: string }> {
    const url = `https://graph.instagram.com/me?fields=id,username&access_token=${accessToken}`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.error) {
        // If the token is invalid, this call will fail, providing inherent validation.
        throw new Error(`Error getting Instagram User ID: ${data.error.message}`);
    }
    return data;
}


export async function POST(request: Request) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Unauthorized: Missing or invalid token.' }, { status: 401 });
    }
    const idToken = authHeader.split('Bearer ')[1];

    try {
        const decodedToken = await adminAuth.verifyIdToken(idToken);
        const userId = decodedToken.uid;
        
        const userDoc = await adminDb.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            return NextResponse.json({ message: 'User not found in database.' }, { status: 404 });
        }
        const companyId = userDoc.data()?.companyId;
        if (!companyId) {
            return NextResponse.json({ message: 'User is not associated with a company.' }, { status: 400 });
        }
        
        const { token: newToken } = await request.json();
        if (!newToken) {
            return NextResponse.json({ message: 'Access token is missing.' }, { status: 400 });
        }

        // 1. Validate the token by using it to fetch the user's profile
        const { id: instagramUserId, username: instagramUsername } = await getInstagramUser(newToken);
        
        // As we don't have expiry info from this new flow, we'll set a default 60-day expiry.
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 60);

        // 2. Securely store the token and user info in Firestore
        const connectionData: Omit<SocialMediaConnection, 'id'> = {
            platform: 'instagram',
            userId, // The Firebase UID of the user who connected the account
            companyId,
            instagramUserId,
            instagramUsername,
            accessToken: newToken,
            expiresIn: 60 * 60 * 24 * 60, // 60 days in seconds
            expiresAt: Timestamp.fromDate(expiresAt),
            connectedAt: serverTimestamp() as Timestamp,
        };

        const connectionId = `${companyId}_instagram`;
        await adminDb.collection('socialMediaConnections').doc(connectionId).set(connectionData, { merge: true });

        return NextResponse.json({ message: 'Successfully authenticated and connection stored.' }, { status: 200 });
        
    } catch (error: any) {
        console.error("Instagram manual token update error:", error);
        return NextResponse.json({ message: error.message || 'An internal server error occurred.' }, { status: 500 });
    }
}

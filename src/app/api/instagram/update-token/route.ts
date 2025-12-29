
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { serverTimestamp, type Timestamp } from 'firebase-admin/firestore';
import { SocialMediaConnection } from '@/lib/types-backend';

async function getInstagramUser(accessToken: string): Promise<{ id: string; username: string }> {
    const url = `https://graph.instagram.com/me?fields=id,username&access_token=${accessToken}`;
    const response = await fetch(url);
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Error validating token with Instagram: ${errorData.error?.message || 'Unknown error'}`);
    }
    const data = await response.json();
    if (!data.id || !data.username) {
        throw new Error('Invalid token: Did not receive ID and username from Instagram.');
    }
    return { id: data.id, username: data.username };
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
        
        const userData = userDoc.data();
        const companyId = userData?.companyId;
        const userRole = userData?.role;

        if (!companyId) {
            return NextResponse.json({ message: 'User is not associated with a company.' }, { status: 400 });
        }
        
        if (userRole !== 'Super Admin' && userRole !== 'Manager') {
            return NextResponse.json({ message: 'Forbidden: You do not have permission to perform this action.' }, { status: 403 });
        }
        
        const { token: newToken } = await request.json();
        if (!newToken) {
            return NextResponse.json({ message: 'New token is missing.' }, { status: 400 });
        }

        // Validate the new token and get user info from Instagram
        const { id: instagramUserId, username: instagramUsername } = await getInstagramUser(newToken);
        
        // Prepare data to update in Firestore
        // We assume a 60-day expiry for manually updated long-lived tokens
        const connectionData: Omit<SocialMediaConnection, 'id'> = {
            accessToken: newToken,
            instagramUserId,
            instagramUsername,
            connectedAt: serverTimestamp(),
            expiresIn: 5184000, // 60 days in seconds
            userId, // Log which admin performed the update
            companyId,
            platform: 'instagram'
        };

        const connectionId = `${companyId}_instagram`;
        await adminDb.collection('socialMediaConnections').doc(connectionId).set(connectionData, { merge: true });

        return NextResponse.json({ message: 'Token updated and validated successfully.' }, { status: 200 });

    } catch (error: any) {
        console.error("Instagram manual token update error:", error);
        return NextResponse.json({ message: error.message || 'An internal server error occurred.' }, { status: 500 });
    }
}

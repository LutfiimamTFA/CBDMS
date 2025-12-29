
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { serverTimestamp, type Timestamp } from 'firebase-admin/firestore';
import { SocialMediaConnection } from '@/lib/types-backend';

const META_APP_ID = process.env.NEXT_PUBLIC_META_APP_ID;
const META_APP_SECRET = process.env.META_APP_SECRET;

async function getInstagramUser(accessToken: string): Promise<{ id: string; username: string }> {
    const url = `https://graph.instagram.com/me?fields=id,username&access_token=${accessToken}`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.error) {
        throw new Error(`Error getting Instagram User ID: ${data.error.message}`);
    }
    return data;
}

async function debugToken(inputToken: string): Promise<any> {
    if (!META_APP_ID || !META_APP_SECRET) {
        throw new Error('Server configuration error: Missing Meta App credentials.');
    }
    const url = `https://graph.facebook.com/debug_token?input_token=${inputToken}&access_token=${META_APP_ID}|${META_APP_SECRET}`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.error || !data.data.is_valid) {
        throw new Error(data.error?.message || 'The provided token is invalid or expired.');
    }
    return data.data;
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

        // 1. Validate the token using Meta's debug endpoint
        const tokenInfo = await debugToken(newToken);
        
        const expiresIn = tokenInfo.data_access_expires_at - Math.floor(Date.now() / 1000);
        const expiresAt = new Date(tokenInfo.data_access_expires_at * 1000);
        const instagramUserId = tokenInfo.user_id;

        // 2. Get the user's Instagram username
        const { username: instagramUsername } = await getInstagramUser(newToken);


        // 3. Securely store the token and user info in Firestore
        const connectionData: Omit<SocialMediaConnection, 'id'> = {
            platform: 'instagram',
            userId, // The Firebase UID of the user who connected the account
            companyId,
            instagramUserId,
            instagramUsername,
            accessToken: newToken,
            expiresIn,
            expiresAt: Timestamp.fromDate(expiresAt),
            connectedAt: serverTimestamp() as Timestamp,
        };

        // Use a composite ID to prevent duplicate connections for the same company and platform
        const connectionId = `${companyId}_instagram`;
        await adminDb.collection('socialMediaConnections').doc(connectionId).set(connectionData, { merge: true });

        return NextResponse.json({ message: 'Successfully authenticated and connection stored.' }, { status: 200 });
        
    } catch (error: any) {
        console.error("Instagram manual token update error:", error);
        return NextResponse.json({ message: error.message || 'An internal server error occurred.' }, { status: 500 });
    }
}

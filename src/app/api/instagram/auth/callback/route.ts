
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { serverTimestamp, type Timestamp } from 'firebase-admin/firestore';

const META_APP_ID = process.env.NEXT_PUBLIC_META_APP_ID;
const META_APP_SECRET = process.env.META_APP_SECRET;
const REDIRECT_URI = process.env.NEXT_PUBLIC_INSTAGRAM_REDIRECT_URI;

async function getInstagramUserId(accessToken: string): Promise<{ id: string; username: string }> {
    const url = `https://graph.instagram.com/me?fields=id,username&access_token=${accessToken}`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.error) {
        throw new Error(`Error getting Instagram User ID: ${data.error.message}`);
    }
    return data;
}


export async function POST(request: Request) {
    if (!META_APP_ID || !META_APP_SECRET || !REDIRECT_URI) {
        return NextResponse.json({ message: 'Server configuration error: Missing Meta App credentials or Redirect URI.' }, { status: 500 });
    }
    
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
        
        const { code } = await request.json();
        if (!code) {
            return NextResponse.json({ message: 'Authorization code is missing.' }, { status: 400 });
        }

        // 1. Exchange code for a short-lived access token
        const tokenUrl = `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${META_APP_ID}&redirect_uri=${REDIRECT_URI}&client_secret=${META_APP_SECRET}&code=${code}`;
        const tokenResponse = await fetch(tokenUrl);
        const tokenData = await tokenResponse.json();

        if (tokenData.error) {
            throw new Error(`Error getting token: ${tokenData.error.message}`);
        }

        const shortLivedToken = tokenData.access_token;

        // 2. Exchange short-lived token for a long-lived access token
        const longLivedTokenUrl = `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${META_APP_ID}&client_secret=${META_APP_SECRET}&fb_exchange_token=${shortLivedToken}`;
        const longLivedTokenResponse = await fetch(longLivedTokenUrl);
        const longLivedTokenData = await longLivedTokenResponse.json();

        if (longLivedTokenData.error) {
            throw new Error(`Error getting long-lived token: ${longLivedTokenData.error.message}`);
        }

        const longLivedToken = longLivedTokenData.access_token;
        const expiresIn = longLivedTokenData.expires_in;

        // 3. Get the user's Instagram account ID and username
        const { id: instagramUserId, username: instagramUsername } = await getInstagramUserId(longLivedToken);

        // 4. Securely store the token and user info in Firestore
        const connectionData = {
            platform: 'instagram',
            userId, // The Firebase UID of the user who connected the account
            companyId,
            instagramUserId,
            instagramUsername,
            accessToken: longLivedToken,
            expiresIn,
            connectedAt: serverTimestamp() as Timestamp,
        };

        // Use a composite ID to prevent duplicate connections for the same company and platform
        const connectionId = `${companyId}_instagram`;
        await adminDb.collection('socialMediaConnections').doc(connectionId).set(connectionData, { merge: true });

        return NextResponse.json({ message: 'Successfully authenticated and connection stored.' }, { status: 200 });
        
    } catch (error: any) {
        console.error("Instagram auth callback error:", error);
        return NextResponse.json({ message: error.message || 'An internal server error occurred.' }, { status: 500 });
    }
}

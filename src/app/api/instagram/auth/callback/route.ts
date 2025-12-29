
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { Timestamp, serverTimestamp } from 'firebase-admin/firestore';
import type { SocialMediaConnection } from '@/lib/types-backend';

const FACEBOOK_GRAPH_API_URL = "https://graph.facebook.com/v19.0";

// Exchanges the short-lived token for a long-lived one
async function getLongLivedAccessToken(accessToken: string): Promise<{ access_token: string; expires_in: number }> {
    const params = new URLSearchParams({
        grant_type: 'fb_exchange_token',
        client_id: process.env.NEXT_PUBLIC_META_APP_ID!,
        client_secret: process.env.META_APP_SECRET!,
        fb_exchange_token: accessToken,
    });
    const url = `${FACEBOOK_GRAPH_API_URL}/oauth/access_token?${params.toString()}`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.error) {
        throw new Error(`Error exchanging token: ${data.error.message}`);
    }
    return data;
}

// Gets the Instagram Business Account ID and username linked to a Facebook Page
async function getInstagramBusinessAccount(accessToken: string): Promise<{ id: string; username: string }> {
    const url = `${FACEBOOK_GRAPH_API_URL}/me/accounts?fields=instagram_business_account{username}&access_token=${accessToken}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
        throw new Error(`Error fetching pages: ${data.error.message}`);
    }
    const businessAccount = data.data?.find((page: any) => page.instagram_business_account)?.instagram_business_account;
    if (!businessAccount) {
        throw new Error('No Instagram Business Account found linked to your Facebook Pages. Please ensure your account is a Business/Creator account and linked to a Facebook Page.');
    }
    return {
        id: businessAccount.id,
        username: businessAccount.username,
    };
}


export async function POST(request: Request) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    const idToken = authHeader.split('Bearer ')[1];
    
    try {
        const decodedToken = await adminAuth.verifyIdToken(idToken);
        const userId = decodedToken.uid;

        const userDoc = await adminDb.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            return NextResponse.json({ message: 'User not found' }, { status: 404 });
        }
        const companyId = userDoc.data()?.companyId;

        const { code } = await request.json();
        if (!code) {
            return NextResponse.json({ message: 'Authorization code is missing.' }, { status: 400 });
        }

        // --- Step 1: Exchange code for a short-lived access token ---
        const tokenParams = new URLSearchParams({
            client_id: process.env.NEXT_PUBLIC_META_APP_ID!,
            redirect_uri: `${new URL(request.url).origin}/social-media/integrations/instagram/callback`,
            client_secret: process.env.META_APP_SECRET!,
            code: code,
        });
        const tokenUrl = `${FACEBOOK_GRAPH_API_URL}/oauth/access_token?${tokenParams.toString()}`;
        const tokenResponse = await fetch(tokenUrl);
        const tokenData = await tokenResponse.json();
        if (tokenData.error) {
            throw new Error(`Error getting access token: ${tokenData.error.message}`);
        }
        const shortLivedToken = tokenData.access_token;

        // --- Step 2: Exchange short-lived token for a long-lived one ---
        const { access_token: longLivedToken, expires_in } = await getLongLivedAccessToken(shortLivedToken);
        
        // --- Step 3: Get Instagram User ID and Username ---
        const { id: instagramUserId, username: instagramUsername } = await getInstagramBusinessAccount(longLivedToken);
        
        // --- Step 4: Store the connection details in Firestore ---
        const expiresAt = new Date();
        expiresAt.setSeconds(expiresAt.getSeconds() + expires_in);

        const connectionData: Omit<SocialMediaConnection, 'id'> = {
            platform: 'instagram',
            userId: userId,
            companyId: companyId,
            instagramUserId: instagramUserId,
            instagramUsername: instagramUsername,
            accessToken: longLivedToken,
            expiresIn: expires_in,
            expiresAt: Timestamp.fromDate(expiresAt),
            connectedAt: serverTimestamp() as FirebaseFirestore.Timestamp,
        };
        
        const connectionId = `${companyId}_instagram`;
        await adminDb.collection('socialMediaConnections').doc(connectionId).set(connectionData, { merge: true });

        return NextResponse.json({ message: 'Successfully connected Instagram account.' }, { status: 200 });

    } catch (error: any) {
        console.error("Instagram Auth Callback Error:", error);
        return NextResponse.json({ message: error.message || 'An internal server error occurred.' }, { status: 500 });
    }
}

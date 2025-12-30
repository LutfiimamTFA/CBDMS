
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { serverTimestamp } from 'firebase-admin/firestore';
import type { SocialMediaConnection } from '@/lib/types-backend';

const FACEBOOK_GRAPH_API_URL = "https://graph.facebook.com/v20.0";

async function getLongLivedAccessToken(shortLivedToken: string): Promise<{ access_token: string, expires_in: number }> {
    const appId = process.env.INSTAGRAM_APP_ID;
    const appSecret = process.env.INSTAGRAM_APP_SECRET;

    if (!appId || !appSecret) {
        throw new Error('Instagram App ID and Secret must be configured on the server.');
    }
    
    const url = `${FACEBOOK_GRAPH_API_URL}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortLivedToken}`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.error) {
        throw new Error(`Error exchanging token: ${data.error.message}`);
    }
    return data;
}

async function getInstagramBusinessAccount(accessToken: string): Promise<{ id: string; username: string }> {
    const fields = 'instagram_business_account{id,username}';
    const url = `${FACEBOOK_GRAPH_API_URL}/me/accounts?fields=${fields}&access_token=${accessToken}`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
        throw new Error(`Error fetching pages from Meta: ${data.error.message}`);
    }
    
    const businessAccount = data.data?.find((page: any) => page.instagram_business_account)?.instagram_business_account;
    
    if (!businessAccount) {
        throw new Error('No Instagram Business Account found linked to your Facebook Pages. Please ensure your account is a Business/Creator account and linked to a Facebook Page via Meta Business Suite.');
    }

    return {
        id: businessAccount.id,
        username: businessAccount.username,
    };
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
        const userRole = decodedToken.role;

        if (userRole !== 'Super Admin' && userRole !== 'Manager') {
             return NextResponse.json({ message: 'Forbidden: You do not have permission to perform this action.' }, { status: 403 });
        }

        const userDoc = await adminDb.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            return NextResponse.json({ message: 'User not found in database.' }, { status: 404 });
        }
        const companyId = userDoc.data()?.companyId;
        if (!companyId) {
            return NextResponse.json({ message: 'User is not associated with a company.' }, { status: 400 });
        }

        const { code, isTokenUpdate = false, accessToken: manualToken } = await request.json();

        let longLivedToken: string;
        let expiresIn: number;

        if (isTokenUpdate && manualToken) {
            longLivedToken = manualToken;
            // When manually updating, we don't know the expiry, so we fetch it.
            const debugUrl = `${FACEBOOK_GRAPH_API_URL}/debug_token?input_token=${longLivedToken}&access_token=${process.env.INSTAGRAM_APP_ID}|${process.env.INSTAGRAM_APP_SECRET}`;
            const debugResponse = await fetch(debugUrl);
            const debugData = await debugResponse.json();
            if (debugData.error || !debugData.data.is_valid) {
                throw new Error(debugData.error?.message || 'The provided token is invalid.');
            }
            expiresIn = debugData.data.expires_at ? debugData.data.expires_at - Math.floor(Date.now() / 1000) : 0;

        } else if (code) {
             const tokenData = await getLongLivedAccessToken(code);
             longLivedToken = tokenData.access_token;
             expiresIn = tokenData.expires_in;
        } else {
             return NextResponse.json({ message: 'Bad Request: Authorization code or access token is required.' }, { status: 400 });
        }
        
        const { id: instagramUserId, username: instagramUsername } = await getInstagramBusinessAccount(longLivedToken);
        
        const expiresAt = new Date(Date.now() + expiresIn * 1000);

        const connectionData: Omit<SocialMediaConnection, 'id'> = {
            platform: 'instagram',
            userId: userId,
            companyId: companyId,
            instagramUserId: instagramUserId,
            instagramUsername: instagramUsername,
            accessToken: longLivedToken,
            expiresAt: serverTimestamp.fromMillis(expiresAt.getTime()),
            connectedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };
        
        const connectionId = `${companyId}_instagram`;
        await adminDb.collection('socialMediaConnections').doc(connectionId).set(connectionData, { merge: true });

        return NextResponse.json({ message: `Successfully connected to Instagram account @${instagramUsername}.` }, { status: 200 });

    } catch (error: any) {
        console.error("Instagram Token Update/Exchange Error:", error);
        const statusCode = error.message.includes('token') || error.message.includes('permission') || error.message.includes('No Instagram Business Account') ? 400 : 500;
        return NextResponse.json({ message: error.message || 'An internal server error occurred.' }, { status: statusCode });
    }
}

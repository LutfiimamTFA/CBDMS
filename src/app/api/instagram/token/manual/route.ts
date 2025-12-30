'use server';
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { serverTimestamp } from 'firebase-admin/firestore';
import type { SocialMediaConnection } from '@/lib/types-backend';

const FACEBOOK_GRAPH_API_URL = "https://graph.facebook.com/v20.0";
const APP_ID = process.env.INSTAGRAM_APP_ID;
const APP_SECRET = process.env.INSTAGRAM_APP_SECRET;

async function getLongLivedAccessToken(code: string, redirectUri: string): Promise<{ access_token: string, expires_in: number }> {
    const url = `${FACEBOOK_GRAPH_API_URL}/oauth/access_token`;
    const params = new URLSearchParams({
        client_id: APP_ID!,
        client_secret: APP_SECRET!,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code: code,
    });

    const response = await fetch(`${url}?${params.toString()}`);
    const data = await response.json();
    if (data.error) throw new Error(`Error exchanging code for token: ${data.error.message}`);
    
    const longLivedUrl = `${FACEBOOK_GRAPH_API_URL}/oauth/access_token`;
    const longLivedParams = new URLSearchParams({
        grant_type: 'fb_exchange_token',
        client_id: APP_ID!,
        client_secret: APP_SECRET!,
        fb_exchange_token: data.access_token,
    });
    
    const longLivedResponse = await fetch(`${longLivedUrl}?${longLivedParams.toString()}`);
    const longLivedData = await longLivedResponse.json();
    if (longLivedData.error) throw new Error(`Error getting long-lived token: ${longLivedData.error.message}`);
    
    return longLivedData;
}

async function debugToken(accessToken: string): Promise<any> {
    const url = `${FACEBOOK_GRAPH_API_URL}/debug_token?input_token=${accessToken}&access_token=${APP_ID}|${APP_SECRET}`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.error) throw new Error(`Token debug error: ${data.error.message}`);
    if (!data.data.is_valid) throw new Error('The provided access token is invalid or has expired.');
    if (data.data.app_id !== APP_ID) throw new Error('This token does not belong to the WorkWise application.');
    
    const requiredScopes = ['instagram_basic', 'instagram_content_publish', 'pages_show_list', 'pages_read_engagement', 'business_management'];
    const missingScopes = requiredScopes.filter(scope => !data.data.scopes.includes(scope));
    if (missingScopes.length > 0) {
        throw new Error(`Missing required permissions: ${missingScopes.join(', ')}. Please re-authenticate with all permissions.`);
    }
    return data.data;
}


async function getInstagramBusinessAccount(accessToken: string): Promise<{ id: string; username: string }> {
    const url = `${FACEBOOK_GRAPH_API_URL}/me/accounts?fields=instagram_business_account{id,username}&access_token=${accessToken}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.error) throw new Error(`Error fetching pages: ${data.error.message}`);
    
    const businessAccount = data.data?.find((page: any) => page.instagram_business_account)?.instagram_business_account;
    
    if (!businessAccount) throw new Error('No Instagram Business Account found linked to your Facebook Pages. Please ensure your IG account is Professional and linked to a Facebook Page.');

    return { id: businessAccount.id, username: businessAccount.username };
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
             return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
        }

        const userDoc = await adminDb.collection('users').doc(userId).get();
        const companyId = userDoc.data()?.companyId;
        if (!companyId) return NextResponse.json({ message: 'User not associated with a company.' }, { status: 400 });

        const { authorizationCode, manualToken } = await request.json();
        
        let longLivedToken: string;
        let tokenData: any;

        if (authorizationCode) {
            const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL}/api/instagram/oauth/callback`;
            const tokenInfo = await getLongLivedAccessToken(authorizationCode, redirectUri);
            longLivedToken = tokenInfo.access_token;
            tokenData = await debugToken(longLivedToken);
        } else if (manualToken) {
            longLivedToken = manualToken.replace(/\s/g, ''); // Sanitize token
            tokenData = await debugToken(longLivedToken);
        } else {
             return NextResponse.json({ message: 'Bad Request: Authorization code or manual token is required.' }, { status: 400 });
        }
        
        const { id: instagramUserId, username: instagramUsername } = await getInstagramBusinessAccount(longLivedToken);
        
        const expiresAt = new Date(tokenData.expires_at * 1000);

        const connectionData: Omit<SocialMediaConnection, 'id'> = {
            platform: 'instagram',
            userId,
            companyId,
            instagramUserId,
            instagramUsername,
            accessToken: longLivedToken,
            expiresAt: serverTimestamp.fromMillis(expiresAt.getTime()),
            connectedAt: serverTimestamp(),
        };
        
        const connectionId = `${companyId}_instagram`;
        await adminDb.collection('socialMediaConnections').doc(connectionId).set(connectionData, { merge: true });

        return NextResponse.json({ message: `Successfully connected to Instagram account @${instagramUsername}.` }, { status: 200 });

    } catch (error: any) {
        console.error("Instagram Token Update/Exchange Error:", error);
        return NextResponse.json({ message: error.message || 'An internal server error occurred.' }, { status: 500 });
    }
}

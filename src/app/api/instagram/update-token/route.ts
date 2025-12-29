
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { serverTimestamp } from 'firebase-admin/firestore';
import type { SocialMediaConnection } from '@/lib/types-backend';

const FACEBOOK_GRAPH_API_URL = "https://graph.facebook.com/v19.0";

/**
 * Gets the Instagram Business Account ID and username linked to a Facebook Page using a valid token.
 * This function now serves as the primary validation method.
 * @param accessToken A valid, long-lived user access token.
 * @returns The ID and username of the linked Instagram Business Account.
 * @throws An error if no linked account is found or if the token is invalid.
 */
async function getInstagramBusinessAccount(accessToken: string): Promise<{ id: string; username: string }> {
    const url = `${FACEBOOK_GRAPH_API_URL}/me/accounts?fields=instagram_business_account{id,username}&access_token=${accessToken}`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
        // Provide a more specific error message if possible
        if (data.error.code === 190) { // OAuthException
            throw new Error('The provided token is invalid, expired, or has been revoked.');
        }
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

        const { accessToken } = await request.json();
        if (!accessToken || typeof accessToken !== 'string') {
            return NextResponse.json({ message: 'Bad Request: Access token is missing or invalid.' }, { status: 400 });
        }

        const trimmedToken = accessToken.trim();

        // 1. Validate the token and get Instagram Business Account details
        const { id: instagramUserId, username: instagramUsername } = await getInstagramBusinessAccount(trimmedToken);
        
        // 2. Prepare data for Firestore
        const expiresAtTimestamp = serverTimestamp(); // Placeholder, we no longer get expiry from debug_token

        const connectionData: Omit<SocialMediaConnection, 'id'> = {
            platform: 'instagram',
            userId: userId,
            companyId: companyId,
            instagramUserId: instagramUserId,
            instagramUsername: instagramUsername,
            accessToken: trimmedToken,
            expiresIn: 0, // Not available without debug_token, set to 0
            expiresAt: expiresAtTimestamp,
            connectedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };
        
        const connectionId = `${companyId}_instagram`;
        await adminDb.collection('socialMediaConnections').doc(connectionId).set(connectionData, { merge: true });

        return NextResponse.json({ message: `Successfully connected to Instagram account @${instagramUsername}.` }, { status: 200 });

    } catch (error: any) {
        console.error("Instagram Manual Token Update Error:", error);
        // Return a 400 Bad Request for validation errors, and 500 for others
        const statusCode = error.message.includes('token') || error.message.includes('permission') || error.message.includes('No Instagram Business Account') ? 400 : 500;
        return NextResponse.json({ message: error.message || 'An internal server error occurred.' }, { status: statusCode });
    }
}

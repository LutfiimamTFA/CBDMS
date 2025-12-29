
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { serverTimestamp } from 'firebase-admin/firestore';
import type { SocialMediaConnection } from '@/lib/types-backend';

const FACEBOOK_GRAPH_API_URL = "https://graph.facebook.com/v19.0";

/**
 * Validates a user-provided token against Meta's debug_token endpoint.
 * Requires a server-side App Access Token.
 * @param userToken The token to validate.
 * @returns The validation data from Meta.
 */
async function validateToken(userToken: string): Promise<any> {
    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;

    if (!appId || !appSecret) {
        throw new Error('Server configuration error: Missing Meta App credentials.');
    }

    const appAccessToken = `${appId}|${appSecret}`;
    const url = `${FACEBOOK_GRAPH_API_URL}/debug_token?input_token=${userToken}&access_token=${appAccessToken}`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (data.error || !data.data.is_valid) {
        throw new Error(data.error?.message || 'The provided token is invalid or expired.');
    }
    
    // Check for required scopes
    const requiredScopes = ['instagram_basic', 'pages_show_list', 'instagram_content_publish'];
    const hasAllScopes = requiredScopes.every(scope => data.data.scopes.includes(scope));
    
    if (!hasAllScopes) {
        throw new Error(`Token is missing required permissions. Please grant: ${requiredScopes.join(', ')}.`);
    }

    return data.data;
}


/**
 * Gets the Instagram Business Account ID and username linked to a Facebook Page using a valid token.
 * @param accessToken A valid, long-lived user access token.
 * @returns The ID and username of the linked Instagram Business Account.
 */
async function getInstagramBusinessAccount(accessToken: string): Promise<{ id: string; username: string }> {
    const url = `${FACEBOOK_GRAPH_API_URL}/me/accounts?fields=instagram_business_account{id,username}&access_token=${accessToken}`;
    
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
      return NextResponse.json({ message: 'Unauthorized: Missing or invalid token.' }, { status: 401 });
    }
    const idToken = authHeader.split('Bearer ')[1];
    
    try {
        const decodedToken = await adminAuth.verifyIdToken(idToken);
        const userId = decodedToken.uid;
        const userRole = decodedToken.role;

        // Security Check: Only Admins or Managers can perform this action.
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

        // 1. Validate the token using Meta's debug_token endpoint
        const validationData = await validateToken(trimmedToken);
        
        // 2. Get the Instagram Business Account details
        const { id: instagramUserId, username: instagramUsername } = await getInstagramBusinessAccount(trimmedToken);
        
        // 3. Prepare data for Firestore
        const expiresAt = new Date(validationData.expires_at * 1000);

        const connectionData: Omit<SocialMediaConnection, 'id'> = {
            platform: 'instagram',
            userId: userId, // The user who performed the action
            companyId: companyId,
            instagramUserId: instagramUserId,
            instagramUsername: instagramUsername,
            accessToken: trimmedToken,
            expiresIn: validationData.data_access_expires_at - validationData.issued_at,
            expiresAt: expiresAt,
            connectedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };
        
        const connectionId = `${companyId}_instagram`;
        // Use set with merge:true to create or update the document
        await adminDb.collection('socialMediaConnections').doc(connectionId).set(connectionData, { merge: true });

        return NextResponse.json({ message: `Successfully connected to Instagram account @${instagramUsername}.` }, { status: 200 });

    } catch (error: any) {
        console.error("Instagram Manual Token Update Error:", error);
        // Return a 400 Bad Request for validation errors, and 500 for others
        const statusCode = error.message.includes('token') || error.message.includes('permission') ? 400 : 500;
        return NextResponse.json({ message: error.message || 'An internal server error occurred.' }, { status: statusCode });
    }
}

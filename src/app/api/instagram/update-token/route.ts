
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { Timestamp, serverTimestamp } from 'firebase-admin/firestore';
import { SocialMediaConnection } from '@/lib/types-backend';

const FACEBOOK_GRAPH_API_URL = "https://graph.facebook.com/v19.0";

// This function validates the token by fetching connected Instagram Business Accounts
async function getInstagramBusinessAccount(accessToken: string): Promise<{ id: string; username: string }> {
    const pagesUrl = `${FACEBOOK_GRAPH_API_URL}/me/accounts?fields=instagram_business_account{username}&access_token=${accessToken}`;
    const pagesResponse = await fetch(pagesUrl);
    const pagesData = await pagesResponse.json();

    if (pagesData.error) {
        throw new Error(`Error fetching pages: ${pagesData.error.message}`);
    }

    const businessAccount = pagesData.data?.find((page: any) => page.instagram_business_account)?.instagram_business_account;

    if (!businessAccount) {
        throw new Error('No Instagram Business Account found linked to any Facebook Page. Please ensure your account is set up correctly as a Professional/Business account and linked to a Facebook Page.');
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

        // 1. Validate the token by fetching the user's business account info
        const { id: instagramUserId, username: instagramUsername } = await getInstagramBusinessAccount(newToken);
        
        // Assume 60-day expiry for manually entered long-lived tokens
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 60);

        // 2. Securely store the token and user info in Firestore
        const connectionData: Omit<SocialMediaConnection, 'id'> = {
            platform: 'instagram',
            userId, 
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

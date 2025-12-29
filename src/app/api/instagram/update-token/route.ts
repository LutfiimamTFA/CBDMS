import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { serverTimestamp } from 'firebase-admin/firestore';
import type { SocialMediaConnection } from '@/lib/types-backend';

const FACEBOOK_GRAPH_API_URL = "https://graph.facebook.com/v19.0";

// Gets the Instagram Business Account ID and username linked to a Facebook Page
async function getInstagramUser(accessToken: string): Promise<{ id: string; username: string }> {
    // This URL asks for the IG business account connected to any of the user's FB pages
    const pagesUrl = `${FACEBOOK_GRAPH_API_URL}/me/accounts?fields=instagram_business_account{id,username}&access_token=${accessToken}`;
    
    const response = await fetch(pagesUrl);
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
            return NextResponse.json({ message: 'User not found in database.' }, { status: 404 });
        }
        const companyId = userDoc.data()?.companyId;
        if (!companyId) {
            return NextResponse.json({ message: 'User is not associated with a company.' }, { status: 400 });
        }

        const { accessToken } = await request.json();
        if (!accessToken) {
            return NextResponse.json({ message: 'Access token is missing.' }, { status: 400 });
        }

        // --- Use the provided token to get Instagram user details ---
        const { id: instagramUserId, username: instagramUsername } = await getInstagramUser(accessToken);
        
        // --- Store the connection details in Firestore ---
        // Note: For manually provided tokens, we don't know the exact expiry,
        // so we'll set a placeholder or assume the standard 60 days.
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 60);

        const connectionData: Omit<SocialMediaConnection, 'id'> = {
            platform: 'instagram',
            userId: userId,
            companyId: companyId,
            instagramUserId: instagramUserId,
            instagramUsername: instagramUsername,
            accessToken: accessToken, // The token provided by the user
            expiresIn: 5184000, // 60 days in seconds, a typical long-lived token duration
            expiresAt: expiresAt,
            connectedAt: serverTimestamp(),
        };
        
        const connectionId = `${companyId}_instagram`;
        // Use set with merge:true to create or update the document
        await adminDb.collection('socialMediaConnections').doc(connectionId).set(connectionData, { merge: true });

        return NextResponse.json({ message: 'Successfully validated and updated Instagram token.' }, { status: 200 });

    } catch (error: any) {
        console.error("Instagram Manual Token Update Error:", error);
        return NextResponse.json({ message: error.message || 'An internal server error occurred.' }, { status: 500 });
    }
}

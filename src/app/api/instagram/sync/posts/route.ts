
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import type { SocialMediaConnection } from '@/lib/types';

const INSTAGRAM_GRAPH_API_URL = "https://graph.instagram.com";

export async function GET(request: Request) {
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

        const connectionDoc = await adminDb.collection('socialMediaConnections').doc(`${companyId}_instagram`).get();
        if (!connectionDoc.exists) {
            return NextResponse.json({ message: 'Instagram connection not found for this company.' }, { status: 404 });
        }
        const connectionData = connectionDoc.data() as SocialMediaConnection;
        const { accessToken, instagramUserId } = connectionData;

        // Fetch user's media from Instagram Graph API
        const fields = 'id,media_type,media_url,thumbnail_url,permalink,caption,timestamp,username,comments_count,like_count';
        const mediaUrl = `${INSTAGRAM_GRAPH_API_URL}/${instagramUserId}/media?fields=${fields}&access_token=${accessToken}`;
        
        const mediaResponse = await fetch(mediaUrl);
        const mediaData = await mediaResponse.json();

        if (mediaData.error) {
            throw new Error(`Error fetching Instagram media: ${mediaData.error.message}`);
        }
        
        return NextResponse.json(mediaData.data, { status: 200 });

    } catch (error: any) {
        console.error("Instagram Sync Posts Error:", error);
        return NextResponse.json({ message: error.message || 'An internal server error occurred.' }, { status: 500 });
    }
}


import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import type { SocialMediaPost, SocialMediaConnection } from '@/lib/types-backend';

const FACEBOOK_GRAPH_API_URL = "https://graph.facebook.com/v20.0";

// Helper function to poll for container status
async function pollContainerStatus(containerId: string, accessToken: string, maxRetries = 20, delay = 5000) {
    for (let i = 0; i < maxRetries; i++) {
        const statusUrl = `${FACEBOOK_GRAPH_API_URL}/${containerId}?fields=status_code&access_token=${accessToken}`;
        const statusResponse = await fetch(statusUrl);
        const statusData = await statusResponse.json();

        if (statusData.error) {
            throw new Error(`Error checking container status: ${statusData.error.message}`);
        }

        const statusCode = statusData.status_code;
        if (statusCode === 'FINISHED') {
            return true;
        }
        if (statusCode === 'ERROR') {
            throw new Error('Media container processing failed.');
        }
        
        await new Promise(resolve => setTimeout(resolve, delay));
    }
    throw new Error('Media container processing timed out.');
}


export async function POST(request: Request) {
    const authHeader = request.headers.get('Authorization');
    if (authHeader !== `Bearer ${process.env.SCHEDULER_SECRET}`) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { postId } = await request.json();

    if (!postId) {
        return NextResponse.json({ message: 'Post ID is required.' }, { status: 400 });
    }

    try {
        const postDoc = await adminDb.collection('socialMediaPosts').doc(postId).get();
        if (!postDoc.exists) {
            return NextResponse.json({ message: 'Social media post not found.' }, { status: 404 });
        }
        const postData = postDoc.data() as SocialMediaPost;

        const connectionId = `${postData.companyId}_instagram`;
        const connectionDoc = await adminDb.collection('socialMediaConnections').doc(connectionId).get();
        if (!connectionDoc.exists) {
            throw new Error('Instagram connection not found for this company.');
        }
        const connectionData = connectionDoc.data() as SocialMediaConnection;
        const { accessToken, instagramUserId } = connectionData;

        const mediaType = postData.postType === 'Reels' ? 'REELS' : 'IMAGE';

        // --- Step 1: Create Media Container ---
        let creationUrl = `${FACEBOOK_GRAPH_API_URL}/${instagramUserId}/media`;
        const params = new URLSearchParams();
        
        if (mediaType === 'IMAGE') {
            params.append('image_url', postData.mediaUrl || '');
        } else { // REELS
            params.append('media_type', 'VIDEO');
            params.append('video_url', postData.mediaUrl || '');
        }
        params.append('caption', postData.caption);
        params.append('access_token', accessToken);

        const creationResponse = await fetch(`${creationUrl}?${params.toString()}`, { method: 'POST' });
        const creationData = await creationResponse.json();

        if (creationData.error) {
            throw new Error(`Error creating media container: ${creationData.error.message}`);
        }
        const containerId = creationData.id;

        // --- Poll for status if it's a video/reel ---
        if (mediaType === 'REELS') {
            await pollContainerStatus(containerId, accessToken);
        }

        // --- Step 2: Publish Media Container ---
        const publishUrl = `${FACEBOOK_GRAPH_API_URL}/${instagramUserId}/media_publish`;
        const publishParams = new URLSearchParams({
            creation_id: containerId,
            access_token: accessToken,
        });

        const publishResponse = await fetch(`${publishUrl}?${publishParams.toString()}`, { method: 'POST' });
        const publishData = await publishResponse.json();

        if (publishData.error) {
            throw new Error(`Error publishing media: ${publishData.error.message}`);
        }

        return NextResponse.json({ message: 'Post published successfully!', mediaId: publishData.id }, { status: 200 });

    } catch (error: any) {
        console.error("Instagram Publish Error:", error);
        // Ensure the response is in the format Next.js expects for errors
        return NextResponse.json({ message: error.message || 'An internal server error occurred.' }, { status: 500 });
    }
}

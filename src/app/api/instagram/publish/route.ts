
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import type { SocialMediaPost, SocialMediaConnection } from '@/lib/types';

// Helper function to poll for container status
async function pollContainerStatus(containerId: string, accessToken: string, maxRetries = 20, delay = 5000) {
    for (let i = 0; i < maxRetries; i++) {
        const statusUrl = `https://graph.facebook.com/v19.0/${containerId}?fields=status_code&access_token=${accessToken}`;
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

        const connectionDoc = await adminDb.collection('socialMediaConnections').doc(`${postData.companyId}_instagram`).get();
        if (!connectionDoc.exists) {
            return NextResponse.json({ message: 'Instagram connection not found for this company.' }, { status: 404 });
        }
        const connectionData = connectionDoc.data() as SocialMediaConnection;
        const { accessToken, instagramUserId } = connectionData;

        // --- Step 1: Create Media Container ---
        const creationUrl = `https://graph.facebook.com/v19.0/${instagramUserId}/media`;
        const mediaType = postData.postType === 'Reels' ? 'REELS' : 'IMAGE';
        
        const creationParams = new URLSearchParams({
            access_token: accessToken,
            caption: postData.caption,
        });

        if (mediaType === 'IMAGE') {
            creationParams.append('image_url', postData.mediaUrl || '');
        } else { // REELS
            creationParams.append('media_type', 'VIDEO');
            creationParams.append('video_url', postData.mediaUrl || '');
        }

        const creationResponse = await fetch(`${creationUrl}?${creationParams.toString()}`, {
            method: 'POST',
        });
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
        const publishUrl = `https://graph.facebook.com/v19.0/${instagramUserId}/media_publish`;
        const publishParams = new URLSearchParams({
            access_token: accessToken,
            creation_id: containerId,
        });
        
        const publishResponse = await fetch(`${publishUrl}?${publishParams.toString()}`, {
            method: 'POST',
        });
        const publishData = await publishResponse.json();

        if (publishData.error) {
            throw new Error(`Error publishing media: ${publishData.error.message}`);
        }

        return NextResponse.json({ message: 'Post published successfully!', mediaId: publishData.id }, { status: 200 });

    } catch (error: any) {
        console.error("Instagram Publish Error:", error);
        return NextResponse.json({ message: error.message || 'An internal server error occurred.' }, { status: 500 });
    }
}

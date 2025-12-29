
import { NextResponse } from 'next/server';

const META_APP_ID = process.env.META_APP_ID;
const META_APP_SECRET = process.env.META_APP_SECRET;
const REDIRECT_URI = process.env.INSTAGRAM_REDIRECT_URI;

export async function POST(request: Request) {
    if (!META_APP_ID || !META_APP_SECRET || !REDIRECT_URI) {
        return NextResponse.json({ message: 'Server configuration error: Missing Meta App credentials or Redirect URI.' }, { status: 500 });
    }

    try {
        const { code } = await request.json();
        if (!code) {
            return NextResponse.json({ message: 'Authorization code is missing.' }, { status: 400 });
        }

        // 1. Exchange code for a short-lived access token
        const tokenUrl = `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${META_APP_ID}&redirect_uri=${REDIRECT_URI}&client_secret=${META_APP_SECRET}&code=${code}`;
        const tokenResponse = await fetch(tokenUrl);
        const tokenData = await tokenResponse.json();

        if (tokenData.error) {
            throw new Error(`Error getting token: ${tokenData.error.message}`);
        }

        const shortLivedToken = tokenData.access_token;

        // 2. Exchange short-lived token for a long-lived access token
        const longLivedTokenUrl = `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${META_APP_ID}&client_secret=${META_APP_SECRET}&fb_exchange_token=${shortLivedToken}`;
        const longLivedTokenResponse = await fetch(longLivedTokenUrl);
        const longLivedTokenData = await longLivedTokenResponse.json();

        if (longLivedTokenData.error) {
            throw new Error(`Error getting long-lived token: ${longLivedTokenData.error.message}`);
        }

        const longLivedToken = longLivedTokenData.access_token;
        const expiresIn = longLivedTokenData.expires_in;

        // TODO: Securely store the longLivedToken and expiresIn in Firestore
        // For now, we'll just log it and return success.
        console.log("Successfully obtained long-lived token:", {
            token: longLivedToken.substring(0, 10) + '...', // Log truncated token for security
            expiresInSeconds: expiresIn
        });


        return NextResponse.json({ message: 'Successfully authenticated.' }, { status: 200 });
        
    } catch (error: any) {
        console.error("Instagram auth callback error:", error);
        return NextResponse.json({ message: error.message || 'An internal server error occurred.' }, { status: 500 });
    }
}

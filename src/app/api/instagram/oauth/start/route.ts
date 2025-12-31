'use server';
import { NextResponse, type NextRequest } from 'next/server';
import crypto from 'crypto';
import { cookies } from 'next/headers';
import { adminAuth } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
    const errorUrl = new URL('/social-media/integrations', request.url);

    const clientId = process.env.INSTAGRAM_APP_ID;
    const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL}/api/instagram/oauth/callback`;

    if (!clientId || !redirectUri) {
        console.error("CRITICAL: Instagram OAuth environment variables are not set.");
        errorUrl.searchParams.set('error', 'server_misconfigured');
        errorUrl.searchParams.set('error_description', 'The server is not configured for Instagram integration. Please contact support.');
        return NextResponse.redirect(errorUrl);
    }
    
    // Generate a secure, random state parameter to prevent CSRF attacks.
    const state = crypto.randomBytes(16).toString('hex');

    // Store the state in an httpOnly cookie. This is the crucial security step.
    cookies().set('ig_oauth_state', state, {
        httpOnly: true,
        secure: process.env.NODE_ENV !== 'development',
        maxAge: 60 * 10, // 10 minutes
        sameSite: 'lax',
        path: '/',
    });
    
    const scope = [
        'instagram_basic',
        'instagram_content_publish',
        'pages_show_list',
        'pages_read_engagement',
        'business_management',
    ].join(',');

    const authUrl = new URL('https://www.facebook.com/v20.0/dialog/oauth');
    authUrl.searchParams.append('client_id', clientId);
    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append('state', state); // The random state is sent to Meta
    authUrl.searchParams.append('scope', scope);
    authUrl.searchParams.append('response_type', 'code');

    // Always redirect the user to the Meta OAuth dialog.
    return NextResponse.redirect(authUrl.toString());
}

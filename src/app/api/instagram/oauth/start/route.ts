'use server';
import { NextResponse, type NextRequest } from 'next/server';
import crypto from 'crypto';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
    const errorUrl = new URL('/social-media/integrations', request.nextUrl.origin);

    const clientId = process.env.INSTAGRAM_APP_ID;
    
    // The redirect URI MUST be constructed dynamically from the request origin.
    // This removes the dependency on NEXT_PUBLIC_BASE_URL and fixes the 0.0.0.0 bug.
    const redirectUri = new URL('/api/instagram/oauth/callback', request.nextUrl.origin).toString();

    if (!clientId) {
        console.error("CRITICAL: Instagram OAuth environment variables are not set.");
        errorUrl.searchParams.set('error', 'server_misconfigured');
        errorUrl.searchParams.set('error_description', 'The server is not configured for Instagram integration. Please contact support.');
        return NextResponse.redirect(errorUrl);
    }
    
    const state = crypto.randomBytes(16).toString('hex');

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
    authUrl.searchParams.append('state', state);
    authUrl.searchParams.append('scope', scope);
    authUrl.searchParams.append('response_type', 'code');

    return NextResponse.redirect(authUrl.toString());
}

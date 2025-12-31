
'use server';
import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const state = searchParams.get('state'); // The ID token from the client

  if (!state) {
    const errorUrl = new URL('/social-media/integrations', request.url);
    errorUrl.searchParams.set('error', 'auth_error');
    errorUrl.searchParams.set('error_description', 'Authentication state is missing. Please try again.');
    return NextResponse.redirect(errorUrl);
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(state);
    const userRole = decodedToken.role;

    if (userRole !== 'Super Admin' && userRole !== 'Manager') {
      const errorUrl = new URL('/social-media/integrations', request.url);
      errorUrl.searchParams.set('error', 'permission_denied');
      errorUrl.searchParams.set('error_description', 'You do not have permission to perform this action.');
      return NextResponse.redirect(errorUrl);
    }

    const clientId = process.env.INSTAGRAM_APP_ID;
    const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL}/api/instagram/oauth/callback`;

    if (!clientId || !redirectUri) {
        console.error("CRITICAL: Instagram OAuth environment variables are not set.");
        const errorUrl = new URL('/social-media/integrations', request.url);
        errorUrl.searchParams.set('error', 'server_misconfigured');
        errorUrl.searchParams.set('error_description', 'The server is not configured for Instagram integration. Please contact support.');
        return NextResponse.redirect(errorUrl);
    }
    
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
    authUrl.searchParams.append('state', state); // Pass the original state (ID token) through
    authUrl.searchParams.append('scope', scope);
    authUrl.searchParams.append('response_type', 'code');

    return NextResponse.redirect(authUrl.toString());

  } catch (error: any) {
    console.error("Instagram OAuth Start Error:", error);
    const errorUrl = new URL('/social-media/integrations', request.url);
    if (error.code === 'auth/id-token-expired' || error.code === 'auth/argument-error') {
        errorUrl.searchParams.set('error', 'auth_error');
        errorUrl.searchParams.set('error_description', 'Your session has expired. Please log in again.');
    } else {
        errorUrl.searchParams.set('error', 'unknown_start_error');
        errorUrl.searchParams.set('error_description', 'An unexpected error occurred while starting the connection process.');
    }
    return NextResponse.redirect(errorUrl);
  }
}

    
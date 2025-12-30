'use server';
import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';

export async function GET(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ message: 'Unauthorized: Missing or invalid token.' }, { status: 401 });
  }
  const idToken = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const userRole = decodedToken.role;

    if (userRole !== 'Super Admin' && userRole !== 'Manager') {
      return NextResponse.json({ message: 'Forbidden: You do not have permission.' }, { status: 403 });
    }

    const clientId = process.env.INSTAGRAM_APP_ID;
    const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL}/api/instagram/oauth/callback`;

    if (!clientId || !redirectUri) {
        // Log the severe configuration error on the server
        console.error("CRITICAL: Instagram OAuth environment variables are not set.");
        // Redirect to an error page on the client side instead of throwing
        const errorUrl = new URL('/social-media/integrations', request.url);
        errorUrl.searchParams.set('error', 'server_misconfigured');
        errorUrl.searchParams.set('error_description', 'The server is not configured for Instagram integration. Please contact support.');
        return NextResponse.redirect(errorUrl);
    }
    
    // Pass the user's ID token in the state to re-authenticate on callback
    const state = idToken;

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

    // Always redirect to the Meta OAuth dialog
    return NextResponse.redirect(authUrl.toString());

  } catch (error: any) {
    console.error("Instagram OAuth Start Error:", error);
    // Handle cases like an invalid or expired token
    const errorUrl = new URL('/social-media/integrations', request.url);
    if (error.code === 'auth/id-token-expired' || error.code === 'auth/argument-error') {
        errorUrl.searchParams.set('error', 'auth_error');
        errorUrl.searchParams.set('error_description', 'Your session has expired. Please log in again.');
        return NextResponse.redirect(errorUrl);
    }
    // For other unexpected errors, provide a generic message
    errorUrl.searchParams.set('error', 'unknown_start_error');
    errorUrl.searchParams.set('error_description', 'An unexpected error occurred while starting the connection process.');
    return NextResponse.redirect(errorUrl);
  }
}

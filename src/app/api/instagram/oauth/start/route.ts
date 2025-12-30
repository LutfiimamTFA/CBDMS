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
        throw new Error("Instagram App ID or Redirect URI is not configured on the server.");
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

    return NextResponse.redirect(authUrl.toString());

  } catch (error: any) {
    console.error("Instagram OAuth Start Error:", error);
    if (error.code === 'auth/id-token-expired' || error.code === 'auth/argument-error') {
        return NextResponse.json({ message: 'Unauthorized: Invalid token.' }, { status: 401 });
    }
    return NextResponse.json({ message: error.message || 'An internal server error occurred.' }, { status: 500 });
  }
}

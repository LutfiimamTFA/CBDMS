'use server';
import { NextResponse, type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // The ID token from the start of the flow

  if (searchParams.has('error')) {
    const errorDescription = searchParams.get('error_description') || 'An error occurred during authentication.';
    const errorUrl = new URL('/social-media/integrations', request.url);
    errorUrl.searchParams.set('error', 'oauth_failed');
    errorUrl.searchParams.set('error_description', errorDescription);
    return NextResponse.redirect(errorUrl);
  }

  if (!code || !state) {
    return NextResponse.json({ message: 'Error: Missing code or state from callback.' }, { status: 400 });
  }

  try {
    // Forward the code and the original ID token (state) to our internal API endpoint
    // This keeps the client-facing callback clean and moves all logic to a secure, internal API.
    const internalApiUrl = new URL('/api/instagram/token/manual', request.url);
    
    const response = await fetch(internalApiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${state}` // Authenticate the internal request with the user's token
        },
        body: JSON.stringify({ authorizationCode: code }), // Send the authorization code
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to exchange authentication code.');
    }

    // On success, redirect the user back to the integrations page.
    const successUrl = new URL('/social-media/integrations', request.url);
    successUrl.searchParams.set('status', 'connected');
    return NextResponse.redirect(successUrl);

  } catch (error: any) {
    console.error("Instagram OAuth Callback Error:", error);
    const errorUrl = new URL('/social-media/integrations', request.url);
    errorUrl.searchParams.set('error', 'connection_failed');
    errorUrl.searchParams.set('error_description', error.message);
    return NextResponse.redirect(errorUrl);
  }
}

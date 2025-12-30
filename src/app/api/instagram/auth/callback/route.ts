import { NextResponse, type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  if (!code || !state) {
    return NextResponse.json({ message: 'Error: Missing code or state from callback.' }, { status: 400 });
  }

  try {
    // The 'state' should contain the Firebase user's ID token to authenticate the request
    // This part is simplified; in production, you'd verify the token.
    const internalApiResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/instagram/update-token`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${state}` // Pass the ID token from state
        },
        body: JSON.stringify({ code: code }),
    });

    if (!internalApiResponse.ok) {
        const errorData = await internalApiResponse.json();
        throw new Error(errorData.message || 'Failed to exchange token.');
    }

    // Redirect user back to the integrations page on success
    return NextResponse.redirect(new URL('/social-media/integrations', request.url));

  } catch (error: any) {
    console.error("Instagram OAuth callback error:", error);
    // Redirect to integrations page with an error message
    const errorUrl = new URL('/social-media/integrations', request.url);
    errorUrl.searchParams.set('error', 'connection_failed');
    errorUrl.searchParams.set('error_description', error.message);
    return NextResponse.redirect(errorUrl);
  }
}

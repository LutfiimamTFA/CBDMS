'use server';
import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';

// This endpoint simply redirects to the main OAuth starting point.
// It exists to provide a clear, semantic API for token renewal.
export async function GET(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ message: 'Unauthorized: Missing or invalid token.' }, { status: 401 });
  }
  
  try {
    const idToken = authHeader.split('Bearer ')[1];
    await adminAuth.verifyIdToken(idToken); // Verify the user is logged in
    
    // The core logic is identical to starting a new connection.
    // We pass the user's token in the state to re-authenticate on callback.
    const oauthStartUrl = new URL('/api/instagram/oauth/start', request.url);
    oauthStartUrl.searchParams.set('state', idToken);

    return NextResponse.redirect(oauthStartUrl.toString());
  } catch (error: any) {
    console.error("Instagram Renew Error:", error);
    return NextResponse.json({ message: 'Authentication failed. Please log in again.' }, { status: 401 });
  }
}

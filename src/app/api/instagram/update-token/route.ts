
import { NextResponse } from 'next/server';

// This entire API route is deprecated and replaced by the OAuth2 callback flow.
// It is kept to prevent 404 errors but should not be used.
export async function POST(request: Request) {
  return NextResponse.json(
    { 
      message: 'This endpoint is deprecated. Please use the OAuth2 connection flow at /social-media/integrations.' 
    },
    { status: 410 } // 410 Gone
  );
}

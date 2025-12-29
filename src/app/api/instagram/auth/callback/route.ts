import { NextResponse } from 'next/server';

// This entire endpoint is part of the automated OAuth flow, which is now deprecated in favor of the manual token flow.
// Returning a 410 Gone status indicates that this resource is intentionally no longer available.
export async function GET(request: Request) {
  return NextResponse.json(
    { 
      message: 'This endpoint is deprecated. Please use the manual token update flow.' 
    },
    { status: 410 } // 410 Gone
  );
}

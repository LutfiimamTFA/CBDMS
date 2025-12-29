
import { NextResponse } from 'next/server';

// This endpoint is no longer used in the new OAuth flow.
// It can be considered deprecated, but is kept to prevent 404s if old UI elements still call it.
export async function POST(request: Request) {
  return NextResponse.json(
    { 
      message: 'This manual update endpoint is deprecated. Please use the "Reconnect Account" button to refresh your token via the standard authentication flow.' 
    },
    { status: 410 } // 410 Gone
  );
}

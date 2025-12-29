import { NextResponse } from 'next/server';

// This entire endpoint is part of the automated OAuth flow, which is being replaced by the manual token flow.
// Returning a 410 Gone status indicates that this resource is intentionally no longer available.
export async function POST(request: Request) {
  return NextResponse.json(
    { 
      message: 'This endpoint is deprecated and not used in the current manual token flow.' 
    },
    { status: 410 } // 410 Gone
  );
}

export async function GET(request: Request) {
  return NextResponse.json(
    { 
      message: 'This endpoint is deprecated and not used in the current manual token flow.' 
    },
    { status: 410 } // 410 Gone
  );
}

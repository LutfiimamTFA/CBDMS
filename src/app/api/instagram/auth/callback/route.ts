
import { NextResponse } from 'next/server';

// This endpoint is no longer used in the manual token flow.
// It is kept to prevent 404 errors but can be considered deprecated.
export async function POST(request: Request) {
  return NextResponse.json(
    { 
      message: 'This endpoint is deprecated. Please use the manual update flow at /social-media/integrations.' 
    },
    { status: 410 } // 410 Gone
  );
}

export async function GET(request: Request) {
  return NextResponse.json(
    { 
      message: 'This endpoint is deprecated. Please use the manual update flow at /social-media/integrations.' 
    },
    { status: 410 } // 410 Gone
  );
}

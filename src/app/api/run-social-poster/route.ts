
import { NextResponse } from 'next/server';

// This file is now deprecated and its logic is merged into /api/run-scheduler.
// It is kept for historical purposes but should not be used directly.
export async function GET(request: Request) {
  
  return NextResponse.json(
    {
      message: `This endpoint is deprecated. Please use /api/run-scheduler to run all scheduled jobs.`,
    },
    { status: 410 } // 410 Gone
  );
}

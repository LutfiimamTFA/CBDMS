// src/app/api/admin/instagram-config/route.ts
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { getInstagramConfig } from '@/lib/instagram-config';

// GET endpoint to check if the configuration exists
export async function GET(request: Request) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    
    try {
        const idToken = authHeader.split('Bearer ')[1];
        await adminAuth.verifyIdToken(idToken);
        
        const config = await getInstagramConfig();
        
        return NextResponse.json({ isConfigured: !!config }, { status: 200 });

    } catch (error: any) {
        return NextResponse.json({ message: 'Authentication failed' }, { status: 401 });
    }
}

// POST endpoint to save the configuration
export async function POST(request: Request) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    try {
        const idToken = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(idToken);
        const userRole = decodedToken.role;

        if (userRole !== 'Super Admin' && userRole !== 'Manager') {
             return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
        }

        const { appId, appSecret } = await request.json();
        if (!appId || !appSecret) {
            return NextResponse.json({ message: 'App ID and App Secret are required.' }, { status: 400 });
        }
        
        const configRef = adminDb.collection('systemSettings').doc('socialMedia');
        await configRef.set({
            instagramAppId: appId,
            instagramAppSecret: appSecret,
        }, { merge: true });

        return NextResponse.json({ message: 'Instagram configuration saved successfully.' }, { status: 200 });

    } catch (error: any) {
        if (error.code === 'auth/id-token-expired' || error.code === 'auth/argument-error') {
            return NextResponse.json({ message: 'Authentication failed' }, { status: 401 });
        }
        console.error("Error saving Instagram config:", error);
        return NextResponse.json({ message: 'An internal server error occurred.' }, { status: 500 });
    }
}

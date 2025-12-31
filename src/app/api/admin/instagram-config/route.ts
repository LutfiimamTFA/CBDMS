
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
        
        if (!config) {
            return NextResponse.json({ configured: false, missing: ['appId', 'appSecret'] }, { status: 200 });
        }

        const missing = [];
        if (!config.appId) missing.push('appId');
        if (!config.appSecret) missing.push('appSecret');
        
        return NextResponse.json({ 
            configured: missing.length === 0,
            missing: missing,
            appIdMasked: config.appId ? `${config.appId.substring(0, 4)}...` : undefined,
        }, { status: 200 });

    } catch (error: any) {
        console.error("GET /api/admin/instagram-config error:", error);
        return NextResponse.json({ message: 'Authentication failed or server error.' }, { status: 401 });
    }
}

// POST endpoint to save the configuration
export async function POST(request: Request) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    try {
        const idToken = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(idToken);
        const userRole = decodedToken.role;

        if (userRole !== 'Super Admin' && userRole !== 'Manager') {
             return NextResponse.json({ ok: false, message: 'Forbidden: You do not have permission to change this configuration.' }, { status: 403 });
        }

        const { appId, appSecret } = await request.json();
        
        if (!appId || !appId.trim()) {
            return NextResponse.json({ ok: false, message: 'App ID cannot be empty.' }, { status: 400 });
        }
        if (!appSecret || appSecret.trim().length < 10) {
            return NextResponse.json({ ok: false, message: 'App Secret is required and must be at least 10 characters.' }, { status: 400 });
        }
        
        const configRef = adminDb.collection('systemSettings').doc('socialMedia');
        await configRef.set({
            instagramAppId: appId.trim(),
            instagramAppSecret: appSecret.trim(),
            updatedAt: new Date().toISOString(),
        }, { merge: true });

        return NextResponse.json({ ok: true, message: 'Instagram configuration saved successfully.' }, { status: 200 });

    } catch (error: any) {
        if (error.code === 'auth/id-token-expired' || error.code === 'auth/argument-error') {
            return NextResponse.json({ ok: false, message: 'Authentication failed' }, { status: 401 });
        }
        console.error("Error saving Instagram config:", error);
        return NextResponse.json({ ok: false, message: 'An internal server error occurred.' }, { status: 500 });
    }
}

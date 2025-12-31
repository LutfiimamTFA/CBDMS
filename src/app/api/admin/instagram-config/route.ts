// src/app/api/admin/instagram-config/route.ts
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { getInstagramConfig } from '@/lib/instagram-config';

async function verifyAdminRole(request: Request): Promise<{ uid: string; role: string; error: NextResponse | null }> {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { uid: '', role: '', error: NextResponse.json({ message: 'Unauthorized: Missing or invalid token.' }, { status: 401 }) };
    }
    const idToken = authHeader.split('Bearer ')[1];

    try {
        const decodedToken = await adminAuth.verifyIdToken(idToken);
        const userRole = decodedToken.role;

        if (userRole !== 'Super Admin' && userRole !== 'Manager') {
            return { uid: '', role: '', error: NextResponse.json({ message: 'Forbidden: You do not have permission.' }, { status: 403 }) };
        }
        return { uid: decodedToken.uid, role: userRole, error: null };
    } catch (error) {
        return { uid: '', role: '', error: NextResponse.json({ message: 'Unauthorized: Invalid session.' }, { status: 401 }) };
    }
}


// GET endpoint to check if the configuration exists
export async function GET(request: Request) {
    const { error } = await verifyAdminRole(request);
    if (error) return error;
    
    try {
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
        return NextResponse.json({ message: 'Server error while fetching configuration.' }, { status: 500 });
    }
}

// POST endpoint to save the configuration
export async function POST(request: Request) {
    const { error } = await verifyAdminRole(request);
    if (error) return error;

    try {
        const { appId, appSecret } = await request.json();
        
        if (!appId || !appId.trim()) {
            return NextResponse.json({ message: 'App ID cannot be empty.' }, { status: 400 });
        }
        if (!appSecret || appSecret.trim().length < 10) {
            return NextResponse.json({ message: 'App Secret is required and must be at least 10 characters.' }, { status: 400 });
        }
        
        const configRef = adminDb.collection('systemSettings').doc('socialMedia');
        await configRef.set({
            instagramAppId: appId.trim(),
            instagramAppSecret: appSecret.trim(),
            updatedAt: new Date().toISOString(),
        }, { merge: true });

        return NextResponse.json({ message: 'Instagram configuration saved successfully.' }, { status: 200 });

    } catch (error: any) {
        console.error("Error saving Instagram config:", error);
        return NextResponse.json({ message: 'An internal server error occurred.' }, { status: 500 });
    }
}

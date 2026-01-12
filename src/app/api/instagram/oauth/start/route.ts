
import { NextResponse, type NextRequest } from "next/server";
import crypto from "crypto";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { Timestamp, serverTimestamp } from "firebase-admin/firestore";

const STATE_COLLECTION = "oauthStates";
const REDIRECT_URI = "https://studio--studio-3200695440-bed4a.us-central1.hosted.app/api/instagram/oauth/callback";

export async function GET(req: NextRequest) {
    const requestId = crypto.randomBytes(8).toString("hex");
    const authHeader = req.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.error(`[IG_OAUTH_START_FAIL][${requestId}]`, { error: "UNAUTHORIZED", message: "Missing or invalid Authorization header." });
        return NextResponse.json({ message: "Unauthorized: Missing or invalid authentication token.", error: "UNAUTHORIZED", requestId }, { status: 401 });
    }
    const idToken = authHeader.split('Bearer ')[1];

    try {
        const decodedToken = await adminAuth.verifyIdToken(idToken);
        const uid = decodedToken.uid;
        const userRole = decodedToken.role;

        if (userRole !== 'Super Admin' && userRole !== 'Manager') {
            console.error(`[IG_OAUTH_START_FAIL][${requestId}]`, { error: "FORBIDDEN", message: "User does not have sufficient privileges.", userId: uid, role: userRole });
            return NextResponse.json({ message: "Forbidden: Only Managers or Super Admins can connect Instagram accounts.", error: "FORBIDDEN", requestId }, { status: 403 });
        }

        const configDoc = await adminDb.collection('systemSettings').doc('socialMedia').get();
        const config = configDoc.data();
        const appId = config?.instagramAppId;

        if (!appId) {
            console.error(`[IG_OAUTH_START_FAIL][${requestId}]`, { error: "MISSING_CONFIG", message: "Instagram App ID is not configured in Firestore." });
            return NextResponse.json({ message: "Server configuration error: Instagram App ID is missing. Please contact an administrator.", error: "MISSING_CONFIG", requestId }, { status: 500 });
        }

        const state = crypto.randomBytes(32).toString("hex");
        const stateDocRef = adminDb.collection(STATE_COLLECTION).doc(state);
        const expiresAt = Timestamp.fromMillis(Date.now() + 15 * 60 * 1000); // 15 minute TTL

        await stateDocRef.set({
            userId: uid,
            createdAt: serverTimestamp(),
            expiresAt,
        });

        console.log(`[IG_OAUTH_START_OK][${requestId}] State saved to Firestore.`, { state: state.slice(0, 6), userId: uid });

        const scope = "instagram_basic,instagram_content_publish,instagram_manage_insights,pages_show_list,pages_read_engagement,business_management";
        const authUrl = new URL("https://www.facebook.com/v20.0/dialog/oauth");
        authUrl.searchParams.set("client_id", appId);
        authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
        authUrl.searchParams.set("state", state);
        authUrl.searchParams.set("scope", scope);
        authUrl.searchParams.set("response_type", "code");
        
        return NextResponse.json({ authUrl: authUrl.toString() });

    } catch (error: any) {
        let errorCode = "TOKEN_VERIFY_FAILED";
        let errorMessage = "Your session is invalid or expired. Please log in again.";
        if (error.code === 'firestore/permission-denied') {
            errorCode = "STATE_WRITE_FAILED";
            errorMessage = "Failed to create a secure session state. Please check server permissions.";
        }
        
        console.error(`[IG_OAUTH_START_FAIL][${requestId}]`, { error: errorCode, originalError: error.message });

        return NextResponse.json({ message: errorMessage, error: errorCode, requestId }, { status: 500 });
    }
}

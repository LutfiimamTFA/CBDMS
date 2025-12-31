import { NextResponse, type NextRequest } from "next/server";
import crypto from "crypto";
import { cookies } from "next/headers";
import { getInstagramConfig } from "@/lib/instagram-config";
import { getAppBaseUrl } from "@/lib/get-app-base-url";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";

async function redirectWithError(baseUrl: string, error: string, description: string) {
    const integrationsUrl = new URL("/social-media/integrations", baseUrl);
    integrationsUrl.searchParams.set("error", error);
    integrationsUrl.searchParams.set("error_description", description);
    return NextResponse.redirect(integrationsUrl.toString());
}

export async function GET(req: NextRequest) {
  let baseUrl;
  try {
    baseUrl = await getAppBaseUrl(req);
  } catch (error: any) {
    console.error("CRITICAL: Could not determine a valid base URL for OAuth start.", error);
    const errorUrl = new URL("/social-media/integrations", req.nextUrl.origin);
    errorUrl.searchParams.set("error", "invalid_base_url");
    errorUrl.searchParams.set("error_description", error.message);
    return NextResponse.redirect(errorUrl.toString());
  }
  
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return await redirectWithError(baseUrl, "not_authenticated", "Your session is invalid. Please log in again.");
  }
  const idToken = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken.uid;
    const userRole = decodedToken.role;

    if (userRole !== 'Super Admin' && userRole !== 'Manager') {
        return await redirectWithError(baseUrl, "forbidden_role", "You do not have permission to connect social media accounts.");
    }
    
    const config = await getInstagramConfig();
    if (!config) {
      return await redirectWithError(baseUrl, "server_misconfigured", "Instagram App ID/Secret has not been configured. Please ask an administrator to set it up.");
    }

    const redirectUri = new URL("/api/instagram/oauth/callback", baseUrl).toString();
    
    const state = crypto.randomBytes(24).toString("hex");
    const oauthSessionId = crypto.randomBytes(24).toString("hex");

    const oauthSessionRef = adminDb.collection('oauthSessions').doc(oauthSessionId);
    const expiresAt = Timestamp.fromMillis(Date.now() + 10 * 60 * 1000); // 10 minute TTL
    await oauthSessionRef.set({ 
        uid,
        provider: 'instagram',
        createdAt: Timestamp.now(),
        expiresAt,
    });
    
    const cookieStore = cookies();
    cookieStore.set("ig_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });
     cookieStore.set("ig_oauth_session", oauthSessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });

    const scope = [
      "instagram_basic",
      "instagram_content_publish",
      "pages_show_list",
      "pages_read_engagement",
      "business_management",
    ].join(",");

    const authUrl = new URL("https://www.facebook.com/v20.0/dialog/oauth");
    authUrl.searchParams.set("client_id", config.appId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("scope", scope);
    authUrl.searchParams.set("response_type", "code");

    return NextResponse.redirect(authUrl.toString());

  } catch (error: any) {
    console.error("[OAuth Start Error]", error);
    let errorMessage = "Could not initiate the authentication flow.";
    let errorCode = "start_failed";
    if (error.code === 'auth/id-token-expired' || error.code === 'auth/argument-error') {
      errorMessage = "Your session has expired. Please log in again.";
      errorCode = "not_authenticated";
    }
    return await redirectWithError(baseUrl, errorCode, errorMessage);
  }
}

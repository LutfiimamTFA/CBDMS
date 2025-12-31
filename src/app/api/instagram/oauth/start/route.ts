
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
    return NextResponse.redirect(integrationsUrl);
}

export async function GET(req: NextRequest) {
  let baseUrl;
  try {
    baseUrl = await getAppBaseUrl(req);
  } catch (error: any) {
    // Cannot redirect without a base URL, but we can try a relative path if it's a non-fatal error.
    const url = new URL("/social-media/integrations", "https://placeholder.com"); // Placeholder base
    url.searchParams.set("error", "invalid_base_url");
    url.searchParams.set("error_description", error.message);
    return NextResponse.redirect(url.pathname + url.search);
  }

  try {
    // 1. Verify user is logged in and has the correct role
    const sessionCookie = (await cookies()).get('__session')?.value;
    if (!sessionCookie) {
        return await redirectWithError(baseUrl, "not_authenticated", "Please log in and try again.");
    }
    const decodedToken = await adminAuth.verifySessionCookie(sessionCookie, true);
    const uid = decodedToken.uid;
    const userRole = decodedToken.role;

    if (userRole !== 'Super Admin' && userRole !== 'Manager') {
        return await redirectWithError(baseUrl, "forbidden_role", "You do not have permission to connect social media accounts.");
    }
    
    // 2. Fetch Instagram App config
    const config = await getInstagramConfig();
    if (!config) {
      return await redirectWithError(baseUrl, "server_misconfigured", "Instagram App ID/Secret has not been configured. Please ask an administrator to set it up.");
    }

    // 3. Build the correct redirect URI
    const redirectUri = new URL("/api/instagram/oauth/callback", baseUrl).toString();

    // 4. Protection Guard (already inside getAppBaseUrl, but an extra check is good)
    if (process.env.NODE_ENV === "production" && (redirectUri.includes('localhost') || !redirectUri.startsWith('https'))) {
      throw new Error(`FATAL: Insecure redirect_uri generated for production: ${redirectUri}.`);
    }

    // 5. Generate state for CSRF protection and session bridging
    const state = crypto.randomBytes(24).toString("hex");

    // Store state and UID in Firestore with a TTL for session bridging
    const oauthSessionRef = adminDb.collection('oauthStates').doc(state);
    const expiresAt = Timestamp.fromMillis(Date.now() + 10 * 60 * 1000); // 10 minute TTL
    await oauthSessionRef.set({ 
        uid,
        provider: 'instagram',
        createdAt: Timestamp.now(),
        expiresAt,
    });
    
    // 6. Set CSRF state in a secure, httpOnly cookie
    const cookieStore = await cookies();
    cookieStore.set("ig_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600, // 10 minutes
    });

    const scope = [
      "instagram_basic",
      "instagram_content_publish",
      "pages_show_list",
      "pages_read_engagement",
      "business_management",
    ].join(",");

    // 7. Redirect to Meta's OAuth dialog
    const authUrl = new URL("https://www.facebook.com/v20.0/dialog/oauth");
    authUrl.searchParams.set("client_id", config.appId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("scope", scope);
    authUrl.searchParams.set("response_type", "code");

    return NextResponse.redirect(authUrl.toString());

  } catch (error: any) {
    console.error("[OAuth Start Error]", error);
    return await redirectWithError(baseUrl, "start_failed", error.message || "Could not initiate the authentication flow.");
  }
}

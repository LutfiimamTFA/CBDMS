
import { NextResponse, type NextRequest } from "next/server";
import crypto from "crypto";
import { cookies } from "next/headers";
import { getInstagramConfig } from "@/lib/instagram-config";
import { getAppBaseUrl } from "@/lib/get-app-base-url";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

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
    console.error("OAuth Start Error: Failed to determine base URL.", error);
    // Cannot redirect without a base URL, so return a plain response.
    return new Response(`OAuth Start Failed: Could not determine a valid application base URL. ${error.message}`, { status: 500 });
  }

  try {
    // 1. Verify user is logged in using the session cookie.
    const sessionCookie = (await cookies()).get('__session')?.value;
    if (!sessionCookie) {
        return redirectWithError(baseUrl, "not_authenticated", "You must be logged in to connect an account.");
    }
    const decodedToken = await adminAuth.verifySessionCookie(sessionCookie, true);
    const uid = decodedToken.uid;
    
    // 2. Fetch Instagram App config
    const config = await getInstagramConfig();
    if (!config) {
      return redirectWithError(baseUrl, "server_misconfigured", "Instagram App ID/Secret has not been configured. Please ask an administrator to set it up.");
    }

    // 3. Build the correct redirect URI
    const redirectUri = new URL("/api/instagram/oauth/callback", baseUrl).toString();

    // 4. Protection Guard
    if (process.env.NODE_ENV === "production" && (redirectUri.includes('localhost') || !redirectUri.startsWith('https'))) {
      throw new Error(`FATAL: Insecure redirect_uri generated for production: ${redirectUri}.`);
    }
    if (redirectUri.includes('0.0.0.0')) {
        throw new Error(`FATAL: Invalid redirect_uri generated: ${redirectUri}.`);
    }

    // 5. Generate state for CSRF protection and session bridging
    const state = crypto.randomBytes(16).toString("hex");

    // Store state with UID in Firestore with a TTL for session bridging
    const stateDocRef = adminDb.collection('oauthStates').doc(state);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minute TTL
    await stateDocRef.set({ uid, expiresAt });
    
    // 6. Set CSRF state in a secure, httpOnly cookie
    const cookieStore = await cookies();
    cookieStore.set("ig_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 10, // 10 minutes
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
    return redirectWithError(baseUrl, "start_failed", error.message || "Could not initiate the authentication flow.");
  }
}

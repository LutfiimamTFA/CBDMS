
import { NextResponse, type NextRequest } from "next/server";
import crypto from "crypto";
import { cookies } from "next/headers";
import { getInstagramConfig } from "@/lib/instagram-config";
import { getAppBaseUrl } from "@/lib/get-app-base-url";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

async function redirectWithError(request: NextRequest, error: string, description: string) {
    const baseUrl = await getAppBaseUrl(request).catch(() => request.nextUrl.origin);
    const integrationsUrl = new URL("/social-media/integrations", baseUrl);
    integrationsUrl.searchParams.set("error", error);
    integrationsUrl.searchParams.set("error_description", description);
    return NextResponse.redirect(integrationsUrl);
}

export async function GET(req: NextRequest) {
  try {
    const baseUrl = await getAppBaseUrl(req);
    const integrationsUrl = new URL("/social-media/integrations", baseUrl);

    // Verify user is logged in before starting
    const sessionCookie = (await cookies()).get('__session')?.value;
    if (!sessionCookie) {
        return redirectWithError(req, "auth_required", "You must be logged in to connect an account.");
    }
    const decodedToken = await adminAuth.verifySessionCookie(sessionCookie, true);
    const userId = decodedToken.uid;
    
    const config = await getInstagramConfig();
    if (!config) {
      return redirectWithError(req, "server_misconfigured", "Instagram App ID/Secret has not been configured. Please ask an administrator to set it up.");
    }

    const { appId } = config;
    const redirectUri = new URL("/api/instagram/oauth/callback", baseUrl).toString();

    // Protection Guard
    if (process.env.NODE_ENV === "production") {
      if (!redirectUri.startsWith('https://') || redirectUri.includes('localhost')) {
          throw new Error(`Invalid redirect_uri generated for production: ${redirectUri}. Aborting OAuth flow.`);
      }
    }
    if (redirectUri.includes('0.0.0.0')) {
        throw new Error(`Invalid redirect_uri generated: ${redirectUri}. Aborting OAuth flow.`);
    }

    const state = crypto.randomBytes(16).toString("hex");

    // Store state with UID in Firestore with a TTL
    const stateDocRef = adminDb.collection('oauthStates').doc(state);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minute TTL
    await stateDocRef.set({ uid: userId, expiresAt });

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

    const authUrl = new URL("https://www.facebook.com/v20.0/dialog/oauth");
    authUrl.searchParams.set("client_id", appId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("scope", scope);
    authUrl.searchParams.set("response_type", "code");

    return NextResponse.redirect(authUrl.toString());

  } catch (error: any) {
    console.error("[OAuth Start Error]", error);
    return redirectWithError(req, "start_failed", error.message || "Could not initiate OAuth flow.");
  }
}

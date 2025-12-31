import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getInstagramConfig } from "@/lib/instagram-config";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { serverTimestamp } from "firebase-admin/firestore";
import type { SocialMediaConnection } from "@/lib/types-backend";

type FbTokenResponse = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: { message: string; type?: string; code?: number; fbtrace_id?: string };
};

function redirectWithError(request: NextRequest, error: string, description: string) {
  const url = new URL("/social-media/integrations", request.nextUrl.origin);
  url.searchParams.set("error", error);
  url.searchParams.set("error_description", description);
  return NextResponse.redirect(url);
}

async function fbFetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { method: "GET" });
  return (await res.json()) as T;
}

export async function GET(req: NextRequest) {
  const config = await getInstagramConfig();

  if (!config) {
    return redirectWithError(
      req,
      "server_misconfigured",
      "Instagram App ID/Secret is not configured on the server."
    );
  }

  const { appId, appSecret } = config;
  const redirectUri = new URL("/api/instagram/oauth/callback", req.nextUrl.origin).toString();
  
  // Clean up cookies regardless of outcome
  const cookieStore = cookies();
  const savedState = cookieStore.get("ig_oauth_state")?.value;
  cookieStore.delete("ig_oauth_state");

  const oauthError = req.nextUrl.searchParams.get("error");
  const oauthErrorDesc = req.nextUrl.searchParams.get("error_description");
  if (oauthError) {
    return redirectWithError(req, "oauth_failed", oauthErrorDesc || `OAuth error: ${oauthError}`);
  }

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");

  if (!savedState || !state || savedState !== state) {
    return redirectWithError(req, "invalid_state", "Invalid or expired authorization request. Please try again.");
  }
  
  if (!code) {
    return redirectWithError(req, "oauth_failed", "Authorization code not found in callback. Please try again.");
  }
  
  try {
    // Exchange code for short-lived token
    const tokenUrl = new URL("https://graph.facebook.com/v20.0/oauth/access_token");
    tokenUrl.searchParams.set("client_id", appId);
    tokenUrl.searchParams.set("client_secret", appSecret);
    tokenUrl.searchParams.set("redirect_uri", redirectUri);
    tokenUrl.searchParams.set("code", code);

    const shortToken = await fbFetchJson<FbTokenResponse>(tokenUrl.toString());
    if (!shortToken.access_token) {
        throw new Error(shortToken.error?.message || "Failed to exchange code for access token.");
    }
    
    // Exchange for long-lived token
    const longUrl = new URL("https://graph.facebook.com/v20.0/oauth/access_token");
    longUrl.searchParams.set("grant_type", "fb_exchange_token");
    longUrl.searchParams.set("client_id", appId);
    longUrl.searchParams.set("client_secret", appSecret);
    longUrl.searchParams.set("fb_exchange_token", shortToken.access_token);
    
    const longToken = await fbFetchJson<FbTokenResponse>(longUrl.toString());
    if (!longToken.access_token || !longToken.expires_in) {
        throw new Error(longToken.error?.message || "Failed to exchange for a long-lived access token.");
    }

    // --- Validation after getting token ---
    const debugUrl = new URL("https://graph.facebook.com/debug_token");
    debugUrl.searchParams.set("input_token", longToken.access_token);
    debugUrl.searchParams.set("access_token", `${appId}|${appSecret}`);

    const debugData = await fbFetchJson<{ data: any }>(debugUrl.toString());
    if (!debugData.data?.is_valid || debugData.data?.app_id !== appId) {
        throw new Error("The access token is invalid or does not belong to this application.");
    }
    const userIdFromToken = debugData.data.user_id;

    // Get user from our system based on who initiated the flow
    const authHeader = req.headers.get('cookie');
    // NOTE: In a real-world scenario, you would use a more robust session management system.
    // For this example, we assume some form of session cookie is present that can be verified.
    // This part is placeholder and needs to be replaced with your actual session verification logic.
    const tempUserId = "placeholder_user_id_from_session"; // This MUST be replaced.

    const userDoc = await adminDb.collection('users').doc(tempUserId).get();
    if (!userDoc.exists) throw new Error("Authenticated user not found in the database.");
    
    const userData = userDoc.data();
    if (userData?.role !== 'Super Admin' && userData?.role !== 'Manager') {
        throw new Error("User does not have permission to perform this action.");
    }

    const pagesUrl = new URL("https://graph.facebook.com/v20.0/me/accounts");
    pagesUrl.searchParams.set("access_token", longToken.access_token);
    pagesUrl.searchParams.set("fields", "id,name,instagram_business_account{username,id}");

    const pagesData = await fbFetchJson<any>(pagesUrl.toString());
    const pageWithIg = (pagesData?.data || []).find((p: any) => p?.instagram_business_account?.id);

    if (!pageWithIg?.instagram_business_account?.id) {
        throw new Error("No Instagram Business Account is linked to your Facebook Pages. Please check your Meta Business Suite settings.");
    }
    
    const connectionData: Omit<SocialMediaConnection, 'id'> = {
        platform: 'instagram',
        userId: userDoc.id,
        companyId: userData.companyId,
        instagramUserId: pageWithIg.instagram_business_account.id,
        instagramUsername: pageWithIg.instagram_business_account.username,
        accessToken: longToken.access_token,
        expiresAt: serverTimestamp.fromMillis(Date.now() + longToken.expires_in * 1000),
        connectedAt: serverTimestamp(),
    };
    
    const connectionId = `${userData.companyId}_instagram`;
    await adminDb.collection('socialMediaConnections').doc(connectionId).set(connectionData, { merge: true });

    const successUrl = new URL('/social-media/integrations', req.nextUrl.origin);
    successUrl.searchParams.set('status', 'connected');
    return NextResponse.redirect(successUrl);

  } catch (error: any) {
    console.error("OAuth Callback Error:", error);
    return redirectWithError(req, "oauth_failed", error.message || "An unknown error occurred during the connection process.");
  }
}

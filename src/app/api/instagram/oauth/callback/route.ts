
import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getInstagramConfig } from "@/lib/instagram-config";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { serverTimestamp } from "firebase-admin/firestore";
import type { SocialMediaConnection } from "@/lib/types-backend";
import { getAppBaseUrl } from "@/lib/get-app-base-url";

async function redirectWithError(request: NextRequest, error: string, description: string) {
  try {
    const baseUrl = await getAppBaseUrl(request);
    const url = new URL("/social-media/integrations", baseUrl);
    url.searchParams.set("error", error);
    url.searchParams.set("error_description", description);
    return NextResponse.redirect(url);
  } catch (fallbackError: any) {
     return new Response(`OAuth Callback Failed: ${description}. Additionally, could not build error redirect URL: ${fallbackError.message}`, { status: 500 });
  }
}

type FbTokenResponse = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: { message: string; type?: string; code?: number; fbtrace_id?: string };
};

async function fbFetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Facebook API request failed with status ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const savedState = cookieStore.get("ig_oauth_state")?.value;
  cookieStore.delete("ig_oauth_state");

  try {
    const baseUrl = await getAppBaseUrl(req);
    const config = await getInstagramConfig();
    
    if (!config) {
      return redirectWithError(
        req,
        "server_misconfigured",
        "Instagram App ID/Secret is not configured on the server."
      );
    }

    const { appId, appSecret } = config;
    const redirectUri = new URL("/api/instagram/oauth/callback", baseUrl).toString();
    
    if (process.env.NODE_ENV === 'production') {
      if (!redirectUri.startsWith('https') || redirectUri.includes('localhost')) {
          throw new Error(`Invalid redirect_uri detected in callback: ${redirectUri}.`);
      }
    }
     if (redirectUri.includes('0.0.0.0')) {
        throw new Error(`Invalid redirect_uri generated: ${redirectUri}. Aborting OAuth flow.`);
    }

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
    
    // Retrieve the UID from the Firestore state document
    const stateDocRef = adminDb.collection('oauthStates').doc(state);
    const stateDoc = await stateDocRef.get();

    if (!stateDoc.exists || stateDoc.data()?.expiresAt.toDate() < new Date()) {
        await stateDocRef.delete();
        return redirectWithError(req, "session_expired", "Your connection attempt expired. Please try again.");
    }

    const { uid: userId } = stateDoc.data() as { uid: string };
    await stateDocRef.delete(); // State is single-use

    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) throw new Error("Authenticated user not found in the database.");

    const userData = userDoc.data();
    if (!userData || (userData.role !== 'Super Admin' && userData.role !== 'Manager')) {
        throw new Error("User does not have permission to perform this action.");
    }
    const companyId = userData.companyId;
    if (!companyId) throw new Error("User is not associated with a company.");

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
        companyId: companyId,
        instagramUserId: pageWithIg.instagram_business_account.id,
        instagramUsername: pageWithIg.instagram_business_account.username,
        accessToken: longToken.access_token,
        expiresAt: serverTimestamp.fromMillis(Date.now() + longToken.expires_in * 1000),
        connectedAt: serverTimestamp(),
    };
    
    const connectionId = `${companyId}_instagram`;
    await adminDb.collection('socialMediaConnections').doc(connectionId).set(connectionData, { merge: true });

    const successUrl = new URL('/social-media/integrations', baseUrl);
    successUrl.searchParams.set('status', 'connected');
    return NextResponse.redirect(successUrl);

  } catch (error: any) {
    console.error("OAuth Callback Error:", error);
    return redirectWithError(req, "oauth_failed", error.message || "An unknown error occurred during the connection process.");
  }
}

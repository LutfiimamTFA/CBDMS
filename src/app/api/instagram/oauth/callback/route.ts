
import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getInstagramConfig } from "@/lib/instagram-config";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import type { SocialMediaConnection } from "@/lib/types-backend";
import { getAppBaseUrl } from "@/lib/get-app-base-url";

async function redirectWithError(baseUrl: string, error: string, description: string) {
  const url = new URL("/social-media/integrations", baseUrl);
  url.searchParams.set("error", error);
  url.searchParams.set("error_description", description);
  return NextResponse.redirect(url.toString());
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
  let baseUrl;
  try {
    baseUrl = await getAppBaseUrl(req);
  } catch (error: any) {
    console.error("OAuth Callback Error: Failed to determine base URL.", error);
    // Cannot redirect to a dynamic URL, so construct a relative one.
    const url = new URL("/social-media/integrations", "https://placeholder.com");
    url.searchParams.set("error", "invalid_base_url");
    url.searchParams.set("error_description", error.message);
    return NextResponse.redirect(url.pathname + url.search);
  }
  
  const savedState = cookieStore.get("ig_oauth_state")?.value;
  const oauthSessionId = cookieStore.get("ig_oauth_session")?.value;

  // Cleanup cookies immediately regardless of outcome
  cookieStore.delete("ig_oauth_state");
  cookieStore.delete("ig_oauth_session");

  try {
    // 1. Handle explicit errors from Meta
    const oauthError = req.nextUrl.searchParams.get("error");
    if (oauthError) {
      const oauthErrorDesc = req.nextUrl.searchParams.get("error_description") || `OAuth error: ${oauthError}. This can happen if you deny the request in the Facebook login popup.`;
      return await redirectWithError(baseUrl, "oauth_denied", oauthErrorDesc);
    }
    
    // 2. Validate CSRF state
    const stateFromParams = req.nextUrl.searchParams.get("state");
    if (!savedState) {
        return await redirectWithError(baseUrl, "state_missing", "CSRF state cookie not found. Please try the connection process again.");
    }
    if (!stateFromParams || savedState !== stateFromParams) {
      return await redirectWithError(baseUrl, "invalid_state", "Invalid or expired authorization request. Please try again.");
    }
    
    // 3. Get UID from our session bridging mechanism (Firestore)
    if (!oauthSessionId) {
        return await redirectWithError(baseUrl, "session_missing", "OAuth session identifier not found. Please try connecting again.");
    }
    const stateDocRef = adminDb.collection('oauthStates').doc(oauthSessionId);
    const stateDoc = await stateDocRef.get();

    // Cleanup Firestore doc now that it's been used
    if (stateDoc.exists) {
        await stateDocRef.delete();
    }

    if (!stateDoc.exists) {
        return await redirectWithError(baseUrl, "session_expired", "Your connection attempt has expired. Please try again.");
    }
    const stateData = stateDoc.data();
    if (stateData?.expiresAt.toDate() < new Date()) {
        return await redirectWithError(baseUrl, "session_expired", "Your connection attempt has expired. Please try again.");
    }

    const { uid: userId } = stateData as { uid: string };
    if (!userId) {
        return await redirectWithError(baseUrl, "session_invalid", "The connection session was invalid. Please try again.");
    }

    // 4. Get App config and authorization code
    const config = await getInstagramConfig();
    if (!config) {
      return await redirectWithError(baseUrl, "server_misconfigured", "Instagram App ID/Secret is not configured on the server.");
    }
    
    const code = req.nextUrl.searchParams.get("code");
    if (!code) {
      return await redirectWithError(baseUrl, "oauth_failed", "Authorization code not found in callback. Please try again.");
    }

    // 5. Exchange code for tokens
    const redirectUri = new URL("/api/instagram/oauth/callback", baseUrl).toString();

    // Exchange code for short-lived token
    const tokenUrl = new URL("https://graph.facebook.com/v20.0/oauth/access_token");
    tokenUrl.searchParams.set("client_id", config.appId);
    tokenUrl.searchParams.set("client_secret", config.appSecret);
    tokenUrl.searchParams.set("redirect_uri", redirectUri);
    tokenUrl.searchParams.set("code", code);

    const shortToken = await fbFetchJson<FbTokenResponse>(tokenUrl.toString());
    if (!shortToken.access_token) {
        throw new Error(shortToken.error?.message || "Failed to exchange code for access token.");
    }
    
    // Exchange for long-lived token
    const longUrl = new URL("https://graph.facebook.com/v20.0/oauth/access_token");
    longUrl.searchParams.set("grant_type", "fb_exchange_token");
    longUrl.searchParams.set("client_id", config.appId);
    longUrl.searchParams.set("client_secret", config.appSecret);
    longUrl.searchParams.set("fb_exchange_token", shortToken.access_token);
    
    const longToken = await fbFetchJson<FbTokenResponse>(longUrl.toString());
    if (!longToken.access_token || !longToken.expires_in) {
        throw new Error(longToken.error?.message || "Failed to exchange for a long-lived access token.");
    }

    // 6. Get IG Business Account ID
    const pagesUrl = new URL("https://graph.facebook.com/v20.0/me/accounts");
    pagesUrl.searchParams.set("access_token", longToken.access_token);
    pagesUrl.searchParams.set("fields", "id,name,instagram_business_account{username,id}");

    const pagesData = await fbFetchJson<any>(pagesUrl.toString());
    const pageWithIg = (pagesData?.data || []).find((p: any) => p?.instagram_business_account?.id);

    if (!pageWithIg?.instagram_business_account?.id) {
        throw new Error("No Instagram Business Account is linked to your Facebook Pages. Please check your Meta Business Suite settings and ensure the account is professional.");
    }

    // 7. Get user's company and save connection
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const companyId = userDoc.data()?.companyId;
    if (!companyId) throw new Error("Authenticated user is not associated with a company.");

    const connectionData: Omit<SocialMediaConnection, 'id'> = {
        platform: 'instagram',
        userId: userDoc.id,
        companyId: companyId,
        instagramUserId: pageWithIg.instagram_business_account.id,
        instagramUsername: pageWithIg.instagram_business_account.username,
        accessToken: longToken.access_token,
        expiresAt: Timestamp.fromMillis(Date.now() + longToken.expires_in * 1000),
        connectedAt: Timestamp.now(),
    };
    
    const connectionId = `${companyId}_instagram`;
    await adminDb.collection('socialMediaConnections').doc(connectionId).set(connectionData, { merge: true });
    
    // 8. Redirect to integrations page with success status
    const successUrl = new URL('/social-media/integrations', baseUrl);
    successUrl.searchParams.set('success', 'instagram_connected');
    return NextResponse.redirect(successUrl.toString());

  } catch (error: any) {
    console.error("OAuth Callback Error:", error);
    return await redirectWithError(baseUrl, "callback_failed", error.message || "An unknown error occurred during the connection process.");
  }
}

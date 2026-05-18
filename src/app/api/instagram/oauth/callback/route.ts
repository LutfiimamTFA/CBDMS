
import { NextResponse, type NextRequest } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import type { SocialMediaConnection } from "@/lib/types-backend";

const STATE_COLLECTION = "oauthStates";
const REDIRECT_URI = "https://studio--studio-3200695440-bed4a.us-central1.hosted.app/api/instagram/oauth/callback";

async function getInstagramConfig() {
    const configDoc = await adminDb.collection('systemSettings').doc('socialMedia').get();
    if (!configDoc.exists) return null;
    const data = configDoc.data();
    return (data && data.instagramAppId && data.instagramAppSecret) ? { appId: data.instagramAppId, appSecret: data.instagramAppSecret } : null;
}

async function redirectWithError(baseUrl: string, error: string, description: string, state?: string) {
  console.error(`[IG_OAUTH_CB_FAIL] state=${state?.slice(0,6) || 'N/A'}, error=${error}, desc=${description}`);
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
    console.error("[IG_OAUTH_FB_FETCH_FAIL]", { url, status: res.status, errorData });
    throw new Error(errorData.error?.message || `Facebook API request failed with status ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function GET(req: NextRequest) {
  const baseUrl = req.nextUrl.origin;
  const state = req.nextUrl.searchParams.get("state");
  const code = req.nextUrl.searchParams.get("code");

  if (!state) {
    return await redirectWithError(baseUrl, "invalid_state", "CSRF state parameter is missing.");
  }
  
  console.log(`[IG_OAUTH_CB_START] state=${state.slice(0,6)}, hasCode=${!!code}`);

  if (!code) {
    return await redirectWithError(baseUrl, "missing_code", "Authorization code is missing from callback.", state);
  }

  const stateDocRef = adminDb.collection(STATE_COLLECTION).doc(state);
  
  try {
    const stateDoc = await stateDocRef.get();

    if (!stateDoc.exists) {
        return await redirectWithError(baseUrl, "expired", "Your connection attempt has expired or is invalid. Please try again.", state);
    }
    
    const stateData = stateDoc.data()!;
    if (stateData.expiresAt.toMillis() < Date.now()) {
        await stateDocRef.delete();
        console.log(`[IG_OAUTH_CB_STATE_DELETED_EXPIRED] state=${state.slice(0,6)}`);
        return await redirectWithError(baseUrl, "expired", "Your connection attempt has expired. Please try again.", state);
    }
    
    const { userId } = stateData as { userId: string };

    const config = await getInstagramConfig();
    if (!config) {
      return await redirectWithError(baseUrl, "server_misconfigured", "Instagram App ID/Secret is not configured on the server.", state);
    }
    
    // Exchange code for short-lived token
    const tokenUrl = new URL("https://graph.facebook.com/v20.0/oauth/access_token");
    tokenUrl.searchParams.set("client_id", config.appId);
    tokenUrl.searchParams.set("client_secret", config.appSecret);
    tokenUrl.searchParams.set("redirect_uri", REDIRECT_URI);
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

    const pagesUrl = new URL("https://graph.facebook.com/v20.0/me/accounts");
    pagesUrl.searchParams.set("access_token", longToken.access_token);
    pagesUrl.searchParams.set("fields", "id,name,instagram_business_account{username,id}");

    const pagesData = await fbFetchJson<any>(pagesUrl.toString());
    const pageWithIg = (pagesData?.data || []).find((p: any) => p?.instagram_business_account?.id);

    if (!pageWithIg?.instagram_business_account?.id) {
        throw new Error("No Instagram Business Account is linked to your Facebook Pages. Please check your Meta Business Suite settings and ensure the account is professional.");
    }

    const userDoc = await adminDb.collection('users').doc(userId).get();
    const companyId = userDoc.data()?.companyId;
    if (!companyId) throw new Error("Authenticated user is not associated with a company.");

    const connectionData: Omit<SocialMediaConnection, 'id'> = {
        platform: 'instagram', userId, companyId,
        instagramUserId: pageWithIg.instagram_business_account.id,
        instagramUsername: pageWithIg.instagram_business_account.username,
        accessToken: longToken.access_token,
        expiresAt: Timestamp.fromMillis(Date.now() + longToken.expires_in * 1000),
        connectedAt: Timestamp.now(),
    };
    
    const connectionId = `${companyId}_instagram`;
    await adminDb.collection('socialMediaConnections').doc(connectionId).set(connectionData, { merge: true });
    
    await stateDocRef.delete();
    console.log(`[IG_OAUTH_CB_DONE] state=${state.slice(0,6)} deleted, connection saved.`);
    
    const successUrl = new URL('/social-media/integrations', baseUrl);
    successUrl.searchParams.set('success', 'instagram_connected');
    return NextResponse.redirect(successUrl.toString());

  } catch (error: any) {
    // Attempt to clean up state doc even on failure
    if (await stateDocRef.get().then(s => s.exists)) {
        await stateDocRef.delete();
    }
    return await redirectWithError(baseUrl, "token_exchange_failed", error.message || "An unknown error occurred during the connection process.", state);
  }
}

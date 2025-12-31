import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";

type FbTokenResponse = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: { message: string; type?: string; code?: number; fbtrace_id?: string };
};

function redirectWithError(origin: string, error: string, description: string) {
  const url = new URL("/social-media/integrations", origin);
  url.searchParams.set("error", error);
  url.searchParams.set("error_description", description); // ✅ no manual encode
  return NextResponse.redirect(url);
}

async function fbFetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { method: "GET" });
  return (await res.json()) as T;
}

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const redirectUri = new URL("/api/instagram/oauth/callback", origin).toString();

  const clientId = process.env.INSTAGRAM_APP_ID;
  const appSecret = process.env.INSTAGRAM_APP_SECRET;

  if (!clientId || !appSecret) {
    return redirectWithError(
      origin,
      "server_misconfigured",
      "Server belum dikonfigurasi untuk integrasi Instagram (App ID/Secret belum tersedia)."
    );
  }

  const oauthError = req.nextUrl.searchParams.get("error");
  const oauthErrorDesc = req.nextUrl.searchParams.get("error_description");
  if (oauthError) {
    return redirectWithError(origin, "oauth_failed", oauthErrorDesc || `OAuth error: ${oauthError}`);
  }

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  if (!code) return redirectWithError(origin, "oauth_failed", "OAuth callback tidak mengandung 'code'.");

  // ✅ cookies() is async in your setup
  const cookieStore = await cookies();
  const savedState = cookieStore.get("ig_oauth_state")?.value;

  // Clear state regardless
  cookieStore.delete("ig_oauth_state");

  if (!savedState || !state || savedState !== state) {
    return redirectWithError(origin, "invalid_state", "State OAuth tidak valid atau kadaluarsa.");
  }

  // Exchange code -> short-lived token
  const tokenUrl = new URL("https://graph.facebook.com/v20.0/oauth/access_token");
  tokenUrl.searchParams.set("client_id", clientId);
  tokenUrl.searchParams.set("client_secret", appSecret);
  tokenUrl.searchParams.set("redirect_uri", redirectUri);
  tokenUrl.searchParams.set("code", code);

  const shortToken = await fbFetchJson<FbTokenResponse>(tokenUrl.toString());
  if (!shortToken.access_token) {
    return redirectWithError(origin, "oauth_failed", shortToken.error?.message || "Gagal menukar code menjadi access token.");
  }

  // Exchange -> long-lived token
  const longUrl = new URL("https://graph.facebook.com/v20.0/oauth/access_token");
  longUrl.searchParams.set("grant_type", "fb_exchange_token");
  longUrl.searchParams.set("client_id", clientId);
  longUrl.searchParams.set("client_secret", appSecret);
  longUrl.searchParams.set("fb_exchange_token", shortToken.access_token);

  const longToken = await fbFetchJson<FbTokenResponse>(longUrl.toString());
  if (!longToken.access_token) {
    return redirectWithError(origin, "oauth_failed", longToken.error?.message || "Gagal mengubah token menjadi long-lived token.");
  }

  // Fetch pages + IG business account
  const pagesUrl = new URL("https://graph.facebook.com/v20.0/me/accounts");
  pagesUrl.searchParams.set("access_token", longToken.access_token);
  pagesUrl.searchParams.set("fields", "id,name,instagram_business_account{username,id}");

  const pagesData = await fbFetchJson<any>(pagesUrl.toString());
  const pages = pagesData?.data || [];
  const pageWithIg = pages.find((p: any) => p?.instagram_business_account?.id);

  if (!pageWithIg?.instagram_business_account?.id) {
    return redirectWithError(
      origin,
      "oauth_failed",
      "Tidak ditemukan Instagram Business Account yang terhubung ke Facebook Page. Pastikan IG kamu Business/Creator dan terhubung ke Page."
    );
  }

  const igUsername = pageWithIg.instagram_business_account.username;

  // Redirect sukses
  const returnTo = cookieStore.get("ig_oauth_return")?.value || "/social-media/integrations";
  cookieStore.delete("ig_oauth_return");

  const successUrl = new URL(returnTo, origin);
  successUrl.searchParams.set("connected", "true");
  successUrl.searchParams.set("ig_username", igUsername);

  return NextResponse.redirect(successUrl);
}

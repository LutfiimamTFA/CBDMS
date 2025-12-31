import { NextResponse, type NextRequest } from "next/server";
import crypto from "crypto";
import { cookies } from "next/headers";

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const integrationsUrl = new URL("/social-media/integrations", origin);

  const clientId = process.env.INSTAGRAM_APP_ID;
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  const redirectUri = new URL("/api/instagram/oauth/callback", origin).toString();

  if (!clientId || !appSecret) {
    integrationsUrl.searchParams.set("error", "server_misconfigured");
    integrationsUrl.searchParams.set(
      "error_description",
      !clientId
        ? "Instagram App ID belum tersedia di server."
        : "Instagram App Secret belum tersedia di server."
    );
    return NextResponse.redirect(integrationsUrl);
  }

  const state = crypto.randomBytes(16).toString("hex");

  // ✅ cookies() is async in your setup
  const cookieStore = await cookies();
  cookieStore.set("ig_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });

  cookieStore.set("ig_oauth_return", "/social-media/integrations", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });

  const scope = [
    "instagram_basic",
    "instagram_content_publish",
    "pages_show_list",
    "pages_read_engagement",
    "business_management",
  ].join(",");

  const authUrl = new URL("https://www.facebook.com/v20.0/dialog/oauth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("scope", scope);
  authUrl.searchParams.set("response_type", "code");

  return NextResponse.redirect(authUrl.toString());
}

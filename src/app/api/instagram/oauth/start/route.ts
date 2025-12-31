
import { NextResponse, type NextRequest } from "next/server";
import crypto from "crypto";
import { cookies } from "next/headers";
import { getInstagramConfig } from "@/lib/instagram-config";

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const integrationsUrl = new URL("/social-media/integrations", origin);

  const config = await getInstagramConfig();

  if (!config) {
    integrationsUrl.searchParams.set("error", "server_misconfigured");
    integrationsUrl.searchParams.set(
      "error_description",
      "Instagram App ID/Secret has not been configured. Please ask an administrator to set it in the Integrations page."
    );
    return NextResponse.redirect(integrationsUrl);
  }

  const { appId } = config;
  const redirectUri = new URL("/api/instagram/oauth/callback", origin).toString();
  const state = crypto.randomBytes(16).toString("hex");
  
  const cookieStore = cookies();
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
}

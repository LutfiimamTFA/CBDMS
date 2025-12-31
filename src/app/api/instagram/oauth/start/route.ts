
import { NextResponse, type NextRequest } from "next/server";
import crypto from "crypto";
import { cookies } from "next/headers";
import { getInstagramConfig } from "@/lib/instagram-config";
import { getAppBaseUrl } from "@/lib/get-app-base-url";

export async function GET(req: NextRequest) {
  try {
    const baseUrl = await getAppBaseUrl(req);
    const integrationsUrl = new URL("/social-media/integrations", baseUrl);

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
    const redirectUri = new URL("/api/instagram/oauth/callback", baseUrl).toString();

    // Protection Guard: Ensure redirect URI is not local or invalid in production-like environments
    if (process.env.NODE_ENV === "production") {
      if (redirectUri.includes('0.0.0.0') || redirectUri.includes('localhost') || !redirectUri.startsWith('https://')) {
          throw new Error(`Invalid redirect_uri generated for production: ${redirectUri}. Aborting OAuth flow.`);
      }
    }
    if (redirectUri.includes('0.0.0.0')) {
        throw new Error(`Invalid redirect_uri generated: ${redirectUri}. Aborting OAuth flow.`);
    }


    const state = crypto.randomBytes(16).toString("hex");

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
    // This is a failsafe. We must not redirect to a broken URL.
    try {
        const baseUrl = await getAppBaseUrl(req);
        const integrationsUrl = new URL("/social-media/integrations", baseUrl);
        integrationsUrl.searchParams.set("error", "start_failed");
        integrationsUrl.searchParams.set("error_description", error.message || "Could not initiate OAuth flow.");
        return NextResponse.redirect(integrationsUrl);
    } catch (fallbackError: any) {
        // If even getAppBaseUrl fails, return a plain text error.
        return new Response(`FATAL: Could not initiate OAuth flow and could not build error redirect URL. ${fallbackError.message}`, { status: 500 });
    }
  }
}

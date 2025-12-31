// src/lib/get-app-base-url.ts
import { type NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

/**
 * Retrieves the application's base URL with a robust fallback system, crucial for OAuth and other server-to-server communication.
 * This is the single source of truth for determining the public-facing URL.
 *
 * Priority order:
 * 1. Environment variable `APP_BASE_URL` (for explicit overrides).
 * 2. Firestore document `systemSettings/socialMedia` field `appBaseUrl` (if it passes allowlist validation).
 * 3. `x-forwarded-host` header (for proxy/load balancer environments).
 * 4. `host` header from the request.
 * 5. `request.nextUrl.origin` (as a final fallback).
 *
 * @param {NextRequest} request The incoming Next.js request object.
 * @returns {Promise<string>} The determined, validated base URL.
 * @throws {Error} If a valid base URL cannot be determined or resolves to an invalid address in production.
 */
export async function getAppBaseUrl(request: NextRequest): Promise<string> {
  const isProduction = process.env.NODE_ENV === 'production';
  let baseUrl: string | undefined;

  // 1. Environment Variable (Highest priority)
  const baseUrlFromEnv = process.env.APP_BASE_URL;
  if (baseUrlFromEnv && baseUrlFromEnv.trim() !== '') {
    baseUrl = baseUrlFromEnv.trim();
  }

  // 2. Firestore Configuration (Dynamic override, if not already set by env)
  if (!baseUrl) {
    try {
      const configDoc = await adminDb.collection('systemSettings').doc('socialMedia').get();
      if (configDoc.exists()) {
        const data = configDoc.data();
        // A simple allowlist for security. Only URLs from these domains can be used.
        const domainAllowlist = ['hosted.app', 'firebaseapp.com', 'web.app', 'cloudworkstations.dev'];
        if (data?.appBaseUrl && typeof data.appBaseUrl === 'string' && data.appBaseUrl.trim() !== '' && domainAllowlist.some(domain => data.appBaseUrl.includes(domain))) {
          baseUrl = data.appBaseUrl.trim();
        }
      }
    } catch (error) {
      console.warn("Could not fetch base URL from Firestore, continuing with next fallback.", error);
    }
  }

  // 3. x-forwarded-host Header (Common in proxy environments)
  if (!baseUrl) {
    const forwardedHost = request.headers.get('x-forwarded-host');
    if (forwardedHost) {
      const protocol = request.headers.get('x-forwarded-proto') || 'https';
      baseUrl = `${protocol}://${forwardedHost}`;
    }
  }
  
  // 4. Host Header
  if (!baseUrl) {
      const host = request.headers.get('host');
      if (host) {
          const protocol = host.startsWith('localhost') ? 'http' : 'https';
          baseUrl = `${protocol}://${host}`;
      }
  }

  // 5. Fallback to request origin
  if (!baseUrl) {
    baseUrl = request.nextUrl.origin;
  }
  
  // --- FINAL VALIDATION & PROTECTION GUARD ---
  if (!baseUrl) {
    throw new Error('Base URL could not be determined from any source.');
  }
  
  const url = new URL(baseUrl);

  if (url.hostname === '0.0.0.0') {
    throw new Error(
      `Invalid base URL detected: ${baseUrl}. Host '0.0.0.0' is not allowed.`
    );
  }

  if (isProduction) {
    if (url.protocol !== 'https:') {
        throw new Error(
            `Insecure URL in production. Base URL must be HTTPS. Detected: ${baseUrl}`
        );
    }
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
       throw new Error(
            `Localhost URL detected in production environment. Detected: ${baseUrl}`
        );
    }
  }

  return baseUrl;
}

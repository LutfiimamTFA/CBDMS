// src/lib/get-app-base-url.ts
import { type NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

/**
 * Retrieves the application's base URL with a robust fallback system.
 * This is the single source of truth for determining the public-facing URL.
 *
 * Priority order:
 * 1. Environment variable `APP_BASE_URL` (for explicit overrides).
 * 2. Firestore document `systemSettings/app` field `baseUrl`.
 * 3. `x-forwarded-host` header (for proxy/load balancer environments).
 * 4. `request.nextUrl.origin` (as a final fallback).
 *
 * @param {NextRequest} request The incoming Next.js request object.
 * @returns {Promise<string>} The determined base URL.
 * @throws {Error} If a valid base URL cannot be determined or resolves to an invalid local address.
 */
export async function getAppBaseUrl(request: NextRequest): Promise<string> {
  // 1. Environment Variable (Highest priority)
  const baseUrlFromEnv = process.env.APP_BASE_URL;
  if (baseUrlFromEnv && baseUrlFromEnv.trim() !== '') {
    return baseUrlFromEnv.trim();
  }

  // 2. Firestore Configuration (Dynamic override)
  try {
    const configDoc = await adminDb.collection('systemSettings').doc('app').get();
    if (configDoc.exists()) {
      const data = configDoc.data();
      if (data?.baseUrl && typeof data.baseUrl === 'string' && data.baseUrl.trim() !== '') {
        return data.baseUrl.trim();
      }
    }
  } catch (error) {
    console.warn("Could not fetch base URL from Firestore, continuing with next fallback.", error);
  }

  // 3. x-forwarded-host Header (Common in proxy environments)
  const forwardedHost = request.headers.get('x-forwarded-host');
  if (forwardedHost) {
    const protocol = request.headers.get('x-forwarded-proto') || 'https';
    return `${protocol}://${forwardedHost}`;
  }

  // 4. Fallback to request origin
  const origin = request.nextUrl.origin;

  // Final Protection Guard
  if (!origin || origin.includes('0.0.0.0') || origin.includes('localhost')) {
      // This is the critical failure point. We MUST throw an error here.
      throw new Error(
        `FATAL: Could not determine a valid public base URL. Detected origin was '${origin}'. ` +
        `Please set APP_BASE_URL environment variable or configure it in Firestore (systemSettings/app).`
      );
  }

  return origin;
}

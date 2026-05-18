
// src/lib/instagram-config.ts
import { adminDb } from '@/lib/firebase-admin';

interface InstagramConfig {
    appId: string;
    appSecret: string;
}

/**
 * Retrieves the Instagram App configuration with a fallback mechanism.
 * Priority:
 * 1. Environment variables (process.env).
 * 2. Firestore document ('systemSettings/socialMedia').
 *
 * This function is intended for server-side use only.
 * @returns {Promise<InstagramConfig | null>} The configuration object or null if not found.
 */
export async function getInstagramConfig(): Promise<InstagramConfig | null> {
    // 1. Check Environment Variables first
    const appIdFromEnv = process.env.INSTAGRAM_APP_ID;
    const appSecretFromEnv = process.env.INSTAGRAM_APP_SECRET;

    if (appIdFromEnv && appSecretFromEnv) {
        return {
            appId: appIdFromEnv,
            appSecret: appSecretFromEnv,
        };
    }

    // 2. Fallback to Firestore
    try {
        const configDoc = await adminDb.collection('systemSettings').doc('socialMedia').get();
        if (configDoc.exists) {
            const data = configDoc.data();
            if (data && data.instagramAppId && data.instagramAppSecret) {
                return {
                    appId: data.instagramAppId,
                    appSecret: data.instagramAppSecret,
                };
            }
        }
    } catch (error) {
        console.error("Error fetching Instagram config from Firestore:", error);
        // Fall through to return null if Firestore access fails
    }

    // Return null if no configuration is found
    return null;
}

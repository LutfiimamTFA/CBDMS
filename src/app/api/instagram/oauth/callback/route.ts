
'use server';
import { NextResponse, type NextRequest } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { serverTimestamp } from 'firebase-admin/firestore';
import type { SocialMediaConnection } from '@/lib/types-backend';
import { cookies } from 'next/headers';

const FACEBOOK_GRAPH_API_URL = "https://graph.facebook.com/v20.0";
const APP_ID = process.env.INSTAGRAM_APP_ID;
const APP_SECRET = process.env.INSTAGRAM_APP_SECRET;

async function getLongLivedAccessToken(code: string, redirectUri: string): Promise<{ access_token: string, expires_in: number }> {
    const url = `${FACEBOOK_GRAPH_API_URL}/oauth/access_token`;
    const params = new URLSearchParams({
        client_id: APP_ID!,
        client_secret: APP_SECRET!,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code: code,
    });

    const response = await fetch(`${url}?${params.toString()}`);
    const data = await response.json();
    if (data.error) throw new Error(`Error exchanging code for token: ${data.error.message}`);
    
    const longLivedUrl = `${FACEBOOK_GRAPH_API_URL}/oauth/access_token`;
    const longLivedParams = new URLSearchParams({
        grant_type: 'fb_exchange_token',
        client_id: APP_ID!,
        client_secret: APP_SECRET!,
        fb_exchange_token: data.access_token,
    });
    
    const longLivedResponse = await fetch(`${longLivedUrl}?${longLivedParams.toString()}`);
    const longLivedData = await longLivedResponse.json();
    if (longLivedData.error) throw new Error(`Error getting long-lived token: ${longLivedData.error.message}`);
    
    return longLivedData;
}

async function debugToken(accessToken: string): Promise<any> {
    const url = `${FACEBOOK_GRAPH_API_URL}/debug_token?input_token=${accessToken}&access_token=${APP_ID}|${APP_SECRET}`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.error) throw new Error(`Token debug error: ${data.error.message}`);
    if (!data.data.is_valid) throw new Error('The provided access token is invalid or has expired.');
    if (data.data.app_id !== APP_ID) throw new Error('This token does not belong to the WorkWise application.');
    
    const requiredScopes = ['instagram_basic', 'instagram_content_publish', 'pages_show_list', 'pages_read_engagement', 'business_management'];
    const missingScopes = requiredScopes.filter(scope => !data.data.scopes.includes(scope));
    if (missingScopes.length > 0) {
        throw new Error(`Missing required permissions: ${missingScopes.join(', ')}. Please re-authenticate with all permissions.`);
    }
    return data.data;
}

async function getInstagramBusinessAccount(accessToken: string): Promise<{ id: string; username: string }> {
    const url = `${FACEBOOK_GRAPH_API_URL}/me/accounts?fields=instagram_business_account{id,username}&access_token=${accessToken}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.error) throw new Error(`Error fetching pages: ${data.error.message}`);
    
    const businessAccount = data.data?.find((page: any) => page.instagram_business_account)?.instagram_business_account;
    
    if (!businessAccount) throw new Error('No Instagram Business Account found linked to your Facebook Pages. Please ensure your IG account is Professional and linked to a Facebook Page.');

    return { id: businessAccount.id, username: businessAccount.username };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const receivedState = searchParams.get('state');
  
  const cookieStore = cookies();
  const storedState = cookieStore.get('ig_oauth_state')?.value;

  const errorUrl = new URL('/social-media/integrations', request.url);

  // Clean up state cookie immediately
  if (storedState) {
    cookieStore.delete('ig_oauth_state');
  }

  // 1. CSRF Protection: Validate state
  if (!receivedState || !storedState || receivedState !== storedState) {
    errorUrl.searchParams.set('error', 'invalid_state');
    errorUrl.searchParams.set('error_description', 'Authentication session has expired or is invalid. Please try again.');
    return NextResponse.redirect(errorUrl);
  }

  if (searchParams.has('error')) {
    const errorDescription = searchParams.get('error_description') || 'An error occurred during authentication.';
    errorUrl.searchParams.set('error', 'oauth_failed');
    errorUrl.searchParams.set('error_description', errorDescription);
    return NextResponse.redirect(errorUrl);
  }

  if (!code) {
    errorUrl.searchParams.set('error', 'invalid_callback');
    errorUrl.searchParams.set('error_description', 'Missing authorization code from Meta callback.');
    return NextResponse.redirect(errorUrl);
  }

  try {
    // 2. User & Role Validation: Get user from session cookie provided by Firebase Auth
    const sessionCookie = cookieStore.get('__session')?.value || '';
    if (!sessionCookie) {
        throw new Error('User not logged in. Please sign in and try again.');
    }
    
    const decodedToken = await adminAuth.verifySessionCookie(sessionCookie, true);
    const userId = decodedToken.uid;
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.data();
    
    if (!userData) {
      throw new Error('User not found in database.');
    }

    const userRole = userData.role;
    if (userRole !== 'Super Admin' && userRole !== 'Manager') {
        throw new Error('Forbidden: You do not have permission to perform this action.');
    }
    
    const companyId = userData.companyId;
    if (!companyId) {
        throw new Error('User is not associated with a company.');
    }

    // 3. Exchange code for token and save connection (only after all validations pass)
    const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL}/api/instagram/oauth/callback`;
    const tokenInfo = await getLongLivedAccessToken(code, redirectUri);
    const longLivedToken = tokenInfo.access_token;
    
    const tokenData = await debugToken(longLivedToken);
    
    const { id: instagramUserId, username: instagramUsername } = await getInstagramBusinessAccount(longLivedToken);
    
    const expiresAt = new Date(tokenData.data_access_expires_at * 1000);

    const connectionData: Omit<SocialMediaConnection, 'id'> = {
        platform: 'instagram',
        userId,
        companyId,
        instagramUserId,
        instagramUsername,
        accessToken: longLivedToken,
        expiresAt: serverTimestamp.fromMillis(expiresAt.getTime()),
        connectedAt: serverTimestamp(),
    };
    
    const connectionId = `${companyId}_instagram`;
    await adminDb.collection('socialMediaConnections').doc(connectionId).set(connectionData, { merge: true });

    // On success, redirect the user back to the integrations page.
    const successUrl = new URL('/social-media/integrations', request.url);
    successUrl.searchParams.set('status', 'connected');
    return NextResponse.redirect(successUrl);

  } catch (error: any) {
    console.error("Instagram OAuth Callback Error:", error);
    let errorCode = 'connection_failed';
    if(error.message.includes('Forbidden')) {
        errorCode = 'forbidden_role';
    } else if (error.message.includes('User not logged in')) {
        errorCode = 'not_logged_in';
    }
    errorUrl.searchParams.set('error', errorCode);
    errorUrl.searchParams.set('error_description', error.message);
    return NextResponse.redirect(errorUrl);
  }
}

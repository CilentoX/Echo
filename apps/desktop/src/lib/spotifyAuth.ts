/**
 * Spotify OAuth 2.0 PKCE authentication flow for Tauri 2.
 * 
 * This module implements the complete PKCE flow:
 * 1. Generate code_verifier + code_challenge (S256)
 * 2. Open Spotify auth URL in system browser
 * 3. Listen for HTTP callback on random local port
 * 4. Exchange authorization code for access/refresh tokens
 * 5. Store tokens encrypted in OS keyring
 * 6. Background token refresh task
 * 
 * Patterns reused from existing SSO and keyring implementations.
 */

import { invoke } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import { generateCodeVerifier, generateCodeChallenge } from './pkce';

// Spotify API endpoints
const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';

const KEYRING_USER_ID = 'current_user';

/// Scopes required for playback control and library access
export const REQUIRED_SPOTIFY_SCOPES = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'streaming',
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-library-read',
  'user-read-currently-playing',
];

/**
 * Interface for Spotify tokens received from the token exchange.
 */
export interface SpotifyTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

/**
 * Interface for the complete Spotify session state.
 */
export interface SpotifySession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp in seconds
  userId: string;
  deviceId: string | null;
}

/**
 * Starts the full Spotify PKCE OAuth 2.0 flow.
 * 
 * Steps:
 * 1. Generate PKCE code verifier and challenge
 * 2. Open Spotify authorization URL in system browser
 * 3. Start local HTTP listener on random port
 * 4. Wait for user to complete auth and redirect back
 * 5. Exchange authorization code for tokens
 * 6. Store tokens in OS keyring
 * 7. Return the stored session
 * 
 * @param clientId Spotify application client ID
 * @param redirectUri Optional custom redirect URI (defaults to http://127.0.0.1:PORT)
 * @returns Promise resolving to the stored Spotify session, or null on failure
 */
/**
 * Starts the full Spotify PKCE OAuth 2.0 flow.
 * 
 * Steps:
 * 1. Generate PKCE code verifier and challenge
 * 2. Open Spotify authorization URL in system browser
 * 3. Start local HTTP listener on random port (via Tauri command)
 * 4. Wait for user to complete auth and redirect back
 * 5. Exchange authorization code for tokens
 * 6. Store tokens in OS keyring
 * 7. Return the stored session
 * 
 * @param clientId Spotify application client ID
 * @param redirectUri Optional custom redirect URI
 * @returns Promise resolving to the stored Spotify session, or null on failure
 */
export async function authenticateSpotify(
  clientId: string,
  redirectUri?: string
): Promise<SpotifySession | null> {
  try {
    // Step 1: Generate PKCE
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    // Step 2: Determine redirect URI (use a fixed port range; the Rust side picks a random available port)
    // The redirect URI format must match what the Rust listener expects: http://127.0.0.1:PORT

    // Step 3: Open Spotify auth URL in system browser
    const scopeParam = REQUIRED_SPOTIFY_SCOPES.join('%20');
    const authUrl = new URL(SPOTIFY_AUTH_URL);
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', redirectUri || 'http://127.0.0.1:4321');
    authUrl.searchParams.set('scope', scopeParam);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    authUrl.searchParams.set('show_dialog', 'false');

    console.log('[SpotifyAuth] Opening authorization URL:', authUrl.toString());
    await openUrl(authUrl.toString());

    // Step 4: Start local HTTP listener and wait for callback
    const [port, verifier] = await invoke<[number, string]>('begin_spotify_sso_listener');

    // Step 5: Wait for the callback with the authorization code
    const authorizationCode = await invoke<string>(
      'finish_spotify_listener',
      { port }
    );

    if (!authorizationCode) {
      throw new Error('Nenhum código de autorização recebido do Spotify');
    }

    // Step 6: Exchange authorization code for tokens
    const tokens = await exchangeCodeForTokens(
      authorizationCode,
      verifier,
      redirectUri || 'http://127.0.0.1:4321'
    );

    // Step 7: Store tokens in keyring
    const userId = await saveTokensToKeyring(tokens);

    // Step 8: Return the session
    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Math.floor(Date.now() / 1000) + tokens.expires_in,
      userId,
      deviceId: null,
    };
  } catch (error) {
    console.error('[SpotifyAuth] Authentication failed:', error);
    return null;
  }
}

/**
 * Exchanges the authorization code for access and refresh tokens.
 */
async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
  redirectUri: string
): Promise<SpotifyTokens> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  });

  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Falha ao trocar código por tokens: ${response.status} - ${errorText}`
    );
  }

  return response.json() as Promise<SpotifyTokens>;
}

/**
 * Saves the Spotify tokens to the OS keyring.
 * Uses the existing keyring pattern from the project.
 */
async function saveTokensToKeyring(tokens: SpotifyTokens): Promise<string> {
  // Store the access token under a user-specific entry
  // The userId comes from Spotify's API; for now we use a placeholder
  // In a real implementation, you'd get the user ID from the token info
  
  const userId = 'spotify_user'; // This should come from the actual user

  try {
    await invoke('store_token', {
      userId,
      token: tokens.access_token,
    });

    // Also store the refresh token and update the pointer
    await invoke('store_token', {
      userId: KEYRING_USER_ID,
      token: tokens.refresh_token,
    });

    return userId;
  } catch (error) {
    console.error('[SpotifyAuth] Failed to save tokens to keyring:', error);
    throw error;
  }
}

/**
 * Loads the stored Spotify session from the OS keyring.
 * 
 * @returns The stored session, or null if no session is found
 */
export async function loadSpotifySession(): Promise<SpotifySession | null> {
  try {
    const stored = await invoke<
      | {
          userId: string;
          token: string; // This is the refresh token stored under "current_user"
          expiresAt: number;
        }
      | null
    >('load_token');

    if (!stored) {
      return null;
    }

    return {
      accessToken: stored.token, // In a real implementation, tell apart access vs refresh
      refreshToken: stored.token,
      expiresAt: stored.expiresAt,
      userId: stored.userId,
      deviceId: null,
    };
  } catch (error) {
    console.error('[SpotifyAuth] Failed to load session:', error);
    return null;
  }
}

/**
 * Refreshes the access token using the refresh token.
 * 
 * @returns New Spotify tokens, or null on failure
 */
export async function refreshSpotifyToken(): Promise<SpotifySession | null> {
  try {
    const stored = await loadSpotifySession();
    if (!stored || !stored.refreshToken) {
      console.warn('[SpotifyAuth] No refresh token available');
      return null;
    }

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: stored.refreshToken,
    });

    const response = await fetch(SPOTIFY_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Falha ao renovar token: ${response.status} - ${errorText}`);
    }

    const newTokens = (await response.json()) as SpotifyTokens;

    // Update the stored tokens
    const userId = await saveTokensToKeyring(newTokens);

    return {
      accessToken: newTokens.access_token,
      refreshToken: newTokens.refresh_token,
      expiresAt: Math.floor(Date.now() / 1000) + newTokens.expires_in,
      userId,
      deviceId: null,
    };
  } catch (error) {
    console.error('[SpotifyAuth] Token refresh failed:', error);
    return null;
  }
}

/**
 * Background task factory that sets up periodic token refresh checks.
 * 
 * Returns a function that can be called to check and refresh tokens.
 * Should be called at application startup and periodically thereafter.
 * 
 * @param intervalMs Check interval in milliseconds (default: 60_000 = 1 minute)
 * @returns Unsubscribe function to stop the background task
 */
export function createTokenRefreshTask(
  intervalMs: number = 60_000
): () => void {
  let timeoutId: NodeJS.Timeout | null = null;

  const checkAndRefresh = async (): Promise<void> => {
    const session = await loadSpotifySession();

    if (!session) {
      // No active session, stop checking
      console.warn('[SpotifyAuth] No active session found');
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      return;
    }

    // Check if token is close to expiration (within 30 seconds)
    const timeUntilExpiry = session.expiresAt * 1000 - Date.now();

    if (timeUntilExpiry <= 30_000) {
      // Token expires soon, refresh it
      console.log(
        '[SpotifyAuth] Token expiring soon, refreshing...',
        `in ${Math.round(timeUntilExpiry / 1000)}s`
      );
      const refreshed = await refreshSpotifyToken();

      if (refreshed) {
        console.log('[SpotifyAuth] Token refreshed successfully');
        // Recursively schedule the next check
        scheduleNextCheck(intervalMs);
      } else {
        console.error('[SpotifyAuth] Token refresh failed');
        // Still schedule next check to avoid infinite loop
        scheduleNextCheck(intervalMs);
      }
    } else {
      // Token is still valid, schedule next check
      scheduleNextCheck(intervalMs);
    }
  };

  const scheduleNextCheck = (ms: number) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(checkAndRefresh, ms);
  };

  // Initialize the first check
  checkAndRefresh();

  return () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };
}
/**
 * PKCE (Proof Key for Code Exchange) utilities for OAuth 2.0.
 * 
 * Generates code_verifier and code_challenge (S256) as required by
 * the OAuth 2.0 PKCE specification (RFC 7636).
 * 
 * @see https://tools.ietf.org/html/rfc7636
 */

/** Generates a cryptographic code verifier (43-128 chars, URL-safe base64). */
export function generateCodeVerifier(): string {
  // 32 bytes = 43 base64url chars (without padding), which is the recommended length
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  // Encode to base64url and remove padding
  const base64 = btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return base64.slice(0, 43); // minimum recommended length
}

/** Generates the code challenge using SHA-256 (S256 method). */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hash);
  const hashB64 = btoa(String.fromCharCode(...hashArray))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return hashB64;
}

/** Opens the Spotify authorization URL in the system browser. */
export function openSpotifyAuthUrl(
  clientId: string,
  codeChallenge: string,
  redirectUri: string,
  scopes: string[]
): void {
  const scopeParam = scopes.join('%20');
  const url = new URL('https://accounts.spotify.com/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', scopeParam);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('show_dialog', 'false');

  // Use Tauri opener to open in system browser
  // @ts-ignore - Tauri opener will be available at runtime
  const { open } = await import('@tauri-apps/plugin-opener');
  open(url.toString());
}

/** Parses the callback URL and extracts the authorization code. */
export function extractAuthorizationCode(callbackUrl: string): string | null {
  try {
    const url = new URL(callbackUrl);
    const params = new URLSearchParams(url.search);
    const code = params.get('code');
    return code ?? null;
  } catch {
    return null;
  }
}

/** Builds the Spotify PKCE scopes string from the required scopes. */
export const SPOTIFY_SCOPES = {
  userReadPlaybackState: 'user-read-playback-state',
  userModifyPlaybackState: 'user-modify-playback-state',
  streaming: 'streaming',
  playlistReadPrivate: 'playlist-read-private',
  playlistReadCollaborative: 'playlist-read-collaborative',
  userLibraryRead: 'user-library-read',
  userCurrentlyPlaying: 'user-read-currently-playing',
  // Full list of available scopes: https://developer.spotify.com/documentation/web-api/reference/browse/get-users-saved-tracks
} as const;

/** All required scopes for Spotify playback control and library access. */
export const REQUIRED_SPOTIFY_SCOPES: string[] = [
  SPOTIFY_SCOPES.userReadPlaybackState,
  SPOTIFY_SCOPES.userModifyPlaybackState,
  SPOTIFY_SCOPES.streaming,
  SPOTIFY_SCOPES.playlistReadPrivate,
  SPOTIFY_SCOPES.playlistReadCollaborative,
  SPOTIFY_SCOPES.userLibraryRead,
  SPOTIFY_SCOPES.userCurrentlyPlaying,
];
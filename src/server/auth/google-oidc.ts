import 'server-only';
import { OAuth2Client, type TokenPayload } from 'google-auth-library';
import { requireEnv } from '@/env';
import { safeEqual } from '@/server/security/crypto';

export class AuthError extends Error {}

let client: OAuth2Client | null = null;

export function oauthClient(): OAuth2Client {
  if (!client) {
    const env = requireEnv();
    client = new OAuth2Client({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      redirectUri: `${env.APP_ORIGIN}/api/auth/google/callback`,
    });
  }
  return client;
}

export function buildAuthUrl(p: { state: string; nonce: string; codeChallenge: string }): string {
  const env = requireEnv();
  const u = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  u.search = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: `${env.APP_ORIGIN}/api/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email',
    access_type: 'online',
    prompt: 'select_account',
    hd: env.ALLOWED_HD, // Solo filtra la UI de Google: el control real está en verifyGoogleIdentity
    state: p.state,
    nonce: p.nonce,
    code_challenge: p.codeChallenge,
    code_challenge_method: 'S256',
  }).toString();
  return u.toString();
}

/** Canjea el código (con PKCE) y devuelve el ID Token recibido directamente de Google. */
export async function exchangeCode(code: string, codeVerifier: string): Promise<string> {
  const { tokens } = await oauthClient().getToken({ code, codeVerifier });
  if (!tokens.id_token) throw new AuthError('no_id_token');
  return tokens.id_token;
}

/** Devuelve las claims solo si TODO cuadra; si no, lanza AuthError con el motivo interno. */
export async function verifyGoogleIdentity(idToken: string, expectedNonce: string): Promise<TokenPayload> {
  const env = requireEnv();
  // Firma (JWKS de Google) + aud + iss + exp
  const ticket = await oauthClient().verifyIdToken({ idToken, audience: env.GOOGLE_CLIENT_ID });
  const c = ticket.getPayload();
  if (!c) throw new AuthError('no_payload');
  if (c.hd !== env.ALLOWED_HD) throw new AuthError('hd_mismatch'); // igualdad estricta
  if (c.email_verified !== true) throw new AuthError('email_unverified');
  if (!c.nonce || !safeEqual(c.nonce, expectedNonce)) throw new AuthError('nonce_mismatch');
  if (!c.email || !c.email.toLowerCase().endsWith(`@${env.ALLOWED_HD}`)) throw new AuthError('email_domain');
  if (Date.now() / 1000 - (c.iat ?? 0) > 300) throw new AuthError('token_stale');
  return c;
}

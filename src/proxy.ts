import { NextResponse, type NextRequest } from 'next/server';
import { STATIC_SECURITY_HEADERS, buildCsp, newNonce } from '@/server/security/headers';
import { validateAndTouchSession, setSessionCookies, clearCookie, SESSION_COOKIE } from '@/server/auth/session';
import { verifyCsrf } from '@/server/auth/csrf';
import { verifyCloudflareAccess } from '@/server/security/cf-access';
import { getEnv } from '@/env';

/**
 * Guardián único. Deniega por defecto: solo estas rutas exactas son públicas.
 * Todo lo demás (incluidos /_next/static, imágenes y favicon) exige sesión válida.
 */
const PUBLIC_ROUTES = new Set(['/login', '/robots.txt', '/api/auth/google/start', '/api/auth/google/callback']);
const SAFE_METHODS = new Set(['GET', 'HEAD']);
const INTERNAL_HEADERS = ['x-nonce', 'x-middleware-subrequest', 'x-fo-user'];

export async function proxy(req: NextRequest) {
  const nonce = newNonce();
  const { pathname } = req.nextUrl;

  // 0. Sin configuración válida, la app no sirve nada (falla cerrada). robots.txt sigue disponible.
  const env = getEnv();
  if (!env) return pathname === '/robots.txt' ? next(req, nonce) : seal(empty(503), nonce);

  // 1. Solo el host canónico: *.vercel.app, previews y hosts falsos → 404 vacío
  if (req.headers.get('host') !== env.APP_HOST) return seal(empty(404), nonce);

  // 2. Si hay Cloudflare Access delante, su JWT es obligatorio
  if (env.CF_ACCESS_AUD && !(await verifyCloudflareAccess(req, env))) return seal(empty(403), nonce);

  // 3. Mutaciones: Origin exacto
  if (!SAFE_METHODS.has(req.method) && req.headers.get('origin') !== env.APP_ORIGIN) {
    return seal(empty(403), nonce);
  }

  // 4. Rutas públicas: solo GET/HEAD
  if (PUBLIC_ROUTES.has(pathname)) {
    return SAFE_METHODS.has(req.method) ? next(req, nonce) : seal(empty(405), nonce);
  }

  // 5. Auth wall
  const sid = req.cookies.get(SESSION_COOKIE)?.value;
  const auth = sid
    ? await validateAndTouchSession(sid, req.headers.get('user-agent') ?? '').catch(() => null)
    : null;
  if (!auth) return unauthenticated(req, nonce, Boolean(sid));

  // 6. CSRF en mutaciones
  if (!SAFE_METHODS.has(req.method) && !verifyCsrf(req, auth.session)) return seal(empty(403), nonce);

  // 7. Continuar; si la sesión rotó, emitir el identificador nuevo
  const res = next(req, nonce);
  if (auth.rotatedSid) setSessionCookies(res, auth.rotatedSid, auth.session);
  return res;
}

function next(req: NextRequest, nonce: string) {
  const headers = new Headers(req.headers);
  INTERNAL_HEADERS.forEach((k) => headers.delete(k));
  headers.set('x-nonce', nonce);
  headers.set('content-security-policy', buildCsp(nonce)); // Next.js toma el nonce de aquí para sus <script>
  return seal(NextResponse.next({ request: { headers } }), nonce);
}

/** Misma respuesta exista o no la ruta: no se puede enumerar nada. */
function unauthenticated(req: NextRequest, nonce: string, hadCookie: boolean) {
  const isNavigation =
    req.method === 'GET' &&
    req.headers.get('sec-fetch-mode') === 'navigate' &&
    !req.nextUrl.pathname.startsWith('/api/');
  const res = isNavigation
    ? new NextResponse(null, { status: 303, headers: { Location: '/login' } })
    : empty(401);
  if (hadCookie) clearCookie(res, SESSION_COOKIE);
  return seal(res, nonce);
}

const empty = (status: number) => new NextResponse(null, { status });

function seal(res: NextResponse, nonce: string) {
  for (const [k, v] of Object.entries(STATIC_SECURITY_HEADERS)) res.headers.set(k, v);
  res.headers.set('Content-Security-Policy', buildCsp(nonce));
  return res;
}

// Sin exclusiones: el proxy cubre todas las rutas, también las estáticas.
export const config = { matcher: ['/:path*'] };

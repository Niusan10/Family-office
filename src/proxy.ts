import { NextResponse, type NextRequest } from 'next/server';
import { STATIC_SECURITY_HEADERS, buildCsp, newNonce } from '@/server/security/headers';
import { validateAndTouchSession, setSessionCookies, clearCookie, SESSION_COOKIE } from '@/server/auth/session';
import { getEnv } from '@/env';

/**
 * Guardián único. Deniega por defecto: solo estas rutas exactas son públicas.
 * Todo lo demás (incluidos /_next/static, imágenes y favicon) exige una sesión válida.
 */
const PUBLIC_GET = new Set(['/login', '/activar', '/robots.txt']);
const PUBLIC_POST = new Set(['/api/auth/login', '/api/auth/activate']);
const SAFE_METHODS = new Set(['GET', 'HEAD']);
const INTERNAL_HEADERS = ['x-nonce', 'x-middleware-subrequest'];

export async function proxy(req: NextRequest) {
  const nonce = newNonce();
  const { pathname } = req.nextUrl;

  // 0. Sin configuración válida no se sirve nada (falla cerrada). robots.txt sigue disponible.
  const env = getEnv();
  if (!env) return pathname === '/robots.txt' ? next(req, nonce) : seal(empty(503), nonce);

  // 1. Solo el host canónico: *.vercel.app de previews y hosts falsos → 404 vacío
  if (req.headers.get('host') !== env.APP_HOST) return seal(empty(404), nonce);

  // 2. Cualquier petición que modifica algo debe venir de nuestro propio origen
  const isSafe = SAFE_METHODS.has(req.method);
  if (!isSafe && !isSameOrigin(req, env.APP_ORIGIN)) return seal(empty(403), nonce);

  // 3. Rutas públicas
  if (isSafe && PUBLIC_GET.has(pathname)) return next(req, nonce);
  if (req.method === 'POST' && PUBLIC_POST.has(pathname)) return next(req, nonce);

  // 4. Auth wall: todo lo demás exige sesión válida
  const sid = req.cookies.get(SESSION_COOKIE)?.value;
  const auth = sid
    ? await validateAndTouchSession(sid, req.headers.get('user-agent') ?? '').catch(() => null)
    : null;
  if (!auth) return unauthenticated(req, nonce, Boolean(sid));

  // 5. Continuar; si la sesión rotó, emitir el identificador nuevo.
  //    El token CSRF de cada mutación lo comprueba su route handler (cabecera o campo de formulario).
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

/**
 * Con Referrer-Policy: no-referrer, los navegadores envían "Origin: null" en los formularios POST.
 * En ese caso se usa Sec-Fetch-Site, que el navegador fija y una página ajena no puede falsificar.
 */
function isSameOrigin(req: NextRequest, appOrigin: string): boolean {
  const origin = req.headers.get('origin');
  if (origin === appOrigin) return true;
  if (origin && origin !== 'null') return false;
  return req.headers.get('sec-fetch-site') === 'same-origin';
}

const empty = (status: number) => new NextResponse(null, { status });

function seal(res: NextResponse, nonce: string) {
  for (const [k, v] of Object.entries(STATIC_SECURITY_HEADERS)) res.headers.set(k, v);
  res.headers.set('Content-Security-Policy', buildCsp(nonce));
  return res;
}

// Sin exclusiones: el proxy cubre todas las rutas, también las estáticas.
export const config = { matcher: ['/:path*'] };

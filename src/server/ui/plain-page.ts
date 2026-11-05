import 'server-only';
import { NextResponse } from 'next/server';
import { PRE_COOKIE } from '@/server/auth/session';
import { randomToken } from '@/server/security/crypto';

export const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/**
 * Página pública mínima: HTML generado en el servidor, sin JavaScript, sin marca y sin metadatos
 * indexables. Al no cargar ningún bundle, el proxy puede exigir sesión también para /_next/static.
 * Emite una cookie anti-CSRF (__Host-fo_pre) que el formulario devuelve en un campo oculto.
 */
export function plainPage(opts: { nonce: string; title: string; body: (csrf: string) => string }) {
  const csrf = randomToken(32);
  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow, noarchive, nosnippet, noimageindex">
<meta name="referrer" content="no-referrer">
<title>${esc(opts.title)}</title>
<style nonce="${esc(opts.nonce)}">
  @font-face { font-family: 'Ubuntu'; font-weight: 400; font-display: swap; src: url('/fonts/ubuntu-400.woff2') format('woff2'); }
  @font-face { font-family: 'Ubuntu'; font-weight: 500; font-display: swap; src: url('/fonts/ubuntu-500.woff2') format('woff2'); }
  @font-face { font-family: 'Ubuntu'; font-weight: 700; font-display: swap; src: url('/fonts/ubuntu-700.woff2') format('woff2'); }
  :root { color-scheme: light; --primary: #e81e76; --primary-2: #ff1779; --gray-dark: #424242; --gray-light: #f2f2f2; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; font: 15px/1.55 'Ubuntu', system-ui, -apple-system, "Segoe UI", sans-serif; background: var(--gray-light); color: #000; -webkit-font-smoothing: antialiased; }
  main { width: min(400px, 92vw); padding: 36px 32px 32px; background: #fff; border-radius: 14px; border-top: 4px solid var(--primary); box-shadow: 0 1px 2px rgba(0,0,0,.04), 0 8px 24px rgba(0,0,0,.06); }
  h1 { font-size: 22px; font-weight: 700; margin: 0 0 6px; }
  p.sub { margin: 0 0 22px; color: var(--gray-dark); font-size: 14px; }
  label { display: block; font-size: 13px; font-weight: 500; color: var(--gray-dark); margin: 16px 0 6px; }
  input { width: 100%; font: inherit; padding: 11px 12px; border: 1px solid #d6d6d6; border-radius: 8px; background: #fff; color: #000; }
  input:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px rgba(232,30,118,.18); }
  button { width: 100%; margin-top: 24px; font: inherit; font-weight: 700; padding: 12px 16px; border: 0; border-radius: 8px; background: var(--primary); color: #fff; cursor: pointer; }
  button:hover { background: var(--primary-2); }
  button:focus-visible { outline: 2px solid var(--gray-dark); outline-offset: 2px; }
  .msg { margin: 0 0 8px; padding: 10px 12px; border-radius: 8px; font-size: 14px; background: var(--gray-light); }
  .err { border-left: 4px solid var(--primary); }
  .ok { border-left: 4px solid #16a34a; }
  .hint { font-size: 12px; color: var(--gray-dark); opacity: .8; margin-top: 6px; }
</style>
</head>
<body>
<main>
${opts.body(csrf)}
</main>
</body>
</html>`;
  const res = new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  res.cookies.set({ name: PRE_COOKIE, value: csrf, httpOnly: true, secure: true, sameSite: 'strict', path: '/', maxAge: 1800 });
  return res;
}

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
  :root { color-scheme: light dark; --line: color-mix(in srgb, CanvasText 16%, transparent); }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; background: Canvas; color: CanvasText; }
  main { width: min(380px, 92vw); padding: 32px; border: 1px solid var(--line); border-radius: 14px; }
  h1 { font-size: 20px; font-weight: 600; margin: 0 0 6px; }
  p.sub { margin: 0 0 22px; opacity: .7; font-size: 14px; }
  label { display: block; font-size: 13px; font-weight: 600; margin: 14px 0 6px; }
  input { width: 100%; font: inherit; padding: 10px 12px; border: 1px solid var(--line); border-radius: 8px; background: transparent; color: inherit; }
  input:focus { outline: 2px solid Highlight; outline-offset: 1px; }
  button { width: 100%; margin-top: 22px; font: inherit; font-weight: 600; padding: 11px 16px; border: 0; border-radius: 8px; background: CanvasText; color: Canvas; cursor: pointer; }
  .msg { margin: 0 0 6px; padding: 10px 12px; border-radius: 8px; font-size: 14px; }
  .err { background: color-mix(in srgb, #d33 14%, transparent); }
  .ok { background: color-mix(in srgb, #2a2 14%, transparent); }
  .hint { font-size: 12px; opacity: .65; margin-top: 6px; }
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

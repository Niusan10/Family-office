import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Login neutro: HTML plano generado en el servidor, sin JavaScript, sin marca, sin metadatos.
 * Al no cargar ningún bundle, el proxy puede exigir sesión también para /_next/static.
 */
export function GET(req: NextRequest) {
  const nonce = req.headers.get('x-nonce') ?? '';
  const failed = req.nextUrl.searchParams.has('e');
  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow, noarchive, nosnippet, noimageindex">
<title>Acceso</title>
<style nonce="${nonce}">
  :root { color-scheme: light dark; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; background: Canvas; color: CanvasText; }
  main { width: min(360px, 90vw); padding: 32px; border: 1px solid color-mix(in srgb, CanvasText 15%, transparent); border-radius: 12px; }
  h1 { font-size: 20px; font-weight: 600; margin: 0 0 24px; }
  p.err { margin: 0 0 16px; padding: 10px 12px; border-radius: 8px; background: color-mix(in srgb, #d33 12%, transparent); }
  a.btn { display: block; text-align: center; padding: 11px 16px; border-radius: 8px; text-decoration: none; font-weight: 600; background: CanvasText; color: Canvas; }
  a.btn:focus-visible { outline: 3px solid Highlight; outline-offset: 2px; }
</style>
</head>
<body>
<main>
<h1>Acceso</h1>
${failed ? '<p class="err" role="alert">No ha sido posible iniciar sesión.</p>' : ''}
<a class="btn" href="/api/auth/google/start" rel="nofollow noopener">Continuar con Google</a>
</main>
</body>
</html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

import 'server-only';
import { NextResponse } from 'next/server';
import { PRE_COOKIE } from '@/server/auth/session';
import { randomToken } from '@/server/security/crypto';

export const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/**
 * Página pública (login y activación): HTML generado en el servidor, sin JavaScript y sin metadatos
 * indexables. Al no cargar ningún bundle, el proxy puede exigir sesión también para /_next/static.
 * El escudo familiar y las fuentes son los únicos recursos públicos (ver PUBLIC_GET en proxy.ts).
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
<meta name="color-scheme" content="dark">
<title>${esc(opts.title)}</title>
<link rel="preload" href="/brand/escudo.webp" as="image" type="image/webp">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/brand/icon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/brand/apple-touch-icon.png">
<style nonce="${esc(opts.nonce)}">
  @font-face { font-family: 'Ubuntu'; font-weight: 300; font-display: swap; src: url('/fonts/ubuntu-300.woff2') format('woff2'); }
  @font-face { font-family: 'Ubuntu'; font-weight: 400; font-display: swap; src: url('/fonts/ubuntu-400.woff2') format('woff2'); }
  @font-face { font-family: 'Ubuntu'; font-weight: 500; font-display: swap; src: url('/fonts/ubuntu-500.woff2') format('woff2'); }
  @font-face { font-family: 'Ubuntu'; font-weight: 700; font-display: swap; src: url('/fonts/ubuntu-700.woff2') format('woff2'); }

  :root {
    /* Login en la gama del escudo (madera y bronce). Dentro de la app se usan los colores corporativos. */
    --ink: #0c0a09; --bronze: #b58456; --bronze-soft: rgba(181, 132, 86, .35);
    --gold-1: #dcb88a; --gold-2: #b0814f; --gold-3: #8a5c33; --oak-ink: #1a120b; --ember: #c9744a;
    --text: rgba(255, 255, 255, .92); --muted: rgba(255, 255, 255, .55); --line: rgba(255, 255, 255, .16);
  }
  * { box-sizing: border-box; }
  html, body { height: 100%; }
  body {
    margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 32px 20px;
    font: 15px/1.55 'Ubuntu', system-ui, -apple-system, "Segoe UI", sans-serif; color: var(--text);
    background:
      radial-gradient(ellipse 60% 45% at 50% 28%, rgba(181, 132, 86, .20), transparent 70%),
      radial-gradient(ellipse 80% 60% at 50% 110%, rgba(138, 92, 51, .14), transparent 70%),
      var(--ink);
    -webkit-font-smoothing: antialiased;
  }
  main { width: min(380px, 100%); display: flex; flex-direction: column; align-items: center; text-align: center; }

  .crest {
    width: min(400px, 82vw); max-height: 40vh; height: auto; object-fit: contain; display: block;
    filter: drop-shadow(0 18px 40px rgba(0, 0, 0, .55)) drop-shadow(0 0 60px rgba(181, 132, 86, .18));
    animation: rise 1.1s cubic-bezier(.2, .7, .2, 1) both;
  }
  .eyebrow {
    display: flex; align-items: center; gap: 14px; width: 100%; margin: 30px 0 26px;
    font-size: 12px; font-weight: 400; letter-spacing: .38em; text-transform: uppercase; color: var(--bronze);
    animation: fade 1s .35s both;
  }
  .eyebrow::before, .eyebrow::after { content: ""; flex: 1; height: 1px; background: linear-gradient(90deg, transparent, var(--bronze-soft)); }
  .eyebrow::after { background: linear-gradient(270deg, transparent, var(--bronze-soft)); }

  form, .note { width: 100%; text-align: left; animation: fade 1s .5s both; }
  .who { margin: -12px 0 18px; text-align: center; color: var(--muted); font-size: 14px; font-weight: 300; }
  label { display: block; font-size: 11px; font-weight: 500; letter-spacing: .16em; text-transform: uppercase; color: var(--muted); margin: 18px 0 8px; }
  input {
    width: 100%; font: inherit; font-weight: 300; font-size: 16px; padding: 13px 14px; color: #fff;
    background: rgba(255, 255, 255, .04); border: 1px solid var(--line); border-radius: 10px;
    transition: border-color .2s, box-shadow .2s, background .2s;
  }
  input:hover { border-color: rgba(255, 255, 255, .28); }
  input:focus { outline: none; border-color: var(--bronze); background: rgba(255, 255, 255, .06); box-shadow: 0 0 0 4px rgba(181, 132, 86, .22); }
  input:-webkit-autofill { -webkit-text-fill-color: #fff; -webkit-box-shadow: 0 0 0 1000px #1a1614 inset; caret-color: var(--gold-1); }
  input { caret-color: var(--gold-1); }
  button {
    width: 100%; margin-top: 28px; font: inherit; font-size: 13px; font-weight: 700; letter-spacing: .22em; text-transform: uppercase;
    padding: 15px 16px; border: 1px solid rgba(255, 236, 205, .25); border-radius: 10px; cursor: pointer; color: var(--oak-ink);
    background: linear-gradient(180deg, var(--gold-1) 0%, var(--gold-2) 100%);
    box-shadow: 0 10px 30px rgba(138, 92, 51, .35), inset 0 1px 0 rgba(255, 244, 225, .45);
    transition: filter .2s, transform .2s, box-shadow .2s;
  }
  button:hover { filter: brightness(1.08); transform: translateY(-1px); box-shadow: 0 14px 34px rgba(181, 132, 86, .4), inset 0 1px 0 rgba(255, 244, 225, .5); }
  button:active { transform: translateY(0); }
  button:focus-visible { outline: 2px solid var(--gold-1); outline-offset: 3px; }

  .msg { margin: 0 0 6px; padding: 11px 14px; border-radius: 10px; font-size: 14px; background: rgba(255, 255, 255, .05); border-left: 3px solid var(--ember); text-align: left; }
  .msg.ok { border-left-color: var(--bronze); }
  .hint { font-size: 12px; color: var(--muted); font-weight: 300; margin-top: 8px; }
  .note { text-align: center; color: var(--muted); font-weight: 300; }
  footer { margin-top: 40px; font-size: 11px; letter-spacing: .3em; text-transform: uppercase; color: rgba(255, 255, 255, .28); animation: fade 1s .7s both; }

  @keyframes rise { from { opacity: 0; transform: translateY(14px) scale(.98); } to { opacity: 1; transform: none; } }
  @keyframes fade { from { opacity: 0; } to { opacity: 1; } }
  @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
  @media (max-height: 700px) { .crest { max-height: 30vh; } .eyebrow { margin: 20px 0 16px; } }
</style>
</head>
<body>
<main>
<img class="crest" src="/brand/escudo.webp" alt="Escudo familiar" width="760" height="593" decoding="async" fetchpriority="high">
${opts.body(csrf)}
<footer>Acceso restringido</footer>
</main>
</body>
</html>`;
  const res = new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  res.cookies.set({ name: PRE_COOKIE, value: csrf, httpOnly: true, secure: true, sameSite: 'strict', path: '/', maxAge: 1800 });
  return res;
}

import type { NextRequest } from 'next/server';
import { esc, plainPage } from '@/server/ui/plain-page';

export const dynamic = 'force-dynamic';

const MESSAGES: Record<string, { cls: string; text: string }> = {
  '1': { cls: 'err', text: 'Email o contraseña incorrectos.' },
  '2': { cls: 'err', text: 'Demasiados intentos. Espera 15 minutos.' },
  '3': { cls: 'err', text: 'La sesión del formulario ha caducado. Vuelve a intentarlo.' },
  ok: { cls: 'ok', text: 'Contraseña guardada. Ya puedes entrar.' },
  out: { cls: 'ok', text: 'Has cerrado sesión.' },
};

/** Login: escudo familiar, formulario mínimo y sin JavaScript. */
export function GET(req: NextRequest) {
  const m = MESSAGES[req.nextUrl.searchParams.get('e') ?? ''];
  return plainPage({
    nonce: req.headers.get('x-nonce') ?? '',
    title: 'Acceso',
    body: (csrf) => `
<h1 class="eyebrow">Acceso privado</h1>
<form method="post" action="/api/auth/login" autocomplete="on">
  ${m ? `<p class="msg ${m.cls}" role="alert">${esc(m.text)}</p>` : ''}
  <input type="hidden" name="csrf" value="${csrf}">
  <label for="email">Email</label>
  <input id="email" name="email" type="email" autocomplete="username" required maxlength="254" autofocus>
  <label for="password">Contraseña</label>
  <input id="password" name="password" type="password" autocomplete="current-password" required maxlength="256">
  <button type="submit">Entrar</button>
</form>`,
  });
}

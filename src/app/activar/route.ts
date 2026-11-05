import type { NextRequest } from 'next/server';
import { esc, plainPage } from '@/server/ui/plain-page';
import { peekInvite } from '@/server/auth/users';
import { PASSWORD_MIN } from '@/server/auth/password';
import { clientIp, rateLimit } from '@/server/security/rate-limit';

export const dynamic = 'force-dynamic';

const ERRORS: Record<string, string> = {
  short: `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`,
  match: 'Las dos contraseñas no coinciden.',
  csrf: 'El formulario ha caducado. Vuelve a intentarlo.',
};

/** Enlace de un solo uso para fijar o restablecer la contraseña. */
export async function GET(req: NextRequest) {
  const nonce = req.headers.get('x-nonce') ?? '';
  const token = req.nextUrl.searchParams.get('t') ?? '';
  const allowed = await rateLimit(`activar:${clientIp(req)}`, 20, 600);
  const email = allowed ? await peekInvite(token).catch(() => null) : null;

  if (!email) {
    return plainPage({
      nonce,
      title: 'Acceso',
      body: () => `<h1 class="eyebrow">Enlace no válido</h1><p class="note">Este enlace ha caducado o ya se ha usado.<br>Pide uno nuevo al administrador.</p>`,
    });
  }

  const err = ERRORS[req.nextUrl.searchParams.get('e') ?? ''];
  return plainPage({
    nonce,
    title: 'Acceso',
    body: (csrf) => `
<h1 class="eyebrow">Crea tu contraseña</h1>
<p class="who">${esc(email)}</p>
<form method="post" action="/api/auth/activate">
  ${err ? `<p class="msg" role="alert">${esc(err)}</p>` : ''}
  <input type="hidden" name="csrf" value="${csrf}">
  <input type="hidden" name="t" value="${esc(token)}">
  <input type="text" name="username" value="${esc(email)}" autocomplete="username" hidden>
  <label for="password">Contraseña nueva</label>
  <input id="password" name="password" type="password" autocomplete="new-password" required minlength="${PASSWORD_MIN}" maxlength="256" autofocus>
  <p class="hint">Mínimo ${PASSWORD_MIN} caracteres. Mejor una frase larga que nadie pueda adivinar.</p>
  <label for="confirm">Repite la contraseña</label>
  <input id="confirm" name="confirm" type="password" autocomplete="new-password" required minlength="${PASSWORD_MIN}" maxlength="256">
  <button type="submit">Guardar contraseña</button>
</form>`,
  });
}

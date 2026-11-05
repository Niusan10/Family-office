# Family Office

Aplicación web privada de gestión de Family Office. Next.js 16 + TypeScript, desplegada en Vercel.

Prioridad: privilegio mínimo y superficie de ataque cero. Para un anónimo solo existen `/login` (HTML neutro, sin JavaScript) y `/robots.txt`. Cualquier otra URL, también los estáticos de `/_next`, responde con un 303 a `/login` o un 401 vacío.

## Seguridad en una línea por capa

| Capa | Fichero | Qué hace |
| --- | --- | --- |
| Proxy | `src/proxy.ts` | Host canónico, Origin, auth wall deny-by-default, CSRF, rotación de sesión y cabeceras (CSP con nonce, `X-Robots-Tag`, HSTS, XFO) en todas las respuestas |
| Login | `src/app/api/auth/google/*` | OIDC Authorization Code + PKCE, `state` y `nonce`; verificación de firma, `hd` exacto, `email_verified` y whitelist con `sub` anclado |
| Sesión | `src/server/auth/session.ts` | ID opaco en `__Host-fo_sid` (HttpOnly, Secure, Strict). 15 min de inactividad, 8 h máximas, rotación cada 5 min con detección de reutilización |
| CSRF | `src/server/auth/csrf.ts` | `SameSite=Strict` + `Origin` + double submit firmado con HMAC |
| Rate limit | `src/server/security/rate-limit.ts` | Límites por IP en las rutas de auth y bloqueo tras 5 fallos en 15 min |
| 2ª barrera | `src/server/auth/require-session.ts` | El layout privado vuelve a validar la sesión aunque el proxy ya lo haya hecho |

Si falta cualquier variable de entorno obligatoria, la app responde 503 a todo: falla cerrada.

## Puesta en marcha

1. **Google Cloud → OAuth client (Web).** Pantalla de consentimiento en modo *Internal*, scopes `openid` y `email`, redirect URI `https://<APP_HOST>/api/auth/google/callback`.
2. **Redis.** En Vercel → Storage, añade Upstash Redis (región UE) y conéctalo al proyecto. Crea las variables `KV_REST_API_URL` y `KV_REST_API_TOKEN`.
3. **Variables de entorno en Vercel:** las de `.env.example`.
4. **Desarrollo local:** `cp .env.example .env.local`, rellenar y ejecutar `npm install && npm run dev`.

Documento de arquitectura completo: ver el doc "Family Office — Arquitectura técnica y de seguridad".

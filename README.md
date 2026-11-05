# Family Office

Aplicación web privada de gestión de Family Office. Next.js 16 + TypeScript, desplegada en Vercel.

Prioridades: privilegio mínimo y que nadie pueda encontrarla. Un visitante anónimo solo puede ver tres cosas: `/login` (HTML neutro, sin JavaScript ni marca), `/activar` (con un enlace válido) y `/robots.txt` (`Disallow: /`). Cualquier otra URL, también los estáticos de `/_next`, responde con un 303 a `/login` o un 401 vacío.

## Acceso

- **Email + contraseña.** Las contraseñas se guardan con scrypt (memory-hard), nunca en claro.
- **Whitelist gestionada desde la app.** En *Emails autorizados*, solo para administradores, se autorizan o quitan emails. Al autorizar uno se genera un enlace de un solo uso (72 h) para que esa persona cree su contraseña. Quitar el acceso cierra su sesión al instante.
- **Administrador inicial:** `ADMIN_EMAIL`. Crea su contraseña con `/activar?t=<SETUP_TOKEN>`, que solo funciona una vez.

## Seguridad por capa

| Capa | Fichero | Qué hace |
| --- | --- | --- |
| Proxy | `src/proxy.ts` | Host canónico, Origin en mutaciones, auth wall deny-by-default, rotación de sesión y cabeceras (CSP con nonce, `X-Robots-Tag`, HSTS, XFO) en todas las respuestas |
| Login | `src/app/api/auth/login` | Anti-CSRF previo a la sesión, rate limit, bloqueo de 15 min tras 5 fallos (por IP y por email) y tiempo constante para no revelar qué emails existen |
| Sesión | `src/server/auth/session.ts` | ID opaco en `__Host-fo_sid` (HttpOnly, Secure, Strict). 30 min de inactividad, 8 h máximas, rotación cada 5 min con detección de reutilización |
| CSRF | `src/server/auth/csrf.ts` | `SameSite=Strict` + `Origin` + token HMAC ligado a la sesión en cada formulario |
| 2ª barrera | `src/server/auth/require-session.ts` | Cada página privada vuelve a validar sesión y que el usuario siga autorizado |
| Auditoría | `src/server/security/audit.ts` | Logins, fallos, altas y bajas en los logs y en Redis |

## Variables de entorno

Ver `.env.example`. Redis se añade desde Vercel → Storage → Upstash Redis (región UE).

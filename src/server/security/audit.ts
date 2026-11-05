// Importado también por src/proxy.ts: sin "server-only" (el proxy no se compila en la capa react-server).
import { redis } from '@/server/db/redis';

export type AuditEvent = {
  event:
    | 'login.ok'
    | 'login.denied'
    | 'login.locked'
    | 'logout'
    | 'session.reuse_detected'
    | 'session.invalid'
    | 'password.set'
    | 'user.added'
    | 'user.removed'
    | 'user.invite';
  reason?: string;
  email?: string;
  by?: string;
  ip?: string;
};

/**
 * Log de auditoría append-only: va a los logs de Vercel y a una lista en Redis
 * (últimos 10 000 eventos). Nunca registra contraseñas, tokens ni identificadores de sesión.
 */
export async function audit(e: AuditEvent): Promise<void> {
  const entry = { ts: new Date().toISOString(), ...e };
  console.log(JSON.stringify({ audit: entry }));
  try {
    await redis().pipeline().lpush('audit', JSON.stringify(entry)).ltrim('audit', 0, 9999).exec();
  } catch {
    // Un fallo de auditoría no debe abrir nada: el evento ya está en los logs.
  }
}

// Importado también por src/proxy.ts: sin "server-only" (el proxy no se compila en la capa react-server).
import { kvSet } from '@/server/db/kv';
import { randomToken } from '@/server/security/crypto';

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
    | 'user.invite'
    | 'valuation.updated'
    | 'org.updated';
  reason?: string;
  email?: string;
  by?: string;
  ip?: string;
};

/**
 * Log de auditoría append-only: va a los logs de Vercel y al almacén privado
 * (un fichero por evento en el almacén privado). Nunca registra contraseñas, tokens ni identificadores de sesión.
 */
export async function audit(e: AuditEvent): Promise<void> {
  const entry = { ts: new Date().toISOString(), ...e };
  console.log(JSON.stringify({ audit: entry }));
  try {
    await kvSet(`audit/${Date.now()}-${randomToken(6)}`, entry);
  } catch {
    // Un fallo de auditoría no debe abrir nada: el evento ya está en los logs.
  }
}

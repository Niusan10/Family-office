import { requireAdmin } from '@/server/auth/require-session';
import { csrfTokenFor } from '@/server/auth/session';
import { listUsers } from '@/server/auth/users';
import { kvDel, kvGet } from '@/server/db/kv';
import type { Flash } from '@/server/ui/flash';

export const dynamic = 'force-dynamic';

const fmt = (ms: number) => new Date(ms).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });

export default async function UsuariosPage() {
  const { session, user: me } = await requireAdmin(); // también lo exige admin/layout.tsx
  const csrf = csrfTokenFor(session);
  const users = await listUsers();
  const flash = await kvGet<Flash>(`flash/${session.family}`);
  if (flash) await kvDel(`flash/${session.family}`);

  return (
    <>
      <h1>Emails autorizados</h1>
      <p className="lead">Solo las personas de esta lista pueden entrar. Quitar a alguien cierra su sesión al instante.</p>

      {flash && (
        <div className={`flash ${flash.kind}`} role="status">
          <p>{flash.text}</p>
          {flash.link && <code className="link">{flash.link}</code>}
        </div>
      )}

      <section className="panel">
        <h2>Autorizar un email</h2>
        <form method="post" action="/api/admin/users" className="row">
          <input type="hidden" name="csrf" value={csrf} />
          <input type="hidden" name="action" value="add" />
          <input name="email" type="email" required maxLength={254} placeholder="nombre@dominio.com" aria-label="Email" />
          <select name="role" defaultValue="miembro" aria-label="Rol">
            <option value="miembro">Miembro</option>
            <option value="admin">Administrador</option>
          </select>
          <button type="submit" className="primary">Autorizar</button>
        </form>
      </section>

      <table className="users">
        <thead>
          <tr>
            <th>Email</th>
            <th>Rol</th>
            <th>Estado</th>
            <th>Alta</th>
            <th aria-label="Acciones" />
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.email}>
              <td className="email">{u.email}</td>
              <td data-label="Rol">{u.role === 'admin' ? 'Administrador' : 'Miembro'}</td>
              <td data-label="Estado">
                {u.passwordHash ? (
                  <span className="badge ok">Activo</span>
                ) : (
                  <span className="badge pending">Pendiente de crear contraseña</span>
                )}
              </td>
              <td data-label="Alta">{fmt(u.createdAt)}</td>
              <td className="actions">
                <form method="post" action="/api/admin/users">
                  <input type="hidden" name="csrf" value={csrf} />
                  <input type="hidden" name="action" value="invite" />
                  <input type="hidden" name="email" value={u.email} />
                  <button type="submit">{u.passwordHash ? 'Restablecer contraseña' : 'Nuevo enlace'}</button>
                </form>
                {u.email !== me.email && (
                  <form method="post" action="/api/admin/users">
                    <input type="hidden" name="csrf" value={csrf} />
                    <input type="hidden" name="action" value="remove" />
                    <input type="hidden" name="email" value={u.email} />
                    <button type="submit" className="danger">Quitar acceso</button>
                  </form>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

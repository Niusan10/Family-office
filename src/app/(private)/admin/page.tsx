import Link from 'next/link';
import { requireAdmin } from '@/server/auth/require-session';
import { listUsers } from '@/server/auth/users';
import { ADMIN_SECTIONS } from './sections';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  await requireAdmin();
  const users = await listUsers();
  const active = users.filter((u) => u.passwordHash).length;
  const pending = users.length - active;

  const stats: Record<string, string> = {
    '/admin/usuarios': `${active} ${active === 1 ? 'activo' : 'activos'}${pending ? ` · ${pending} ${pending === 1 ? 'pendiente' : 'pendientes'}` : ''}`,
  };

  return (
    <>
      <h1>Admin</h1>
      <p className="lead">Configuración y control de acceso del family office.</p>
      <div className="grid">
        {ADMIN_SECTIONS.map((s) => (
          <Link key={s.href} href={s.href} className="card">
            <h2>{s.title}</h2>
            <p>{s.text}</p>
            {stats[s.href] && <span className="card-stat">{stats[s.href]}</span>}
          </Link>
        ))}
      </div>
    </>
  );
}

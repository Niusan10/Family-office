import type { ReactNode } from 'react';
import { requireAdmin } from '@/server/auth/require-session';
import { NavLink } from '@/components/nav-link';
import { ADMIN_SECTIONS } from './sections';

export const dynamic = 'force-dynamic';

/** Todo lo que cuelga de /admin es solo para administradores (un miembro recibe "no encontrado"). */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin();
  return (
    <>
      <nav className="admin-tabs" aria-label="Admin">
        <NavLink href="/admin" exact>
          Resumen
        </NavLink>
        {ADMIN_SECTIONS.map((s) => (
          <NavLink key={s.href} href={s.href}>
            {s.title}
          </NavLink>
        ))}
      </nav>
      {children}
    </>
  );
}

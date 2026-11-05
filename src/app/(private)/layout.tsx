import Link from 'next/link';
import type { ReactNode } from 'react';
import { requireSession } from '@/server/auth/require-session';
import { csrfTokenFor } from '@/server/auth/session';

export const dynamic = 'force-dynamic';

export default async function PrivateLayout({ children }: { children: ReactNode }) {
  const { session, user } = await requireSession(); // Segunda barrera, independiente del proxy

  return (
    <div className="shell">
      <nav className="nav" aria-label="Principal">
        <Link href="/dashboard">Inicio</Link>
        {user.role === 'admin' && <Link href="/admin/usuarios">Emails autorizados</Link>}
        <div className="spacer" />
        <div className="who">{user.email}</div>
        <form method="post" action="/api/auth/logout">
          <input type="hidden" name="csrf" value={csrfTokenFor(session)} />
          <button type="submit" className="logout">Cerrar sesión</button>
        </form>
      </nav>
      <main className="main">{children}</main>
    </div>
  );
}

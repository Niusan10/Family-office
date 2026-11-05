import type { ReactNode } from 'react';
import { requireSession } from '@/server/auth/require-session';
import { csrfTokenFor } from '@/server/auth/session';
import { NavLink } from '@/components/nav-link';

export const dynamic = 'force-dynamic';

export default async function PrivateLayout({ children }: { children: ReactNode }) {
  const { session, user } = await requireSession(); // Segunda barrera, independiente del proxy

  return (
    <div className="shell">
      <nav className="nav" aria-label="Principal">
        {/* eslint-disable-next-line @next/next/no-img-element -- servido tras la sesión, sin optimizador */}
        <img className="logo" src="/brand/nodriza-blanco.png" alt="Nodriza Tech" width={1266} height={150} />
        <NavLink href="/dashboard">Inicio</NavLink>
        {user.role === 'admin' && <NavLink href="/admin/usuarios">Emails autorizados</NavLink>}
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

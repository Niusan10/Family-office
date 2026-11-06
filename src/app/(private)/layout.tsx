import type { ReactNode } from 'react';
import { requireSession } from '@/server/auth/require-session';
import { csrfTokenFor } from '@/server/auth/session';
import { NavLink } from '@/components/nav-link';
import { NavShell } from '@/components/nav-shell';

export const dynamic = 'force-dynamic';

export default async function PrivateLayout({ children }: { children: ReactNode }) {
  const { session, user } = await requireSession(); // Segunda barrera, independiente del proxy

  return (
    <div className="shell">
      <NavShell
        logo={
          // eslint-disable-next-line @next/next/no-img-element -- servido tras la sesión, sin optimizador
          <img className="logo" src="/brand/nodriza-blanco.png" alt="Nodriza Tech" width={1266} height={150} />
        }
      >
        <NavLink href="/dashboard">Inicio</NavLink>
        <div className="spacer" />
        {user.role === 'admin' && (
          <NavLink href="/admin" className="nav-admin">
            <GearIcon />
            Admin
          </NavLink>
        )}
        <div className="who">{user.email}</div>
        <form method="post" action="/api/auth/logout">
          <input type="hidden" name="csrf" value={csrfTokenFor(session)} />
          <button type="submit" className="logout">Cerrar sesión</button>
        </form>
      </NavShell>
      <main className="main">{children}</main>
    </div>
  );
}

/** Rueda dentada (configuración). Hereda el color del enlace. */
function GearIcon() {
  return (
    <svg className="icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

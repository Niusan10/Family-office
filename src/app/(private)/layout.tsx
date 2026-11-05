import Link from 'next/link';
import type { ReactNode } from 'react';
import { requireSession } from '@/server/auth/require-session';
import { LogoutButton } from '@/components/logout-button';

export const dynamic = 'force-dynamic';

export default async function PrivateLayout({ children }: { children: ReactNode }) {
  const session = await requireSession(); // Segunda barrera, independiente del proxy

  return (
    <div className="shell">
      <nav className="nav" aria-label="Principal">
        <Link href="/dashboard">Inicio</Link>
        <Link href="/patrimonio">Patrimonio</Link>
        <Link href="/sociedades">Sociedades</Link>
        <Link href="/tesoreria">Tesorería</Link>
        <Link href="/inversiones">Inversiones</Link>
        <div className="spacer" />
        <div className="who">{session.email}</div>
        <LogoutButton />
      </nav>
      <main className="main">{children}</main>
    </div>
  );
}

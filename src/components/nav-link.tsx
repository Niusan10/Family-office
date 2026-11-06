'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

/** Enlace de menú que se marca cuando es la página actual (o una subpágina, salvo con `exact`). */
export function NavLink({ href, exact, children }: { href: string; exact?: boolean; children: ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || (!exact && pathname.startsWith(`${href}/`));
  return (
    <Link href={href} aria-current={active ? 'page' : undefined}>
      {children}
    </Link>
  );
}

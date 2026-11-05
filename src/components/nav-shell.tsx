'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

/**
 * Menú principal. En escritorio es la barra lateral; en móvil se convierte en una barra superior
 * con el logo y un botón ☰ que despliega las opciones. Se cierra al navegar o con Escape.
 */
export function NavShell({ logo, children }: { logo: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <nav className="nav" aria-label="Principal" data-open={open}>
      <div className="nav-head">
        {logo}
        <button
          type="button"
          className="menu-btn"
          aria-expanded={open}
          aria-controls="nav-body"
          aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
          onClick={() => setOpen((o) => !o)}
        >
          <span className="bars" aria-hidden="true" />
        </button>
      </div>
      <div className="nav-body" id="nav-body">
        {children}
      </div>
    </nav>
  );
}

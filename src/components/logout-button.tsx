'use client';

import { useState } from 'react';

function readCsrf(): string {
  const m = document.cookie.match(/(?:^|;\s*)__Host-fo_csrf=([^;]+)/);
  return m?.[1] ?? '';
}

export function LogoutButton() {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="logout"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'X-CSRF-Token': readCsrf() },
          credentials: 'same-origin',
        }).catch(() => null);
        window.location.replace('/login');
      }}
    >
      {busy ? 'Saliendo…' : 'Cerrar sesión'}
    </button>
  );
}

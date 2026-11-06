import { requireAdmin } from '@/server/auth/require-session';
import { csrfTokenFor } from '@/server/auth/session';
import { kvDel, kvGet } from '@/server/db/kv';
import { COMPANIES } from '@/server/holding/companies';
import { getValuations } from '@/server/holding/valuations';
import type { Flash } from '@/server/ui/flash';

export const dynamic = 'force-dynamic';

const num = (n: number | null | undefined) => (n === null || n === undefined ? '' : n.toLocaleString('es-ES'));

export default async function ValoracionesPage() {
  const { session } = await requireAdmin(); // también lo exige admin/layout.tsx
  const csrf = csrfTokenFor(session);
  const v = await getValuations();
  const flash = await kvGet<Flash>(`flash/${session.family}`);
  if (flash) await kvDel(`flash/${session.family}`);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <h1>Valoraciones</h1>
      <p className="lead">
        Equity value y enterprise value de cada empresa, en euros. Alimentan las gráficas de Inicio. Más adelante se
        calcularán solos con los cierres mensuales.
      </p>

      {flash && (
        <div className={`flash ${flash.kind}`} role="status">
          <p>{flash.text}</p>
        </div>
      )}

      <form method="post" action="/api/admin/valuations" className="panel val-form">
        <input type="hidden" name="csrf" value={csrf} />

        <label className="val-date">
          <span>Fecha de la valoración</span>
          <input type="date" name="asOf" required defaultValue={v?.asOf ?? today} />
        </label>

        <table className="val-table">
          <thead>
            <tr>
              <th>Empresa</th>
              <th>Equity value (€)</th>
              <th>Enterprise value (€)</th>
            </tr>
          </thead>
          <tbody>
            {COMPANIES.map((c) => (
              <tr key={c.slug}>
                <th scope="row">
                  <svg className="swatch" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                    <rect width="12" height="12" rx="3" fill={c.color} />
                  </svg>
                  {c.name}
                </th>
                <td data-label="Equity value (€)">
                  <input
                    name={`equity.${c.slug}`}
                    inputMode="decimal"
                    autoComplete="off"
                    maxLength={24}
                    placeholder="p. ej. 2.500.000"
                    defaultValue={num(v?.bySlug[c.slug]?.equity)}
                    aria-label={`Equity value de ${c.name}`}
                  />
                </td>
                <td data-label="Enterprise value (€)">
                  <input
                    name={`ev.${c.slug}`}
                    inputMode="decimal"
                    autoComplete="off"
                    maxLength={24}
                    placeholder="p. ej. 3.100.000"
                    defaultValue={num(v?.bySlug[c.slug]?.ev)}
                    aria-label={`Enterprise value de ${c.name}`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="val-hint">Admite 2.500.000 · 2.500.000,50 · 2,5M · 800k. Deja vacío lo que no tengas.</p>
        <button type="submit" className="primary">Guardar valoraciones</button>
      </form>
    </>
  );
}

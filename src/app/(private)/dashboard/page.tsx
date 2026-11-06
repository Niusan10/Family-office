import Link from 'next/link';
import { requireSession } from '@/server/auth/require-session';
import { COMPANIES } from '@/server/holding/companies';
import { getValuations, type CompanyValuation } from '@/server/holding/valuations';
import { DonutChart, type DonutSlice } from '@/components/donut-chart';

export const dynamic = 'force-dynamic';

const fecha = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

/** Dashboard: página de inicio tras el login, el "super dashboard" con lo importante del family office de un vistazo. */
export default async function Dashboard() {
  const { user } = await requireSession();
  const valuations = await getValuations();
  const isAdmin = user.role === 'admin';

  const slicesFor = (field: keyof CompanyValuation) => {
    const slices: DonutSlice[] = [];
    const missing: string[] = [];
    for (const c of COMPANIES) {
      const v = valuations?.bySlug[c.slug]?.[field];
      if (v === null || v === undefined) missing.push(c.name);
      else slices.push({ key: c.slug, label: c.name, value: v, color: c.color });
    }
    return { slices, missing };
  };

  const charts = [
    {
      id: 'equity',
      title: 'Valoración por equity value',
      help: 'Valor de los fondos propios de cada empresa: lo que vale para el accionista.',
      center: 'equity value',
      ...slicesFor('equity'),
    },
    {
      id: 'ev',
      title: 'Valoración por enterprise value',
      help: 'Valor del negocio completo: equity value más deuda financiera neta.',
      center: 'enterprise value',
      ...slicesFor('ev'),
    },
  ];

  return (
    <>
      <h1>Dashboard</h1>
      <p className="lead">
        Vacas lecheras del holding
        {valuations?.asOf ? ` · valoración a ${fecha(valuations.asOf)}` : ''}
      </p>

      <div className="dash-grid">
        {charts.map((ch) => (
          <section key={ch.id} className="panel chart-panel" aria-labelledby={`h-${ch.id}`}>
            <h2 id={`h-${ch.id}`}>{ch.title}</h2>
            <p className="chart-help">{ch.help}</p>
            {ch.slices.some((s) => s.value > 0) ? (
              <DonutChart title={ch.title} slices={ch.slices} centerLabel={ch.center} />
            ) : (
              <div className="empty">
                <p>Aún no hay valoraciones introducidas.</p>
                {isAdmin && (
                  <Link href="/admin/valoraciones" className="button-link">
                    Introducir valoraciones
                  </Link>
                )}
              </div>
            )}
            {ch.missing.length > 0 && ch.missing.length < COMPANIES.length && (
              <p className="chart-note">Sin valorar: {ch.missing.join(', ')}.</p>
            )}
          </section>
        ))}
      </div>

      {valuations && (
        <p className="dash-foot">
          Valoración introducida a mano por {valuations.updatedBy}.
          {isAdmin && (
            <>
              {' '}
              <Link href="/admin/valoraciones">Actualizar</Link>
            </>
          )}
        </p>
      )}
    </>
  );
}

import Link from 'next/link';
import { requireAdmin } from '@/server/auth/require-session';
import { csrfTokenFor } from '@/server/auth/session';
import { kvDel, kvGet } from '@/server/db/kv';
import { COMPANIES } from '@/server/holding/companies';
import { getOrg, ROOT_ID, type OrgEntity } from '@/server/holding/org';
import type { Flash } from '@/server/ui/flash';

export const dynamic = 'force-dynamic';

const NEW_ROWS = 3;
const pctValue = (n: number | null) => (n === null ? '' : n.toLocaleString('es-ES', { maximumFractionDigits: 4 }));
const colorOf = new Map(COMPANIES.map((c) => [c.slug, c.color]));

export default async function OrganigramaAdminPage() {
  const { session } = await requireAdmin(); // también lo exige admin/layout.tsx
  const csrf = csrfTokenFor(session);
  const org = await getOrg();
  const flash = await kvGet<Flash>(`flash/${session.family}`);
  if (flash) await kvDel(`flash/${session.family}`);

  const root = org.entities.find((e) => e.id === ROOT_ID)!;
  const middle = org.entities.filter((e) => e.kind === 'holding' || e.kind === 'other');
  const companies = org.entities.filter((e) => e.kind === 'company');

  const ParentSelect = ({ e, name, label }: { e?: OrgEntity; name: string; label: string }) => (
    <select name={name} defaultValue={e?.parentId ?? ROOT_ID} aria-label={label}>
      {org.entities
        .filter((p) => p.id !== e?.id && p.kind !== 'company')
        .map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
    </select>
  );

  const PctInput = ({ e, name, label }: { e?: OrgEntity; name: string; label: string }) => (
    <input
      name={name}
      inputMode="decimal"
      autoComplete="off"
      maxLength={10}
      placeholder="p. ej. 100"
      defaultValue={pctValue(e?.pct ?? null)}
      aria-label={label}
    />
  );

  return (
    <>
      <h1>Organigrama</h1>
      <p className="lead">
        De quién depende cada sociedad y qué porcentaje tiene. Se ve en <Link href="/organigrama">Organigrama</Link>.
      </p>

      {flash && (
        <div className={`flash ${flash.kind}`} role="status">
          <p>{flash.text}</p>
        </div>
      )}

      <form method="post" action="/api/admin/org" className="panel val-form">
        <input type="hidden" name="csrf" value={csrf} />

        <label className="val-date">
          <span>Nombre de la cima del organigrama</span>
          <input name={`name.${root.id}`} required maxLength={80} defaultValue={root.name} />
        </label>

        <h2 className="org-form-h">Sociedades intermedias y otras participadas</h2>
        <table className="val-table org-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Tipo</th>
              <th>Depende de</th>
              <th>% del padre</th>
              <th>Quitar</th>
            </tr>
          </thead>
          <tbody>
            {middle.map((e) => (
              <tr key={e.id}>
                <td data-label="Nombre">
                  <input name={`name.${e.id}`} required maxLength={80} defaultValue={e.name} aria-label="Nombre" />
                </td>
                <td data-label="Tipo">
                  <KindSelect name={`kind.${e.id}`} value={e.kind} />
                </td>
                <td data-label="Depende de">
                  <ParentSelect e={e} name={`parent.${e.id}`} label={`De quién depende ${e.name}`} />
                </td>
                <td data-label="% del padre">
                  <PctInput e={e} name={`pct.${e.id}`} label={`Porcentaje de ${e.name}`} />
                </td>
                <td data-label="Quitar">
                  <label className="org-del">
                    <input type="checkbox" name={`del.${e.id}`} value="1" /> <span>Quitar</span>
                  </label>
                </td>
              </tr>
            ))}
            {Array.from({ length: NEW_ROWS }, (_, i) => (
              <tr key={`new${i}`} className="org-new">
                <td data-label="Nueva sociedad">
                  <input name={`name.new${i}`} maxLength={80} placeholder="Nueva sociedad" aria-label="Nombre de la nueva sociedad" />
                </td>
                <td data-label="Tipo">
                  <KindSelect name={`kind.new${i}`} value="holding" />
                </td>
                <td data-label="Depende de">
                  <ParentSelect name={`parent.new${i}`} label="De quién depende la nueva sociedad" />
                </td>
                <td data-label="% del padre">
                  <PctInput name={`pct.new${i}`} label="Porcentaje de la nueva sociedad" />
                </td>
                <td />
              </tr>
            ))}
          </tbody>
        </table>

        <h2 className="org-form-h">Empresas operativas</h2>
        <table className="val-table org-table">
          <thead>
            <tr>
              <th>Empresa</th>
              <th>Depende de</th>
              <th>% del padre</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((e) => (
              <tr key={e.id}>
                <th scope="row">
                  <svg className="swatch" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                    <rect width="12" height="12" rx="3" fill={colorOf.get(e.id) ?? '#b5b5b5'} />
                  </svg>
                  {e.name}
                </th>
                <td data-label="Depende de">
                  <ParentSelect e={e} name={`parent.${e.id}`} label={`De quién depende ${e.name}`} />
                </td>
                <td data-label="% del padre">
                  <PctInput e={e} name={`pct.${e.id}`} label={`Porcentaje de ${e.name}`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="val-hint">
          Para colgar una empresa de una sociedad nueva, primero crea la sociedad y guarda; luego ya aparece en «Depende de».
          El % admite decimales (51,5). Deja vacío lo que no sepas.
        </p>
        <button type="submit" className="primary">Guardar organigrama</button>
      </form>
    </>
  );
}

function KindSelect({ name, value }: { name: string; value: string }) {
  return (
    <select name={name} defaultValue={value} aria-label="Tipo de sociedad">
      <option value="holding">Sociedad holding</option>
      <option value="other">Otra participada</option>
    </select>
  );
}

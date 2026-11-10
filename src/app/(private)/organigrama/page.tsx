import Link from 'next/link';
import { requireSession } from '@/server/auth/require-session';
import { buildTree, getOrg, KIND_LABEL, pctText, ROOT_ID, type OrgNode } from '@/server/holding/org';
import { getValuations } from '@/server/holding/valuations';
import { eurShort } from '@/components/donut-chart';

export const dynamic = 'force-dynamic';

const fecha = (ms: number) => new Date(ms).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

/** Organigrama societario del holding: árbol renderizado en el servidor, sin JavaScript. */
export default async function Organigrama() {
  const { user } = await requireSession();
  const [org, valuations] = await Promise.all([getOrg(), getValuations()]);
  const tree = buildTree(org);
  const isAdmin = user.role === 'admin';
  const missingPct = org.entities.filter((e) => e.id !== ROOT_ID && e.pct === null).length;

  return (
    <>
      <h1>Organigrama</h1>
      <p className="lead">Estructura societaria del holding: quién participa en quién y con qué porcentaje.</p>

      <section className="panel org-panel" aria-label="Organigrama del holding">
        <div className="org-scroll">
          <ul className="org-tree">
            <Node node={tree} equityBySlug={valuations?.bySlug ?? {}} parentName={null} />
          </ul>
        </div>
        <p className="org-legend">
          El porcentaje es la participación de la sociedad de arriba. «Efectiva» es lo que corresponde al family office
          sumando todo el camino.
        </p>
      </section>

      <p className="dash-foot">
        {missingPct > 0
          ? `Falta el porcentaje de ${missingPct} ${missingPct === 1 ? 'sociedad' : 'sociedades'}.`
          : org.updatedAt
            ? `Actualizado el ${fecha(org.updatedAt)} por ${org.updatedBy}.`
            : ''}
        {isAdmin && (
          <>
            {' '}
            <Link href="/admin/organigrama">Editar el organigrama</Link>
          </>
        )}
      </p>
    </>
  );
}

function Node({
  node,
  equityBySlug,
  parentName,
}: {
  node: OrgNode;
  equityBySlug: Record<string, { equity: number | null }>;
  parentName: string | null;
}) {
  const equity = node.kind === 'company' ? equityBySlug[node.id]?.equity ?? null : null;
  const showEffective = node.effective !== null && node.pct !== null && Math.abs(node.effective - node.pct) > 0.001;

  return (
    <li>
      <div className={`org-node kind-${node.kind}`}>
        {node.kind !== 'top' && (
          <svg className="org-bar" viewBox="0 0 10 4" preserveAspectRatio="none" aria-hidden="true">
            <rect width="10" height="4" fill={node.color ?? (node.kind === 'holding' ? '#424242' : '#b5b5b5')} />
          </svg>
        )}
        <span className="org-name">{node.name}</span>
        {node.name !== KIND_LABEL[node.kind] && <span className="org-kind">{KIND_LABEL[node.kind]}</span>}
        {parentName !== null && (
          <span
            className={node.pct === null ? 'org-pct missing' : 'org-pct'}
            title={node.pct === null ? 'Porcentaje sin definir' : `${pctText(node.pct)} en manos de ${parentName}`}
          >
            {node.pct === null ? 'Sin %' : pctText(node.pct)}
          </span>
        )}
        {showEffective && <span className="org-meta">Efectiva {pctText(node.effective!)}</span>}
        {equity !== null && <span className="org-meta">Equity {eurShort(equity)}</span>}
      </div>
      {node.children.length > 0 && (
        <ul>
          {node.children.map((c) => (
            <Node key={c.id} node={c} equityBySlug={equityBySlug} parentName={node.name} />
          ))}
        </ul>
      )}
    </li>
  );
}

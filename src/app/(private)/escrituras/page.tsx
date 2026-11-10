import { requireSession } from '@/server/auth/require-session';
import { csrfTokenFor } from '@/server/auth/session';
import { hasApiKey } from '@/server/escrituras/claude';
import { COMPANY_OPTIONS, listMetas, type EscrituraMeta } from '@/server/escrituras/store';
import { EscriturasChat } from '@/components/escrituras/chat';
import { EscrituraActions, UploadEscritura } from '@/components/escrituras/upload';
import { pdfHref } from '@/components/escrituras/links';

export const dynamic = 'force-dynamic';

const fecha = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

const STATUS: Record<EscrituraMeta['status'], { cls: string; text: string }> = {
  uploading: { cls: 'pending', text: 'Subida incompleta' },
  processing: { cls: 'pending', text: 'Procesando' },
  ready: { cls: 'ok', text: 'Lista' },
  error: { cls: 'pending', text: 'Error' },
};

/** Escrituras de todas las sociedades y chat para consultarlas. Suben los admins; consultan todos. */
export default async function Escrituras() {
  const { session, user } = await requireSession();
  const csrf = csrfTokenFor(session);
  const isAdmin = user.role === 'admin';
  const metas = await listMetas();
  const ready = metas.filter((m) => m.status === 'ready').length;
  const apiKey = hasApiKey();

  const groups = COMPANY_OPTIONS.map((c) => ({ ...c, items: metas.filter((m) => m.company === c.slug) })).filter((g) => g.items.length > 0);
  const companiesWithDocs = groups.map((g) => ({ slug: g.slug, name: g.name }));

  const disabled = !apiKey
    ? 'El chat aún no está activado: falta configurar la clave ANTHROPIC_API_KEY en Vercel.'
    : ready === 0
      ? 'Cuando haya alguna escritura subida y leída, podrás preguntar sobre ella aquí.'
      : null;

  return (
    <>
      <h1>Escrituras</h1>
      <p className="lead">
        Escrituras de todas las sociedades del holding. {ready} {ready === 1 ? 'escritura lista' : 'escrituras listas'} para consultar.
      </p>

      <EscriturasChat csrf={csrf} companies={companiesWithDocs} disabled={disabled} />

      {isAdmin && (apiKey ? (
        <UploadEscritura csrf={csrf} companies={COMPANY_OPTIONS.map((c) => ({ slug: c.slug, name: c.name }))} />
      ) : (
        <section className="panel">
          <h2>Subir escritura</h2>
          <p>Para subir escrituras hace falta la clave ANTHROPIC_API_KEY en Vercel: Claude lee cada PDF al subirlo.</p>
        </section>
      ))}

      {groups.length === 0 ? (
        <section className="panel">
          <div className="empty">
            <p>Todavía no hay escrituras subidas.</p>
          </div>
        </section>
      ) : (
        groups.map((g) => (
          <section key={g.slug} className="panel esc-group" aria-labelledby={`h-${g.slug}`}>
            <h2 id={`h-${g.slug}`}>
              <svg className="swatch" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                <rect width="12" height="12" rx="3" fill={g.color} />
              </svg>
              {g.name}
            </h2>
            <ul className="esc-list">
              {g.items.map((m) => (
                <li key={m.id}>
                  <div className="esc-main">
                    <a className="esc-title" href={pdfHref(m.id)} target="_blank" rel="noopener">
                      {m.title}
                    </a>
                    <span className="esc-ficha">
                      {[
                        m.index?.tipo,
                        m.index?.fecha && fecha(m.index.fecha),
                        m.index?.notario && `Notario: ${m.index.notario}`,
                        m.index?.protocolo && `Protocolo ${m.index.protocolo}`,
                        m.pages && `${m.pages} págs.`,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                    {m.index?.resumen && <span className="esc-resumen">{m.index.resumen}</span>}
                    {m.status === 'processing' && m.chunks ? (
                      <span className="esc-resumen">
                        Leído {Math.min(m.chunksDone * 4, m.pages ?? 0)} de {m.pages} páginas.
                      </span>
                    ) : null}
                    {m.error && <span className="esc-error">{m.error}</span>}
                  </div>
                  <div className="esc-side">
                    {m.status !== 'ready' && <span className={`badge ${STATUS[m.status].cls}`}>{STATUS[m.status].text}</span>}
                    {isAdmin && <EscrituraActions id={m.id} title={m.title} csrf={csrf} processing={m.status === 'processing'} />}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </>
  );
}

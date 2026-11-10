'use client';

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { pdfPageHref } from './links';

type Source = { n: number; id: string; title: string; page: number; quote: string };
type Answer = {
  segments: { text: string; refs: number[] }[];
  sources: Source[];
  consulted: { id: string; title: string }[];
  uncited: boolean;
};
type Msg = { role: 'user'; text: string } | { role: 'assistant'; answer: Answer } | { role: 'error'; text: string };

const EXAMPLES = [
  '¿Quiénes son los administradores de cada sociedad?',
  '¿Cuál es el capital social de TodoCESPED y cómo está repartido?',
  '¿Qué poderes hay otorgados y a quién?',
];

/** Quita el formato markdown que a veces añade el modelo (negritas, almohadillas). */
const clean = (s: string) => s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/^#{1,6}\s+/gm, '');

export function EscriturasChat({
  csrf,
  companies,
  disabled,
}: {
  csrf: string;
  companies: { slug: string; name: string }[];
  disabled: string | null;
}) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [question, setQuestion] = useState('');
  const [company, setCompany] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [msgs, loading]);

  const history = () => {
    const turns: { q: string; a: string }[] = [];
    msgs.forEach((m, i) => {
      const next = msgs[i + 1];
      if (m.role === 'user' && next?.role === 'assistant') {
        turns.push({ q: m.text, a: next.answer.segments.map((s) => s.text).join('') });
      }
    });
    return turns.slice(-4);
  };

  async function ask(q: string) {
    const text = q.trim();
    if (!text || loading) return;
    setQuestion('');
    setMsgs((m) => [...m, { role: 'user', text }]);
    setLoading(true);
    try {
      const res = await fetch('/api/escrituras/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-csrf-token': csrf },
        body: JSON.stringify({ question: text, history: history(), company: company || null }),
      });
      const data = (await res.json().catch(() => null)) as (Answer & { error?: string }) | null;
      if (!res.ok || !data || data.error) {
        setMsgs((m) => [...m, { role: 'error', text: data?.error ?? (res.status === 404 ? 'La sesión ha caducado. Recarga la página.' : 'No se ha podido responder.') }]);
      } else {
        setMsgs((m) => [...m, { role: 'assistant', answer: data }]);
      }
    } catch {
      setMsgs((m) => [...m, { role: 'error', text: 'Sin conexión. Vuelve a intentarlo.' }]);
    } finally {
      setLoading(false);
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void ask(question);
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void ask(question);
    }
  };

  return (
    <section className="panel esc-chat" aria-labelledby="h-chat">
      <div className="esc-chat-head">
        <h2 id="h-chat">Pregunta a las escrituras</h2>
        <label className="esc-filter">
          <span className="sr-only">Buscar en</span>
          <select value={company} onChange={(e) => setCompany(e.target.value)} disabled={loading}>
            <option value="">Todas las empresas</option>
            {companies.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="chat-help">
        Responde solo con lo que pone en las escrituras subidas, citando escritura y página. Si algo no aparece, lo dice.
      </p>

      {disabled ? (
        <div className="empty">
          <p>{disabled}</p>
        </div>
      ) : (
        <>
          <div className="esc-thread" aria-live="polite">
            {msgs.length === 0 && (
              <div className="esc-examples">
                {EXAMPLES.map((q) => (
                  <button key={q} type="button" onClick={() => void ask(q)}>
                    {q}
                  </button>
                ))}
              </div>
            )}
            {msgs.map((m, i) =>
              m.role === 'user' ? (
                <div key={i} className="esc-msg user">
                  {m.text}
                </div>
              ) : m.role === 'error' ? (
                <div key={i} className="esc-msg error" role="alert">
                  {m.text}
                </div>
              ) : (
                <AnswerView key={i} answer={m.answer} />
              ),
            )}
            {loading && (
              <div className="esc-msg bot loading">
                <span className="dots" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                Leyendo las escrituras…
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form className="esc-ask" onSubmit={onSubmit}>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={onKey}
              rows={2}
              maxLength={2000}
              placeholder="Escribe tu pregunta…"
              aria-label="Pregunta"
              disabled={loading}
            />
            <button type="submit" className="primary" disabled={loading || !question.trim()}>
              Preguntar
            </button>
          </form>
        </>
      )}
    </section>
  );
}

function AnswerView({ answer }: { answer: Answer }) {
  return (
    <div className="esc-msg bot">
      <div className="esc-answer">
        {answer.segments.map((s, i) => (
          <span key={i}>
            {clean(s.text)}
            {s.refs.map((n) => {
              const src = answer.sources.find((x) => x.n === n);
              return src ? (
                <a key={n} className="ref" href={pdfPageHref(src.id, src.page)} target="_blank" rel="noopener" title={`${src.title}, página ${src.page}`}>
                  {n}
                </a>
              ) : null;
            })}
          </span>
        ))}
      </div>

      {answer.uncited && (
        <p className="esc-warn">Esta respuesta no trae citas de las escrituras: compruébala antes de fiarte de ella.</p>
      )}

      {answer.sources.length > 0 && (
        <ol className="esc-sources">
          {answer.sources.map((s) => (
            <li key={s.n}>
              <a href={pdfPageHref(s.id, s.page)} target="_blank" rel="noopener">
                <span className="ref">{s.n}</span>
                <strong>{s.title}</strong> · página {s.page}
              </a>
              <q>{s.quote}</q>
            </li>
          ))}
        </ol>
      )}

      {answer.consulted.length > 0 && (
        <p className="esc-consulted">
          Consultadas: {answer.consulted.map((c) => c.title).join(' · ')}
        </p>
      )}
    </div>
  );
}

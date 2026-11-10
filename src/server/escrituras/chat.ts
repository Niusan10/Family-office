import 'server-only';
import { callClaude, MODEL_FAST, MODEL_MAIN, parseJsonObject, textOf, type Citation } from './claude';
import { companyName, getAllPages, listMetas, type EscrituraMeta } from './store';

/**
 * Chat sobre las escrituras. Para que no divague ni se invente nada:
 * - Claude solo recibe el texto literal de las escrituras (página a página) y nada más.
 * - Se activan las citas de la API: cada afirmación va ligada al fragmento exacto y a su página.
 * - temperature 0 y unas instrucciones que prohíben usar conocimiento propio.
 * - Si la respuesta no trae ninguna cita, se marca para que el usuario la verifique.
 */
export const NOT_FOUND = 'No encuentro esa información en las escrituras subidas.';

/** Unos 110.000 tokens de texto: margen de sobra para la respuesta. */
const MAX_CHARS = 360_000;

const SYSTEM = `Eres el asistente de consulta de las escrituras notariales de las sociedades de un family office.

Reglas obligatorias:
1. Responde ÚNICAMENTE con lo que dicen los documentos que se te proporcionan. No uses conocimientos propios, no supongas y no completes huecos.
2. Respalda cada dato con una cita de la escritura donde aparece.
3. Si la respuesta no está en los documentos, responde exactamente: "${NOT_FOUND}" y no añadas nada más.
4. Si la información está solo en parte, da esa parte con su cita y di claramente qué no aparece.
5. Si dos escrituras dicen cosas distintas (p. ej. una posterior modifica a otra), muestra ambas con su fecha, sin decidir tú cuál prevalece.
6. No des opiniones, consejos ni interpretaciones jurídicas más allá de lo que dice el texto.
7. Responde en español, breve y directo, sin introducciones ni despedidas. Copia cifras, nombres, fechas y porcentajes tal cual aparecen.`;

export type ChatTurn = { q: string; a: string };
export type ChatSource = { n: number; id: string; title: string; page: number; quote: string };
export type ChatAnswer = {
  segments: { text: string; refs: number[] }[];
  sources: ChatSource[];
  consulted: { id: string; title: string }[];
  uncited: boolean;
};

export async function askEscrituras(question: string, history: ChatTurn[], company: string | null): Promise<ChatAnswer> {
  const ready = (await listMetas()).filter((m) => m.status === 'ready' && (!company || m.company === company));
  if (ready.length === 0) {
    return { segments: [{ text: 'Todavía no hay escrituras procesadas para consultar.', refs: [] }], sources: [], consulted: [], uncited: false };
  }

  const docs = await Promise.all(ready.map(async (m) => ({ meta: m, pages: await getAllPages(m) })));
  const size = (d: { pages: string[] }) => d.pages.reduce((s, p) => s + p.length, 0);
  const total = docs.reduce((s, d) => s + size(d), 0);

  // Si todas caben, van todas. Si no, primero se eligen las relevantes a partir de sus fichas.
  let chosen = docs;
  if (total > MAX_CHARS) {
    const order = await rankByIndex(question, history, ready);
    chosen = [];
    let used = 0;
    for (const id of order) {
      const d = docs.find((x) => x.meta.id === id);
      if (!d || used + size(d) > MAX_CHARS) continue;
      chosen.push(d);
      used += size(d);
    }
    if (chosen.length === 0) chosen = [docs[0]!];
  }

  const documents = chosen.map((d, i) => ({
    type: 'document',
    title: `${d.meta.title} · ${companyName(d.meta.company)}`,
    context: fichaText(d.meta),
    source: { type: 'content', content: d.pages.map((p) => ({ type: 'text', text: p.trim() || '[página sin texto]' })) },
    citations: { enabled: true },
    ...(i === chosen.length - 1 ? { cache_control: { type: 'ephemeral' } } : {}),
  }));

  const prev = history
    .slice(-4)
    .map((t) => `Pregunta anterior: ${t.q}\nRespuesta anterior: ${t.a}`)
    .join('\n\n');

  const res = await callClaude({
    model: MODEL_MAIN,
    max_tokens: 2500,
    temperature: 0,
    system: SYSTEM,
    messages: [
      {
        role: 'user',
        content: [
          ...documents,
          {
            type: 'text',
            text: `${prev ? `Contexto de la conversación (solo para entender la pregunta; no es una fuente):\n${prev}\n\n` : ''}Pregunta: ${question}`,
          },
        ],
      },
    ],
  });

  const sources: ChatSource[] = [];
  const segments: ChatAnswer['segments'] = [];
  for (const block of res.content) {
    if (block.type !== 'text' || !block.text) continue;
    const refs = (block.citations ?? []).map((c) => sourceNumber(sources, c, chosen)).filter((n): n is number => n !== null);
    segments.push({ text: block.text, refs: [...new Set(refs)] });
  }

  const plain = segments.map((s) => s.text).join('').trim();
  return {
    segments,
    sources,
    consulted: chosen.map((d) => ({ id: d.meta.id, title: d.meta.title })),
    uncited: sources.length === 0 && !plain.startsWith(NOT_FOUND.slice(0, 30)),
  };
}

function sourceNumber(sources: ChatSource[], c: Citation, chosen: { meta: EscrituraMeta }[]): number | null {
  const doc = chosen[c.document_index];
  if (!doc) return null;
  const page = (c.start_block_index ?? (c.start_page_number ? c.start_page_number - 1 : 0)) + 1;
  const quote = c.cited_text.trim();
  const found = sources.find((s) => s.id === doc.meta.id && s.page === page && s.quote === quote);
  if (found) return found.n;
  const n = sources.length + 1;
  sources.push({ n, id: doc.meta.id, title: doc.meta.title, page, quote });
  return n;
}

function fichaText(m: EscrituraMeta): string {
  const i = m.index;
  return [
    `Sociedad: ${companyName(m.company)}`,
    i?.tipo && `Tipo de acto: ${i.tipo}`,
    i?.fecha && `Fecha: ${i.fecha}`,
    i?.notario && `Notario: ${i.notario}`,
    i?.protocolo && `Protocolo: ${i.protocolo}`,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** Ordena las escrituras por relevancia para la pregunta usando solo sus fichas. */
async function rankByIndex(question: string, history: ChatTurn[], metas: EscrituraMeta[]): Promise<string[]> {
  const list = metas
    .map((m) => `- id=${m.id} | ${m.title} | ${fichaText(m)} | ${m.index?.resumen ?? ''}`)
    .join('\n');
  const prev = history.slice(-2).map((t) => t.q).join(' / ');
  const res = await callClaude({
    model: MODEL_FAST,
    max_tokens: 400,
    temperature: 0,
    messages: [
      {
        role: 'user',
        content: `Estas son las fichas de unas escrituras notariales:\n${list}\n\n${prev ? `Preguntas anteriores: ${prev}\n` : ''}Pregunta: ${question}\n\nDevuelve solo un JSON {"ids": [...]} con los id de las escrituras que pueden contener la respuesta, de más a menos relevante. Incluye todas las que puedan servir.`,
      },
    ],
  });
  const ids = parseJsonObject<{ ids?: unknown }>(textOf(res))?.ids;
  const valid = Array.isArray(ids) ? ids.map(String).filter((id) => metas.some((m) => m.id === id)) : [];
  // Las no elegidas van detrás, por si queda sitio.
  return [...valid, ...metas.map((m) => m.id).filter((id) => !valid.includes(id))];
}

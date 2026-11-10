import 'server-only';
import { PDFDocument } from 'pdf-lib';
import { callClaude, ClaudeError, MODEL_FAST, MODEL_MAIN, parseJsonObject, textOf } from './claude';
import {
  CHUNK_PAGES,
  getAllPages,
  getChunk,
  putChunk,
  putPages,
  readOriginal,
  saveMeta,
  type EscrituraIndex,
  type EscrituraMeta,
} from './store';

/**
 * Procesa una escritura un paso cada vez, para no pasar del tiempo máximo de una función de Vercel
 * ni del límite de uso de la API. El navegador del admin va llamando hasta que queda "ready";
 * si se cierra la pestaña, se puede reanudar donde se quedó.
 *
 *  1. Trocear el PDF en grupos de CHUNK_PAGES páginas.
 *  2. Transcribir literalmente cada grupo (vale para PDF escaneados y digitales).
 *  3. Ficha: tipo de acto, fecha, notario, protocolo, sociedades y resumen.
 */
export async function processStep(meta: EscrituraMeta): Promise<EscrituraMeta> {
  try {
    if (meta.status === 'ready' || meta.status === 'error') return meta;
    if (meta.chunks === null) return await split(meta);
    if (meta.chunksDone < meta.chunks) return await transcribe(meta);
    return await buildIndex(meta);
  } catch (e) {
    if (e instanceof ClaudeError) return fail(meta, e.message);
    throw e; // ClaudeBusyError y fallos transitorios: el navegador reintenta
  }
}

async function fail(meta: EscrituraMeta, error: string) {
  const m = { ...meta, status: 'error' as const, error };
  await saveMeta(m);
  return m;
}

async function split(meta: EscrituraMeta): Promise<EscrituraMeta> {
  const bytes = await readOriginal(meta);
  if (!bytes) return fail(meta, 'No se encuentra el fichero subido. Bórrala y vuelve a subirla.');

  let src: PDFDocument;
  try {
    src = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  } catch {
    return fail(meta, 'El fichero no es un PDF válido o está protegido con contraseña.');
  }

  const total = src.getPageCount();
  if (total === 0) return fail(meta, 'El PDF no tiene páginas.');
  const chunks = Math.ceil(total / CHUNK_PAGES);

  for (let c = 0; c < chunks; c++) {
    const out = await PDFDocument.create();
    const indices = Array.from({ length: Math.min(CHUNK_PAGES, total - c * CHUNK_PAGES) }, (_, i) => c * CHUNK_PAGES + i);
    const pages = await out.copyPages(src, indices);
    pages.forEach((p) => out.addPage(p));
    await putChunk(meta.id, c, Buffer.from(await out.save()));
  }

  const m: EscrituraMeta = { ...meta, status: 'processing', pages: total, chunks, chunksDone: 0, error: null };
  await saveMeta(m);
  return m;
}

const TRANSCRIBE_PROMPT = (first: number, last: number) => `Este PDF es un fragmento (páginas ${first} a ${last}) de una escritura notarial española.

Transcribe LITERALMENTE el texto de cada página, de principio a fin:
- No resumas, no corrijas, no reordenes, no traduzcas y no añadas nada tuyo.
- Respeta exactamente nombres, DNI/NIF, cifras, importes, fechas, porcentajes y números de protocolo.
- Si una palabra no se puede leer, escribe [ilegible]. Si una página está en blanco, escribe [página en blanco].
- Sellos, firmas y notas al margen: transcribe su texto si se lee, o indica [sello], [firma].
- Antes de cada página escribe una línea exactamente así: ===PÁGINA n=== (n empieza en ${first}).

Devuelve solo la transcripción, sin comentarios.`;

async function transcribe(meta: EscrituraMeta): Promise<EscrituraMeta> {
  const c = meta.chunksDone;
  const pdf = await getChunk(meta.id, c);
  if (!pdf) return fail(meta, 'Falta un trozo del PDF. Bórrala y vuelve a subirla.');

  const first = c * CHUNK_PAGES + 1;
  const count = Math.min(CHUNK_PAGES, (meta.pages ?? 0) - c * CHUNK_PAGES);
  const last = first + count - 1;

  const res = await callClaude({
    model: MODEL_MAIN,
    max_tokens: 16000,
    temperature: 0,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdf.toString('base64') } },
          { type: 'text', text: TRANSCRIBE_PROMPT(first, last) },
        ],
      },
    ],
  });

  await putPages(meta.id, c, splitPages(textOf(res), first, count));
  const m: EscrituraMeta = { ...meta, chunksDone: c + 1 };
  await saveMeta(m);
  return m;
}

/** Reparte la transcripción por los marcadores ===PÁGINA n===. Siempre devuelve `count` páginas. */
function splitPages(text: string, first: number, count: number): string[] {
  const pages: string[] = Array.from({ length: count }, () => '');
  const re = /===\s*P[ÁA]GINA\s+(\d+)\s*===/gi;
  const marks = [...text.matchAll(re)];
  if (marks.length === 0) {
    pages[0] = text.trim();
    return pages;
  }
  marks.forEach((m, i) => {
    const n = Number(m[1]) - first;
    const start = m.index! + m[0].length;
    const end = i + 1 < marks.length ? marks[i + 1]!.index! : text.length;
    if (n >= 0 && n < count) pages[n] = `${pages[n]}\n${text.slice(start, end)}`.trim();
  });
  return pages;
}

const INDEX_PROMPT = `A partir SOLO del texto de esta escritura notarial, rellena esta ficha en JSON:
{"tipo": "tipo de acto (p. ej. constitución, ampliación de capital, compraventa de participaciones, nombramiento de administrador, poder)",
 "fecha": "AAAA-MM-DD del otorgamiento",
 "notario": "nombre del notario",
 "protocolo": "número de protocolo",
 "sociedades": ["sociedades que aparecen como parte o afectadas"],
 "resumen": "2 o 3 frases con lo que se acuerda u otorga, sin interpretar"}
Si un dato no aparece en el texto, pon null (o [] en sociedades). No inventes nada. Devuelve solo el JSON.`;

async function buildIndex(meta: EscrituraMeta): Promise<EscrituraMeta> {
  const pages = await getAllPages(meta);
  const text = pages.map((p, i) => `--- Página ${i + 1} ---\n${p}`).join('\n\n');
  // La ficha sale casi siempre del principio (comparecencia, otorgamiento) y del final (fecha, firma).
  const excerpt = text.length > 120_000 ? `${text.slice(0, 90_000)}\n[…]\n${text.slice(-30_000)}` : text;

  const res = await callClaude({
    model: MODEL_FAST,
    max_tokens: 1500,
    temperature: 0,
    messages: [{ role: 'user', content: `${INDEX_PROMPT}\n\n<escritura>\n${excerpt}\n</escritura>` }],
  });

  const raw = parseJsonObject<Partial<EscrituraIndex>>(textOf(res)) ?? {};
  const str = (v: unknown) => (typeof v === 'string' && v.trim() && v.trim() !== 'null' ? v.trim().slice(0, 400) : null);
  const index: EscrituraIndex = {
    tipo: str(raw.tipo),
    fecha: str(raw.fecha) && /^\d{4}-\d{2}-\d{2}$/.test(String(raw.fecha)) ? String(raw.fecha) : null,
    notario: str(raw.notario),
    protocolo: str(raw.protocolo),
    sociedades: Array.isArray(raw.sociedades) ? raw.sociedades.map(str).filter((s): s is string => Boolean(s)).slice(0, 10) : [],
    resumen: str(raw.resumen),
  };

  const m: EscrituraMeta = { ...meta, status: 'ready', index, error: null };
  await saveMeta(m);
  return m;
}

import 'server-only';

/**
 * Llamadas a la API de Claude (Anthropic) con fetch, sin SDK. La clave va en la variable
 * ANTHROPIC_API_KEY de Vercel y nunca sale del servidor. Si falta, la sección Escrituras lo avisa
 * y el resto de la app sigue funcionando.
 */
export const MODEL_MAIN = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
export const MODEL_FAST = process.env.ANTHROPIC_MODEL_FAST || 'claude-haiku-5-5';

export const hasApiKey = () => Boolean(process.env.ANTHROPIC_API_KEY);

/** La API está saturada o hemos llegado al límite de uso: hay que reintentar más tarde. */
export class ClaudeBusyError extends Error {
  constructor(public retryAfter: number) {
    super('claude_busy');
  }
}

export class ClaudeError extends Error {}

export type Citation = {
  type: string;
  cited_text: string;
  document_index: number;
  document_title?: string | null;
  start_block_index?: number;
  end_block_index?: number;
  start_page_number?: number;
  end_page_number?: number;
};

export type ContentBlock = { type: string; text?: string; citations?: Citation[] | null };

export type ClaudeResponse = { content: ContentBlock[]; stop_reason: string };

export async function callClaude(body: Record<string, unknown>): Promise<ClaudeResponse> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new ClaudeError('Falta la clave ANTHROPIC_API_KEY en Vercel.');

  let res: Response;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ClaudeBusyError(10);
  }

  if (res.status === 429 || res.status === 529 || res.status >= 500) {
    const after = Number(res.headers.get('retry-after'));
    throw new ClaudeBusyError(Number.isFinite(after) && after > 0 ? Math.min(after, 120) : 20);
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error(JSON.stringify({ event: 'claude.error', status: res.status, detail: detail.slice(0, 500) }));
    if (res.status === 401) throw new ClaudeError('La clave ANTHROPIC_API_KEY no es válida.');
    if (res.status === 400 && /credit balance/i.test(detail)) throw new ClaudeError('La cuenta de Anthropic no tiene saldo.');
    throw new ClaudeError(`La API de Claude ha rechazado la petición (${res.status}).`);
  }
  return (await res.json()) as ClaudeResponse;
}

export const textOf = (r: ClaudeResponse) =>
  r.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('');

/** Saca el primer objeto JSON de un texto (por si el modelo lo envuelve en ```json). */
export function parseJsonObject<T>(text: string): T | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

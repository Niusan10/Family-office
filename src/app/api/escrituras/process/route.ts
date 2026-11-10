import { NextResponse, type NextRequest } from 'next/server';
import { apiActor } from '@/server/escrituras/api-auth';
import { ClaudeBusyError, hasApiKey } from '@/server/escrituras/claude';
import { processStep } from '@/server/escrituras/process';
import { getMeta } from '@/server/escrituras/store';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Avanza un paso el procesado de una escritura (?id=…). El navegador repite hasta "ready". */
export async function POST(req: NextRequest) {
  const actor = await apiActor(req, { admin: true });
  if (!actor) return new NextResponse(null, { status: 404 });
  if (!hasApiKey()) return NextResponse.json({ error: 'Falta configurar la clave ANTHROPIC_API_KEY en Vercel.' }, { status: 400 });

  const meta = await getMeta(req.nextUrl.searchParams.get('id') ?? '');
  if (!meta || meta.status === 'uploading') return NextResponse.json({ error: 'Escritura no encontrada.' }, { status: 404 });

  try {
    const m = await processStep(meta);
    return NextResponse.json({ status: m.status, done: m.chunksDone, total: m.chunks, pages: m.pages, error: m.error });
  } catch (e) {
    const wait = e instanceof ClaudeBusyError ? e.retryAfter : 15;
    console.error(JSON.stringify({ event: 'escritura.process_retry', id: meta.id, error: String(e).slice(0, 300) }));
    return NextResponse.json({ retryAfter: wait }, { status: 503 });
  }
}

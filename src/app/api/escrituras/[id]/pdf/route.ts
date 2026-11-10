import { NextResponse, type NextRequest } from 'next/server';
import { rawGet } from '@/server/db/kv';
import { apiActor } from '@/server/escrituras/api-auth';
import { CHUNK_PAGES, getChunk, getMeta } from '@/server/escrituras/store';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * PDF de una escritura para cualquier usuario con sesión.
 * - Sin parámetros: el original completo, en streaming (puede pasar de 4,5 MB).
 * - Con ?p=N: solo el grupo de páginas que contiene la página N (lo que enlazan las citas del chat).
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const actor = await apiActor(req, { csrf: false });
  if (!actor) return new NextResponse(null, { status: 404 });
  const meta = await getMeta((await ctx.params).id);
  if (!meta || meta.status === 'uploading') return new NextResponse(null, { status: 404 });

  const ascii = meta.fileName.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '');
  const headers = {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(meta.fileName)}`,
  };

  const p = Number(req.nextUrl.searchParams.get('p'));
  if (Number.isInteger(p) && p >= 1 && meta.chunks && meta.pages && p <= meta.pages) {
    const chunk = await getChunk(meta.id, Math.floor((p - 1) / CHUNK_PAGES));
    if (chunk) return new NextResponse(new Uint8Array(chunk), { headers: { ...headers, 'Content-Length': String(chunk.length) } });
  }

  let n = 0;
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (n >= meta.parts) return controller.close();
      const part = await rawGet(`escrituras/${meta.id}/part-${String(n).padStart(3, '0')}.bin`);
      n++;
      if (!part) return controller.error(new Error('missing_part'));
      controller.enqueue(new Uint8Array(part));
    },
  });
  return new NextResponse(stream, { headers: { ...headers, 'Content-Length': String(meta.size) } });
}

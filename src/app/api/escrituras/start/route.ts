import { NextResponse, type NextRequest } from 'next/server';
import { apiActor } from '@/server/escrituras/api-auth';
import { COMPANY_OPTIONS, MAX_FILE_BYTES, PART_BYTES, saveMeta, type EscrituraMeta } from '@/server/escrituras/store';
import { randomToken } from '@/server/security/crypto';

export const dynamic = 'force-dynamic';

/** Da de alta una escritura antes de subir sus trozos. Solo administradores. */
export async function POST(req: NextRequest) {
  const actor = await apiActor(req, { admin: true });
  if (!actor) return new NextResponse(null, { status: 404 });

  const body = (await req.json().catch(() => null)) as { title?: unknown; company?: unknown; fileName?: unknown; size?: unknown } | null;
  const size = Number(body?.size);
  const company = String(body?.company ?? '');
  const fileName = String(body?.fileName ?? '').replace(/[^\p{L}\p{N} ._()-]/gu, '').slice(0, 120) || 'escritura.pdf';
  const title = String(body?.title ?? '').replace(/\s+/g, ' ').trim().slice(0, 140) || fileName.replace(/\.pdf$/i, '');

  if (!COMPANY_OPTIONS.some((c) => c.slug === company)) return NextResponse.json({ error: 'Elige la empresa.' }, { status: 400 });
  if (!Number.isInteger(size) || size <= 0) return NextResponse.json({ error: 'Fichero vacío.' }, { status: 400 });
  if (size > MAX_FILE_BYTES) return NextResponse.json({ error: 'El PDF pesa más de 80 MB.' }, { status: 400 });

  const meta: EscrituraMeta = {
    id: `e${randomToken(12).toLowerCase().replace(/[^a-z0-9]/g, '')}`.slice(0, 20).padEnd(12, '0'),
    title,
    company,
    fileName,
    size,
    parts: Math.ceil(size / PART_BYTES),
    status: 'uploading',
    pages: null,
    chunks: null,
    chunksDone: 0,
    error: null,
    index: null,
    uploadedBy: actor.user.email,
    uploadedAt: Date.now(),
  };
  await saveMeta(meta);
  return NextResponse.json({ id: meta.id, parts: meta.parts, partBytes: PART_BYTES });
}

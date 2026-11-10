import { NextResponse, type NextRequest } from 'next/server';
import { apiActor } from '@/server/escrituras/api-auth';
import { getMeta, PART_BYTES, putPart, saveMeta } from '@/server/escrituras/store';
import { audit } from '@/server/security/audit';
import { clientIp } from '@/server/security/rate-limit';

export const dynamic = 'force-dynamic';

/** Recibe un trozo del PDF (?id=…&n=…). Al llegar el último, la escritura pasa a "processing". */
export async function POST(req: NextRequest) {
  const actor = await apiActor(req, { admin: true });
  if (!actor) return new NextResponse(null, { status: 404 });

  const id = req.nextUrl.searchParams.get('id') ?? '';
  const n = Number(req.nextUrl.searchParams.get('n'));
  const meta = await getMeta(id);
  if (!meta || meta.status !== 'uploading' || !Number.isInteger(n) || n < 0 || n >= meta.parts) {
    return NextResponse.json({ error: 'Subida no válida.' }, { status: 400 });
  }

  const data = Buffer.from(await req.arrayBuffer());
  const expected = n < meta.parts - 1 ? PART_BYTES : meta.size - PART_BYTES * (meta.parts - 1);
  if (data.length !== expected) return NextResponse.json({ error: 'Trozo incompleto.' }, { status: 400 });
  if (n === 0 && data.subarray(0, 5).toString('latin1') !== '%PDF-') {
    return NextResponse.json({ error: 'El fichero no es un PDF.' }, { status: 400 });
  }

  await putPart(meta.id, n, data);
  if (n === meta.parts - 1) {
    await saveMeta({ ...meta, status: 'processing' });
    await audit({ event: 'escritura.uploaded', by: actor.user.email, ip: clientIp(req), reason: meta.id });
  }
  return NextResponse.json({ ok: true });
}

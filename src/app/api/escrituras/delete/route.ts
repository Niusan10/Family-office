import { NextResponse, type NextRequest } from 'next/server';
import { apiActor } from '@/server/escrituras/api-auth';
import { deleteEscritura, getMeta } from '@/server/escrituras/store';
import { audit } from '@/server/security/audit';
import { clientIp } from '@/server/security/rate-limit';

export const dynamic = 'force-dynamic';

/** Borra una escritura con todos sus ficheros (?id=…). Solo administradores. */
export async function POST(req: NextRequest) {
  const actor = await apiActor(req, { admin: true });
  if (!actor) return new NextResponse(null, { status: 404 });
  const meta = await getMeta(req.nextUrl.searchParams.get('id') ?? '');
  if (!meta) return NextResponse.json({ error: 'Escritura no encontrada.' }, { status: 404 });
  await deleteEscritura(meta.id);
  await audit({ event: 'escritura.deleted', by: actor.user.email, ip: clientIp(req), reason: `${meta.id} ${meta.title}`.slice(0, 160) });
  return NextResponse.json({ ok: true });
}

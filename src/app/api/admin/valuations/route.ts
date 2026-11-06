import { NextResponse, type NextRequest } from 'next/server';
import { readSession, SESSION_COOKIE } from '@/server/auth/session';
import { verifyCsrfToken } from '@/server/auth/csrf';
import { getUser } from '@/server/auth/users';
import { kvSet } from '@/server/db/kv';
import { COMPANIES } from '@/server/holding/companies';
import { parseEuros, saveValuations, type CompanyValuation } from '@/server/holding/valuations';
import { audit } from '@/server/security/audit';
import { clientIp } from '@/server/security/rate-limit';
import type { Flash } from '@/server/ui/flash';

export const dynamic = 'force-dynamic';

/** Guarda las valoraciones de las empresas. Solo administradores, con sesión, Origin (proxy) y token CSRF. */
export async function POST(req: NextRequest) {
  const session = await readSession(req.cookies.get(SESSION_COOKIE)?.value);
  const actor = session ? await getUser(session.email) : null;
  const form = await req.formData().catch(() => null);
  if (!session || !actor || actor.role !== 'admin' || !form || !verifyCsrfToken(String(form.get('csrf') ?? ''), session)) {
    return new NextResponse(null, { status: 404 });
  }

  const asOf = String(form.get('asOf') ?? '');
  const bySlug: Record<string, CompanyValuation> = {};
  const errors: string[] = [];

  for (const c of COMPANIES) {
    const equity = parseEuros(String(form.get(`equity.${c.slug}`) ?? ''));
    const ev = parseEuros(String(form.get(`ev.${c.slug}`) ?? ''));
    if (equity === undefined) errors.push(`equity value de ${c.name}`);
    if (ev === undefined) errors.push(`enterprise value de ${c.name}`);
    bySlug[c.slug] = { equity: equity ?? null, ev: ev ?? null };
  }

  let flash: Flash;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf) || Number.isNaN(Date.parse(asOf))) {
    flash = { kind: 'err', text: 'La fecha de la valoración no es válida.' };
  } else if (errors.length) {
    flash = { kind: 'err', text: `No se ha guardado nada. Revisa: ${errors.join(', ')}.` };
  } else {
    await saveValuations({ bySlug, asOf, updatedBy: actor.email });
    await audit({ event: 'valuation.updated', by: actor.email, ip: clientIp(req), reason: asOf });
    flash = { kind: 'ok', text: 'Valoraciones guardadas. Ya se ven en Inicio.' };
  }

  await kvSet(`flash/${session.family}`, flash, { ttl: 600 });
  return NextResponse.redirect(new URL('/admin/valoraciones', req.url), 303);
}

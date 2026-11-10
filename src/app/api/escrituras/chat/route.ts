import { NextResponse, type NextRequest } from 'next/server';
import { apiActor } from '@/server/escrituras/api-auth';
import { askEscrituras, type ChatTurn } from '@/server/escrituras/chat';
import { ClaudeBusyError, ClaudeError, hasApiKey } from '@/server/escrituras/claude';
import { COMPANY_OPTIONS } from '@/server/escrituras/store';
import { audit } from '@/server/security/audit';
import { clientIp, rateLimit } from '@/server/security/rate-limit';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Pregunta sobre las escrituras. Cualquier usuario con sesión. */
export async function POST(req: NextRequest) {
  const actor = await apiActor(req);
  if (!actor) return new NextResponse(null, { status: 404 });
  if (!hasApiKey()) return NextResponse.json({ error: 'Falta configurar la clave ANTHROPIC_API_KEY en Vercel.' }, { status: 400 });
  if (!(await rateLimit(`chat:${actor.user.email}`, 60, 3600))) {
    return NextResponse.json({ error: 'Demasiadas preguntas en una hora. Espera un poco.' }, { status: 429 });
  }

  const body = (await req.json().catch(() => null)) as { question?: unknown; history?: unknown; company?: unknown } | null;
  const question = String(body?.question ?? '').trim().slice(0, 2000);
  if (!question) return NextResponse.json({ error: 'Escribe una pregunta.' }, { status: 400 });
  const company = COMPANY_OPTIONS.some((c) => c.slug === body?.company) ? String(body!.company) : null;
  const history: ChatTurn[] = Array.isArray(body?.history)
    ? (body!.history as unknown[])
        .slice(-4)
        .map((t) => t as { q?: unknown; a?: unknown })
        .map((t) => ({ q: String(t.q ?? '').slice(0, 2000), a: String(t.a ?? '').slice(0, 4000) }))
    : [];

  try {
    const answer = await askEscrituras(question, history, company);
    await audit({ event: 'escritura.question', by: actor.user.email, ip: clientIp(req) });
    return NextResponse.json(answer);
  } catch (e) {
    if (e instanceof ClaudeBusyError) return NextResponse.json({ error: 'Claude está saturado ahora mismo. Vuelve a preguntar en unos segundos.' }, { status: 503 });
    if (e instanceof ClaudeError) return NextResponse.json({ error: e.message }, { status: 502 });
    console.error(JSON.stringify({ event: 'escritura.chat_error', error: String(e).slice(0, 300) }));
    return NextResponse.json({ error: 'No se ha podido responder. Inténtalo de nuevo.' }, { status: 500 });
  }
}

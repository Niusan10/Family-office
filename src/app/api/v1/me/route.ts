import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { readSession, SESSION_COOKIE } from '@/server/auth/session';

export const dynamic = 'force-dynamic';

// Ejemplo de API privada: el proxy exige sesión y aquí se vuelve a comprobar (defensa en profundidad).
export async function GET() {
  const session = await readSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) return new NextResponse(null, { status: 401 });
  return NextResponse.json({ email: session.email });
}

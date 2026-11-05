import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const dynamic = 'force-static';

// Fuentes para las páginas públicas sin JavaScript (login y activación), que no cargan /_next.
// Lista cerrada: cualquier otro nombre responde 404.
const FILES: Record<string, string> = {
  'ubuntu-300.woff2': 'ubuntu-latin-300-normal.woff2',
  'ubuntu-400.woff2': 'ubuntu-latin-400-normal.woff2',
  'ubuntu-500.woff2': 'ubuntu-latin-500-normal.woff2',
  'ubuntu-700.woff2': 'ubuntu-latin-700-normal.woff2',
};

export function generateStaticParams() {
  return Object.keys(FILES).map((file) => ({ file }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const source = FILES[(await params).file];
  if (!source) return new Response(null, { status: 404 });
  const data = await readFile(path.join(process.cwd(), 'node_modules/@fontsource/ubuntu/files', source));
  return new Response(new Uint8Array(data), { headers: { 'Content-Type': 'font/woff2' } });
}

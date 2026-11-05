import type { Metadata } from 'next';
import type { ReactNode } from 'react';
// Ubuntu autoalojada (paquete @fontsource): sin peticiones a Google Fonts.
import '@fontsource/ubuntu/400.css';
import '@fontsource/ubuntu/500.css';
import '@fontsource/ubuntu/700.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'Panel',
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: 'no-referrer',
  // Sin description, openGraph, twitter, icons ni manifest: nada que indexar ni previsualizar.
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}

import type { NextConfig } from 'next';

// Red de seguridad: estas cabeceras se aplican aunque el proxy no se ejecute.
// El proxy (src/proxy.ts) es quien aplica el conjunto completo, incluida la CSP con nonce.
const fallbackHeaders = [
  { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive, nosnippet, noimageindex' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  reactStrictMode: true,
  async headers() {
    return [{ source: '/:path*', headers: fallbackHeaders }];
  },
};

export default nextConfig;

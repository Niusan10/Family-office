import type { MetadataRoute } from 'next';

// Única ruta pública además del login. Prohíbe todo a todos los rastreadores.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: '*', disallow: '/' } };
}

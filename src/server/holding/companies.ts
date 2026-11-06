/**
 * Empresas del holding. Por ahora solo las "vacas lecheras" (las que generan EBITDA).
 *
 * El color de cada empresa es fijo y la acompaña en todas las gráficas (nunca depende de su
 * posición ni de su peso). Paleta categórica validada para daltonismo y contraste sobre blanco;
 * empieza por el fucsia corporativo. Para añadir una empresa nueva, usar el siguiente color libre
 * y volver a validar la paleta.
 */
export type Company = { slug: string; name: string; color: string };

export const COMPANIES: readonly Company[] = [
  { slug: 'sportup', name: 'Sportup', color: '#e81e76' },
  { slug: 'todocesped', name: 'TodoCESPED', color: '#0b84a5' },
  { slug: 'arelux', name: 'Arelux Top Chemicals', color: '#c97a10' },
  { slug: 'talento-cuarte', name: 'El talento de Cuarte', color: '#7a52cc' },
  { slug: 'dr-property', name: 'Dr.Property', color: '#3c9a5f' },
  { slug: 'bunga-burger', name: 'Bunga Burger', color: '#2f6fd6' },
];

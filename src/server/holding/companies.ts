/**
 * Empresas del holding. Por ahora solo las "vacas lecheras" (las que generan EBITDA).
 *
 * El color de cada empresa es su color corporativo, sacado de su web, y la acompaña en todas las
 * gráficas (nunca depende de su posición ni de su peso).
 */
export type Company = { slug: string; name: string; color: string; web?: string };

export const COMPANIES: readonly Company[] = [
  // Provisional: pendiente de su web para tomar el color corporativo.
  { slug: 'sportup', name: 'Sportup', color: '#e81e76' },
  // Verde del logo y de los botones de todocesped.es
  { slug: 'todocesped', name: 'TodoCESPED', color: '#82a819', web: 'https://todocesped.es' },
  // Azul del logotipo de arelux.com (la otra tinta es azul marino #001e38)
  { slug: 'arelux', name: 'Arelux Top Chemicals', color: '#0068e8', web: 'https://arelux.com' },
  // Provisional: pendiente de su web para tomar el color corporativo.
  { slug: 'talento-cuarte', name: 'El talento de Cuarte', color: '#7a52cc' },
  // Azul claro del logo de doctorproperty.es (la otra tinta es azul marino #222046)
  { slug: 'dr-property', name: 'Dr.Property', color: '#6ec1e4', web: 'https://doctorproperty.es' },
  // Provisional: pendiente de su web para tomar el color corporativo.
  { slug: 'bunga-burger', name: 'Bunga Burger', color: '#c97a10' },
];

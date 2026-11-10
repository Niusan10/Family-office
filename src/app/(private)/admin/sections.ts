/**
 * Herramientas del apartado Admin. Para añadir una nueva: crear su carpeta en app/(private)/admin/
 * y añadirla aquí; aparecerá en la portada de Admin y en las pestañas.
 */
export const ADMIN_SECTIONS = [
  {
    href: '/admin/usuarios',
    title: 'Emails autorizados',
    text: 'Quién puede entrar: autorizar emails, enviar enlaces de acceso y quitar permisos.',
  },
  {
    href: '/admin/valoraciones',
    title: 'Valoraciones',
    text: 'Equity value y enterprise value de cada empresa del holding. Alimentan las gráficas del Dashboard.',
  },
  {
    href: '/admin/organigrama',
    title: 'Organigrama',
    text: 'Estructura societaria: de quién depende cada sociedad y con qué porcentaje.',
  },
] as const;

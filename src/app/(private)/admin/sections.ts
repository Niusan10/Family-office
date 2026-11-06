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
] as const;

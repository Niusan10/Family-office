/** Debe coincidir con CHUNK_PAGES de src/server/escrituras/store.ts. */
const CHUNK_PAGES = 4;

/** Enlace a una página concreta: se sirve su grupo de páginas y se salta a ella dentro del visor. */
export const pdfPageHref = (id: string, page: number) => `/api/escrituras/${id}/pdf?p=${page}#page=${((page - 1) % CHUNK_PAGES) + 1}`;

export const pdfHref = (id: string) => `/api/escrituras/${id}/pdf`;

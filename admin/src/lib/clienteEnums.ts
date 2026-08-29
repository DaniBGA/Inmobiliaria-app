// `OrigenCliente`/`ORIGEN_LABEL` estaban declarados por separado en
// ClientesPage.tsx y AgregarPropiedadPage.tsx (mismo tipo, mismos 5
// labels) — un lugar compartido para no tener que acordarse de tocar los
// dos si se agrega un origen nuevo.
export type OrigenCliente = 'INSTAGRAM' | 'PAGINA_WEB' | 'EN_PERSONA' | 'FACEBOOK' | 'CONTACTOS';

export const ORIGEN_LABEL: Record<OrigenCliente, string> = {
  INSTAGRAM: 'Instagram',
  PAGINA_WEB: 'Página web',
  EN_PERSONA: 'En persona',
  FACEBOOK: 'Facebook',
  CONTACTOS: 'Contactos',
};

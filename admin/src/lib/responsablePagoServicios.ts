export type ResponsablePagoServicios = 'PROPIETARIO' | 'INMOBILIARIA' | 'INQUILINO';

// Espejo de api/src/propiedades/dto/create-propiedad.dto.ts (enum
// ResponsablePagoServicios) — quién paga los servicios trasladables de la
// propiedad, usado en AgregarPropiedadPage.tsx y
// PropiedadFichaDrawer.tsx::EditarDatosGeneralesModal.
export const RESPONSABLE_PAGO_SERVICIOS_LABEL: Record<ResponsablePagoServicios, string> = {
  PROPIETARIO: 'El propietario',
  INMOBILIARIA: 'La inmobiliaria',
  INQUILINO: 'El inquilino',
};

export const RESPONSABLE_PAGO_SERVICIOS_HINT: Record<ResponsablePagoServicios, string> = {
  PROPIETARIO:
    'El inquilino paga alquiler + servicios en una sola factura; todo se le gira al propietario (menos honorarios) y él paga los servicios por su cuenta.',
  INMOBILIARIA:
    'El inquilino paga igual, pero la inmobiliaria retiene el importe de los servicios (los paga ella) antes de girarle el resto al propietario.',
  INQUILINO: 'El inquilino paga los servicios directo a cada proveedor — ni siquiera se le facturan acá, solo el alquiler.',
};

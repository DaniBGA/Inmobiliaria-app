import { ServicioFacturable } from '@prisma/client';

// Vive acá (sin importar ningún service) a propósito: tanto
// `facturas.service.ts` (arma la factura real) como
// `common/monto-regular-mes.util.ts` (estima el "esperado" de Cobros del
// mes antes de que exista una factura) necesitan esto — si viviera dentro
// de `facturas.service.ts`, `monto-regular-mes.util.ts` tendría que
// importarlo desde ahí, y como `facturas.service.ts` también importa
// `CobrosService`, se cerraría un import circular real entre archivos
// (cobros.service.ts -> monto-regular-mes.util.ts -> facturas.service.ts
// -> cobros.service.ts) — eso rompía el arranque de Nest ("undefined
// dependency", CobrosService llegaba `undefined` a FacturasService).

// Servicios trasladables (§3.5) — a qué descripción de ítem corresponde
// cada uno. Un servicio que la propiedad no tiene habilitado
// (Propiedad.serviciosHabilitados) no se ofrece al abrir la factura.
export const SERVICIO_DESCRIPCION: Record<ServicioFacturable, string> = {
  EXPENSAS: 'Expensas del mes',
  USINA: 'Usina',
  CAMUZZI: 'Camuzzi',
  OBRAS_SANITARIAS: 'Obras Sanitarias',
  RETRIBUTIVAS: 'Retributivas de Servicios',
  CLOACAS: 'Cloacas',
  GAS_ENVASADO: 'Gas envasado',
  SISTEMA_BIODIGESTOR: 'Sistema biodigestor',
};

// Orden canónico en la factura, sin importar el orden en que se
// tildaron los checkboxes al cargar/editar la propiedad.
export const SERVICIO_ORDEN: ServicioFacturable[] = [
  ServicioFacturable.EXPENSAS,
  ServicioFacturable.USINA,
  ServicioFacturable.CAMUZZI,
  ServicioFacturable.OBRAS_SANITARIAS,
  ServicioFacturable.RETRIBUTIVAS,
  ServicioFacturable.CLOACAS,
  ServicioFacturable.GAS_ENVASADO,
  ServicioFacturable.SISTEMA_BIODIGESTOR,
];

// Datos fijos de cuenta (ver comentario en schema.prisma) para los
// servicios que los tienen — se agregan a la descripción del ítem
// predeterminado para que queden reflejados en la factura sin tener que
// volver a tipearlos cada mes. Usina lleva usuario + N° de control;
// Obras Sanitarias, Camuzzi y Retributivas de Servicios solo N° de cuenta
// (pedido del usuario 2026-08-15: antes era al revés, Obras Sanitarias
// llevaba usuario y Usina solo N° de cuenta).
export function datosCuentaSuffix(
  servicio: ServicioFacturable,
  propiedad: {
    obrasSanitariasNumeroCuenta: string | null;
    camuzziNumeroCuenta: string | null;
    retributivasNumeroCuenta: string | null;
    usinaNumeroCuenta: string | null;
    usinaUsuario: string | null;
  },
): string {
  if (servicio === ServicioFacturable.USINA) {
    const partes: string[] = [];
    if (propiedad.usinaUsuario) partes.push(`Usuario ${propiedad.usinaUsuario}`);
    if (propiedad.usinaNumeroCuenta) partes.push(`N° de control ${propiedad.usinaNumeroCuenta}`);
    return partes.length ? ` (${partes.join(' - ')})` : '';
  }
  if (servicio === ServicioFacturable.OBRAS_SANITARIAS && propiedad.obrasSanitariasNumeroCuenta) {
    return ` (N° cuenta ${propiedad.obrasSanitariasNumeroCuenta})`;
  }
  if (servicio === ServicioFacturable.CAMUZZI && propiedad.camuzziNumeroCuenta) {
    return ` (N° cuenta ${propiedad.camuzziNumeroCuenta})`;
  }
  if (servicio === ServicioFacturable.RETRIBUTIVAS && propiedad.retributivasNumeroCuenta) {
    return ` (N° cuenta ${propiedad.retributivasNumeroCuenta})`;
  }
  return '';
}

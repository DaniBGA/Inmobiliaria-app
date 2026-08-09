import { TipoHonorarios } from '@prisma/client';

// §2.3, §5.5: cada propiedad define sus honorarios propios (Libre de gastos
// / 3% / 6% / Otros con % libre). Si no define nada, se usa el % de
// Configuración como default sugerido — nunca hay un % general obligatorio.
// Punto único: liquidaciones, honorarios potenciales de venta, gráfico
// Bruto/Neto y resumen anual deben resolver el porcentaje acá, no por su cuenta.
export function resolverPorcentajeHonorarios(
  propiedad: { honorariosTipo: TipoHonorarios | null; honorariosPorcentaje: unknown },
  defaultPorcentaje: number,
): number {
  switch (propiedad.honorariosTipo) {
    case TipoHonorarios.LIBRE:
      return 0;
    case TipoHonorarios.TRES_POR_CIENTO:
      return 3;
    case TipoHonorarios.CUATRO_POR_CIENTO:
      return 4;
    case TipoHonorarios.SEIS_POR_CIENTO:
      return 6;
    case TipoHonorarios.OTRO:
      return propiedad.honorariosPorcentaje != null ? Number(propiedad.honorariosPorcentaje) : 0;
    default:
      return defaultPorcentaje;
  }
}

// Honorarios de administración (§ gestión mensual del alquiler): a
// diferencia de los profesionales de arriba, es 100% opt-in por propiedad
// — sin `honorariosAdministracion` tildado no hay ningún % (no existe un
// default de Configuración para este cargo).
export function resolverPorcentajeHonorariosAdministracion(propiedad: {
  honorariosAdministracion: boolean;
  honorariosAdministracionPorcentaje: unknown;
}): number {
  if (!propiedad.honorariosAdministracion) return 0;
  return propiedad.honorariosAdministracionPorcentaje != null
    ? Number(propiedad.honorariosAdministracionPorcentaje)
    : 0;
}

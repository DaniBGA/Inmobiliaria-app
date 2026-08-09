export type TipoHonorarios = 'LIBRE' | 'TRES_POR_CIENTO' | 'CUATRO_POR_CIENTO' | 'SEIS_POR_CIENTO' | 'OTRO' | null;

// Espejo de api/src/common/honorarios.util.ts::resolverPorcentajeHonorarios —
// mismo criterio en todos los cálculos (liquidaciones, honorarios de venta).
export function resolverPorcentajeHonorarios(
  propiedad: { honorariosTipo: TipoHonorarios; honorariosPorcentaje: number | string | null },
  defaultPorcentaje: number,
): number {
  switch (propiedad.honorariosTipo) {
    case 'LIBRE':
      return 0;
    case 'TRES_POR_CIENTO':
      return 3;
    case 'CUATRO_POR_CIENTO':
      return 4;
    case 'SEIS_POR_CIENTO':
      return 6;
    case 'OTRO':
      return propiedad.honorariosPorcentaje != null ? Number(propiedad.honorariosPorcentaje) : 0;
    default:
      return defaultPorcentaje;
  }
}

export function honorariosLabel(propiedad: { honorariosTipo: TipoHonorarios; honorariosPorcentaje: number | string | null }, defaultPorcentaje: number): string {
  if (propiedad.honorariosTipo === 'LIBRE') return 'Libre de gastos';
  return `${resolverPorcentajeHonorarios(propiedad, defaultPorcentaje)}%`;
}

// Honorarios de administración (gestión mensual del alquiler) — opt-in por
// propiedad, sin % por defecto de Configuración (a diferencia de los
// profesionales de arriba). Espejo de
// api/src/common/honorarios.util.ts::resolverPorcentajeHonorariosAdministracion.
export function resolverPorcentajeHonorariosAdministracion(propiedad: {
  honorariosAdministracion: boolean;
  honorariosAdministracionPorcentaje: number | string | null;
}): number {
  if (!propiedad.honorariosAdministracion) return 0;
  return propiedad.honorariosAdministracionPorcentaje != null
    ? Number(propiedad.honorariosAdministracionPorcentaje)
    : 0;
}

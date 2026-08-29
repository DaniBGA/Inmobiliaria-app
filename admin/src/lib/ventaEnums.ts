// `EstadoVenta`/`ESTADO_VENTA_LABEL`/`ESTADO_VENTA_CLASE` estaban
// declarados por separado en VentasPage.tsx y PropiedadFichaDrawer.tsx
// (mismo tipo, mismos labels y clases de badge) — un lugar compartido para
// no tener que acordarse de tocar los dos si se agrega un estado nuevo.
export type EstadoVenta = 'PUBLICADA' | 'RESERVADA' | 'VENDIDA' | 'VENDIDA_POR_TERCEROS' | 'PAUSADA';

export const ESTADO_VENTA_LABEL: Record<EstadoVenta, string> = {
  PUBLICADA: 'Publicada',
  RESERVADA: 'Reservada',
  VENDIDA: 'Vendida',
  VENDIDA_POR_TERCEROS: 'Vendida por terceros',
  PAUSADA: 'Pausada',
};

export const ESTADO_VENTA_CLASE: Record<EstadoVenta, string> = {
  PUBLICADA: 'publicada',
  RESERVADA: 'reservada',
  VENDIDA: 'vendida',
  VENDIDA_POR_TERCEROS: 'vendida_por_terceros',
  PAUSADA: 'pausada',
};

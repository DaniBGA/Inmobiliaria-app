export const TIPO_LABEL: Record<string, string> = {
  CASA: 'Casa',
  DEPARTAMENTO_DUPLEX: 'Departamento/Dúplex',
  QUINTA: 'Quinta',
  LOTE: 'Lote',
  CAMPO: 'Campo',
  GALPON: 'Galpón',
  LOCAL_OFICINA: 'Local/Oficina',
  CABANIAS_HOTELES_OTROS: 'Cabañas/Hoteles/Otros',
  FONDO_DE_COMERCIO: 'Fondo de comercio',
  COCHERAS: 'Cocheras',
};

export function formatMoney(monto: number | string | null | undefined): string {
  const n = Number(monto ?? 0);
  return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
}

export function formatUsd(monto: number | string | null | undefined): string {
  const n = Number(monto ?? 0);
  return `USD ${n.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
}

export function formatPrecio(precio: number | null, moneda: 'ARS' | 'USD' | null): string {
  if (precio == null) return 'Consultar';
  return moneda === 'USD' ? formatUsd(precio) : formatMoney(precio);
}

export function waLink(numero: string, mensaje: string): string {
  const digits = numero.replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(mensaje)}`;
}

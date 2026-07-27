export function formatMoney(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  return `$ ${v.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
}

export function formatUsd(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  return `US$ ${v.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
}

export function formatDate(fecha: string | Date | null | undefined): string {
  if (!fecha) return '—';
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha;
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
}

export function mesActualStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function sumarMesesStr(mesStr: string, delta: number): string {
  const [anio, mes] = mesStr.split('-').map(Number);
  const d = new Date(Date.UTC(anio, mes - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

export function mesLabel(mesStr: string): string {
  const [anio, mes] = mesStr.split('-').map(Number);
  return `${MESES[mes - 1]} ${anio}`;
}

export function hoyLabel(): string {
  return new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
}

// `maximumFractionDigits: 2` sin `minimumFractionDigits` muestra los
// centavos solo cuando el monto los tiene (nunca ".00" de más en un monto
// redondo) — antes `maximumFractionDigits: 0` los descartaba siempre,
// redondeando para arriba o para abajo cualquier monto con centavos en
// facturas, liquidaciones, cobros, etc. (pedido del usuario 2026-08-18).
export function formatMoney(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  return `$ ${v.toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;
}

export function formatUsd(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  return `US$ ${v.toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;
}

// Interpreta un monto tipeado a mano (o pegado desde afuera, como la
// calculadora de Arquiler embebida) con el formato argentino de miles/
// decimales — "352.520" son trescientos cincuenta y dos mil quinientos
// veinte, no 352,52 (que es lo que da `Number()` a secas, tratando el
// punto como separador decimal a la inglesa — pedido del usuario, la
// calculadora de aumento lo estaba guardando mal).
//
// Con coma: la coma es el separador decimal, cualquier punto es de miles
// ("352.520,50" → 352520.5). Sin coma: un punto seguido de exactamente 3
// dígitos al final se interpreta como separador de miles ("352.520" →
// 352520); si no, es un decimal normal ("352.5" → 352.5).
export function parseMontoArgentino(raw: string): number {
  const limpio = raw.trim();
  if (!limpio) return NaN;
  if (limpio.includes(',')) {
    return Number(limpio.replace(/\./g, '').replace(',', '.'));
  }
  const partes = limpio.split('.');
  if (partes.length > 1 && partes[partes.length - 1].length === 3) {
    return Number(partes.join(''));
  }
  return Number(limpio);
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

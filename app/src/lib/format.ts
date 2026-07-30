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

// Paleta de gradientes de respaldo cuando una propiedad todavía no tiene
// fotos cargadas — mismo criterio de "placeholder prolijo" en toda la
// landing (tarjetas, carrusel del hero) en vez de un ícono roto.
const GRADIENTES = [
  'linear-gradient(135deg, #2c4263, #1b3050)',
  'linear-gradient(135deg, #1f3a5c, #14253b)',
  'linear-gradient(135deg, #34507a, #1e3350)',
  'linear-gradient(135deg, #26405f, #14253b)',
];

export function gradienteFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return GRADIENTES[Math.abs(hash) % GRADIENTES.length];
}

export interface Spec {
  k: string;
  v: string;
}

export function specsDe(p: {
  ambientes: number | null;
  dormitorios: number | null;
  banos: number | null;
  superficieM2: number | string | null;
}): Spec[] {
  return [
    p.ambientes != null ? { k: 'Amb.', v: String(p.ambientes) } : null,
    p.dormitorios != null ? { k: 'Dorm.', v: String(p.dormitorios) } : null,
    p.banos != null ? { k: 'Baños', v: String(p.banos) } : null,
    p.superficieM2 != null ? { k: 'Sup.', v: `${p.superficieM2}m²` } : null,
  ].filter(Boolean) as Spec[];
}

export function specsLineDe(p: {
  ambientes: number | null;
  dormitorios: number | null;
  banos: number | null;
  superficieM2: number | string | null;
}): string {
  return specsDe(p)
    .map((s) => `${s.k} ${s.v}`)
    .join(' · ');
}

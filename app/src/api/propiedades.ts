import { api } from './client';

export type ModalidadPropiedad = 'ALQUILER' | 'VENTA';
export type TipoPropiedad =
  | 'CASA'
  | 'DEPARTAMENTO_DUPLEX'
  | 'QUINTA'
  | 'LOTE'
  | 'CAMPO'
  | 'GALPON'
  | 'LOCAL_OFICINA'
  | 'CABANIAS_HOTELES_OTROS'
  | 'FONDO_DE_COMERCIO'
  | 'COCHERAS';

export interface FotoPublica {
  id: string;
  url: string;
  orden: number;
}

export interface PropiedadPublica {
  id: string;
  nombre: string;
  direccion: string;
  tipo: TipoPropiedad;
  modalidad: ModalidadPropiedad;
  montoAlquilerVigente: number | null;
  precio: number | null;
  moneda: 'ARS' | 'USD' | null;
  ambientes: number | null;
  dormitorios: number | null;
  banos: number | null;
  cochera: boolean;
  superficieM2: number | null;
  superficieCubierta: number | null;
  descripcion: string | null;
  fotos: FotoPublica[];
}

export interface ListarPropiedadesResultado {
  items: PropiedadPublica[];
  total: number;
}

export interface StatsPorTipo {
  casas: number;
  departamentos: number;
  locales: number;
  lotes: number;
}

export function listarPropiedades(
  params: { modalidad?: ModalidadPropiedad; tipo?: TipoPropiedad; page?: number; limit?: number } = {},
) {
  const q = new URLSearchParams();
  if (params.modalidad) q.set('modalidad', params.modalidad);
  if (params.tipo) q.set('tipo', params.tipo);
  if (params.page) q.set('page', String(params.page));
  if (params.limit) q.set('limit', String(params.limit));
  const qs = q.toString();
  return api.get<ListarPropiedadesResultado>(`/public/propiedades${qs ? `?${qs}` : ''}`);
}

export function statsPorTipo() {
  return api.get<StatsPorTipo>('/public/propiedades/stats-por-tipo');
}

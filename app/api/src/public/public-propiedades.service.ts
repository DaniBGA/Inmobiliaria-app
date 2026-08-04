import { Injectable } from '@nestjs/common';
import { EstadoVenta, ModalidadPropiedad, Prisma, TipoPropiedad } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// Select explícito de solo lo que es seguro mostrar en la web pública —
// nunca propietario, honorarios, contrato, punitorios ni nada del pipeline
// de interesados.
const SELECT_PUBLICO = {
  id: true,
  nombre: true,
  direccion: true,
  tipo: true,
  modalidad: true,
  montoAlquilerVigente: true,
  ambientes: true,
  dormitorios: true,
  banos: true,
  cochera: true,
  superficieM2: true,
  superficieCubierta: true,
  descripcion: true,
  caracterEspecial: true,
  fotos: { select: { id: true, url: true, orden: true, esPortada: true }, orderBy: { orden: 'asc' as const } },
  venta: { select: { precio: true, moneda: true } },
} satisfies Prisma.PropiedadSelect;

type PropiedadPublicaRaw = Prisma.PropiedadGetPayload<{ select: typeof SELECT_PUBLICO }>;

const BUCKET_STATS: Partial<Record<TipoPropiedad, keyof StatsPorTipo>> = {
  CASA: 'casas',
  DEPARTAMENTO: 'departamentos',
  DUPLEX: 'departamentos',
  LOCAL_OFICINA: 'locales',
  LOTE: 'lotes',
};

export interface StatsPorTipo {
  casas: number;
  departamentos: number;
  locales: number;
  lotes: number;
}

function mapear(p: PropiedadPublicaRaw) {
  return {
    id: p.id,
    nombre: p.nombre,
    direccion: p.direccion,
    tipo: p.tipo,
    modalidad: p.modalidad,
    montoAlquilerVigente: p.montoAlquilerVigente != null ? Number(p.montoAlquilerVigente) : null,
    precio: p.venta ? Number(p.venta.precio) : null,
    moneda: p.venta?.moneda ?? null,
    ambientes: p.ambientes,
    dormitorios: p.dormitorios,
    banos: p.banos,
    cochera: p.cochera,
    superficieM2: p.superficieM2 != null ? Number(p.superficieM2) : null,
    superficieCubierta: p.superficieCubierta != null ? Number(p.superficieCubierta) : null,
    descripcion: p.descripcion,
    caracterEspecial: p.caracterEspecial,
    // El carrusel destacado del Hero siempre usa `fotos[0]` como imagen
    // principal — si hay una marcada como portada, se antepone acá para
    // que ese `[0]` la use sin que el frontend tenga que saber nada de
    // `esPortada` (por eso no se expone ese campo en la forma pública).
    fotos: [...p.fotos]
      .sort((a, b) => Number(b.esPortada) - Number(a.esPortada))
      .map(({ id, url, orden }) => ({ id, url, orden })),
  };
}

@Injectable()
export class PublicPropiedadesService {
  constructor(private readonly prisma: PrismaService) {}

  // §PublicModule: alquiler "disponible para publicar" = vacante (sin
  // inquilino) Y no pausada (`alquilerPublicado`, equivalente a
  // `Venta.publicada` pero sin ficha satélite) — una propiedad ocupada
  // nunca se muestra en la web pública, tenga o no el flag en true. Venta
  // publicable = `publicada` Y todavía activa (una venta cerrada nunca
  // vuelve a `publicada:false` sola, así que hace falta chequear el estado
  // además del booleano).
  private condicionListable(modalidad?: ModalidadPropiedad): Prisma.PropiedadWhereInput {
    const condicionAlquiler: Prisma.PropiedadWhereInput = {
      modalidad: ModalidadPropiedad.ALQUILER,
      inquilino: null,
      alquilerPublicado: true,
    };
    const condicionVenta: Prisma.PropiedadWhereInput = {
      modalidad: ModalidadPropiedad.VENTA,
      venta: { publicada: true, estado: EstadoVenta.PUBLICADA },
    };

    if (modalidad === ModalidadPropiedad.ALQUILER) return condicionAlquiler;
    if (modalidad === ModalidadPropiedad.VENTA) return condicionVenta;
    return { OR: [condicionAlquiler, condicionVenta] };
  }

  async listar(params: {
    modalidad?: ModalidadPropiedad;
    // Lista (no un único valor): el chip "Deptos" de la landing agrupa
    // DEPARTAMENTO + DUPLEX en un solo filtro (ver TipoStatsBand/
    // PropertyFilterChips), así que un solo `tipo` ya no alcanza.
    tipo?: TipoPropiedad[];
    especial?: boolean;
    page?: number;
    limit?: number;
  }) {
    const page = params.page && params.page > 0 ? params.page : 1;
    const limit = params.limit && params.limit > 0 ? Math.min(params.limit, 48) : 12;

    const condicion = this.condicionListable(params.modalidad);
    const extra: Prisma.PropiedadWhereInput[] = [];
    if (params.tipo && params.tipo.length > 0) extra.push({ tipo: { in: params.tipo } });
    if (params.especial) extra.push({ caracterEspecial: true });
    const where: Prisma.PropiedadWhereInput = extra.length > 0 ? { AND: [condicion, ...extra] } : condicion;

    const [items, total] = await Promise.all([
      this.prisma.propiedad.findMany({
        where,
        select: SELECT_PUBLICO,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.propiedad.count({ where }),
    ]);

    return { items: items.map(mapear), total };
  }

  async statsPorTipo(): Promise<StatsPorTipo> {
    const propiedades = await this.prisma.propiedad.findMany({
      where: this.condicionListable(),
      select: { tipo: true },
    });

    const stats: StatsPorTipo = { casas: 0, departamentos: 0, locales: 0, lotes: 0 };
    for (const p of propiedades) {
      const bucket = BUCKET_STATS[p.tipo];
      if (bucket) stats[bucket] += 1;
    }
    return stats;
  }
}

import { Injectable } from '@nestjs/common';
import { EstadoVenta, ModalidadPropiedad, Prisma, TipoPropiedad } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ConfiguracionService } from '../configuracion/configuracion.service';

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
  venta: { select: { precio: true, moneda: true, estado: true } },
  // Solo para derivar `estadoPublico` (§ventana de gracia) — nunca se
  // expone el inquilino en sí, solo si existe o no.
  inquilino: { select: { id: true } },
} satisfies Prisma.PropiedadSelect;

type PropiedadPublicaRaw = Prisma.PropiedadGetPayload<{ select: typeof SELECT_PUBLICO }>;
type EstadoPublico = 'DISPONIBLE' | 'ALQUILADA' | 'VENDIDA';

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
  // Ventana de gracia (§Configuracion.diasMostrarDespuesVentaAlquiler): la
  // propiedad puede seguir listada un tiempo después de alquilarse/venderse
  // — `estadoPublico` es lo que le permite al frontend mostrar "Alquilada"/
  // "Vendida" en vez de dejarla parecer disponible.
  const estadoPublico: EstadoPublico =
    p.modalidad === ModalidadPropiedad.VENTA
      ? p.venta && (p.venta.estado === EstadoVenta.VENDIDA || p.venta.estado === EstadoVenta.VENDIDA_POR_TERCEROS)
        ? 'VENDIDA'
        : 'DISPONIBLE'
      : p.inquilino
        ? 'ALQUILADA'
        : 'DISPONIBLE';

  return {
    id: p.id,
    nombre: p.nombre,
    direccion: p.direccion,
    tipo: p.tipo,
    modalidad: p.modalidad,
    estadoPublico,
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly configuracionService: ConfiguracionService,
  ) {}

  // §PublicModule: alquiler "disponible para publicar" = vacante (sin
  // inquilino) Y no pausada (`alquilerPublicado`, equivalente a
  // `Venta.publicada` pero sin ficha satélite). Venta publicable =
  // `publicada` Y todavía activa (una venta cerrada nunca vuelve a
  // `publicada:false` sola, así que hace falta chequear el estado además
  // del booleano).
  //
  // Además, `Configuracion.diasMostrarDespuesVentaAlquiler` (0 = apagado)
  // mantiene la propiedad visible una cantidad de días DESPUÉS de que se
  // alquiló/vendió — así no desaparece de la web en el instante mismo de la
  // operación. Se ancla en `contratoInicio` (alquiler) o `venta.cierreReal`
  // (venta: cubre tanto "vendida" por la inmobiliaria como "vendida por
  // terceros"), no en la fecha en que se cargó el registro.
  private async condicionListable(modalidad?: ModalidadPropiedad): Promise<Prisma.PropiedadWhereInput> {
    const dias = Number((await this.configuracionService.get()).diasMostrarDespuesVentaAlquiler ?? 0);
    const desde = new Date();
    desde.setDate(desde.getDate() - dias);

    const condicionAlquiler: Prisma.PropiedadWhereInput = {
      modalidad: ModalidadPropiedad.ALQUILER,
      alquilerPublicado: true,
      OR: [
        { inquilino: null },
        ...(dias > 0 ? [{ inquilino: { isNot: null }, contratoInicio: { gte: desde } }] : []),
      ],
    };
    const condicionVenta: Prisma.PropiedadWhereInput = {
      modalidad: ModalidadPropiedad.VENTA,
      venta: {
        publicada: true,
        OR: [
          { estado: EstadoVenta.PUBLICADA },
          ...(dias > 0
            ? [{ estado: { in: [EstadoVenta.VENDIDA, EstadoVenta.VENDIDA_POR_TERCEROS] }, cierreReal: { gte: desde } }]
            : []),
        ],
      },
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

    const condicion = await this.condicionListable(params.modalidad);
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
      where: await this.condicionListable(),
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

import { Injectable } from '@nestjs/common';
import { EstadoCartel, RolUsuario } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCartelDto } from './dto/create-cartel.dto';
import { UpdateCartelDto } from './dto/update-cartel.dto';

const MS_POR_DIA = 1000 * 60 * 60 * 24;

type UsuarioRequest = { id: string; rol: RolUsuario; integranteEquipoId: string | null };

@Injectable()
export class CartelesService {
  constructor(private readonly prisma: PrismaService) {}

  private conDiasEnLaCalle<T extends { fechaColocacion: Date | null; fechaRetiro: Date | null }>(
    cartel: T,
  ) {
    let diasEnLaCalle: number | null = null;
    if (cartel.fechaColocacion) {
      const hasta = cartel.fechaRetiro ?? new Date();
      diasEnLaCalle = Math.max(
        0,
        Math.floor((hasta.getTime() - cartel.fechaColocacion.getTime()) / MS_POR_DIA),
      );
    }
    return { ...cartel, diasEnLaCalle };
  }

  // Un designado (EQUIPO) solo ve los carteles de sus propias propiedades en
  // venta — mismo criterio que Ventas y Carteles en general (pedido del
  // usuario 2026-09-04). El campo "designado" en la práctica solo se carga
  // para propiedades en venta (ver VentasPage.tsx), así que esto no le
  // oculta carteles de alquiler que en los hechos ya nadie tiene asignados.
  async findAll(usuario?: UsuarioRequest) {
    const where =
      usuario?.rol === RolUsuario.EQUIPO
        ? { propiedad: { modalidad: 'VENTA' as const, designadoId: usuario.integranteEquipoId } }
        : undefined;
    const carteles = await this.prisma.cartel.findMany({
      where,
      include: { propiedad: true },
      orderBy: { createdAt: 'desc' },
    });
    return carteles.map((c) => this.conDiasEnLaCalle(c));
  }

  create(dto: CreateCartelDto) {
    return this.prisma.cartel.create({
      data: {
        propiedadId: dto.propiedadId,
        tipoCartel: dto.tipoCartel ?? EstadoCartel.COLOCADO,
        medida: dto.medida,
        fechaColocacion: dto.fechaColocacion ? new Date(dto.fechaColocacion) : new Date(),
      },
    });
  }

  update(id: string, dto: UpdateCartelDto) {
    return this.prisma.cartel.update({
      where: { id },
      data: {
        tipoCartel: dto.tipoCartel,
        medida: dto.medida,
        fechaColocacion: dto.fechaColocacion ? new Date(dto.fechaColocacion) : undefined,
        fechaRetiro: dto.fechaRetiro ? new Date(dto.fechaRetiro) : undefined,
      },
    });
  }

  // Retirar el cartel: marca tipoCartel y fecha de retiro en un solo paso.
  retirar(id: string, fechaStr?: string) {
    return this.prisma.cartel.update({
      where: { id },
      data: {
        tipoCartel: EstadoCartel.RETIRADO,
        fechaRetiro: fechaStr ? new Date(fechaStr) : new Date(),
      },
    });
  }

  remove(id: string) {
    return this.prisma.cartel.delete({ where: { id } });
  }

  // §2.3: KPIs del bloque "Carteles en la calle". "Publicada" incluye tanto
  // ventas publicadas como alquileres vacantes (sin inquilino) — el cartel
  // acompaña el ciclo comercial de cualquier propiedad publicada, no solo
  // las de venta.
  async kpis(usuario?: UsuarioRequest) {
    const esEquipo = usuario?.rol === RolUsuario.EQUIPO;
    const cartelWhere = esEquipo
      ? { propiedad: { modalidad: 'VENTA' as const, designadoId: usuario!.integranteEquipoId } }
      : undefined;
    const [colocados, aPedido, retirados] = await Promise.all([
      this.prisma.cartel.count({ where: { ...cartelWhere, tipoCartel: EstadoCartel.COLOCADO } }),
      this.prisma.cartel.count({ where: { ...cartelWhere, tipoCartel: EstadoCartel.A_PEDIDO } }),
      this.prisma.cartel.count({ where: { ...cartelWhere, tipoCartel: EstadoCartel.RETIRADO } }),
    ]);

    const propiedadesPublicadas = await this.prisma.propiedad.findMany({
      where: esEquipo
        ? { modalidad: 'VENTA', designadoId: usuario!.integranteEquipoId, venta: { publicada: true } }
        : {
            OR: [
              { modalidad: 'VENTA', venta: { publicada: true } },
              { modalidad: 'ALQUILER', inquilino: null },
            ],
          },
      include: { carteles: { where: { tipoCartel: { not: EstadoCartel.RETIRADO } } } },
    });
    const publicadasSinCartel = propiedadesPublicadas.filter((p) => p.carteles.length === 0).length;

    return { colocados, aPedido, retirados, publicadasSinCartel };
  }
}

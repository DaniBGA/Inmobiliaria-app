import { Injectable } from '@nestjs/common';
import { EstadoCartel } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCartelDto } from './dto/create-cartel.dto';
import { UpdateCartelDto } from './dto/update-cartel.dto';

const MS_POR_DIA = 1000 * 60 * 60 * 24;

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

  async findAll() {
    const carteles = await this.prisma.cartel.findMany({
      include: { propiedad: true },
      orderBy: { createdAt: 'desc' },
    });
    return carteles.map((c) => this.conDiasEnLaCalle(c));
  }

  create(dto: CreateCartelDto) {
    return this.prisma.cartel.create({
      data: {
        propiedadId: dto.propiedadId,
        tipoCartel: dto.tipoCartel,
        medida: dto.medida,
        fechaColocacion: dto.fechaColocacion ? new Date(dto.fechaColocacion) : new Date(),
        estado: EstadoCartel.COLOCADO,
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
        estado: dto.estado,
      },
    });
  }

  // Retirar el cartel: marca estado y fecha de retiro en un solo paso.
  retirar(id: string, fechaStr?: string) {
    return this.prisma.cartel.update({
      where: { id },
      data: {
        estado: EstadoCartel.RETIRADO,
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
  async kpis() {
    const [colocados, aPedido, retirados] = await Promise.all([
      this.prisma.cartel.count({ where: { estado: EstadoCartel.COLOCADO } }),
      this.prisma.cartel.count({ where: { estado: EstadoCartel.A_PEDIDO } }),
      this.prisma.cartel.count({ where: { estado: EstadoCartel.RETIRADO } }),
    ]);

    const propiedadesPublicadas = await this.prisma.propiedad.findMany({
      where: {
        OR: [
          { modalidad: 'VENTA', venta: { publicada: true } },
          { modalidad: 'ALQUILER', inquilino: null },
        ],
      },
      include: { carteles: { where: { estado: { not: EstadoCartel.RETIRADO } } } },
    });
    const publicadasSinCartel = propiedadesPublicadas.filter((p) => p.carteles.length === 0).length;

    return { colocados, aPedido, retirados, publicadasSinCartel };
  }
}

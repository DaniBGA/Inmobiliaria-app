import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProveedorDto } from './dto/create-proveedor.dto';
import { UpdateProveedorDto } from './dto/update-proveedor.dto';

@Injectable()
export class ProveedoresService {
  constructor(private readonly prisma: PrismaService) {}

  // §2.5: cuenta corriente del proveedor — Total facturado (trabajos
  // resueltos con costo) − Abonado (pagos registrados) = Saldo a pagar.
  async cuentaCorriente(proveedorId: string) {
    const [facturado, abonado] = await Promise.all([
      this.prisma.incidencia.aggregate({
        where: { proveedorId, estado: 'RESUELTA', costo: { not: null } },
        _sum: { costo: true },
      }),
      this.prisma.pagoProveedor.aggregate({
        where: { proveedorId },
        _sum: { monto: true },
      }),
    ]);
    const totalFacturado = Number(facturado._sum.costo ?? 0);
    const totalAbonado = Number(abonado._sum.monto ?? 0);
    return {
      totalFacturado,
      abonado: totalAbonado,
      saldoAPagar: totalFacturado - totalAbonado,
    };
  }

  async findAll() {
    const proveedores = await this.prisma.proveedor.findMany({ orderBy: { nombre: 'asc' } });
    return Promise.all(
      proveedores.map(async (p) => ({ ...p, ...(await this.cuentaCorriente(p.id)) })),
    );
  }

  async findOne(id: string) {
    const proveedor = await this.prisma.proveedor.findUniqueOrThrow({
      where: { id },
      include: {
        incidencias: { include: { propiedad: true }, orderBy: { fechaApertura: 'desc' } },
        pagosProveedor: { orderBy: { fecha: 'desc' } },
      },
    });
    return { ...proveedor, ...(await this.cuentaCorriente(id)) };
  }

  create(dto: CreateProveedorDto, tx: Prisma.TransactionClient | PrismaService = this.prisma) {
    return tx.proveedor.create({ data: dto });
  }

  update(id: string, dto: UpdateProveedorDto) {
    return this.prisma.proveedor.update({ where: { id }, data: dto });
  }

  remove(id: string) {
    return this.prisma.proveedor.delete({ where: { id } });
  }

  // Trabajos resueltos con costo, con este proveedor, todavía no abonados
  // (usado por "pagar saldo completo").
  incidenciasPendientesDePago(proveedorId: string, tx: Prisma.TransactionClient | PrismaService = this.prisma) {
    return tx.incidencia.findMany({
      where: { proveedorId, estado: 'RESUELTA', costo: { not: null }, abonadaFecha: null },
    });
  }
}

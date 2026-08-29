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

  // Antes llamaba `cuentaCorriente(p.id)` por cada proveedor (2 `aggregate`
  // por uno, N+1). Con `groupBy` es una sola pasada por tabla para todos
  // los proveedores a la vez — mismo resultado por proveedor.
  async findAll() {
    const [proveedores, facturados, abonados] = await Promise.all([
      this.prisma.proveedor.findMany({ orderBy: { nombre: 'asc' } }),
      this.prisma.incidencia.groupBy({
        by: ['proveedorId'],
        where: { proveedorId: { not: null }, estado: 'RESUELTA', costo: { not: null } },
        _sum: { costo: true },
      }),
      this.prisma.pagoProveedor.groupBy({
        by: ['proveedorId'],
        _sum: { monto: true },
      }),
    ]);
    const facturadoPorProveedor = new Map(facturados.map((f) => [f.proveedorId, Number(f._sum.costo ?? 0)]));
    const abonadoPorProveedor = new Map(abonados.map((a) => [a.proveedorId, Number(a._sum.monto ?? 0)]));

    return proveedores.map((p) => {
      const totalFacturado = facturadoPorProveedor.get(p.id) ?? 0;
      const totalAbonado = abonadoPorProveedor.get(p.id) ?? 0;
      return { ...p, totalFacturado, abonado: totalAbonado, saldoAPagar: totalFacturado - totalAbonado };
    });
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

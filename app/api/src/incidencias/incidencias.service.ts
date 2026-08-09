import { BadRequestException, Injectable } from '@nestjs/common';
import { DestinoGasto, EstadoIncidencia, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProveedoresService } from '../proveedores/proveedores.service';
import { GastosService } from '../gastos/gastos.service';
import { CreateIncidenciaDto } from './dto/create-incidencia.dto';
import { UpdateIncidenciaDto } from './dto/update-incidencia.dto';
import { AsignarProveedorDto } from './dto/asignar-proveedor.dto';
import { ResolverIncidenciaDto } from './dto/resolver-incidencia.dto';
import { ProveedorNuevoDto } from './dto/proveedor-nuevo.dto';
import { primerDiaMes } from '../common/fecha.util';

@Injectable()
export class IncidenciasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly proveedoresService: ProveedoresService,
    private readonly gastosService: GastosService,
  ) {}

  private async resolverProveedor(
    input: { proveedorId?: string; proveedorNuevo?: ProveedorNuevoDto },
    rubroHeredado: string,
    tx: Prisma.TransactionClient,
  ): Promise<string | undefined> {
    if (input.proveedorId) return input.proveedorId;
    if (input.proveedorNuevo) {
      const proveedor = await this.proveedoresService.create(
        {
          nombre: input.proveedorNuevo.nombre,
          rubro: input.proveedorNuevo.rubro || rubroHeredado,
          telefono: input.proveedorNuevo.telefono,
        },
        tx,
      );
      return proveedor.id;
    }
    return undefined;
  }

  // `pagosProveedor` (tabla puente) se incluye para exponer el pago que
  // saldó esta incidencia — lo usa el frontend para editar/deshacer el pago
  // desde acá, sin otro endpoint para "buscar el pago de tal incidencia".
  // `_count.incidencias` avisa si ese pago cubrió otras incidencias a la vez
  // (p. ej. "Pagar saldo"), para advertir antes de deshacerlo.
  private readonly INCLUDE_PAGO = {
    pagosProveedor: {
      include: { pagoProveedor: { include: { _count: { select: { incidencias: true } } } } },
    },
  };

  findAll(estado?: EstadoIncidencia, propiedadId?: string) {
    return this.prisma.incidencia.findMany({
      where: { estado, propiedadId },
      include: { propiedad: true, proveedor: true, ...this.INCLUDE_PAGO },
      orderBy: { fechaApertura: 'desc' },
    });
  }

  findOne(id: string) {
    return this.prisma.incidencia.findUniqueOrThrow({
      where: { id },
      include: { propiedad: true, proveedor: true, gasto: true, ...this.INCLUDE_PAGO },
    });
  }

  // Incidencias sin proveedor asignado (§3.3: dispara aviso "pedido de
  // presupuesto" — lo consumirá el módulo Avisos).
  findSinProveedor() {
    return this.prisma.incidencia.findMany({
      where: { proveedorId: null, estado: { not: EstadoIncidencia.RESUELTA } },
      include: { propiedad: true },
    });
  }

  async crear(dto: CreateIncidenciaDto) {
    await this.prisma.propiedad.findUniqueOrThrow({ where: { id: dto.propiedadId } });

    return this.prisma.$transaction(async (tx) => {
      const proveedorId = await this.resolverProveedor(dto, dto.rubro, tx);

      return tx.incidencia.create({
        data: {
          propiedadId: dto.propiedadId,
          titulo: dto.titulo,
          descripcion: dto.descripcion,
          rubro: dto.rubro,
          prioridad: dto.prioridad,
          reportadaPor: dto.reportadaPor,
          notas: dto.notas,
          fechaApertura: dto.fechaApertura ? new Date(dto.fechaApertura) : undefined,
          proveedorId,
          estado: proveedorId ? EstadoIncidencia.EN_CURSO : EstadoIncidencia.ABIERTA,
          fechaEjecucion: proveedorId
            ? dto.fechaEjecucion
              ? new Date(dto.fechaEjecucion)
              : new Date()
            : undefined,
        },
        include: { propiedad: true, proveedor: true },
      });
    });
  }

  update(id: string, dto: UpdateIncidenciaDto) {
    return this.prisma.incidencia.update({ where: { id }, data: dto });
  }

  // §3.3: asignar proveedor → pasa a EN_CURSO y pide fecha de ejecución (§2.7)
  async asignarProveedor(id: string, dto: AsignarProveedorDto) {
    const incidencia = await this.prisma.incidencia.findUniqueOrThrow({ where: { id } });

    return this.prisma.$transaction(async (tx) => {
      const proveedorId = await this.resolverProveedor(dto, incidencia.rubro, tx);
      if (!proveedorId) {
        throw new BadRequestException('Debe indicarse proveedorId o proveedorNuevo.');
      }

      return tx.incidencia.update({
        where: { id },
        data: {
          proveedorId,
          estado: EstadoIncidencia.EN_CURSO,
          fechaEjecucion: dto.fechaEjecucion ? new Date(dto.fechaEjecucion) : new Date(),
        },
        include: { propiedad: true, proveedor: true },
      });
    });
  }

  async volverAAbierta(id: string) {
    // La fecha de ejecución queda igual en la incidencia (§2.7); solo deja
    // de mostrarse en Agenda mientras no esté EN_CURSO — eso lo resuelve la
    // consulta del módulo Agenda, no un borrado acá.
    return this.prisma.incidencia.update({
      where: { id },
      data: { estado: EstadoIncidencia.ABIERTA },
    });
  }

  // §3.3: al marcar RESUELTA con costo, genera el gasto automáticamente
  // (destino = quienPagaCosto). Si hay proveedor asignado, no genera egreso
  // propio en Caja — eso lo hace el pago al proveedor más adelante. Si NO
  // hay proveedor y la paga la inmobiliaria, no hay ningún pago a proveedor
  // que vaya a registrar esa salida de plata, así que el egreso en Caja se
  // genera acá mismo.
  async resolver(id: string, dto: ResolverIncidenciaDto) {
    const incidencia = await this.prisma.incidencia.findUniqueOrThrow({
      where: { id },
      include: { propiedad: true },
    });
    const fechaCierre = dto.fechaCierre ? new Date(dto.fechaCierre) : new Date();

    return this.prisma.$transaction(async (tx) => {
      const actualizada = await tx.incidencia.update({
        where: { id },
        data: {
          estado: EstadoIncidencia.RESUELTA,
          costo: dto.costo,
          quienPagaCosto: dto.quienPagaCosto,
          fechaCierre,
        },
      });

      if (dto.costo != null && dto.quienPagaCosto) {
        await this.gastosService.crearDesdeIncidencia(
          {
            incidenciaId: id,
            propiedadId: incidencia.propiedadId,
            propiedadNombre: incidencia.propiedad.nombre,
            mes: primerDiaMes(fechaCierre),
            descripcion: incidencia.titulo,
            monto: dto.costo,
            fecha: fechaCierre,
            categoria: incidencia.rubro,
            destino: dto.quienPagaCosto,
            generarEgresoCaja: !incidencia.proveedorId && dto.quienPagaCosto === DestinoGasto.INMOBILIARIA,
          },
          tx,
        );
      }

      return actualizada;
    });
  }

  // El gasto que genera `resolver()` apunta a la incidencia con
  // `onDelete: SetNull` (schema.prisma) — sin este paso, borrar la
  // incidencia no borra ese gasto, solo le vacía `incidenciaId`. Queda un
  // gasto huérfano: invisible en Incidencias (ya no hay incidencia) y, si
  // tenía proveedor (o no generó egreso propio, ver `generarEgresoCaja`),
  // también invisible en Caja — pero sigue restando de `gananciaPesos`
  // (caja.service.ts::kpisDelMes) para siempre, sin ninguna pantalla desde
  // donde corregirlo. Por eso acá también se borra su egreso en Caja
  // (`movimientoCajaId`) cuando lo tiene.
  async remove(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const gasto = await tx.gasto.findUnique({ where: { incidenciaId: id } });
      if (gasto) {
        if (gasto.movimientoCajaId) {
          await tx.movimientoCaja.delete({ where: { id: gasto.movimientoCajaId } });
        }
        await tx.gasto.delete({ where: { id: gasto.id } });
      }
      return tx.incidencia.delete({ where: { id } });
    });
  }
}

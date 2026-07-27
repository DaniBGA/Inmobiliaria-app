import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EstadoVenta, Moneda, MonedaVenta, OrigenMovimientoCaja, TipoMovimientoCaja, TipoPropiedad } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CajaService } from '../caja/caja.service';
import { ConfiguracionService } from '../configuracion/configuracion.service';
import { resolverPorcentajeHonorarios } from '../common/honorarios.util';
import { UpsertVentaDto } from './dto/upsert-venta.dto';
import { RegistrarSenaDto } from './dto/registrar-sena.dto';
import { CerrarVentaDto } from './dto/cerrar-venta.dto';
import { VenderPorTercerosDto } from './dto/vender-por-terceros.dto';
import { CreateInteresadoDto } from './dto/create-interesado.dto';
import { UpdateInteresadoDto } from './dto/update-interesado.dto';

const INCLUDE_FICHA = {
  propiedad: { include: { propietario: true, designado: true } },
  interesados: { include: { cliente: true }, orderBy: { updatedAt: 'desc' as const } },
};

@Injectable()
export class VentasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cajaService: CajaService,
    private readonly configuracionService: ConfiguracionService,
  ) {}

  findAll(tipoPropiedad?: TipoPropiedad, estado?: EstadoVenta) {
    return this.prisma.venta.findMany({
      where: {
        estado,
        propiedad: tipoPropiedad ? { tipo: tipoPropiedad } : undefined,
      },
      include: INCLUDE_FICHA,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const venta = await this.prisma.venta.findUnique({ where: { id }, include: INCLUDE_FICHA });
    if (!venta) throw new NotFoundException('Venta no encontrada.');
    return venta;
  }

  // §2.3: alta o edición de la ficha de venta de una propiedad (1:1).
  async upsert(propiedadId: string, dto: UpsertVentaDto) {
    await this.prisma.propiedad.findUniqueOrThrow({ where: { id: propiedadId } });

    if (dto.estado === EstadoVenta.VENDIDA_POR_TERCEROS && !dto.vendidaPorTercerosDetalle) {
      throw new BadRequestException(
        'Al elegir "Vendida por terceros" hay que indicar el detalle de quién la vendió.',
      );
    }

    return this.prisma.venta.upsert({
      where: { propiedadId },
      update: {
        precio: dto.precio,
        moneda: dto.moneda,
        estado: dto.estado,
        publicada: dto.publicada,
        cierreEstimado: dto.cierreEstimado ? new Date(dto.cierreEstimado) : undefined,
        mejorOferta: dto.mejorOferta,
        vendidaPorTercerosDetalle:
          dto.estado === EstadoVenta.VENDIDA_POR_TERCEROS ? dto.vendidaPorTercerosDetalle : null,
      },
      create: {
        propiedadId,
        precio: dto.precio,
        moneda: dto.moneda,
        estado: dto.estado ?? EstadoVenta.PUBLICADA,
        publicada: dto.publicada ?? true,
        cierreEstimado: dto.cierreEstimado ? new Date(dto.cierreEstimado) : undefined,
        mejorOferta: dto.mejorOferta,
        vendidaPorTercerosDetalle:
          dto.estado === EstadoVenta.VENDIDA_POR_TERCEROS ? dto.vendidaPorTercerosDetalle : null,
      },
      include: INCLUDE_FICHA,
    });
  }

  // §3.6: seña recibida (etapa reserva) → INGRESO EN USD del mes en Caja.
  // Reemplaza el ingreso anterior si ya se había registrado una seña — este
  // mismo endpoint sirve tanto para registrar la seña por primera vez como
  // para corregirla después (Ventas y Carteles muestra "Editar seña" en vez
  // de "Registrar seña" una vez que ya está reservada).
  async registrarSena(id: string, dto: RegistrarSenaDto) {
    const venta = await this.prisma.venta.findUniqueOrThrow({
      where: { id },
      include: { propiedad: true },
    });

    return this.prisma.$transaction(async (tx) => {
      if (venta.movimientoCajaSenaId) {
        await tx.movimientoCaja.delete({ where: { id: venta.movimientoCajaSenaId } });
      }

      const movimiento = await this.cajaService.registrarMovimiento(
        {
          fecha: new Date(dto.fecha),
          tipo: TipoMovimientoCaja.INGRESO,
          moneda: Moneda.USD,
          monto: dto.monto,
          concepto: `Seña de venta — ${venta.propiedad.nombre}`,
          categoria: 'Ventas',
          origen: OrigenMovimientoCaja.SENA_VENTA,
        },
        tx,
      );

      return tx.venta.update({
        where: { id },
        data: {
          senaRecibida: dto.monto,
          estado: EstadoVenta.RESERVADA,
          movimientoCajaSenaId: movimiento.id,
        },
        include: INCLUDE_FICHA,
      });
    });
  }

  // Corrige un error de carga: quita la seña registrada (borra el ingreso en
  // Caja) y vuelve la venta a "Publicada" — simétrico de registrarSena.
  async eliminarSena(id: string) {
    const venta = await this.prisma.venta.findUniqueOrThrow({ where: { id } });
    if (venta.estado !== EstadoVenta.RESERVADA) {
      throw new BadRequestException('Esta venta no tiene una seña registrada para quitar.');
    }

    return this.prisma.$transaction(async (tx) => {
      if (venta.movimientoCajaSenaId) {
        await tx.movimientoCaja.delete({ where: { id: venta.movimientoCajaSenaId } });
      }

      return tx.venta.update({
        where: { id },
        data: { senaRecibida: null, estado: EstadoVenta.PUBLICADA, movimientoCajaSenaId: null },
        include: INCLUDE_FICHA,
      });
    });
  }

  // §3.6 + §2.3: venta cerrada por la inmobiliaria → comisión = % propio de
  // la propiedad (o el default de Configuración si no define uno — mismo
  // criterio que liquidaciones, §2.3 "todos los cálculos... usan el %
  // propio de cada propiedad") → INGRESO EN USD del mes del cierre.
  //
  // Reemplaza la comisión anterior si la venta ya estaba cerrada (mismo
  // patrón que registrarSena): este endpoint también sirve para corregir un
  // precio final o una fecha de cierre mal cargados, sin duplicar el
  // ingreso en Caja.
  async cerrar(id: string, dto: CerrarVentaDto) {
    const venta = await this.prisma.venta.findUniqueOrThrow({
      where: { id },
      include: { propiedad: true },
    });
    const configuracion = await this.configuracionService.get();

    const precioCierre = dto.precioFinal ?? Number(venta.precio);
    const porcentaje = resolverPorcentajeHonorarios(
      venta.propiedad,
      Number(configuracion.honorariosDefaultPorcentaje),
    );
    const comision = Math.round(precioCierre * (porcentaje / 100) * 100) / 100;

    return this.prisma.$transaction(async (tx) => {
      if (venta.movimientoCajaComisionId) {
        await tx.movimientoCaja.delete({ where: { id: venta.movimientoCajaComisionId } });
      }

      let movimientoCajaComisionId: string | undefined;
      if (comision > 0) {
        const movimiento = await this.cajaService.registrarMovimiento(
          {
            fecha: new Date(dto.fecha),
            tipo: TipoMovimientoCaja.INGRESO,
            moneda: Moneda.USD,
            monto: comision,
            concepto: `Comisión de venta — ${venta.propiedad.nombre}`,
            categoria: 'Ventas',
            origen: OrigenMovimientoCaja.COMISION_VENTA,
          },
          tx,
        );
        movimientoCajaComisionId = movimiento.id;
      }

      return tx.venta.update({
        where: { id },
        data: {
          estado: EstadoVenta.VENDIDA,
          cierreReal: new Date(dto.fecha),
          precio: precioCierre,
          movimientoCajaComisionId,
        },
        include: INCLUDE_FICHA,
      });
    });
  }

  // Corrige un error de carga: deshace el cierre (borra la comisión en Caja)
  // y vuelve la venta a "Reservada" — simétrico de eliminarSena.
  async deshacerCierre(id: string) {
    const venta = await this.prisma.venta.findUniqueOrThrow({ where: { id } });
    if (venta.estado !== EstadoVenta.VENDIDA) {
      throw new BadRequestException('Esta venta no está cerrada.');
    }

    return this.prisma.$transaction(async (tx) => {
      if (venta.movimientoCajaComisionId) {
        await tx.movimientoCaja.delete({ where: { id: venta.movimientoCajaComisionId } });
      }

      return tx.venta.update({
        where: { id },
        data: { estado: EstadoVenta.RESERVADA, cierreReal: null, movimientoCajaComisionId: null },
        include: INCLUDE_FICHA,
      });
    });
  }

  // §2.3: "Vendida por terceros" — no genera comisión ni honorarios
  // potenciales, la gestionó otra inmobiliaria o fue venta directa.
  venderPorTerceros(id: string, dto: VenderPorTercerosDto) {
    return this.prisma.venta.update({
      where: { id },
      data: {
        estado: EstadoVenta.VENDIDA_POR_TERCEROS,
        vendidaPorTercerosDetalle: dto.detalle,
        cierreReal: new Date(),
      },
      include: INCLUDE_FICHA,
    });
  }

  // §2.3: KPI "comisión potencial" — a diferencia de los cálculos reales
  // (que usan el % propio de cada propiedad), este indicador agregado usa
  // explícitamente el % de Configuración sobre las NO vendidas, convertido
  // a USD al dólar de referencia solo para este indicador.
  async kpis() {
    const [enVenta, reservadas, interesadosActivos, noVendidas, configuracion] = await Promise.all([
      this.prisma.venta.count({ where: { estado: EstadoVenta.PUBLICADA } }),
      this.prisma.venta.count({ where: { estado: EstadoVenta.RESERVADA } }),
      this.prisma.interesadoVenta.count({ where: { etapa: { not: 'DESCARTADO' } } }),
      this.prisma.venta.findMany({
        where: { estado: { notIn: [EstadoVenta.VENDIDA, EstadoVenta.VENDIDA_POR_TERCEROS] } },
      }),
      this.configuracionService.get(),
    ]);

    const dolarReferencia = Number(configuracion.dolarReferencia);
    const comisionPotencial = noVendidas.reduce((acc, v) => {
      const precioUsd =
        v.moneda === MonedaVenta.USD
          ? Number(v.precio)
          : dolarReferencia > 0
            ? Number(v.precio) / dolarReferencia
            : 0;
      return acc + precioUsd * (Number(configuracion.comisionVentaPorcentaje) / 100);
    }, 0);

    return { enVenta, reservadas, interesadosActivos, comisionPotencial };
  }

  // Interesados (pipeline: consulta → visita → negociación → reserva → descartado)
  crearInteresado(ventaId: string, dto: CreateInteresadoDto) {
    return this.prisma.interesadoVenta.create({
      data: { ventaId, ...dto },
      include: { cliente: true },
    });
  }

  editarInteresado(id: string, dto: UpdateInteresadoDto) {
    return this.prisma.interesadoVenta.update({
      where: { id },
      data: dto,
      include: { cliente: true },
    });
  }

  eliminarInteresado(id: string) {
    return this.prisma.interesadoVenta.delete({ where: { id } });
  }
}

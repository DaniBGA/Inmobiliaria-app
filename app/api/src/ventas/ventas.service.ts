import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  EstadoVenta,
  Moneda,
  MonedaVenta,
  OrigenMovimientoCaja,
  Prisma,
  RolUsuario,
  TipoMovimientoCaja,
  TipoPropiedad,
} from '@prisma/client';
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

type UsuarioRequest = { id: string; rol: RolUsuario; integranteEquipoId: string | null };

@Injectable()
export class VentasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cajaService: CajaService,
    private readonly configuracionService: ConfiguracionService,
  ) {}

  // Un designado (EQUIPO) solo ve/trabaja el pipeline de las propiedades
  // que el admin le asignó (mismo criterio que PropiedadesService.findAll,
  // pedido del usuario 2026-09-04).
  findAll(usuario: UsuarioRequest, tipoPropiedad?: TipoPropiedad, estado?: EstadoVenta) {
    return this.prisma.venta.findMany({
      where: {
        estado,
        propiedad: {
          tipo: tipoPropiedad,
          designadoId: usuario.rol === RolUsuario.EQUIPO ? usuario.integranteEquipoId : undefined,
        },
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

  // Un designado (EQUIPO) no puede operar sobre la venta de una propiedad
  // que no le fue asignada, aunque sepa el id — protege contra un JWT
  // robado usado directo contra la API (mismo criterio que
  // AgendaService.assertPropietario).
  private async assertPropietario(ventaId: string, usuario: UsuarioRequest) {
    if (usuario.rol !== RolUsuario.EQUIPO) return;
    const venta = await this.prisma.venta.findUnique({
      where: { id: ventaId },
      select: { propiedad: { select: { designadoId: true } } },
    });
    if (!venta) throw new NotFoundException('Venta no encontrada.');
    if (venta.propiedad.designadoId !== usuario.integranteEquipoId) {
      throw new ForbiddenException('No podés operar sobre una propiedad que no te fue designada.');
    }
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

  // Toma un lock de fila (`FOR UPDATE`) sobre la venta antes de leerla
  // dentro de la transacción — si dos personas disparan la misma acción
  // (ej. las dos "Cerrar venta") casi al mismo tiempo, la segunda espera a
  // que la primera termine y recién ahí lee el estado ya actualizado, en
  // vez de leer el mismo estado "viejo" que la primera y terminar creando
  // un segundo movimiento de Caja duplicado.
  private async lockVenta(tx: Prisma.TransactionClient, id: string) {
    await tx.$queryRaw`SELECT id FROM "ventas" WHERE id = ${id} FOR UPDATE`;
    const venta = await tx.venta.findUnique({ where: { id }, include: { propiedad: true } });
    if (!venta) throw new NotFoundException('Venta no encontrada.');
    return venta;
  }

  // §3.6: seña recibida (etapa reserva) — a diferencia del cierre (ver
  // cerrar() más abajo), la seña NO genera movimiento en Caja: de una venta,
  // lo único que se refleja ahí es el honorario/comisión al cerrarla. La
  // seña solo queda registrada en la ficha de la venta. Este mismo endpoint
  // sirve tanto para registrar la seña por primera vez como para corregirla
  // después (Ventas y Carteles muestra "Editar seña" en vez de "Registrar
  // seña" una vez que ya está reservada).
  async registrarSena(id: string, dto: RegistrarSenaDto, usuario: UsuarioRequest) {
    await this.assertPropietario(id, usuario);
    return this.prisma.$transaction(async (tx) => {
      const venta = await this.lockVenta(tx, id);

      // Limpieza de una seña cargada antes de este cambio, que sí había
      // generado un movimiento — no se vuelve a crear uno nuevo.
      if (venta.movimientoCajaSenaId) {
        await tx.movimientoCaja.delete({ where: { id: venta.movimientoCajaSenaId } });
      }

      return tx.venta.update({
        where: { id },
        data: {
          senaRecibida: dto.monto,
          estado: EstadoVenta.RESERVADA,
          movimientoCajaSenaId: null,
        },
        include: INCLUDE_FICHA,
      });
    });
  }

  // Corrige un error de carga: quita la seña registrada (borra el ingreso en
  // Caja) y vuelve la venta a "Publicada" — simétrico de registrarSena.
  async eliminarSena(id: string, usuario: UsuarioRequest) {
    await this.assertPropietario(id, usuario);
    return this.prisma.$transaction(async (tx) => {
      const venta = await this.lockVenta(tx, id);
      if (venta.estado !== EstadoVenta.RESERVADA) {
        throw new BadRequestException('Esta venta no tiene una seña registrada para quitar.');
      }

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
  async cerrar(id: string, dto: CerrarVentaDto, usuario: UsuarioRequest) {
    await this.assertPropietario(id, usuario);
    const configuracion = await this.configuracionService.get();

    return this.prisma.$transaction(async (tx) => {
      const venta = await this.lockVenta(tx, id);

      const precioCierre = dto.precioFinal ?? Number(venta.precio);
      const porcentaje = resolverPorcentajeHonorarios(
        venta.propiedad,
        Number(configuracion.honorariosDefaultPorcentaje),
      );
      const comision = dto.comisionManual ?? Math.round(precioCierre * (porcentaje / 100) * 100) / 100;

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
  async deshacerCierre(id: string, usuario: UsuarioRequest) {
    await this.assertPropietario(id, usuario);
    return this.prisma.$transaction(async (tx) => {
      const venta = await this.lockVenta(tx, id);
      if (venta.estado !== EstadoVenta.VENDIDA) {
        throw new BadRequestException('Esta venta no está cerrada.');
      }

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
  async venderPorTerceros(id: string, dto: VenderPorTercerosDto, usuario: UsuarioRequest) {
    await this.assertPropietario(id, usuario);
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
  async kpis(usuario: UsuarioRequest) {
    const propiedad =
      usuario.rol === RolUsuario.EQUIPO ? { designadoId: usuario.integranteEquipoId } : undefined;
    const [enVenta, reservadas, interesadosActivos, noVendidas, configuracion] = await Promise.all([
      this.prisma.venta.count({ where: { estado: EstadoVenta.PUBLICADA, propiedad } }),
      this.prisma.venta.count({ where: { estado: EstadoVenta.RESERVADA, propiedad } }),
      this.prisma.interesadoVenta.count({ where: { etapa: { not: 'DESCARTADO' }, venta: { propiedad } } }),
      this.prisma.venta.findMany({
        where: { estado: { notIn: [EstadoVenta.VENDIDA, EstadoVenta.VENDIDA_POR_TERCEROS] }, propiedad },
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

  // Un designado (EQUIPO) no puede tocar el interesado de una venta que no
  // le fue asignada, aunque sepa el id del interesado — mismo criterio que
  // assertPropietario, resuelto acá vía su venta.
  private async assertPropietarioDeInteresado(interesadoId: string, usuario: UsuarioRequest) {
    if (usuario.rol !== RolUsuario.EQUIPO) return;
    const interesado = await this.prisma.interesadoVenta.findUnique({
      where: { id: interesadoId },
      select: { ventaId: true },
    });
    if (!interesado) throw new NotFoundException('Interesado no encontrado.');
    await this.assertPropietario(interesado.ventaId, usuario);
  }

  // Interesados (pipeline: consulta → visita → negociación → reserva → descartado)
  async crearInteresado(ventaId: string, dto: CreateInteresadoDto, usuario: UsuarioRequest) {
    await this.assertPropietario(ventaId, usuario);
    return this.prisma.interesadoVenta.create({
      data: { ventaId, ...dto },
      include: { cliente: true },
    });
  }

  async editarInteresado(id: string, dto: UpdateInteresadoDto, usuario: UsuarioRequest) {
    await this.assertPropietarioDeInteresado(id, usuario);
    return this.prisma.interesadoVenta.update({
      where: { id },
      data: dto,
      include: { cliente: true },
    });
  }

  async eliminarInteresado(id: string, usuario: UsuarioRequest) {
    await this.assertPropietarioDeInteresado(id, usuario);
    return this.prisma.interesadoVenta.delete({ where: { id } });
  }
}

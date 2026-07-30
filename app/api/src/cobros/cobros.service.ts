import { Injectable } from '@nestjs/common';
import { Moneda, OrigenMovimientoCaja, TipoMovimientoCaja } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PropiedadesService } from '../propiedades/propiedades.service';
import { CajaService } from '../caja/caja.service';
import { ConfiguracionService } from '../configuracion/configuracion.service';
import { CreatePagoDto } from './dto/create-pago.dto';
import { UpdatePagoDto } from './dto/update-pago.dto';
import { fechaAMesString, finDeMes, mesCerrado, mesStringAFecha, primerDiaMes, ultimosMesesCerrados } from '../common/fecha.util';

export type EstadoCobro = 'PAGADO' | 'PENDIENTE' | 'IMPAGO' | 'NO_CORRESPONDE';

const VENTANA_DEUDA_MESES = 12; // §5.4

@Injectable()
export class CobrosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly propiedadesService: PropiedadesService,
    private readonly cajaService: CajaService,
    private readonly configuracionService: ConfiguracionService,
  ) {}

  private propiedadesAlquiladas() {
    return this.prisma.propiedad.findMany({
      where: { modalidad: 'ALQUILER', inquilino: { isNot: null } },
      include: { inquilino: true, propietario: true },
      orderBy: { nombre: 'asc' },
    });
  }

  // Últimos pagos de una propiedad (ficha de propiedad, Panel General) —
  // a diferencia de resumenMes, no está atado a un mes puntual.
  historialPagos(propiedadId: string, limit = 6) {
    return this.prisma.pago.findMany({
      where: { propiedadId, anulado: false },
      orderBy: { mes: 'desc' },
      take: limit,
    });
  }

  // Público: lo reusa Facturación (Recibo) para saber cuánto se cobró
  // efectivamente ese mes, sin duplicar la lógica de agregación.
  async cobradoDelMes(propiedadId: string, mes: Date): Promise<number> {
    const agregado = await this.prisma.pago.aggregate({
      where: { propiedadId, mes, anulado: false },
      _sum: { monto: true },
    });
    return Number(agregado._sum.monto ?? 0);
  }

  private calcularEstado(
    mes: Date,
    esperado: number | null,
    cobrado: number,
  ): EstadoCobro {
    if (esperado == null) return 'NO_CORRESPONDE';
    if (cobrado >= esperado) return 'PAGADO';
    return mesCerrado(mes) ? 'IMPAGO' : 'PENDIENTE';
  }

  // §2.2 / §3.1: tabla "Cobros del mes" — esperado, cobrado, estado y pagos
  // por cada propiedad alquilada con inquilino.
  async resumenMes(mesStr: string) {
    const mes = mesStringAFecha(mesStr);
    const propiedades = await this.propiedadesAlquiladas();

    const filas = await Promise.all(
      propiedades.map(async (p) => {
        const esperadoRaw = await this.propiedadesService.rentaVigente(p.id, finDeMes(mes));
        const esperado = esperadoRaw != null ? Number(esperadoRaw) : null;
        const cobrado = await this.cobradoDelMes(p.id, mes);
        const pagos = await this.prisma.pago.findMany({
          where: { propiedadId: p.id, mes, anulado: false },
          orderBy: { fecha: 'asc' },
        });
        return {
          propiedadId: p.id,
          propiedadNombre: p.nombre,
          inquilino: p.inquilino,
          propietario: p.propietario,
          esperado,
          cobrado,
          pendiente: esperado != null ? Math.max(esperado - cobrado, 0) : 0,
          estado: this.calcularEstado(mes, esperado, cobrado),
          pagos,
        };
      }),
    );

    const totales = filas.reduce(
      (acc, f) => ({
        esperado: acc.esperado + (f.esperado ?? 0),
        cobrado: acc.cobrado + f.cobrado,
        pendiente: acc.pendiente + f.pendiente,
      }),
      { esperado: 0, cobrado: 0, pendiente: 0 },
    );

    return { mes: mesStr, totales, filas };
  }

  // §3.1: registrar pago -> INGRESO automático en Caja, en la misma
  // transacción (si falla uno, no queda plata fantasma ni cobro sin caja).
  async registrarPago(propiedadId: string, dto: CreatePagoDto) {
    const propiedad = await this.prisma.propiedad.findUniqueOrThrow({
      where: { id: propiedadId },
    });
    const mes = mesStringAFecha(dto.mes);

    return this.prisma.$transaction(async (tx) => {
      const movimiento = await this.cajaService.registrarMovimiento(
        {
          fecha: new Date(dto.fecha),
          tipo: TipoMovimientoCaja.INGRESO,
          moneda: Moneda.ARS,
          monto: dto.monto,
          concepto: `Cobro alquiler — ${propiedad.nombre} (${dto.mes})`,
          categoria: 'Alquiler',
          medio: dto.medio,
          origen: OrigenMovimientoCaja.COBRO_ALQUILER,
        },
        tx,
      );

      return tx.pago.create({
        data: {
          propiedadId,
          mes,
          monto: dto.monto,
          fecha: new Date(dto.fecha),
          medio: dto.medio,
          comprobante: dto.comprobante,
          observaciones: dto.observaciones,
          movimientoCajaId: movimiento.id,
        },
      });
    });
  }

  async editarPago(pagoId: string, dto: UpdatePagoDto) {
    return this.prisma.$transaction(async (tx) => {
      const pago = await tx.pago.findUniqueOrThrow({ where: { id: pagoId } });

      const actualizado = await tx.pago.update({
        where: { id: pagoId },
        data: {
          monto: dto.monto ?? undefined,
          fecha: dto.fecha ? new Date(dto.fecha) : undefined,
          medio: dto.medio ?? undefined,
          comprobante: dto.comprobante,
          observaciones: dto.observaciones,
        },
      });

      // El registro de Caja se corrige junto con el pago que lo originó
      // (§3.8: los automáticos se corrigen desde su módulo de origen).
      if (pago.movimientoCajaId) {
        await tx.movimientoCaja.update({
          where: { id: pago.movimientoCajaId },
          data: {
            monto: dto.monto ?? undefined,
            fecha: dto.fecha ? new Date(dto.fecha) : undefined,
            medio: dto.medio ?? undefined,
          },
        });
      }

      return actualizado;
    });
  }

  async anularPago(pagoId: string) {
    return this.prisma.$transaction(async (tx) => {
      const pago = await tx.pago.findUniqueOrThrow({ where: { id: pagoId } });

      if (pago.movimientoCajaId) {
        await tx.movimientoCaja.delete({ where: { id: pago.movimientoCajaId } });
      }

      return tx.pago.update({
        where: { id: pagoId },
        data: { anulado: true, movimientoCajaId: null },
      });
    });
  }

  // §5.4: deuda acumulada sobre los últimos 12 meses cerrados (el mes en
  // curso todavía no es deuda — es "Pendiente" hasta que cierra, §5.3).
  async deudaAcumulada(propiedadId: string, ahora: Date = new Date()) {
    const meses = ultimosMesesCerrados(VENTANA_DEUDA_MESES, ahora);
    let deuda = 0;
    let mesesImpagos = 0;

    for (const mes of meses) {
      const esperadoRaw = await this.propiedadesService.rentaVigente(propiedadId, finDeMes(mes));
      if (esperadoRaw == null) continue;
      const cobrado = await this.cobradoDelMes(propiedadId, mes);
      const faltante = Number(esperadoRaw) - cobrado;
      if (faltante > 0) {
        deuda += faltante;
        mesesImpagos++;
      }
    }

    return { deuda, mesesImpagos };
  }

  // Detalle mes a mes de lo pendiente (deuda + mes en curso si todavía no se
  // cobró) — lo usa el selector de "Pago de alquiler" en Caja para saber
  // qué meses concretos puede saldar un inquilino, en vez de un monto suelto.
  async mesesPendientes(propiedadId: string, ahora: Date = new Date()) {
    const meses = [...ultimosMesesCerrados(VENTANA_DEUDA_MESES, ahora), primerDiaMes(ahora)];
    const pendientes: { mes: string; esperado: number; cobrado: number; pendiente: number }[] = [];

    for (const mes of meses) {
      const esperadoRaw = await this.propiedadesService.rentaVigente(propiedadId, finDeMes(mes));
      if (esperadoRaw == null) continue;
      const esperado = Number(esperadoRaw);
      const cobrado = await this.cobradoDelMes(propiedadId, mes);
      const pendiente = Math.max(esperado - cobrado, 0);
      if (pendiente > 0) {
        pendientes.push({ mes: fechaAMesString(mes), esperado, cobrado, pendiente });
      }
    }

    return pendientes;
  }

  // §2.2 FICHAS DE INQUILINOS
  async fichasInquilinos() {
    const [propiedades, configuracion] = await Promise.all([
      this.propiedadesAlquiladas(),
      this.configuracionService.get(),
    ]);

    return Promise.all(
      propiedades.map(async (p) => {
        const [{ deuda, mesesImpagos }, rentaVigenteRaw, ultimoPago] = await Promise.all([
          this.deudaAcumulada(p.id),
          this.propiedadesService.rentaVigente(p.id),
          this.prisma.pago.findFirst({
            where: { propiedadId: p.id, anulado: false },
            orderBy: { fecha: 'desc' },
          }),
        ]);

        return {
          propiedadId: p.id,
          propiedadNombre: p.nombre,
          inquilino: p.inquilino,
          rentaVigente: rentaVigenteRaw != null ? Number(rentaVigenteRaw) : null,
          diaVencimiento: configuracion.diaVencimientoAlquiler,
          deudaAcumulada: deuda,
          mesesImpagos,
          ultimoPago,
        };
      }),
    );
  }

  // KPIs para Panel General (§2.1) y encabezado de Inquilinos y Cobros
  async kpis() {
    const propiedades = await this.propiedadesAlquiladas();
    const deudas = await Promise.all(
      propiedades.map((p) => this.deudaAcumulada(p.id)),
    );

    const inquilinosActivos = propiedades.length;
    const conDeuda = deudas.filter((d) => d.deuda > 0).length;
    const deudaTotalAcumulada = deudas.reduce((acc, d) => acc + d.deuda, 0);

    return {
      inquilinosActivos,
      alDia: inquilinosActivos - conDeuda,
      conDeuda,
      deudaTotalAcumulada,
    };
  }
}

import { Injectable } from '@nestjs/common';
import { EstadoCliente } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CobrosService } from '../cobros/cobros.service';
import { IncidenciasService } from '../incidencias/incidencias.service';
import { PropiedadesService } from '../propiedades/propiedades.service';
import { ConfiguracionService } from '../configuracion/configuracion.service';
import { primerDiaMes } from '../common/fecha.util';

function formatearFecha(fecha: Date): string {
  return fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatearMonto(monto: number): string {
  return monto.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

@Injectable()
export class AvisosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cobrosService: CobrosService,
    private readonly incidenciasService: IncidenciasService,
    private readonly propiedadesService: PropiedadesService,
    private readonly configuracionService: ConfiguracionService,
  ) {}

  // §2.8: reclamos de deuda — a partir de las fichas de inquilinos (§2.2).
  // `clave` incluye el monto: si la deuda de la misma propiedad cambia
  // (sube un mes más, o se salda parcialmente), es un aviso distinto y
  // vuelve a aparecer aunque el anterior se haya descartado.
  private async reclamosDeuda() {
    const fichas = await this.cobrosService.fichasInquilinos();
    return fichas
      .filter((f) => f.deudaAcumulada > 0)
      .map((f) => ({
        grupo: 'RECLAMO_DEUDA' as const,
        clave: `${f.propiedadId}:${f.deudaAcumulada}`,
        propiedadId: f.propiedadId,
        inquilino: f.inquilino,
        deuda: f.deudaAcumulada,
        mesesImpagos: f.mesesImpagos,
        texto:
          `Hola ${f.inquilino?.nombre ?? ''}, te escribimos de la inmobiliaria para recordarte ` +
          `que tenés una deuda acumulada de $${formatearMonto(f.deudaAcumulada)} ` +
          `correspondiente a ${f.mesesImpagos} mes(es). Por favor comunicate a la brevedad para regularizar la situación. Saludos.`,
      }));
  }

  // §2.8 / §3.3: pedidos de presupuesto — incidencias sin proveedor asignado
  private async pedidosPresupuesto() {
    const incidencias = await this.incidenciasService.findSinProveedor();
    return incidencias.map((i) => ({
      grupo: 'PEDIDO_PRESUPUESTO' as const,
      clave: i.id,
      incidenciaId: i.id,
      propiedad: i.propiedad,
      titulo: i.titulo,
      texto: `Solicitamos presupuesto para: "${i.titulo}" (rubro: ${i.rubro}) en ${i.propiedad.nombre}.`,
    }));
  }

  // §2.8 / §3.1: avisos de aumento — próximo aumento dentro de la ventana
  // configurada (diasAnticipacionAumento). `clave` incluye la fecha: al
  // aplicar el aumento, el próximo cambia y el aviso descartado no vuelve a
  // ocultar el siguiente.
  private async avisosAumento() {
    const configuracion = await this.configuracionService.get();
    const hoy = new Date();
    const limite = new Date(hoy);
    limite.setDate(limite.getDate() + configuracion.diasAnticipacionAumento);

    const propiedades = await this.prisma.propiedad.findMany({
      where: { modalidad: 'ALQUILER', inquilino: { isNot: null } },
      include: { inquilino: true },
    });

    const avisos = [];
    for (const p of propiedades) {
      const proxima = await this.propiedadesService.proximoAumento(p.id);
      if (proxima && proxima >= hoy && proxima <= limite) {
        const rentaVigenteRaw = await this.propiedadesService.rentaVigente(p.id);
        avisos.push({
          grupo: 'AVISO_AUMENTO' as const,
          clave: `${p.id}:${proxima.toISOString().slice(0, 10)}`,
          propiedadId: p.id,
          inquilino: p.inquilino,
          fecha: proxima,
          texto:
            `Hola ${p.inquilino?.nombre ?? ''}, te avisamos que el ${formatearFecha(proxima)} ` +
            `corresponde actualizar el alquiler de ${p.nombre} ` +
            `(valor vigente actual: $${formatearMonto(Number(rentaVigenteRaw ?? 0))}). Te contactaremos con el nuevo monto.`,
        });
      }
    }
    return avisos;
  }

  // §2.8: renovaciones de contrato dentro de la ventana configurada
  // (diasAnticipacionVencimiento). `clave` incluye la fecha de fin: al
  // renovar el contrato cambia y el aviso vuelve a aparecer para la próxima.
  private async renovacionesContrato() {
    const configuracion = await this.configuracionService.get();
    const hoy = new Date();
    const limite = new Date(hoy);
    limite.setDate(limite.getDate() + configuracion.diasAnticipacionVencimiento);

    const propiedades = await this.prisma.propiedad.findMany({
      where: { contratoFin: { gte: hoy, lte: limite } },
      include: { inquilino: true },
    });

    return propiedades.map((p) => ({
      grupo: 'RENOVACION_CONTRATO' as const,
      clave: `${p.id}:${p.contratoFin!.toISOString().slice(0, 10)}`,
      propiedadId: p.id,
      inquilino: p.inquilino,
      contratoFin: p.contratoFin,
      texto:
        `El contrato de ${p.nombre} vence el ${formatearFecha(p.contratoFin!)}. ` +
        `Coordinemos la renovación con ${p.inquilino?.nombre ?? 'el inquilino'}.`,
    }));
  }

  // §2.8 / §2.6: clientes sin contactar
  private async clientesSinContactar() {
    const clientes = await this.prisma.cliente.findMany({
      where: { estado: EstadoCliente.SIN_CONTACTAR },
    });
    return clientes.map((c) => ({
      grupo: 'CLIENTE_SIN_CONTACTAR' as const,
      clave: c.id,
      clienteId: c.id,
      nombre: c.nombre,
      telefono: c.telefono,
      email: c.email,
      texto: `Hola ${c.nombre}, te contactamos de la inmobiliaria respecto a tu búsqueda. ¿Seguís interesado/a?`,
    }));
  }

  // §2.8: recordatorios — eventos de agenda manuales pendientes de los
  // próximos 7 días
  private async recordatorios() {
    const hoy = new Date();
    const limite = new Date(hoy);
    limite.setDate(limite.getDate() + 7);

    const eventos = await this.prisma.eventoAgenda.findMany({
      where: { hecho: false, fecha: { gte: hoy, lte: limite } },
      include: { cliente: true, propiedad: true },
      orderBy: { fecha: 'asc' },
    });

    return eventos.map((e) => ({
      grupo: 'RECORDATORIO' as const,
      clave: e.id,
      eventoId: e.id,
      titulo: e.titulo,
      fecha: e.fecha,
      texto: `Recordatorio: ${e.titulo} — ${formatearFecha(e.fecha)}.`,
    }));
  }

  // §2.8 / §3.4: liquidaciones ya generadas este mes, listas para
  // compartir. `liquidacionId` ya es una clave segura: regenerar la
  // liquidación de un propietario borra la anterior y crea una fila nueva
  // (LiquidacionesService.generar()), así que nunca queda un descarte
  // apuntando a un monto viejo.
  private async liquidacionesListas() {
    const mesActual = primerDiaMes(new Date());
    const liquidaciones = await this.prisma.liquidacion.findMany({
      where: { mes: mesActual },
      include: { propietario: true },
    });

    return liquidaciones.map((l) => ({
      grupo: 'LIQUIDACION_LISTA' as const,
      clave: l.id,
      liquidacionId: l.id,
      propietario: l.propietario,
      netoAGirar: Number(l.netoAGirar),
      texto:
        `Hola ${l.propietario.nombre}, tu liquidación de este mes ya está lista. ` +
        `Neto a girar: $${formatearMonto(Number(l.netoAGirar))}.`,
    }));
  }

  // §2.8: agrupa todos los avisos generados automáticamente, sacando los que
  // el usuario ya descartó. El texto es editable en el frontend antes de
  // enviar, pero eso no se persiste acá (§2.8: "la edición no se guarda, al
  // recargar vuelve el texto generado") — lo único que se persiste es el
  // descarte explícito de un aviso puntual (ver `descartar()`).
  async generar() {
    const [
      reclamosDeuda,
      pedidosPresupuesto,
      avisosAumento,
      renovacionesContrato,
      clientesSinContactar,
      recordatorios,
      liquidacionesListas,
      descartados,
    ] = await Promise.all([
      this.reclamosDeuda(),
      this.pedidosPresupuesto(),
      this.avisosAumento(),
      this.renovacionesContrato(),
      this.clientesSinContactar(),
      this.recordatorios(),
      this.liquidacionesListas(),
      this.prisma.avisoDescartado.findMany(),
    ]);

    const descartadosSet = new Set(descartados.map((d) => `${d.grupo}:${d.clave}`));
    const sinDescartados = <T extends { grupo: string; clave: string }>(items: T[]) =>
      items.filter((it) => !descartadosSet.has(`${it.grupo}:${it.clave}`));

    return {
      reclamosDeuda: sinDescartados(reclamosDeuda),
      pedidosPresupuesto: sinDescartados(pedidosPresupuesto),
      avisosAumento: sinDescartados(avisosAumento),
      renovacionesContrato: sinDescartados(renovacionesContrato),
      clientesSinContactar: sinDescartados(clientesSinContactar),
      recordatorios: sinDescartados(recordatorios),
      liquidacionesListas: sinDescartados(liquidacionesListas),
    };
  }

  // Descarta un aviso puntual de la vista (ver el comentario en el modelo
  // `AvisoDescartado`). Upsert porque no pasa nada si el usuario lo
  // descarta dos veces (doble clic, etc.).
  descartar(grupo: string, clave: string) {
    return this.prisma.avisoDescartado.upsert({
      where: { grupo_clave: { grupo, clave } },
      update: {},
      create: { grupo, clave },
    });
  }
}

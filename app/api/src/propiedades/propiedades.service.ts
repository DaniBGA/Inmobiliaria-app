import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { unlink, writeFile } from 'fs/promises';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { procesarFotoParaTarjeta } from '../common/imagen.util';
import { primerDiaMes } from '../common/fecha.util';
import { CreatePropiedadDto } from './dto/create-propiedad.dto';
import { UpdatePropiedadDto } from './dto/update-propiedad.dto';
import { RegistrarAumentoDto } from './dto/registrar-aumento.dto';
import { UpdateAumentoDto } from './dto/update-aumento.dto';
import { UpsertInquilinoDto } from './dto/upsert-inquilino.dto';
import { UPLOADS_DIR, FOTOS_DIR } from './multer.config';

const INCLUDE_FICHA = {
  propietario: true,
  inquilino: true,
  designado: true,
  historialAumentos: { orderBy: [{ fecha: 'desc' as const }, { createdAt: 'desc' as const }] },
  venta: { include: { interesados: true } },
  fotos: { orderBy: { orden: 'asc' as const } },
  documentos: { orderBy: { subidoEn: 'desc' as const } },
};

@Injectable()
export class PropiedadesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.propiedad.findMany({
      include: {
        propietario: true,
        inquilino: true,
        designado: true,
        venta: true,
        fotos: { orderBy: { orden: 'asc' } },
      },
      orderBy: { nombre: 'asc' },
    });
  }

  findOne(id: string) {
    return this.prisma.propiedad.findUniqueOrThrow({
      where: { id },
      include: INCLUDE_FICHA,
    });
  }

  async create(dto: CreatePropiedadDto) {
    const {
      montoAlquilerInicial,
      fechaAlquilerInicial,
      contratoInicio,
      contratoFin,
      ...datos
    } = dto;

    const propiedad = await this.prisma.propiedad.create({
      data: {
        ...datos,
        contratoInicio: contratoInicio ? new Date(contratoInicio) : undefined,
        contratoFin: contratoFin ? new Date(contratoFin) : undefined,
        montoAlquilerVigente: montoAlquilerInicial ?? undefined,
      },
    });

    // Solo se crea el primer `HistorialAumento` acá si vino una fecha real
    // de arranque de contrato (`fechaAlquilerInicial`/`contratoInicio`) —
    // nunca con un fallback a "hoy". `AgregarPropiedadPage.tsx` no manda
    // ninguna de las dos (ahí "monto de alquiler inicial" es solo el precio
    // de publicación de una propiedad todavía vacante, sin contrato real
    // todavía), así que antes esto fabricaba un aumento fechado el día en
    // que se cargó la propiedad — no el día en que arrancó el contrato. Si
    // después se le asignaba un inquilino con un contrato viejo (vía
    // `AlquilarPropiedadModal`, que registra su propio aumento con la fecha
    // real de `contratoInicio`), ese aumento fantasma "de hoy" quedaba como
    // el más reciente (`proximoAumento()`/`rentaVigente()` anclan siempre
    // en el último) y pisaba el cálculo real de aumentos — bug reportado
    // por el usuario 2026-08-18, mismo mecanismo que ya se había detectado
    // como aumento duplicado en una propiedad real (ver CONEXIONES.md).
    // Ahora el historial de una propiedad recién empieza a existir cuando
    // se asigna el primer inquilino de verdad.
    if (montoAlquilerInicial != null && (fechaAlquilerInicial || contratoInicio)) {
      await this.prisma.historialAumento.create({
        data: {
          propiedadId: propiedad.id,
          fecha: new Date(fechaAlquilerInicial ?? contratoInicio!),
          monto: montoAlquilerInicial,
        },
      });
    }

    return this.findOne(propiedad.id);
  }

  async update(id: string, dto: UpdatePropiedadDto) {
    const { contratoInicio, contratoFin, ...datos } = dto;
    await this.prisma.propiedad.update({
      where: { id },
      data: {
        ...datos,
        contratoInicio: contratoInicio ? new Date(contratoInicio) : undefined,
        contratoFin: contratoFin ? new Date(contratoFin) : undefined,
      },
    });
    return this.findOne(id);
  }

  // Todo lo demás (venta, inquilino, historial, fotos, gastos, pagos,
  // facturas, carteles, incidencias...) cuelga de Propiedad con
  // onDelete: Cascade — se borra solo. La única excepción a propósito es
  // LiquidacionPropiedad (onDelete: Restrict, §3.4): una liquidación ya
  // emitida es un comprobante histórico hacia el propietario, no se puede
  // perder en cascada solo porque la propiedad se borra del catálogo.
  async remove(id: string) {
    try {
      return await this.prisma.propiedad.delete({ where: { id } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new BadRequestException(
          'Esta propiedad tiene liquidaciones registradas a nombre del propietario y no se puede eliminar ' +
            '(se perdería ese historial). Si fue un error de carga, corregí sus datos con "Editar ficha" en vez de borrarla.',
        );
      }
      throw error;
    }
  }

  // §5.1: la renta vigente es el monto del último aumento anterior (o igual)
  // a la fecha de cálculo. Punto único reusado por Cobros, Facturas y
  // Liquidaciones — nadie más debe recalcular esto por su cuenta.
  //
  // Si no hay ningún HistorialAumento con fecha <= la consultada, no hay
  // renta vigente para ese momento (p. ej. es anterior al inicio del
  // contrato): devuelve null. No cae al monto cacheado en Propiedad —ese
  // campo es solo una lectura rápida del valor actual para listados, no una
  // fuente válida para fechas pasadas.
  async rentaVigente(propiedadId: string, fecha: Date = new Date()) {
    // `createdAt` desempata cuando dos aumentos comparten la misma `fecha`
    // (p. ej. se crea la propiedad y se aplica un aumento el mismo día): sin
    // esto, el orden entre filas con igual `fecha` no está garantizado.
    const ultimo = await this.prisma.historialAumento.findFirst({
      where: { propiedadId, fecha: { lte: fecha } },
      orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }],
    });
    return ultimo?.monto ?? null;
  }

  // §3.1: el precio se mantiene fijo durante los `frecuenciaAumentoMeses`
  // meses posteriores al último aumento, y el aumento entra en vigencia el
  // día 1 de un mes — nunca a mitad de mes. El mes del último aumento
  // siempre cuenta como el primero de los `frecuenciaAumentoMeses`, sin
  // importar qué día de ese mes haya arrancado (decisión explícita del
  // usuario 2026-08-18: un contrato desde el 03/08 con frecuencia
  // trimestral entra en vigencia el 01/11, contando agosto como el primer
  // mes). **Reemplaza** la regla anterior (2026-07-30), que hacía contar
  // como parcial cualquier mes que no arrancara el día 1 y sumaba un mes
  // extra — con esa regla vieja, un contrato desde el 27/07 trimestral daba
  // 01/11 (jul parcial, ago-sep-oct completos); con esta, da 01/10 (jul ya
  // cuenta como el primer mes, jul-ago-sep). Se calcula con componentes
  // año/mes vía `Date.UTC` (nunca `setMonth` sobre la fecha original) para
  // no depender del día del mes de origen ni sufrir su overflow en meses
  // cortos.
  async proximoAumento(propiedadId: string) {
    const propiedad = await this.prisma.propiedad.findUniqueOrThrow({
      where: { id: propiedadId },
      select: { frecuenciaAumentoMeses: true, contratoInicio: true, contratoFin: true, inquilino: { select: { id: true } } },
    });
    // Vacante = sin contrato vigente — aunque queden `frecuenciaAumentoMeses`
    // o historial de una tenencia anterior, no corresponde mostrar ningún
    // "próximo aumento" hasta que haya un inquilino de nuevo.
    if (!propiedad.inquilino) return null;
    if (!propiedad.frecuenciaAumentoMeses || !propiedad.contratoInicio) return null;

    // El ancla es el último aumento ya registrado DESDE que arrancó este
    // contrato (fecha >= contratoInicio) — así un aumento que haya quedado
    // de un inquilino anterior nunca se cuela acá. Si todavía no se
    // registró ninguno para este contrato, el ancla es el propio inicio.
    const ultimoDeEsteContrato = await this.prisma.historialAumento.findFirst({
      where: { propiedadId, fecha: { gte: propiedad.contratoInicio } },
      orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }],
    });
    const anclaFecha = ultimoDeEsteContrato ? new Date(ultimoDeEsteContrato.fecha) : new Date(propiedad.contratoInicio);

    const proximo = new Date(
      Date.UTC(anclaFecha.getUTCFullYear(), anclaFecha.getUTCMonth() + propiedad.frecuenciaAumentoMeses, 1),
    );

    // Si el contrato ya termina antes de que llegue ese aumento, no
    // corresponde mostrarlo — el contrato se va a renovar o terminar antes
    // de esa fecha, así que no hay "próximo aumento" real que anunciar.
    if (propiedad.contratoFin && proximo.getTime() > propiedad.contratoFin.getTime()) return null;

    return proximo;
  }

  // Lista completa (no solo el próximo) de fechas de aumento que le quedan
  // al contrato vigente, para mostrar en la ficha (§ "Próximos aumentos").
  // Mismo ancla y misma regla de "el mes del último aumento cuenta como el
  // primero" que proximoAumento() — acá simplemente se repite el paso de
  // `frecuenciaAumentoMeses` en meses hasta pasarse de contratoFin. Si el
  // contrato no tiene fecha de fin cargada, no hay tope natural: se corta
  // en TOPE_SIN_FIN ocurrencias para no listar al infinito.
  async proximosAumentos(propiedadId: string) {
    const propiedad = await this.prisma.propiedad.findUniqueOrThrow({
      where: { id: propiedadId },
      select: { frecuenciaAumentoMeses: true, contratoInicio: true, contratoFin: true, inquilino: { select: { id: true } } },
    });
    if (!propiedad.inquilino) return [];
    if (!propiedad.frecuenciaAumentoMeses || !propiedad.contratoInicio) return [];

    const ultimoDeEsteContrato = await this.prisma.historialAumento.findFirst({
      where: { propiedadId, fecha: { gte: propiedad.contratoInicio } },
      orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }],
    });
    const anclaFecha = ultimoDeEsteContrato ? new Date(ultimoDeEsteContrato.fecha) : new Date(propiedad.contratoInicio);

    const TOPE_SIN_FIN = 6;
    const fechas: Date[] = [];
    for (let i = 1; ; i++) {
      const fecha = new Date(
        Date.UTC(anclaFecha.getUTCFullYear(), anclaFecha.getUTCMonth() + propiedad.frecuenciaAumentoMeses * i, 1),
      );
      if (propiedad.contratoFin) {
        if (fecha.getTime() > propiedad.contratoFin.getTime()) break;
      } else if (fechas.length >= TOPE_SIN_FIN) {
        break;
      }
      fechas.push(fecha);
    }

    return fechas.map((fecha) => ({ fecha }));
  }

  async registrarAumento(propiedadId: string, dto: RegistrarAumentoDto) {
    await this.prisma.propiedad.findUniqueOrThrow({ where: { id: propiedadId } });

    await this.prisma.historialAumento.create({
      data: {
        propiedadId,
        fecha: new Date(dto.fecha),
        monto: dto.monto,
      },
    });

    // Recalcula el vigente por si el aumento cargado no es cronológicamente
    // el último (carga tardía de un aumento retroactivo).
    const vigente = await this.rentaVigente(propiedadId);
    await this.prisma.propiedad.update({
      where: { id: propiedadId },
      data: { montoAlquilerVigente: vigente ?? undefined },
    });

    return this.findOne(propiedadId);
  }

  // Corrección de un aumento ya cargado (fecha y/o monto mal tipeados) — no
  // recrea la fila, la edita en el lugar. Igual que en `registrarAumento`,
  // recalcula `montoAlquilerVigente` por si la edición cambió cuál es el
  // aumento más reciente.
  async editarAumento(propiedadId: string, aumentoId: string, dto: UpdateAumentoDto) {
    const aumento = await this.prisma.historialAumento.findUniqueOrThrow({ where: { id: aumentoId } });
    if (aumento.propiedadId !== propiedadId) {
      throw new BadRequestException('Ese aumento no pertenece a esta propiedad.');
    }

    await this.prisma.historialAumento.update({
      where: { id: aumentoId },
      data: {
        fecha: dto.fecha ? new Date(dto.fecha) : undefined,
        monto: dto.monto,
      },
    });

    const vigente = await this.rentaVigente(propiedadId);
    await this.prisma.propiedad.update({
      where: { id: propiedadId },
      data: { montoAlquilerVigente: vigente ?? undefined },
    });

    return this.findOne(propiedadId);
  }

  async eliminarAumento(propiedadId: string, aumentoId: string) {
    const aumento = await this.prisma.historialAumento.findUniqueOrThrow({ where: { id: aumentoId } });
    if (aumento.propiedadId !== propiedadId) {
      throw new BadRequestException('Ese aumento no pertenece a esta propiedad.');
    }

    await this.prisma.historialAumento.delete({ where: { id: aumentoId } });

    const vigente = await this.rentaVigente(propiedadId);
    await this.prisma.propiedad.update({
      where: { id: propiedadId },
      data: { montoAlquilerVigente: vigente ?? undefined },
    });

    return this.findOne(propiedadId);
  }

  async upsertInquilino(propiedadId: string, dto: UpsertInquilinoDto) {
    await this.prisma.propiedad.findUniqueOrThrow({ where: { id: propiedadId } });
    const { alDia, ...datos } = dto;
    // Solo se toca `alDiaDesde` cuando el checkbox viene explícito en el
    // request (creación desde AlquilarPropiedadModal); una edición que no
    // lo manda (EditarInquilinoModal) no debe pisar el valor ya guardado.
    // El mes se calcula del lado del servidor (no del cliente) para no
    // depender del reloj del navegador.
    const alDiaDesde = alDia === undefined ? undefined : alDia ? primerDiaMes(new Date()) : null;
    await this.prisma.inquilino.upsert({
      where: { propiedadId },
      update: { ...datos, ...(alDia === undefined ? {} : { alDiaDesde }) },
      create: { ...datos, propiedadId, alDiaDesde: alDiaDesde ?? undefined },
    });
    return this.findOne(propiedadId);
  }

  removeInquilino(propiedadId: string) {
    return this.prisma.inquilino.delete({ where: { propiedadId } });
  }

  // Fotos (galería, pensada para Ventas y para la futura página pública —
  // Fase 7). `orden` se asigna como "siguiente lugar libre" para que las
  // fotos aparezcan en el orden en que se subieron.
  async agregarFoto(propiedadId: string, archivo: Express.Multer.File) {
    await this.prisma.propiedad.findUniqueOrThrow({ where: { id: propiedadId } });
    const ultima = await this.prisma.fotoPropiedad.findFirst({
      where: { propiedadId },
      orderBy: { orden: 'desc' },
    });

    // Recorte/recompresión estándar (1080x1350, JPEG) — ver imagen.util.ts.
    // Siempre se guarda como .jpg sin importar el formato original.
    const procesada = await procesarFotoParaTarjeta(archivo.buffer);
    if (!existsSync(FOTOS_DIR)) mkdirSync(FOTOS_DIR, { recursive: true });
    const nombreArchivo = `${randomUUID()}.jpg`;
    await writeFile(join(FOTOS_DIR, nombreArchivo), procesada);

    return this.prisma.fotoPropiedad.create({
      data: {
        propiedadId,
        url: `/uploads/propiedades/${nombreArchivo}`,
        orden: (ultima?.orden ?? -1) + 1,
      },
    });
  }

  // Cuál foto usa el carrusel destacado del Hero para esta propiedad (solo
  // aplica si es "carácter especial") — a lo sumo una en true, así que hay
  // que desmarcar cualquier otra de la misma propiedad en la misma
  // transacción antes de marcar la elegida. Tocar la que ya es portada la
  // destilda (vuelve a "sin portada explícita", usa la primera por orden).
  async marcarFotoPortada(propiedadId: string, fotoId: string) {
    const foto = await this.prisma.fotoPropiedad.findUniqueOrThrow({ where: { id: fotoId } });
    if (foto.propiedadId !== propiedadId) {
      throw new BadRequestException('Esa foto no pertenece a esta propiedad.');
    }

    await this.prisma.$transaction([
      this.prisma.fotoPropiedad.updateMany({ where: { propiedadId, esPortada: true }, data: { esPortada: false } }),
      ...(foto.esPortada ? [] : [this.prisma.fotoPropiedad.update({ where: { id: fotoId }, data: { esPortada: true } })]),
    ]);

    return { ok: true };
  }

  async eliminarFoto(propiedadId: string, fotoId: string) {
    const foto = await this.prisma.fotoPropiedad.findUniqueOrThrow({ where: { id: fotoId } });
    if (foto.propiedadId !== propiedadId) {
      throw new BadRequestException('Esa foto no pertenece a esta propiedad.');
    }

    await this.prisma.fotoPropiedad.delete({ where: { id: fotoId } });
    // Si el archivo ya no está en disco (borrado a mano, etc.) no hace
    // falta que la operación falle — la fila de la DB es la fuente de
    // verdad para lo que se muestra.
    await unlink(join(UPLOADS_DIR, 'propiedades', foto.url.split('/').pop()!)).catch(() => {});

    return { ok: true };
  }

  // Documentación (contratos PDF, §7.4 del documento funcional — antes un
  // placeholder en localStorage, ahora un archivo real en disco).
  async agregarDocumento(propiedadId: string, archivo: Express.Multer.File) {
    await this.prisma.propiedad.findUniqueOrThrow({ where: { id: propiedadId } });

    return this.prisma.documento.create({
      data: {
        propiedadId,
        nombre: archivo.originalname,
        url: `/uploads/documentos/${archivo.filename}`,
        tamanioBytes: archivo.size,
      },
    });
  }

  async eliminarDocumento(propiedadId: string, documentoId: string) {
    const doc = await this.prisma.documento.findUniqueOrThrow({ where: { id: documentoId } });
    if (doc.propiedadId !== propiedadId) {
      throw new BadRequestException('Ese documento no pertenece a esta propiedad.');
    }

    await this.prisma.documento.delete({ where: { id: documentoId } });
    await unlink(join(UPLOADS_DIR, 'documentos', doc.url.split('/').pop()!)).catch(() => {});

    return { ok: true };
  }
}

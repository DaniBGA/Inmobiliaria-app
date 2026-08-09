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

    if (montoAlquilerInicial != null) {
      await this.prisma.historialAumento.create({
        data: {
          propiedadId: propiedad.id,
          // Sin `new Date()` a secas acá: eso incluye la hora actual, y como
          // el resto de los aumentos siempre se cargan a partir de un
          // `@IsDateString()` (medianoche UTC), un aumento posterior el
          // mismo día quedaría ordenado *antes* que este por `fecha desc`
          // (medianoche < la hora en que se creó la propiedad).
          fecha: fechaAlquilerInicial
            ? new Date(fechaAlquilerInicial)
            : contratoInicio
              ? new Date(contratoInicio)
              : new Date(new Date().toISOString().slice(0, 10)),
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
  // día 1 de un mes — nunca a mitad de mes. Si el último aumento no cayó
  // justo el día 1 (lo normal: un contrato casi siempre arranca a mitad de
  // mes), ese mes inicial es parcial y no cuenta como uno de los
  // `frecuenciaAumentoMeses` completos — por eso hay que redondear hacia
  // arriba un mes más. P. ej. contrato desde el 27/07 con frecuencia
  // trimestral: julio es parcial, ago-sep-oct son los 3 meses completos al
  // precio viejo, y el aumento entra el 01/11 (no el 01/10, que sería a
  // mitad del 3er mes completo). Si el último aumento hubiese caído el
  // 01/07 en cambio, los 3 meses completos son jul-ago-sep y el aumento
  // entra el 01/10. Se calcula con componentes año/mes/día vía `Date.UTC`
  // (nunca `setMonth` sobre la fecha original) para no depender del día del
  // mes de origen ni sufrir su overflow en meses cortos.
  async proximoAumento(propiedadId: string) {
    const propiedad = await this.prisma.propiedad.findUniqueOrThrow({
      where: { id: propiedadId },
      select: { frecuenciaAumentoMeses: true, contratoInicio: true, inquilino: { select: { id: true } } },
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

    const mesParcial = anclaFecha.getUTCDate() === 1 ? 0 : 1;
    const mesesAAgregar = propiedad.frecuenciaAumentoMeses + mesParcial;
    return new Date(Date.UTC(anclaFecha.getUTCFullYear(), anclaFecha.getUTCMonth() + mesesAAgregar, 1));
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

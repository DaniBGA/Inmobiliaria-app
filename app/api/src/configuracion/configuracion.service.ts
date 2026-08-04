import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { unlink, writeFile } from 'fs/promises';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { procesarFotoParaTarjeta } from '../common/imagen.util';
import { UpdateConfiguracionDto } from './dto/update-configuracion.dto';
import { FOTO_NOSOTROS_DIR } from './foto-nosotros-multer.config';

const CONFIG_ID = 1;

type Cliente = Prisma.TransactionClient | PrismaService;

export interface CotizacionDolarApi {
  compra: number;
  venta: number;
  fechaActualizacion: string;
}

@Injectable()
export class ConfiguracionService {
  constructor(private readonly prisma: PrismaService) {}

  async get() {
    return this.prisma.configuracion.findUniqueOrThrow({
      where: { id: CONFIG_ID },
    });
  }

  // Para la landing pública (§ PublicModule) — select acotado a los campos
  // de contacto, nunca la fila completa (que tiene ipc/icl/dolarReferencia/
  // honorarios*, nada de eso es para mostrar afuera).
  async getContactoPublico() {
    const c = await this.prisma.configuracion.findUniqueOrThrow({
      where: { id: CONFIG_ID },
      select: {
        publicoWhatsapp: true,
        publicoTelefono: true,
        publicoEmail: true,
        publicoInstagramUrl: true,
        publicoDireccion: true,
        publicoMatricula: true,
        publicoFotoNosotrosUrl: true,
      },
    });
    return {
      whatsapp: c.publicoWhatsapp,
      telefono: c.publicoTelefono,
      email: c.publicoEmail,
      instagramUrl: c.publicoInstagramUrl,
      direccion: c.publicoDireccion,
      matricula: c.publicoMatricula,
      fotoNosotrosUrl: c.publicoFotoNosotrosUrl || null,
    };
  }

  // Reemplaza la foto de la sección "Nosotros" de la landing — si había una
  // anterior, se borra del disco (si ya no está ahí por algún motivo, no
  // hace falta que la operación falle por eso).
  async actualizarFotoNosotros(archivo: Express.Multer.File) {
    const actual = await this.prisma.configuracion.findUniqueOrThrow({
      where: { id: CONFIG_ID },
      select: { publicoFotoNosotrosUrl: true },
    });
    if (actual.publicoFotoNosotrosUrl) {
      await unlink(join(FOTO_NOSOTROS_DIR, actual.publicoFotoNosotrosUrl.split('/').pop()!)).catch(() => {});
    }

    // Mismo recorte/recompresión que las fotos de propiedad (1080x1350,
    // JPEG) — la caja de "Nosotros" usa la misma relación 4:5 en CSS.
    const procesada = await procesarFotoParaTarjeta(archivo.buffer);
    if (!existsSync(FOTO_NOSOTROS_DIR)) mkdirSync(FOTO_NOSOTROS_DIR, { recursive: true });
    const nombreArchivo = `${randomUUID()}.jpg`;
    await writeFile(join(FOTO_NOSOTROS_DIR, nombreArchivo), procesada);

    return this.prisma.configuracion.update({
      where: { id: CONFIG_ID },
      data: { publicoFotoNosotrosUrl: `/uploads/configuracion/${nombreArchivo}` },
    });
  }

  // Cotización del dólar oficial en vivo (dolarapi.com, sin necesidad de
  // API key) — el valor de referencia sigue siendo el que el usuario guarda
  // en Configuración; esto solo evita que lo tenga que tipear a mano cada día.
  async cotizacionDolar(): Promise<CotizacionDolarApi> {
    const res = await fetch('https://dolarapi.com/v1/dolares/oficial');
    if (!res.ok) {
      throw new Error(`dolarapi.com respondió ${res.status}`);
    }
    const data = (await res.json()) as CotizacionDolarApi;
    return { compra: data.compra, venta: data.venta, fechaActualizacion: data.fechaActualizacion };
  }

  async update(dto: UpdateConfiguracionDto) {
    return this.prisma.configuracion.update({
      where: { id: CONFIG_ID },
      data: dto,
    });
  }

  // Numeración atómica de comprobantes (§2.10, §3.7): cada emisión reserva
  // el número vigente y avanza el contador en la misma transacción, para que
  // dos comprobantes nunca puedan salir con el mismo número. Se acepta un
  // `tx` opcional para participar de la transacción del módulo que emite
  // (Factura, Recibo, Liquidación) — si esa transacción falla, el contador
  // también se revierte.
  async siguienteNumeroFactura(tx: Cliente = this.prisma): Promise<number> {
    const actualizado = await tx.configuracion.update({
      where: { id: CONFIG_ID },
      data: { proximoNumeroFactura: { increment: 1 } },
    });
    return actualizado.proximoNumeroFactura - 1;
  }

  async siguienteNumeroRecibo(tx: Cliente = this.prisma): Promise<number> {
    const actualizado = await tx.configuracion.update({
      where: { id: CONFIG_ID },
      data: { proximoNumeroRecibo: { increment: 1 } },
    });
    return actualizado.proximoNumeroRecibo - 1;
  }

  async siguienteNumeroLiquidacion(tx: Cliente = this.prisma): Promise<number> {
    const actualizado = await tx.configuracion.update({
      where: { id: CONFIG_ID },
      data: { proximoNumeroLiquidacion: { increment: 1 } },
    });
    return actualizado.proximoNumeroLiquidacion - 1;
  }
}

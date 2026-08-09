import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { RolUsuario } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateIntegranteDto } from './dto/update-integrante.dto';

const SALT_ROUNDS = 12;

const SELECT_CON_USUARIO = {
  id: true,
  nombre: true,
  usuarioId: true,
  usuario: { select: { id: true, email: true, activo: true } },
} as const;

@Injectable()
export class IntegrantesEquipoService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.integranteEquipo.findMany({
      orderBy: { nombre: 'asc' },
      select: SELECT_CON_USUARIO,
    });
  }

  create(nombre: string) {
    return this.prisma.integranteEquipo.create({ data: { nombre } });
  }

  // Al quitar a alguien de la lista, lo ya asignado conserva el nombre
  // (§2.10): no se borra en cascada la referencia, solo se libera el
  // registro del directorio del equipo. Si tenía login (usuarioId), el
  // Usuario en sí queda huérfano (onDelete: SetNull) — no se borra, pero
  // pierde su vínculo con el roster.
  remove(id: string) {
    return this.prisma.integranteEquipo.delete({ where: { id } });
  }

  // Da o edita el acceso al panel de un integrante del roster: si todavía
  // no tiene Usuario vinculado, crea uno (rol EQUIPO — ver §restricción de
  // rutas en el admin); si ya lo tiene, actualiza email/nombre/password
  // sobre ese mismo Usuario en vez de crear uno nuevo.
  async update(id: string, dto: UpdateIntegranteDto) {
    const integrante = await this.prisma.integranteEquipo.findUnique({ where: { id } });
    if (!integrante) throw new NotFoundException('Integrante no encontrado.');

    if (dto.email !== undefined || dto.password !== undefined) {
      if (integrante.usuarioId) {
        if (dto.email !== undefined) {
          const existente = await this.prisma.usuario.findUnique({ where: { email: dto.email } });
          if (existente && existente.id !== integrante.usuarioId) {
            throw new ConflictException('Ya existe un usuario con ese email.');
          }
        }
        await this.prisma.usuario.update({
          where: { id: integrante.usuarioId },
          data: {
            ...(dto.nombre !== undefined ? { nombre: dto.nombre } : {}),
            ...(dto.email !== undefined ? { email: dto.email } : {}),
            ...(dto.password ? { passwordHash: await bcrypt.hash(dto.password, SALT_ROUNDS) } : {}),
          },
        });
      } else {
        if (!dto.email || !dto.password) {
          throw new BadRequestException('Para dar acceso hace falta email y contraseña.');
        }
        const existente = await this.prisma.usuario.findUnique({ where: { email: dto.email } });
        if (existente) throw new ConflictException('Ya existe un usuario con ese email.');
        const usuario = await this.prisma.usuario.create({
          data: {
            nombre: dto.nombre ?? integrante.nombre,
            email: dto.email,
            passwordHash: await bcrypt.hash(dto.password, SALT_ROUNDS),
            rol: RolUsuario.EQUIPO,
          },
        });
        await this.prisma.integranteEquipo.update({ where: { id }, data: { usuarioId: usuario.id } });
      }
    }

    if (dto.nombre !== undefined) {
      await this.prisma.integranteEquipo.update({ where: { id }, data: { nombre: dto.nombre } });
    }

    return this.prisma.integranteEquipo.findUnique({ where: { id }, select: SELECT_CON_USUARIO });
  }

  async setAccesoActivo(id: string, activo: boolean) {
    const integrante = await this.prisma.integranteEquipo.findUnique({ where: { id } });
    if (!integrante?.usuarioId) {
      throw new BadRequestException('Este integrante no tiene acceso configurado.');
    }
    await this.prisma.usuario.update({ where: { id: integrante.usuarioId }, data: { activo } });
    return this.prisma.integranteEquipo.findUnique({ where: { id }, select: SELECT_CON_USUARIO });
  }
}

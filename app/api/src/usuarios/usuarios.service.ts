import { Injectable, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RolUsuario } from '@prisma/client';
import { CreateUsuarioDto } from './dto/create-usuario.dto';

const SALT_ROUNDS = 12;

@Injectable()
export class UsuariosService {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string) {
    return this.prisma.usuario.findUnique({ where: { email } });
  }

  async findAll() {
    return this.prisma.usuario.findMany({
      select: {
        id: true,
        nombre: true,
        email: true,
        rol: true,
        activo: true,
        createdAt: true,
      },
      orderBy: { nombre: 'asc' },
    });
  }

  async create(dto: CreateUsuarioDto) {
    const existente = await this.findByEmail(dto.email);
    if (existente) {
      throw new ConflictException('Ya existe un usuario con ese email.');
    }
    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const usuario = await this.prisma.usuario.create({
      data: {
        nombre: dto.nombre,
        email: dto.email,
        passwordHash,
        rol: dto.rol ?? RolUsuario.EQUIPO,
      },
    });
    const { passwordHash: _omit, ...seguro } = usuario;
    return seguro;
  }

  async setActivo(id: string, activo: boolean) {
    return this.prisma.usuario.update({ where: { id }, data: { activo } });
  }
}

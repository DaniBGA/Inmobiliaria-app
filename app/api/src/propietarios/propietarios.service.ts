import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePropietarioDto } from './dto/create-propietario.dto';
import { UpdatePropietarioDto } from './dto/update-propietario.dto';

// Umbral de la etiqueta automática "Grandes Activos" (§2.9, §5.9): más de
// una propiedad asociada. Se calcula al leer, no se almacena.
const UMBRAL_GRANDES_ACTIVOS = 1;

@Injectable()
export class PropietariosService {
  constructor(private readonly prisma: PrismaService) {}

  private conEtiqueta<T extends { propiedades: unknown[] }>(propietario: T) {
    return {
      ...propietario,
      grandesActivos: propietario.propiedades.length > UMBRAL_GRANDES_ACTIVOS,
    };
  }

  async findAll() {
    const propietarios = await this.prisma.propietario.findMany({
      include: { propiedades: { select: { id: true } } },
      orderBy: { nombre: 'asc' },
    });
    return propietarios.map((p) => this.conEtiqueta(p));
  }

  async findOne(id: string) {
    const propietario = await this.prisma.propietario.findUniqueOrThrow({
      where: { id },
      include: {
        propiedades: {
          include: { inquilino: true, venta: true },
        },
      },
    });
    return this.conEtiqueta(propietario);
  }

  create(dto: CreatePropietarioDto) {
    return this.prisma.propietario.create({ data: dto });
  }

  update(id: string, dto: UpdatePropietarioDto) {
    return this.prisma.propietario.update({ where: { id }, data: dto });
  }

  remove(id: string) {
    return this.prisma.propietario.delete({ where: { id } });
  }
}

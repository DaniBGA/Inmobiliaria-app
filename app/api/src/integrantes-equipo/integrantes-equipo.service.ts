import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class IntegrantesEquipoService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.integranteEquipo.findMany({ orderBy: { nombre: 'asc' } });
  }

  create(nombre: string) {
    return this.prisma.integranteEquipo.create({ data: { nombre } });
  }

  // Al quitar a alguien de la lista, lo ya asignado conserva el nombre
  // (§2.10): no se borra en cascada la referencia, solo se libera el
  // registro del directorio del equipo.
  remove(id: string) {
    return this.prisma.integranteEquipo.delete({ where: { id } });
  }
}

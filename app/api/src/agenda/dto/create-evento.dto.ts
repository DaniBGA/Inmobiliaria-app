import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { TipoEvento } from '@prisma/client';

export class CreateEventoDto {
  @IsDateString()
  fecha: string;

  @IsEnum(TipoEvento)
  tipo: TipoEvento;

  @IsString()
  titulo: string;

  @IsOptional()
  @IsString()
  clienteId?: string;

  @IsOptional()
  @IsString()
  propiedadId?: string;
}

import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PrioridadIncidencia } from '@prisma/client';

// Edición de campos generales — estado, proveedor y resolución van por
// endpoints dedicados (asignarProveedor / resolver / reabrir).
export class UpdateIncidenciaDto {
  @IsOptional()
  @IsString()
  titulo?: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsString()
  rubro?: string;

  @IsOptional()
  @IsEnum(PrioridadIncidencia)
  prioridad?: PrioridadIncidencia;

  @IsOptional()
  @IsString()
  reportadaPor?: string;

  @IsOptional()
  @IsString()
  notas?: string;
}

import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsOptional, IsString, ValidateNested } from 'class-validator';
import { PrioridadIncidencia } from '@prisma/client';
import { ProveedorNuevoDto } from './proveedor-nuevo.dto';

export class CreateIncidenciaDto {
  @IsString()
  propiedadId: string;

  @IsString()
  titulo: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsString()
  rubro: string;

  @IsOptional()
  @IsEnum(PrioridadIncidencia)
  prioridad?: PrioridadIncidencia;

  @IsOptional()
  @IsString()
  reportadaPor?: string;

  @IsOptional()
  @IsString()
  notas?: string;

  @IsOptional()
  @IsDateString()
  fechaApertura?: string;

  // Alta de proveedor desde la incidencia (§2.5): uno de los dos, opcional.
  @IsOptional()
  @IsString()
  proveedorId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ProveedorNuevoDto)
  proveedorNuevo?: ProveedorNuevoDto;
}

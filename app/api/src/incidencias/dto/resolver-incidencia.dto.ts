import { IsDateString, IsEnum, IsNumber, IsOptional, Min } from 'class-validator';
import { DestinoGasto } from '@prisma/client';

export class ResolverIncidenciaDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  costo?: number;

  @IsOptional()
  @IsEnum(DestinoGasto)
  quienPagaCosto?: DestinoGasto;

  @IsOptional()
  @IsDateString()
  fechaCierre?: string;
}

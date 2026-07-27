import { IsDateString, IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { Moneda, TipoMovimientoCaja } from '@prisma/client';

export class UpdateMovimientoDto {
  @IsOptional()
  @IsDateString()
  fecha?: string;

  @IsOptional()
  @IsEnum(TipoMovimientoCaja)
  tipo?: TipoMovimientoCaja;

  @IsOptional()
  @IsEnum(Moneda)
  moneda?: Moneda;

  @IsOptional()
  @IsNumber()
  monto?: number;

  @IsOptional()
  @IsString()
  concepto?: string;

  @IsOptional()
  @IsString()
  categoria?: string;

  @IsOptional()
  @IsString()
  medio?: string;

  @IsOptional()
  @IsString()
  referencia?: string;
}

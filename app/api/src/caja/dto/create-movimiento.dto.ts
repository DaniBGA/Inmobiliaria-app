import { IsDateString, IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { Moneda, TipoMovimientoCaja } from '@prisma/client';

export class CreateMovimientoDto {
  @IsDateString()
  fecha: string;

  @IsEnum(TipoMovimientoCaja)
  tipo: TipoMovimientoCaja;

  @IsEnum(Moneda)
  moneda: Moneda;

  @IsNumber()
  monto: number;

  @IsString()
  concepto: string;

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

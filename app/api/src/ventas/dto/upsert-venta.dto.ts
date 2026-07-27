import { IsBoolean, IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { EstadoVenta, MonedaVenta } from '@prisma/client';

export class UpsertVentaDto {
  @IsNumber()
  @Min(0)
  precio: number;

  @IsEnum(MonedaVenta)
  moneda: MonedaVenta;

  @IsOptional()
  @IsEnum(EstadoVenta)
  estado?: EstadoVenta;

  @IsOptional()
  @IsBoolean()
  publicada?: boolean;

  @IsOptional()
  @IsDateString()
  cierreEstimado?: string;

  @IsOptional()
  @IsNumber()
  mejorOferta?: number;

  // Obligatorio si estado = VENDIDA_POR_TERCEROS (validado en el servicio,
  // no acá, porque depende del valor de otro campo)
  @IsOptional()
  @IsString()
  vendidaPorTercerosDetalle?: string;
}

import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { MedioPago } from '@prisma/client';

export class UpdatePagoDto {
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  monto?: number;

  @IsOptional()
  @IsDateString()
  fecha?: string;

  @IsOptional()
  @IsEnum(MedioPago)
  medio?: MedioPago;

  @IsOptional()
  @IsString()
  comprobante?: string;

  @IsOptional()
  @IsString()
  observaciones?: string;
}

import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Matches, Min } from 'class-validator';
import { MedioPago } from '@prisma/client';

export class CreatePagoDto {
  // "YYYY-MM" — mes al que corresponde el cobro (puede diferir del mes de la fecha de pago)
  @Matches(/^\d{4}-\d{2}$/)
  mes: string;

  @IsNumber()
  @Min(0.01)
  monto: number;

  @IsDateString()
  fecha: string;

  @IsEnum(MedioPago)
  medio: MedioPago;

  @IsOptional()
  @IsString()
  comprobante?: string;

  @IsOptional()
  @IsString()
  observaciones?: string;
}

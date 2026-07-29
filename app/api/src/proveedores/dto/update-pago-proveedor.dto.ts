import { IsDateString, IsNumber, IsOptional, Min } from 'class-validator';

export class UpdatePagoProveedorDto {
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  monto?: number;

  @IsOptional()
  @IsDateString()
  fecha?: string;
}

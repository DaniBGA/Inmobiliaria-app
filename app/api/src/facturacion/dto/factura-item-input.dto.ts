import { IsNumber, IsOptional, IsString } from 'class-validator';

export class FacturaItemInputDto {
  @IsString()
  descripcion: string;

  @IsNumber()
  monto: number;

  @IsOptional()
  @IsString()
  numeroLiquidacion?: string;
}

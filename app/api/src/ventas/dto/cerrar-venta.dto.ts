import { IsDateString, IsNumber, IsOptional, Min } from 'class-validator';

export class CerrarVentaDto {
  @IsDateString()
  fecha: string;

  // Si el cierre fue a un precio distinto del publicado
  @IsOptional()
  @IsNumber()
  @Min(0)
  precioFinal?: number;
}

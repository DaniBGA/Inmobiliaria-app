import { IsDateString, IsNumber, IsOptional, Min } from 'class-validator';

export class CerrarVentaDto {
  @IsDateString()
  fecha: string;

  // Si el cierre fue a un precio distinto del publicado
  @IsOptional()
  @IsNumber()
  @Min(0)
  precioFinal?: number;

  // Corrección manual del monto de comisión (editar desde Caja, §3.8): si se
  // manda, reemplaza el cálculo automático precio×porcentaje para esta venta.
  @IsOptional()
  @IsNumber()
  @Min(0)
  comisionManual?: number;
}

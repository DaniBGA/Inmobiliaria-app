import { Type } from 'class-transformer';
import { IsArray, IsOptional, ValidateNested } from 'class-validator';
import { LiquidacionDetalleInputDto } from './liquidacion-detalle-input.dto';

export class GenerarLiquidacionDto {
  // Si no se manda, se recalcula desde la factura del mes / los ítems
  // predeterminados (comportamiento anterior, sin edición manual) — se usa
  // cuando el usuario edita los montos de "Cobrado" antes de confirmar.
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LiquidacionDetalleInputDto)
  detalle?: LiquidacionDetalleInputDto[];
}

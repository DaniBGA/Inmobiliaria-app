import { Type } from 'class-transformer';
import { IsArray, IsOptional, ValidateNested } from 'class-validator';
import { LiquidacionDetalleInputDto } from './liquidacion-detalle-input.dto';
import { FacturaItemInputDto } from '../../facturacion/dto/factura-item-input.dto';

export class GenerarLiquidacionDto {
  // Si no se manda, se recalcula desde la factura del mes / los ítems
  // predeterminados (comportamiento anterior, sin edición manual) — se usa
  // cuando el usuario edita los montos de "Cobrado" antes de confirmar.
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LiquidacionDetalleInputDto)
  detalle?: LiquidacionDetalleInputDto[];

  // Total de servicios de TODAS las propiedades del propietario (incluidas
  // las alquiladas por la inmobiliaria, ver comentario en
  // LiquidacionAjusteServicio en schema.prisma) — se cargan a mano cada vez,
  // sin Propiedad ni Factura detrás (reusa FacturaItemInputDto por
  // descripción+monto+N° de liquidación del servicio, § pedido del usuario
  // 2026-09-19). Restan directo de `netoAGirar`; es el único descuento real
  // de servicios, sin tocar el `neto` de ninguna propiedad puntual.
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FacturaItemInputDto)
  ajustesServicios?: FacturaItemInputDto[];
}

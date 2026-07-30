import { Type } from 'class-transformer';
import { IsArray, IsString, ValidateNested } from 'class-validator';
import { FacturaItemInputDto } from '../../facturacion/dto/factura-item-input.dto';

export class LiquidacionDetalleInputDto {
  @IsString()
  propiedadId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FacturaItemInputDto)
  items: FacturaItemInputDto[];
}

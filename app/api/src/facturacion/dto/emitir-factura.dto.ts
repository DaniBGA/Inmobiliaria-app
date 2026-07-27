import { Type } from 'class-transformer';
import { IsArray, IsOptional, Matches, ValidateNested } from 'class-validator';
import { FacturaItemInputDto } from './factura-item-input.dto';

export class EmitirFacturaDto {
  @Matches(/^\d{4}-\d{2}$/)
  mes: string;

  // Si no se manda, se usan los ítems predeterminados (§3.5)
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FacturaItemInputDto)
  items?: FacturaItemInputDto[];
}

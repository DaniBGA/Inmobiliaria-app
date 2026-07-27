import { Type } from 'class-transformer';
import { IsDateString, IsOptional, IsString, ValidateNested } from 'class-validator';
import { ProveedorNuevoDto } from './proveedor-nuevo.dto';

export class AsignarProveedorDto {
  @IsOptional()
  @IsString()
  proveedorId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ProveedorNuevoDto)
  proveedorNuevo?: ProveedorNuevoDto;

  // Fecha de visita del proveedor (§2.7); si no se manda, se precarga hoy.
  @IsOptional()
  @IsDateString()
  fechaEjecucion?: string;
}

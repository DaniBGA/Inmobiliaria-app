import { IsOptional, IsString } from 'class-validator';

export class ProveedorNuevoDto {
  @IsString()
  nombre: string;

  // Si no se completa, hereda el rubro de la incidencia (§2.5)
  @IsOptional()
  @IsString()
  rubro?: string;

  @IsOptional()
  @IsString()
  telefono?: string;
}

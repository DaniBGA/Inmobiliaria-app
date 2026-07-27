import { IsDateString, IsOptional } from 'class-validator';

export class RegistrarPagoProveedorDto {
  @IsOptional()
  @IsDateString()
  fecha?: string;
}
